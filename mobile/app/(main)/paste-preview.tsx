import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Menu, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useShoppingStore } from '../../src/hooks';
import { useLeaveIfReadOnly } from '../../src/hooks/useHouseholdExpiry';
import { usePastePreviewStore } from '../../src/hooks/usePastePreviewStore';
import { useAddParsedItems } from '../../src/hooks/useAddParsedItems';
import { useUndoBarStore } from '../../src/hooks/useUndoBarStore';
import {
  parseListLocally,
  parseListWithAi,
  type ListDraftItem,
  type ListParseSource,
} from '../../src/services/aiListParser';
import { findDuplicate } from '../../src/services';
import { DuplicateReason, ItemCategory, ItemUnit } from '../../src/models';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';

interface Row extends ListDraftItem {
  key: string;
  included: boolean;
}

const CATEGORIES = Object.values(ItemCategory);
const UNITS: (ItemUnit | null)[] = [null, ...Object.values(ItemUnit)];

let rowSeq = 0;
const toRows = (items: ListDraftItem[]): Row[] =>
  items.map((item) => ({ ...item, key: `r${++rowSeq}`, included: true }));

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
}

/**
 * Preview for a pasted or shared list. The on-device parse shows at once; the
 * free AI worker's answer replaces it a moment later (unless the user already
 * started editing). Nothing is added until "Add N items".
 */
export default function PastePreviewScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  useLeaveIfReadOnly();

  const text = usePastePreviewStore((s) => s.text);
  const source = usePastePreviewStore((s) => s.source);
  const version = usePastePreviewStore((s) => s.version);
  const clearPaste = usePastePreviewStore((s) => s.clear);
  const activeItems = useShoppingStore((s) => s.activeItems);
  const addParsed = useAddParsedItems();
  const showUndo = useUndoBarStore((s) => s.show);

  const [rows, setRows] = useState<Row[]>(() => toRows(text ? parseListLocally(text) : []));
  const [parsing, setParsing] = useState(!!text);
  const [parseSource, setParseSource] = useState<ListParseSource>('local');
  const [notAList, setNotAList] = useState(false);
  const [adding, setAdding] = useState(false);
  const editedRef = useRef(false);

  useEffect(() => {
    if (!text) {
      router.back();
      return;
    }
    const controller = new AbortController();
    editedRef.current = false;
    setRows(toRows(parseListLocally(text)));
    setParsing(true);
    setNotAList(false);
    parseListWithAi(text, { locale: i18n.language, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setParseSource(result.source);
        setNotAList(!!result.notAList);
        // Don't throw away the user's edits for a late AI answer.
        if (!editedRef.current && result.source === 'ai') setRows(toRows(result.items));
      })
      .finally(() => {
        if (!controller.signal.aborted) setParsing(false);
      });
    return () => controller.abort();
    // `version` restarts parsing when new text arrives while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const update = (key: string, patch: Partial<Row>) => {
    editedRef.current = true;
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const included = useMemo(() => rows.filter((r) => r.included && r.name.trim()), [rows]);

  const close = () => {
    clearPaste();
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/shopping-list');
  };

  const handleAdd = async () => {
    if (included.length === 0 || adding) return;
    setAdding(true);
    try {
      const result = await addParsed(included);
      showUndo(t('quick_add_bulk_added', { count: included.length }), result.undo);
      close();
    } catch {
      Alert.alert('', t('error_generic'));
    } finally {
      setAdding(false);
    }
  };

  const title = source === 'share' ? t('paste_preview_shared_title') : t('paste_preview_title');

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={title} onBack={close} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        >
          <View style={styles.inner}>
            <View style={styles.statusRow} accessibilityLiveRegion="polite">
              {parsing ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant } as any]}>
                    {t('paste_preview_parsing')}
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={parseSource === 'ai' ? 'creation' : 'cellphone'}
                    size={16}
                    color={colors.onSurfaceVariant}
                  />
                  <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, flex: 1 } as any]}>
                    {notAList
                      ? t('paste_preview_not_a_list')
                      : parseSource === 'ai'
                        ? t('paste_preview_source_ai')
                        : t('paste_preview_source_local')}
                  </Text>
                </>
              )}
            </View>

            {rows.length === 0 && !parsing ? (
              <SalinoSurfaceCard>
                <Text style={[Typography.bodyMedium, { color: colors.onSurfaceVariant } as any]}>
                  {t('paste_preview_empty')}
                </Text>
              </SalinoSurfaceCard>
            ) : (
              <SalinoSurfaceCard padding={6}>
                {rows.map((row, index) => (
                  <DraftRow
                    key={row.key}
                    row={row}
                    showDivider={index > 0}
                    onList={
                      findDuplicate(row.name, activeItems)?.reason === DuplicateReason.EXACT_DUPLICATE
                    }
                    onChange={(patch) => update(row.key, patch)}
                  />
                ))}
              </SalinoSurfaceCard>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <SalinoPrimaryButton
            text={t('paste_preview_add', { count: included.length })}
            onPress={() => void handleAdd()}
            enabled={included.length > 0 && !adding}
            loading={adding}
            leading={<MaterialCommunityIcons name="cart-plus" size={20} color={colors.onPrimary} />}
          />
        </View>
      </KeyboardAvoidingView>
    </SalinoGradientBackground>
  );
}

