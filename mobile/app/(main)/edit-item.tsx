import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { ItemCategory, ItemUnit, ShoppingItem } from '../../src/models';
import {
  ItemNameAutocompleteField,
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';
import { HouseholdHistoryIndex, AutocompleteSuggestion } from '../../src/services/householdHistoryIndex';
import { suggestAutocomplete } from '../../src/services/itemNameAutocompleteEngine';
import { warmUpCatalog } from '../../src/services/categoryKeywordCatalog';
import { detectCategory } from '../../src/services';

const ALL_CATEGORIES = Object.values(ItemCategory);
const ALL_UNITS = Object.values(ItemUnit);

const AUTOCOMPLETE_DEBOUNCE_MS = 80;
const NAME_DERIVATIVES_DEBOUNCE_MS = 280;

export default function EditItemScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { items, updateItem, deleteItem, activeItems, boughtItems, recurringItems } = useShoppingStore();

  const item = items.find((i) => i.id === itemId);

  const [name, setName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(String(item?.quantity || 1));
  const [unit, setUnit] = useState<ItemUnit | null>(item?.unit ?? null);
  const [category, setCategory] = useState<ItemCategory>(
    (item?.category as ItemCategory) || ItemCategory.OTHER
  );
  const [note, setNote] = useState(item?.note || '');
  const [isUrgent, setIsUrgent] = useState(item?.isUrgent || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isAutocompleteVisible, setIsAutocompleteVisible] = useState(false);
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derivativesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            setCategory((prev) => (detected !== prev ? detected : prev));
          }
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

  const handleSuggestionSelected = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      setName(suggestion.displayName);
      setIsAutocompleteVisible(false);
      setAutocompleteSuggestions([]);
      if (suggestion.category) {
        setCategory(suggestion.category);
      }
      if (suggestion.unit !== undefined && suggestion.unit !== null) {
        setUnit(suggestion.unit);
      }
      if (suggestion.quantity) {
        setQuantity(String(suggestion.quantity));
      }
    },
    [],
  );

  if (!item) {
    return (
      <SalinoGradientBackground plain>
        <SalinoWebInnerTopBar title={t('edit_item_title')} onBack={() => router.back()} />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <Text style={{ color: colors.onSurfaceVariant }}>—</Text>
        </View>
      </SalinoGradientBackground>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('empty_name');
      return;
    }
    if (!activeHouseholdId) return;
    setIsSaving(true);
    try {
      const updated: ShoppingItem = {
        ...item,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit,
        category,
        note: note.trim(),
        isUrgent,
      };
      await updateItem(activeHouseholdId, updated);
      router.back();
    } catch (e) {
      setError('generic');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('', t('shopping_list_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('shopping_list_delete'),
        style: 'destructive',
        onPress: async () => {
          if (activeHouseholdId) {
            await deleteItem(activeHouseholdId, item.id, item.name);
          }
          router.back();
        },
      },
    ]);
  };

  const errorText =
    error === 'empty_name'
      ? t('item_error_empty_name')
      : error === 'generic'
      ? t('error_generic')
      : null;

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar
        title={t('edit_item_title')}
        onBack={() => router.back()}
        actions={
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            style={({ pressed }) => [
              { padding: 8, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="delete-outline" size={24} color={colors.error} />
          </Pressable>
        }
      />
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
              <Text style={[Typography.headlineMedium, { color: colors.onSurface } as any]}>
                {t('edit_item_title')}
              </Text>
              <View style={{ height: 8 }} />
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
                        <ChipBtn
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
                    <ChipBtn
                      key={c}
                      label={t(`category_${c.toLowerCase()}`)}
                      selected={selected}
                      onPress={() => setCategory(c)}
                      colors={colors}
                    />
                  );
                })}
              </ScrollView>

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

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons
                    name="priority-high"
                    size={22}
                    color={isUrgent ? colors.error : colors.onSurfaceVariant}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
                      {t('urgent_toggle_title')}
                    </Text>
                    <Text
                      style={[
                        Typography.bodySmall,
                        { color: colors.onSurfaceVariant, marginTop: 2 } as any,
                      ]}
                    >
                      {t('urgent_toggle_subtitle')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isUrgent}
                  onValueChange={setIsUrgent}
                  trackColor={{ true: colors.error, false: colors.outlineVariant }}
                  thumbColor={isUrgent ? colors.onPrimary : colors.surface}
                />
              </View>

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
                text={isSaving ? t('item_saving') : t('item_save')}
                onPress={handleSave}
                enabled={!isSaving}
                loading={isSaving}
                leading={
                  <MaterialCommunityIcons name="content-save" size={20} color={colors.onPrimary} />
                }
              />
              </View>
            </SalinoSurfaceCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SalinoGradientBackground>
  );
}

function ChipBtn({
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
          { color: selected ? colors.onPrimary : colors.onSurface, fontWeight: '600' } as any,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
