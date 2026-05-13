import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useHouseholdStore } from '../src/hooks';
import {
  BrandLogo,
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoWebSegmentedTabs,
} from '../src/components';
import { Layout, Typography, useThemeColors } from '../src/theme';

export default function HouseholdSetupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { createHousehold, joinHousehold, isLoading, error, clearError } = useHouseholdStore();

  const [tab, setTab] = useState(0);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreate = async () => {
    if (!householdName.trim()) return;
    await createHousehold(householdName.trim());
    router.replace('/(main)/shopping-list');
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) return;
    await joinHousehold(inviteCode.trim());
    router.replace('/(main)/shopping-list');
  };

  const errorText = error ? t(error) : null;

  return (
    <SalinoGradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={styles.inner}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ height: 24 }} />
              <BrandLogo iconSize={96} showWordmark={false} />
              <View style={{ height: 16 }} />
              <Text
                style={[
                  Typography.headlineMedium,
                  { color: colors.onBackground, fontSize: 28, textAlign: 'center' } as any,
                ]}
              >
                {t('household_setup_title')}
              </Text>
              <View style={{ height: 8 }} />
              <Text
                style={[
                  Typography.bodyMedium,
                  { color: colors.onSurfaceVariant, textAlign: 'center', maxWidth: 320 } as any,
                ]}
              >
                {t('household_setup_subtitle')}
              </Text>
            </View>

            <View style={{ height: 24 }} />

            <SalinoWebSegmentedTabs
              labels={[t('household_create'), t('household_join')]}
              selectedIndex={tab}
              onSelect={(idx) => {
                setTab(idx);
                clearError();
              }}
            />

            <View style={{ height: 20 }} />

            {errorText && (
              <Text
                style={[
                  Typography.bodyMedium,
                  { color: colors.error, textAlign: 'center', marginBottom: 16 } as any,
                ]}
              >
                {errorText}
              </Text>
            )}

            {tab === 0 ? (
              <View style={{ gap: 16 }}>
                <Text
                  style={[
                    Typography.bodyMedium,
                    { color: colors.onSurfaceVariant, textAlign: 'center' } as any,
                  ]}
                >
                  {t('household_create_hint')}
                </Text>
                <View>
                  <Text
                    style={[
                      Typography.labelMedium,
                      { color: colors.onSurfaceVariant, marginBottom: 6 } as any,
                    ]}
                  >
                    {t('household_name_label')}
                  </Text>
                  <TextInput
                    value={householdName}
                    onChangeText={(v) => {
                      setHouseholdName(v);
                      clearError();
                    }}
                    placeholder={t('household_name_hint')}
                    mode="outlined"
                    autoCapitalize="words"
                    outlineStyle={{ borderRadius: Layout.inputCorner }}
                    style={{ backgroundColor: 'transparent' }}
                    disabled={isLoading}
                  />
                </View>
                <SalinoPrimaryButton
                  text={isLoading ? t('household_creating') : t('household_create_button')}
                  onPress={handleCreate}
                  enabled={!isLoading && !!householdName.trim()}
                  loading={isLoading}
                />
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <Text
                  style={[
                    Typography.bodyMedium,
                    { color: colors.onSurfaceVariant, textAlign: 'center' } as any,
                  ]}
                >
                  {t('household_join_hint')}
                </Text>
                <View>
                  <Text
                    style={[
                      Typography.labelMedium,
                      { color: colors.onSurfaceVariant, marginBottom: 6 } as any,
                    ]}
                  >
                    {t('household_invite_code_label')}
                  </Text>
                  <TextInput
                    value={inviteCode}
                    onChangeText={(raw) => {
                      const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                      setInviteCode(cleaned);
                      clearError();
                    }}
                    placeholder={t('household_invite_code_hint')}
                    mode="outlined"
                    autoCapitalize="characters"
                    outlineStyle={{ borderRadius: Layout.inputCorner }}
                    style={{
                      backgroundColor: 'transparent',
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: '700',
                      letterSpacing: 4,
                    }}
                    disabled={isLoading}
                  />
                </View>
                <SalinoPrimaryButton
                  text={isLoading ? t('household_joining') : t('household_join_button')}
                  onPress={handleJoin}
                  enabled={!isLoading && inviteCode.length >= 6}
                  loading={isLoading}
                />
              </View>
            )}
            <View style={{ height: 32 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.horizontalPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    justifyContent: 'center',
  },
});
