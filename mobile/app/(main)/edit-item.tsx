import React, { useState } from 'react';
import {
  Alert,
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
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';

const ALL_CATEGORIES = Object.values(ItemCategory);
const ALL_UNITS = Object.values(ItemUnit);

export default function EditItemScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { items, updateItem, deleteItem } = useShoppingStore();

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

  if (!item) {
    return (
      <SalinoGradientBackground>
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
    <SalinoGradientBackground>
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
          keyboardShouldPersistTaps="handled"
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

              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
                label={t('item_name_label')}
                mode="outlined"
                outlineStyle={{ borderRadius: Layout.inputCorner }}
                style={styles.input}
                error={error === 'empty_name'}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={handleSave}
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
