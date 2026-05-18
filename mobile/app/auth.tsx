import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  statusCodes,
  type SignInResponse,
} from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../src/hooks';
import {
  BrandLogo,
  SalinoGradientBackground,
  SalinoPrimaryButton,
} from '../src/components';
import { BorderRadius, Layout, Typography, useIsDark, useThemeColors } from '../src/theme';
import { PRIVACY_POLICY_URL } from '../src/constants/legal';
import { validatePassword } from '../src/utils/passwordValidation';

function generateRawNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
  const bytes = Crypto.getRandomBytes(length);
  let nonce = '';
  for (let i = 0; i < bytes.length; i++) {
    nonce += charset.charAt(bytes[i] % charset.length);
  }
  return nonce;
}

const GOOGLE_WEB_CLIENT_ID: string | undefined = (Constants.expoConfig?.extra as any)
  ?.googleWebClientId;
const GOOGLE_IOS_CLIENT_ID: string | undefined = (Constants.expoConfig?.extra as any)
  ?.googleIosClientId;

// `@react-native-google-signin/google-signin` requires a native module that is not
// bundled into Expo Go. We detect the runtime environment via expo-constants so we
// can still show a friendly message instead of a confusing native crash.
// `executionEnvironment === 'storeClient'` means we're inside Expo Go.
function isGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== 'storeClient';
}

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (!GOOGLE_WEB_CLIENT_ID) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
}

