import React, { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useHouseholdStore } from '../../hooks/useHouseholdStore';
import { TemporaryDurationPicker } from './TemporaryDurationPicker';
import { endOfDayInDays, toExpiresAt } from '../../utils/householdExpiry';

const DEFAULT_EXTEND_DAYS = 7;

/** Owner picks a new end date for the active trip home (also revives an ended one). */
export function ExtendHouseholdDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { t } = useTranslation();
  const extendHousehold = useHouseholdStore((s) => s.extendHousehold);
  const [endDate, setEndDate] = useState(() => endOfDayInDays(DEFAULT_EXTEND_DAYS));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setEndDate(endOfDayInDays(DEFAULT_EXTEND_DAYS));
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      await extendHousehold(toExpiresAt(endDate));
      onDismiss();
    } catch {
      Alert.alert('', t('error_generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('household_extend_title')}</Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: 16 }}>
          <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
            {visible && (
              <TemporaryDurationPicker
                value={endDate}
                onChange={setEndDate}
                initialPresetDays={DEFAULT_EXTEND_DAYS}
              />
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('cancel')}</Button>
          <Button onPress={() => void save()} loading={saving} disabled={saving}>
            {t('household_extend_action')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
