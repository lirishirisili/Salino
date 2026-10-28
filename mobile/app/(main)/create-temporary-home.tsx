import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useHouseholdStore } from '../../src/hooks';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { TemporaryDurationPicker, shareHouseholdInvite } from '../../src/components/household';
import { Layout, Typography, useThemeColors } from '../../src/theme';
import { GRACE_DAYS, endOfDayInDays, toExpiresAt } from '../../src/utils/householdExpiry';

const DEFAULT_DAYS = 7;

/** New trip home: name + length, then it becomes the active home and the invite share sheet opens. */
export default function CreateTemporaryHomeScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const createHousehold = useHouseholdStore((s) => s.createHousehold);
  const isLoading = useHouseholdStore((s) => s.isLoading);
  const error = useHouseholdStore((s) => s.error);
  const clearError = useHouseholdStore((s) => s.clearError);

  const [name, setName] = useState('');
  const [endDate, setEndDate] = useState(() => endOfDayInDays(DEFAULT_DAYS));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/shopping-list');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createHousehold(name.trim(), toExpiresAt(endDate));
    const { household, error: storeError } = useHouseholdStore.getState();
    if (storeError || !household) return;
    goBack();
    // Friends join through the link, so offer it right away.
    void shareHouseholdInvite(household, t, i18n.language).catch(() => undefined);
  };

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('household_temp_create_title')} onBack={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.inner}>
            <View style={styles.intro}>
              <MaterialCommunityIcons name="bag-suitcase" size={40} color={colors.primary} />
              <Text style={[Typography.bodyMedium, { color: colors.onSurfaceVariant, textAlign: 'center' } as any]}>
                {t('household_temp_create_subtitle')}
              </Text>
            </View>

            <SalinoSurfaceCard>
              <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant, marginBottom: 6 } as any]}>
                {t('household_temp_name_label')}
              </Text>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  clearError();
                }}
                placeholder={t('household_temp_name_hint')}
                mode="outlined"
                autoCapitalize="sentences"
                outlineStyle={{ borderRadius: Layout.inputCorner }}
                style={{ backgroundColor: 'transparent' }}
                disabled={isLoading}
              />

              <Text
                style={[
                  Typography.labelMedium,
                  { color: colors.onSurfaceVariant, marginTop: 18, marginBottom: 8 } as any,
                ]}
              >
                {t('household_temp_duration_label')}
              </Text>
              <TemporaryDurationPicker value={endDate} onChange={setEndDate} initialPresetDays={DEFAULT_DAYS} />

              <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 12 } as any]}>
                {t('household_temp_explainer', { days: GRACE_DAYS })}
              </Text>
            </SalinoSurfaceCard>

            {error && (
              <Text style={[Typography.bodyMedium, { color: colors.error, textAlign: 'center' } as any]}>
                {t(error)}
              </Text>
            )}

            <SalinoPrimaryButton
              text={isLoading ? t('household_creating') : t('household_temp_create_button')}
              onPress={() => void handleCreate()}
              enabled={!isLoading && !!name.trim()}
              loading={isLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: 8,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    gap: 16,
  },
  intro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
});
