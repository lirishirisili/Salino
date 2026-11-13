import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { useLeaveIfReadOnly } from '../../src/hooks/useHouseholdExpiry';
import { usePastePreviewStore } from '../../src/hooks/usePastePreviewStore';
import { MAX_SMART_REQUEST_CHARS } from '../../src/services/aiListParser';
import { requestFeatureUse } from '../../src/services/featureUnlock';
import { Layout, Typography, useThemeColors } from '../../src/theme';

const PRESETS: { key: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'shabbat', icon: 'candle' },
  { key: 'bbq', icon: 'grill-outline' },
  { key: 'camping', icon: 'tent' },
  { key: 'breakfast', icon: 'coffee-outline' },
  { key: 'birthday', icon: 'cake-variant-outline' },
  { key: 'week', icon: 'calendar-week' },
];

const MIN_PEOPLE = 1;
const MAX_PEOPLE = 50;

/**
 * "Smart list": describe a meal, event, dish or trip → the AI writes the list,
 * which opens in the paste preview for review. One free use a day, then a
 * rewarded video (featureUnlock.ts).
 */
export default function SmartListScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  useLeaveIfReadOnly();
  const openSmart = usePastePreviewStore((s) => s.openSmart);

  const [request, setRequest] = useState('');
  const [people, setPeople] = useState(4);
  const [busy, setBusy] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/shopping-list');
  };

  const submit = async () => {
    const text = request.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    try {
      if (!(await requestFeatureUse('smart_list'))) return;
      openSmart({ request: text, people });
      router.replace('/(main)/paste-preview');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('smart_list_title')} onBack={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.inner}>
            <View style={styles.intro}>
              <MaterialCommunityIcons name="creation" size={40} color={colors.primary} />
              <Text style={[Typography.bodyMedium, { color: colors.onSurfaceVariant, textAlign: 'center' } as any]}>
                {t('smart_list_subtitle')}
              </Text>
            </View>

            <View style={styles.presets}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setRequest(t(`smart_list_preset_${p.key}`))}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.preset,
                    { borderColor: colors.outlineVariant, backgroundColor: colors.surface },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <MaterialCommunityIcons name={p.icon} size={16} color={colors.primary} />
                  <Text style={[Typography.labelMedium, { color: colors.onSurface } as any]}>
                    {t(`smart_list_preset_${p.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <SalinoSurfaceCard>
              <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant, marginBottom: 6 } as any]}>
                {t('smart_list_request_label')}
              </Text>
              <TextInput
                value={request}
                onChangeText={setRequest}
                placeholder={t('smart_list_request_hint')}
                mode="outlined"
                multiline
                maxLength={MAX_SMART_REQUEST_CHARS}
                outlineStyle={{ borderRadius: Layout.inputCorner }}
                style={{ backgroundColor: 'transparent', minHeight: 80 }}
                disabled={busy}
              />

              <View style={styles.peopleRow}>
                <Text style={[Typography.labelMedium, { color: colors.onSurfaceVariant, flex: 1 } as any]}>
                  {t('smart_list_people_label')}
                </Text>
                <Pressable
                  onPress={() => setPeople((n) => Math.max(MIN_PEOPLE, n - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="-"
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="minus-circle-outline" size={28} color={colors.primary} />
                </Pressable>
                <Text style={[Typography.titleMedium, styles.peopleValue, { color: colors.onSurface } as any]}>
                  {people}
                </Text>
                <Pressable
                  onPress={() => setPeople((n) => Math.min(MAX_PEOPLE, n + 1))}
                  accessibilityRole="button"
                  accessibilityLabel="+"
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={28} color={colors.primary} />
                </Pressable>
              </View>
            </SalinoSurfaceCard>

            <SalinoPrimaryButton
              text={t('smart_list_create')}
              onPress={() => void submit()}
              enabled={!busy && request.trim().length >= 2}
              loading={busy}
              leading={<MaterialCommunityIcons name="creation" size={20} color={colors.onPrimary} />}
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
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  peopleValue: {
    minWidth: 28,
    textAlign: 'center',
  },
});
