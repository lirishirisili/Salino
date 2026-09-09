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
import { useCategoryAutoDetection } from '../../src/hooks/useCategoryAutoDetection';
import { useVoiceInput } from '../../src/hooks/useVoiceInput';
import { ItemCategory, ItemUnit, ShoppingItem } from '../../src/models';
import {
  ItemNameAutocompleteField,
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useIsDark, useThemeColors } from '../../src/theme';
import { HouseholdHistoryIndex, AutocompleteSuggestion } from '../../src/services/householdHistoryIndex';
import { suggestAutocomplete } from '../../src/services/itemNameAutocompleteEngine';
import { warmUpCatalog } from '../../src/services/categoryKeywordCatalog';

const ALL_CATEGORIES = Object.values(ItemCategory);
const ALL_UNITS = Object.values(ItemUnit);

const AUTOCOMPLETE_DEBOUNCE_MS = 80;

export default function EditItemScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDark();
  // Outlined TextInput floating labels paint theme.colors.background behind the
  // text. Match SalinoSurfaceCard so dark mode does not show a black strip.
  const cardSurface = isDark ? colors.surfaceBright : colors.surface;
  const outlinedFieldTheme = useMemo(
    () => ({ colors: { background: cardSurface } }),
    [cardSurface]
  );
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
  const [autoDetected, setAutoDetected] = useState(false);

  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isAutocompleteVisible, setIsAutocompleteVisible] = useState(false);
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    scheduleDetection,
    onManualCategorySelect,
    onSuggestionCategory,
  } = useCategoryAutoDetection({ setCategory, setAutoDetected });

  const { isListening, startListening, stopListening } = useVoiceInput({
    onResult: (parsed) => {
      if (parsed.name) setName(parsed.name);
      if (parsed.quantity) setQuantity(String(parsed.quantity));
      if (parsed.unit) setUnit(parsed.unit);
      if (parsed.name) scheduleDetection(parsed.name);
    },
  });

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

  const handleNameChange = useCallback(
    (text: string) => {
      setName(text);
      setError(null);
      refreshAutocomplete(text);
      scheduleDetection(text);
    },
    [refreshAutocomplete, scheduleDetection],
  );

  const handleSuggestionSelected = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      setName(suggestion.displayName);
      setIsAutocompleteVisible(false);
      setAutocompleteSuggestions([]);
      if (suggestion.category) {
        onSuggestionCategory(suggestion.category);
      }
      if (suggestion.unit !== undefined && suggestion.unit !== null) {
        setUnit(suggestion.unit);
      }
      if (suggestion.quantity) {
        setQuantity(String(suggestion.quantity));
      }
    },
    [onSuggestionCategory],
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
          if (!activeHouseholdId) return;
          try {
            await deleteItem(activeHouseholdId, item.id, item.name);
            router.back();
          } catch {
            Alert.alert('', t('error_generic'));
          }
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
            accessibilityLabel={t('shopping_list_delete')}
            accessibilityRole="button"
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

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
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
                </View>
                <Pressable
                  onPress={isListening ? stopListening : startListening}
                  accessibilityLabel={t('voice_input_action')}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [
                    {
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 50,
                      backgroundColor: isListening ? colors.error : colors.primaryContainer,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isListening ? 'microphone-off' : 'microphone'}
                    size={24}
                    color={isListening ? colors.onError : colors.onPrimaryContainer}
                  />
                </Pressable>
              </View>
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
                  theme={outlinedFieldTheme}
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
                      onPress={() => onManualCategorySelect(c)}
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
                theme={outlinedFieldTheme}
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
