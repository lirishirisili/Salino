import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { DuplicateReason, ItemCategory, ItemUnit, type DuplicateMatch, type ShoppingItem } from '../../src/models';
import { detectCategory, findDuplicate } from '../../src/services';
import {
  ItemNameAutocompleteField,
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import {
  BorderRadius,
  Layout,
  Typography,
  useIsDark,
  useThemeColors,
} from '../../src/theme';
import { HouseholdHistoryIndex, AutocompleteSuggestion } from '../../src/services/householdHistoryIndex';
import { suggestAutocomplete } from '../../src/services/itemNameAutocompleteEngine';
import { warmUpCatalog } from '../../src/services/categoryKeywordCatalog';

const ALL_CATEGORIES = Object.values(ItemCategory);
const ALL_UNITS = Object.values(ItemUnit);

const AUTOCOMPLETE_DEBOUNCE_MS = 80;
const NAME_DERIVATIVES_DEBOUNCE_MS = 280;

type SaveOverrides = {
  name?: string;
  quantity?: number;
  unit?: ItemUnit | null;
  category?: ItemCategory;
};

export default function AddItemScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    prefillName?: string;
    prefillQuantity?: string;
    prefillUnit?: string;
    prefillCategory?: string;
    prefillNote?: string;
  }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDark();

  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { addItem, updateItem, activeItems, boughtItems, recurringItems } = useShoppingStore();

  const [name, setName] = useState(params.prefillName || '');
  const [quantity, setQuantity] = useState(params.prefillQuantity || '1');
  const [unit, setUnit] = useState<ItemUnit | null>(
    (params.prefillUnit as ItemUnit) || null
  );
  const [category, setCategory] = useState<ItemCategory>(
    (params.prefillCategory as ItemCategory) || ItemCategory.OTHER
  );
  const [note, setNote] = useState(params.prefillNote || '');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalDays, setIntervalDays] = useState('7');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  const [duplicateDialog, setDuplicateDialog] = useState<
    null | { duplicateMatch: DuplicateMatch; addQuantity: number; overrides?: SaveOverrides }
  >(null);

  // If the soft keyboard is open (e.g. user typing), dismiss it when we show the dialog,
  // so the dialog can fully fit on screen.
  useEffect(() => {
    if (duplicateDialog != null) {
      Keyboard.dismiss();
    }
  }, [duplicateDialog]);

  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isAutocompleteVisible, setIsAutocompleteVisible] = useState(false);
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derivativesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const historyIndex = useMemo(
    () => HouseholdHistoryIndex.from(activeItems, boughtItems, recurringItems),
    [activeItems, boughtItems, recurringItems],
  );

  useEffect(() => {
    warmUpCatalog();
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      setIsAutocompleteVisible(false);
    });
    return () => sub.remove();
  }, []);

  const refreshAutocomplete = useCallback(
    (text: string) => {
      if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
      autocompleteTimerRef.current = setTimeout(() => {
        const trimmed = text.trim();
        if (!trimmed) {
          setAutocompleteSuggestions([]);
          setIsAutocompleteVisible(false);
          return;
        }
        const results = suggestAutocomplete(trimmed, historyIndex);
        setAutocompleteSuggestions(results);
        setIsAutocompleteVisible(results.length > 0);
      }, AUTOCOMPLETE_DEBOUNCE_MS);
    },
    [historyIndex],
  );

  const scheduleNameDerivatives = useCallback(
    (text: string) => {
      if (derivativesTimerRef.current) clearTimeout(derivativesTimerRef.current);
      derivativesTimerRef.current = setTimeout(() => {
        if (text.trim().length >= 2) {
          const detected = detectCategory(text);
          if (detected) {
            setCategory((prev) => {
              if (detected !== prev) {
                setAutoDetected(true);
                return detected;
              }
              return prev;
            });
          } else {
            setAutoDetected(false);
          }
        } else {
          setAutoDetected(false);
        }
      }, NAME_DERIVATIVES_DEBOUNCE_MS);
    },
    [],
  );

  const handleNameChange = useCallback(
    (text: string) => {
      setName(text);
      setError(null);
      refreshAutocomplete(text);
      scheduleNameDerivatives(text);
    },
    [refreshAutocomplete, scheduleNameDerivatives],
  );

  const performSave = useCallback(
    async (overrides?: {
      name?: string;
      quantity?: number;
      unit?: ItemUnit | null;
      category?: ItemCategory;
    }) => {
      const itemName = (overrides?.name ?? name).trim();
      if (!itemName) {
        setError('empty_name');
        return;
      }
      if (!activeHouseholdId || isSaving) return;

      const itemQuantity = overrides?.quantity ?? (parseFloat(quantity) || 1);
      const itemUnit = overrides?.unit !== undefined ? overrides.unit : unit;
      const itemCategory = overrides?.category ?? category;

      setIsSaving(true);
      setError(null);
      try {
        await addItem(activeHouseholdId, {
          name: itemName,
          quantity: itemQuantity,
          unit: itemUnit,
          category: itemCategory,
          note: note.trim(),
          isUrgent,
          isFavorite: false,
          boughtBy: null,
          boughtByName: null,
        });
        if (isRecurring) {
          const { recurringRepository } = await import('../../src/repositories');
          await recurringRepository.upsertRecurringItem(activeHouseholdId, {
            name: itemName,
            quantity: itemQuantity,
            unit: itemUnit,
            category: itemCategory,
            note: note.trim(),
            intervalDays: parseInt(intervalDays) || 7,
          });
        }
        router.back();
      } catch {
        setError('generic');
      } finally {
        setIsSaving(false);
      }
    },
    [
      activeHouseholdId,
      addItem,
      category,
      intervalDays,
      isRecurring,
      isSaving,
      isUrgent,
      name,
      note,
      quantity,
      unit,
    ],
  );

  const mergeWithExisting = useCallback(
    async (existing: ShoppingItem, addQuantity: number) => {
      if (!activeHouseholdId || isSaving) return;
      const mergedNote = existing.note.trim() ? existing.note : note.trim();
      const mergedQuantity = existing.quantity + addQuantity;

      setIsSaving(true);
      setError(null);
      try {
        await updateItem(activeHouseholdId, {
          ...existing,
          quantity: mergedQuantity,
          note: mergedNote,
        });
        if (isRecurring) {
          const { recurringRepository } = await import('../../src/repositories');
          await recurringRepository.upsertRecurringItem(activeHouseholdId, {
            name: existing.name,
            quantity: mergedQuantity,
            unit: existing.unit,
            category: existing.category,
            note: mergedNote,
            intervalDays: parseInt(intervalDays) || 7,
          });
        }
        router.back();
      } catch {
        setError('generic');
      } finally {
        setIsSaving(false);
      }
    },
    [activeHouseholdId, intervalDays, isRecurring, isSaving, note, updateItem],
  );

  const attemptSave = useCallback(
    (overrides?: SaveOverrides) => {
      const itemName = (overrides?.name ?? name).trim();
      if (!itemName) {
        setError('empty_name');
        return;
      }
      if (!activeHouseholdId || isSaving) return;

      const itemQuantity = overrides?.quantity ?? (parseFloat(quantity) || 1);
      const dup = findDuplicate(itemName, activeItems);
      if (dup?.reason === DuplicateReason.EXACT_DUPLICATE) {
        setDuplicateDialog({ duplicateMatch: dup, addQuantity: itemQuantity, overrides });
        return;
      }

      void performSave(overrides);
    },
    [
      activeHouseholdId,
      activeItems,
      isSaving,
      mergeWithExisting,
      name,
      performSave,
      quantity,
      t,
    ],
  );

  const handleSave = () => {
    attemptSave();
  };

  const handleSuggestionSelected = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      if (derivativesTimerRef.current) clearTimeout(derivativesTimerRef.current);
      if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
      setIsAutocompleteVisible(false);
      setAutocompleteSuggestions([]);

      let itemCategory = suggestion.category ?? category;
      if (!suggestion.category && suggestion.source === 'CATEGORY_CATALOG') {
        const detected = detectCategory(suggestion.displayName);
        if (detected) {
          itemCategory = detected;
        }
      }

      attemptSave({
        name: suggestion.displayName,
        quantity: suggestion.quantity ?? (parseFloat(quantity) || 1),
        unit:
          suggestion.unit !== undefined && suggestion.unit !== null
            ? suggestion.unit
            : unit,
        category: itemCategory,
      });
    },
    [attemptSave, category, quantity, unit],
  );

  const errorText =
    error === 'empty_name'
      ? t('item_error_empty_name')
      : error === 'generic'
      ? t('error_generic')
      : null;

  const duplicateDialogMaxHeight = Math.min(520, Math.max(240, windowHeight * 0.58));

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('add_item_title')} onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.inner}>
            <SalinoSurfaceCard>
              <Text
                style={[
                  Typography.headlineMedium,
                  { color: colors.onSurface } as any,
                ]}
              >
                {t('item_name_label')}
              </Text>
              <View style={{ height: 6 }} />
              <Text
                style={[
                  Typography.bodyMedium,
                  { color: colors.onSurfaceVariant } as any,
                ]}
              >
                {t('item_name_hint')}
              </Text>
              <View style={{ height: 20 }} />

              <ItemNameAutocompleteField
                value={name}
                onChangeText={handleNameChange}
                suggestions={autocompleteSuggestions}
                isAutocompleteVisible={isAutocompleteVisible}
                onSuggestionSelected={handleSuggestionSelected}
                label={t('item_name_label')}
                placeholder={t('item_name_hint')}
                isError={error === 'empty_name'}
                onSubmitEditing={handleSave}
                suggestionsMaxHeight={320}
              />
              {errorText && error === 'empty_name' && (
                <Text
                  style={[
                    Typography.bodySmall,
                    { color: colors.error, marginTop: 4, marginLeft: 8 } as any,
                  ]}
                >
                  {errorText}
                </Text>
              )}

              <View pointerEvents={isAutocompleteVisible ? 'none' : 'auto'}>
              <View style={{ height: 16 }} />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  label={t('item_quantity_label')}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  outlineStyle={{ borderRadius: Layout.inputCorner }}
                  style={[styles.input, { flex: 1 }]}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleSave}
                  editable={!isAutocompleteVisible}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      Typography.labelMedium,
                      { color: colors.onSurfaceVariant, marginBottom: 6 } as any,
                    ]}
                  >
                    {t('item_unit_label')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {ALL_UNITS.map((u) => {
                      const selected = unit === u;
                      return (
                        <Chip
                          key={u}
                          label={t(`unit_${u.toLowerCase()}`)}
                          selected={selected}
                          onPress={() => setUnit(selected ? null : u)}
                          colors={colors}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              <View style={{ height: 16 }} />

              <Text
                style={[
                  Typography.labelLarge,
                  { color: colors.onSurface, marginBottom: 8 } as any,
                ]}
              >
                {t('item_category_label')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {ALL_CATEGORIES.map((c) => {
                  const selected = category === c;
                  return (
                    <Chip
                      key={c}
                      label={t(`category_${c.toLowerCase()}`)}
                      selected={selected}
                      onPress={() => {
                        setCategory(c);
                        setAutoDetected(false);
                      }}
                      colors={colors}
                    />
                  );
                })}
              </ScrollView>
              {autoDetected && (
                <Text
                  style={[
                    Typography.bodySmall,
                    { color: colors.primary, marginTop: 8 } as any,
                  ]}
                >
                  {t('category_auto_detected', {
                    category: t(`category_${category.toLowerCase()}`),
                  })}
                </Text>
              )}

              <View style={{ height: 16 }} />

              <TextInput
                value={note}
                onChangeText={setNote}
                label={t('item_note_label')}
                placeholder={t('item_note_hint')}
                mode="outlined"
                multiline
                numberOfLines={3}
                outlineStyle={{ borderRadius: Layout.inputCorner }}
                style={[styles.input, { minHeight: 90 }]}
                editable={!isAutocompleteVisible}
              />

              <View style={{ height: 16 }} />

              <ToggleRow
                title={t('recurring_toggle_title')}
                subtitle={t('recurring_toggle_subtitle')}
                value={isRecurring}
                onValueChange={setIsRecurring}
                color={colors.primary}
              />

              {isRecurring && (
                <>
                  <View style={{ height: 12 }} />
                  <TextInput
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    label={t('recurring_every_days_label')}
                    mode="outlined"
                    keyboardType="number-pad"
                    outlineStyle={{ borderRadius: Layout.inputCorner }}
                    style={styles.input}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={handleSave}
                    editable={!isAutocompleteVisible}
                  />
                </>
              )}

              <View style={{ height: 16 }} />

              <ToggleRow
                title={t('urgent_toggle_title')}
                subtitle={t('urgent_toggle_subtitle')}
                value={isUrgent}
                onValueChange={setIsUrgent}
                color={colors.error}
                leadingIcon="priority-high"
                leadingIconColor={isUrgent ? colors.error : colors.onSurfaceVariant}
              />

              <View style={{ height: 24 }} />

              {errorText && error !== 'empty_name' && (
                <Text
                  style={[
                    Typography.bodySmall,
                    { color: colors.error, marginBottom: 8 } as any,
                  ]}
                >
                  {errorText}
                </Text>
              )}

              <SalinoPrimaryButton
                text={isSaving ? t('item_saving') : t('item_add')}
                onPress={handleSave}
                enabled={!isSaving}
                loading={isSaving}
                leading={
                  <MaterialCommunityIcons name="cart-plus" size={20} color={colors.onPrimary} />
                }
              />
              </View>
            </SalinoSurfaceCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog
          visible={duplicateDialog != null}
          onDismiss={() => setDuplicateDialog(null)}
          style={{ marginHorizontal: 16 }}
        >
          {duplicateDialog != null && (
            <>
              <Dialog.Content style={{ paddingHorizontal: 0, maxHeight: duplicateDialogMaxHeight }}>
                <ScrollView
                  bounces={false}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
                >
                  <SalinoSurfaceCard padding={16}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={26}
                        color={colors.error}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            Typography.titleMedium,
                            { color: colors.onSurface } as any,
                          ]}
                        >
                          {t('duplicate_warning_title')}
                        </Text>
                        <Text
                          style={[
                            Typography.bodyMedium,
                            { color: colors.onSurfaceVariant, marginTop: 6 } as any,
                          ]}
                        >
                          {duplicateDialog.duplicateMatch.item.name} ·{' '}
                          {formatQuantityForDisplay(duplicateDialog.duplicateMatch.item.quantity)}
                        </Text>
                        <Text
                          style={[
                            Typography.bodySmall,
                            { color: colors.onSurfaceVariant, marginTop: 8 } as any,
                          ]}
                        >
                          {t('duplicate_confirm_message', {
                            name: duplicateDialog.duplicateMatch.item.name,
                            quantity: formatQuantityForDisplay(
                              duplicateDialog.duplicateMatch.item.quantity,
                            ),
                          })}
                        </Text>
                      </View>
                    </View>
                  </SalinoSurfaceCard>
                </ScrollView>
              </Dialog.Content>

              <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                <View style={{ width: '100%', gap: 10 }}>
                  <SalinoPrimaryButton
                    text={t('duplicate_merge_action')}
                    onPress={() => {
                      const state = duplicateDialog;
                      setDuplicateDialog(null);
                      if (state)
                        void mergeWithExisting(state.duplicateMatch.item, state.addQuantity);
                    }}
                  />
                  <Button
                    mode="outlined"
                    onPress={() => {
                      const state = duplicateDialog;
                      setDuplicateDialog(null);
                      if (state) void performSave(state.overrides);
                    }}
                    style={{ width: '100%' }}
                  >
                    {t('duplicate_add_anyway')}
                  </Button>
                  <Button onPress={() => setDuplicateDialog(null)} style={{ alignSelf: 'flex-end' }}>
                    {t('cancel')}
                  </Button>
                </View>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </SalinoGradientBackground>
  );
}

function formatQuantityForDisplay(quantity: number): string {
  if (Number.isNaN(quantity) || !Number.isFinite(quantity)) return String(quantity);
  const rounded = Math.round(quantity);
  const isInt = Math.abs(quantity - rounded) < 1e-9;
  return isInt ? String(rounded) : String(quantity);
}

function Chip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 50,
          borderWidth: 1,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          Typography.labelMedium,
          {
            color: selected ? colors.onPrimary : colors.onSurface,
            fontWeight: '600',
          } as any,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  color,
  leadingIcon,
  leadingIconColor,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  color: string;
  leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  leadingIconColor?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {leadingIcon && (
          <MaterialCommunityIcons name={leadingIcon} size={22} color={leadingIconColor ?? colors.onSurfaceVariant} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
            {title}
          </Text>
          <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 2 } as any]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: color, false: colors.outlineVariant }}
        thumbColor={value ? colors.onPrimary : colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.horizontalPadding,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