export default function AuthScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const {
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
    signInWithApple,
    error,
    isSubmitting,
    clearError,
  } = useAuthStore();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (!isGoogleSignInAvailable()) {
      Alert.alert(
        t('auth_sign_in_google'),
        'Google Sign-In requires a development build. Please use email / password, or build a dev client with EAS.'
      );
      return;
    }
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(t('auth_sign_in_google'), 'Missing googleWebClientId in app.json -> extra');
      return;
    }
    try {
      clearError();
      ensureGoogleConfigured();
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = (await GoogleSignin.signIn()) as SignInResponse;
      // v13 returns { type, data }; older returns the user object directly.
      const idToken: string | null =
        (response as any)?.data?.idToken ?? (response as any)?.idToken ?? null;
      if (!idToken) {
        Alert.alert(t('auth_sign_in_google'), t('auth_error_generic'));
        return;
      }
      await signInWithGoogle(idToken);
    } catch (e: any) {
      const code = e?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return;
      if (code === statusCodes.IN_PROGRESS) return;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(t('auth_sign_in_google'), 'Google Play Services not available on this device.');
        return;
      }
      Alert.alert(t('auth_sign_in_google'), e?.message ?? t('auth_error_generic'));
    }
  };

  const handleAppleSignIn = async () => {
    try {
      clearError();
      const rawNonce = generateRawNonce(32);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        Alert.alert(t('auth_sign_in_apple'), t('auth_error_generic'));
        return;
      }
      await signInWithApple(
        credential.identityToken,
        rawNonce,
        credential.fullName ?? null
      );
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') {
        return;
      }
      const storeError = useAuthStore.getState().error;
      Alert.alert(
        t('auth_sign_in_apple'),
        storeError ? t(storeError) : e?.message ?? t('auth_error_apple_failed')
      );
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || password.length < 6) return;
    if (isRegister) {
      const result = validatePassword(password);
      if (!result.valid) {
        setPasswordError(result.errorKey);
        return;
      }
      setPasswordError(null);
      await registerWithEmail(email.trim(), password);
    } else {
      setPasswordError(null);
      await signInWithEmail(email.trim(), password);
    }
  };

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
            <View style={styles.header}>
              <BrandLogo
                iconSize={120}
                showWordmark={false}
                showGlow
                center
                shadowElevation={12}
              />
              <Text
                style={[
                  Typography.headlineLarge,
                  { color: colors.onBackground, textAlign: 'center', marginTop: 14 } as any,
                ]}
              >
                {t('app_name', 'Haserli')}
              </Text>
              <Text
                style={[
                  Typography.bodyLarge,
                  {
                    color: colors.onSurfaceVariant,
                    textAlign: 'center',
                    maxWidth: 320,
                    marginTop: 8,
                  } as any,
                ]}
              >
                {t('auth_welcome_subtitle')}
              </Text>
            </View>

            <View style={{ marginTop: 28 }}>
              {!!error && (
                <Text
                  style={[
                    Typography.bodyMedium,
                    { color: colors.error, textAlign: 'center', marginBottom: 16 } as any,
                  ]}
                >
                  {t(error)}
                </Text>
              )}

              <>
                  <Pressable
                    onPress={handleGoogleSignIn}
                    style={({ pressed }) => [
                      styles.googleBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.outlineVariant,
                        opacity: pressed ? 0.85 : 1,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 6,
                        elevation: 4,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="google" size={20} color={colors.onSurface} />
                    <Text
                      style={[
                        Typography.titleSmall,
                        { color: colors.onSurface, fontWeight: '600' } as any,
                      ]}
                    >
                      {t('auth_sign_in_google')}
                    </Text>
                  </Pressable>

                  {Platform.OS === 'ios' && appleAvailable && (
                    <View style={{ marginTop: 12 }}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={
                          AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                        }
                        buttonStyle={
                          isDark
                            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                        }
                        cornerRadius={27}
                        style={styles.appleBtn}
                        onPress={handleAppleSignIn}
                      />
                    </View>
                  )}

                  <Text
                    style={[
                      Typography.bodyMedium,
                      { color: colors.onSurfaceVariant, textAlign: 'center', marginVertical: 16 } as any,
                    ]}
                  >
                    {t('auth_or')}
                  </Text>

                  <Text
                    style={[
                      Typography.labelMedium,
                      { color: colors.onSurfaceVariant, marginBottom: 6 } as any,
                    ]}
                  >
                    {t('auth_email_label')}
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearError();
                    }}
                    placeholder={t('auth_email_hint')}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    outlineStyle={{ borderRadius: Layout.inputCorner, borderWidth: 1 }}
                    style={styles.input}
                  />

                  <Text
                    style={[
                      Typography.labelMedium,
                      { color: colors.onSurfaceVariant, marginBottom: 6, marginTop: 12 } as any,
                    ]}
                  >
                    {t('auth_password_label')}
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setPasswordError(null);
                      clearError();
                    }}
                    placeholder={t('auth_password_hint')}
                    mode="outlined"
                    secureTextEntry
                    outlineStyle={{ borderRadius: Layout.inputCorner, borderWidth: 1 }}
                    style={styles.input}
                  />

                  {isRegister && passwordError && (
                    <Text
                      style={[
                        Typography.bodySmall,
                        { color: colors.error, marginTop: 4 } as any,
                      ]}
                    >
                      {t(passwordError)}
                    </Text>
                  )}

                  <View style={{ height: 16 }} />

                  <SalinoPrimaryButton
                    text={isRegister ? t('auth_register_email') : t('auth_sign_in_email')}
                    onPress={handleEmailAuth}
                    enabled={
                      !isSubmitting && !!email.trim() && password.length >= 6
                    }
                    loading={isSubmitting}
                  />

                  <Pressable
                    onPress={() => {
                      setIsRegister(!isRegister);
                      setPasswordError(null);
                      clearError();
                    }}
                    style={{ marginTop: 8, padding: 12 }}
                  >
                    <Text
                      style={[
                        Typography.bodyMedium,
                        { color: colors.primary, textAlign: 'center', fontWeight: '600' } as any,
                      ]}
                    >
                      {isRegister ? t('auth_has_account_sign_in') : t('auth_no_account_register')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
                        Alert.alert('', t('settings_privacy_open_error'));
                      });
                    }}
                    style={{ marginTop: 4, padding: 8 }}
                  >
                    <Text
                      style={[
                        Typography.bodySmall,
                        { color: colors.onSurfaceVariant, textAlign: 'center' } as any,
                      ]}
                    >
                      {t('settings_privacy_policy')}
                    </Text>
                  </Pressable>
              </>
            </View>
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
  header: {
    alignItems: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 27,
    borderWidth: 1.5,
  },
  appleBtn: {
    width: '100%',
    height: 54,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
