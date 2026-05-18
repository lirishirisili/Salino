import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/hooks';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
} from '../src/components';
import { Layout, Typography, useThemeColors } from '../src/theme';

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const router = useRouter();
  const { checkEmailVerified, resendVerificationEmail, signOut, user } = useAuthStore();

  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown for resend button
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Check verification when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        await handleCheckVerified();
      }
    });
    return () => subscription.remove();
  }, []);

  const handleCheckVerified = useCallback(async () => {
    setChecking(true);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        router.replace('/');
      }
    } catch {
      // Ignore - user can retry
    }
    setChecking(false);
  }, [checkEmailVerified, router]);

  const handleResend = useCallback(async () => {
    await resendVerificationEmail();
    setCooldown(RESEND_COOLDOWN_SEC);
  }, [resendVerificationEmail]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/auth');
  }, [signOut, router]);

  return (
    <SalinoGradientBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <MaterialCommunityIcons
          name="email-check-outline"
          size={80}
          color={colors.primary}
        />

        <Text
          style={[
            Typography.headlineSmall,
            { color: colors.onBackground, textAlign: 'center', marginTop: 24 } as any,
          ]}
        >
          {t('verify_email_title')}
        </Text>

        <Text
          style={[
            Typography.bodyLarge,
            {
              color: colors.onSurfaceVariant,
              textAlign: 'center',
              marginTop: 12,
              maxWidth: 320,
            } as any,
          ]}
        >
          {t('verify_email_description', { email: user?.email ?? '' })}
        </Text>

        <View style={styles.actions}>
          <SalinoPrimaryButton
            text={checking ? t('verify_email_checking') : t('verify_email_check_button')}
            onPress={handleCheckVerified}
            enabled={!checking}
            loading={checking}
          />

          <View style={{ height: 12 }} />

          <SalinoPrimaryButton
            text={
              cooldown > 0
                ? t('verify_email_resend_cooldown', { seconds: cooldown })
                : t('verify_email_resend')
            }
            onPress={handleResend}
            enabled={cooldown === 0}
            variant="outlined"
          />

          <View style={{ height: 24 }} />

          <Text
            onPress={handleSignOut}
            style={[
              Typography.bodyMedium,
              { color: colors.onSurfaceVariant, textAlign: 'center' } as any,
            ]}
          >
            {t('verify_email_sign_out')}
          </Text>
        </View>
      </View>
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.horizontalPadding,
  },
  actions: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    marginTop: 32,
  },
});