function DraftRow({
  row,
  showDivider,
  onList,
  onChange,
}: {
  row: Row;
  showDivider: boolean;
  onList: boolean;
  onChange: (patch: Partial<Row>) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [categoryMenu, setCategoryMenu] = useState(false);
  const [unitMenu, setUnitMenu] = useState(false);
  const dim = !row.included;
  const unitLabel = (u: ItemUnit | null) => (u ? t(`unit_${u.toLowerCase()}`) : t('paste_preview_no_unit'));

  return (
    <View>
      {showDivider && <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '80' }]} />}
      <View style={[styles.row, dim && { opacity: 0.45 }]}>
        <Pressable
          onPress={() => onChange({ included: !row.included })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: row.included }}
          accessibilityLabel={row.name}
          hitSlop={8}
          style={styles.check}
        >
          <MaterialCommunityIcons
            name={row.included ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={row.included ? colors.primary : colors.outline}
          />
        </Pressable>

        <View style={{ flex: 1, gap: 6 }}>
          <TextInput
            value={row.name}
            onChangeText={(name) => onChange({ name })}
            style={[Typography.titleSmall as any, styles.nameInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
            accessibilityLabel={t('item_name_label')}
          />
          <View style={styles.metaRow}>
            <View style={[styles.stepper, { borderColor: colors.outlineVariant }]}>
              <Pressable
                onPress={() => onChange({ quantity: Math.max(0.5, row.quantity > 1 ? row.quantity - 1 : row.quantity / 2) })}
                accessibilityRole="button"
                accessibilityLabel="-"
                hitSlop={6}
                style={styles.stepBtn}
              >
                <MaterialCommunityIcons name="minus" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
              <Text style={[Typography.labelLarge, { color: colors.onSurface, minWidth: 28, textAlign: 'center' } as any]}>
                {formatQty(row.quantity)}
              </Text>
              <Pressable
                onPress={() => onChange({ quantity: Math.min(999, Math.floor(row.quantity) + 1) })}
                accessibilityRole="button"
                accessibilityLabel="+"
                hitSlop={6}
                style={styles.stepBtn}
              >
                <MaterialCommunityIcons name="plus" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <Menu
              visible={unitMenu}
              onDismiss={() => setUnitMenu(false)}
              anchor={
                <Pressable
                  onPress={() => setUnitMenu(true)}
                  accessibilityRole="button"
                  style={[styles.chip, { borderColor: colors.outlineVariant }]}
                >
                  <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant } as any]}>
                    {unitLabel(row.unit)}
                  </Text>
                </Pressable>
              }
            >
              {UNITS.map((u) => (
                <Menu.Item
                  key={u ?? 'none'}
                  title={unitLabel(u)}
                  onPress={() => {
                    setUnitMenu(false);
                    onChange({ unit: u });
                  }}
                />
              ))}
            </Menu>

            <Menu
              visible={categoryMenu}
              onDismiss={() => setCategoryMenu(false)}
              anchor={
                <Pressable
                  onPress={() => setCategoryMenu(true)}
                  accessibilityRole="button"
                  style={[styles.chip, { borderColor: colors.primary + '66', backgroundColor: colors.primary + '14' }]}
                >
                  <Text style={[Typography.labelMedium, { color: colors.primary } as any]}>
                    {t(`category_${row.category.toLowerCase()}`)}
                  </Text>
                </Pressable>
              }
            >
              {CATEGORIES.map((c) => (
                <Menu.Item
                  key={c}
                  title={t(`category_${c.toLowerCase()}`)}
                  onPress={() => {
                    setCategoryMenu(false);
                    onChange({ category: c });
                  }}
                />
              ))}
            </Menu>
          </View>

          {(row.note || onList) && (
            <View style={styles.metaRow}>
              {!!row.note && (
                <TextInput
                  value={row.note}
                  onChangeText={(note) => onChange({ note })}
                  style={[Typography.bodySmall as any, styles.noteInput, { color: colors.onSurfaceVariant }]}
                  accessibilityLabel={t('item_note_label')}
                />
              )}
              {onList && (
                <Text style={[Typography.labelSmall, { color: colors.tertiary ?? colors.primary } as any]}>
                  {t('paste_preview_on_list')}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: 8,
    alignItems: 'center',
  },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, minHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 8 },
  check: { paddingTop: 6 },
  divider: { height: 1, marginHorizontal: 8 },
  nameInput: {
    borderBottomWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    textAlign: 'auto',
  },
  noteInput: { flex: 1, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 4,
    minHeight: 32,
  },
  stepBtn: { padding: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: 10,
  },
});
