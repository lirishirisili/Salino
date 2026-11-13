import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAddParsedItems } from '../hooks/useAddParsedItems';
import { useUndoBarStore } from '../hooks/useUndoBarStore';
import type { ForgottenItem } from '../utils/forgottenItems';
import { Typography, useThemeColors } from '../theme';

/** "What did I forget?" results: regular items that are due; tick and add. */
export function ForgottenItemsDialog({
  items,
  visible,
  onDismiss,
}: {
  items: ForgottenItem[];
  visible: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const addParsed = useAddParsedItems();
  const showUndo = useUndoBarStore((s) => s.show);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (visible) setSelected(new Set(items.map((i) => i.name)));
  }, [visible, items]);

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const add = async () => {
    const chosen = items.filter((i) => selected.has(i.name));
    if (chosen.length === 0) return;
    setAdding(true);
    try {
      const result = await addParsed(
        chosen.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, category: i.category })),
      );
      showUndo(t('quick_add_bulk_added', { count: chosen.length }), result.undo);
      onDismiss();
    } catch {
      Alert.alert('', t('error_generic'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('forgotten_title')}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
            {items.length === 0 ? (
              <Text style={[Typography.bodyMedium, { color: colors.onSurfaceVariant } as any]}>
                {t('forgotten_none')}
              </Text>
            ) : (
              items.map((item) => {
                const on = selected.has(item.name);
                return (
                  <Pressable
                    key={item.name}
                    onPress={() => toggle(item.name)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={styles.row}
                  >
                    <MaterialCommunityIcons
                      name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={24}
                      color={on ? colors.primary : colors.outline}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]}>{item.name}</Text>
                      <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant } as any]}>
                        {t('forgotten_row_hint', { every: item.usualEveryDays, since: item.daysSinceLast })}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('cancel')}</Button>
          {items.length > 0 && (
            <Button onPress={() => void add()} loading={adding} disabled={adding || selected.size === 0}>
              {t('paste_preview_add', { count: selected.size })}
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollArea: { paddingHorizontal: 20, maxHeight: 420 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
