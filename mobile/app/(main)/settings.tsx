import React, { useState } from 'react';
import {
  Alert,
  DevSettings,
  I18nManager,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput, Dialog, Portal, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useAuthStore, useHouseholdStore } from '../../src/hooks';
import { changeLanguage, SUPPORTED_LANGUAGES, isRTL } from '../../src/i18n';
import {
  BrandLogo,
  SalinoGradientBackground,
  SalinoSurfaceCard,
  SalinoWebAppBarTitle,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { signOut, profile } = useAuthStore();
  const {
    household,
    members,
    leaveHousehold,
    updateHouseholdName,
  } = useHouseholdStore();

  const [showLeave, setShowLeave] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [newName, setNewName] = useState(household?.name || '');

  const handleCopy = () => {
    Alert.alert('', t('household_invite_code_copied'));
  };

  const handleShareInvite = async () => {
    if (!household?.inviteCode) return;
    await Share.share({
      message: t('settings_share_invite_message', { code: household.inviteCode }),
    });
  };

  const handleLeave = async () => {
    setShowLeave(false);
    await leaveHousehold();
    router.replace('/household-setup');
  };

  const handleSignOut = async () => {
    setShowSignOut(false);
    await signOut();
    router.replace('/auth');
  };

  const handleSaveName = async () => {
    if (newName.trim()) {
      await updateHouseholdName(newName.trim());
      setShowEditName(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setShowLanguage(false);
    await changeLanguage(lang);
    const rtl = isRTL(lang);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
      // Hard-reload the JS bundle so the new RTL direction takes effect on every
      // already-rendered native view (matches Android's recreate-on-locale-change).
      if (__DEV__) {
        DevSettings.reload();
      } else {
        try {
          await Updates.reloadAsync();
        } catch {
          DevSettings.reload();
        }
      }
    }
  };

  return (
    <SalinoGradientBackground>
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 4 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onBackground} />
        </Pressable>
        <View style={{ marginHorizontal: 10 }}>
          <BrandLogo iconSize={38} showWordmark={false} />
        </View>
        <SalinoWebAppBarTitle text={t('settings_title')} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.inner}>
          {household && (
            <SalinoSurfaceCard>
              <Text
                style={[
                  Typography.titleLarge,
                  { color: colors.primary } as any,
                ]}
              >
                {t('settings_household_section')}
              </Text>
              <View style={{ height: 14 }} />

              <Row
                icon="home"
                title={t('settings_household_name')}
                subtitle={household.name}
                trailing={
                  <Pressable
                    onPress={() => {
                      setNewName(household.name);
                      setShowEditName(true);
                    }}
                    style={{ padding: 6 }}
                  >
                    <MaterialCommunityIcons name="pencil" size={20} color={colors.onSurfaceVariant} />
                  </Pressable>
                }
              />
              <Divider />

              <Row
                icon="key"
                title={t('settings_invite_code')}
                subtitle={household.inviteCode}
                trailing={
                  <View style={{ flexDirection: 'row' }}>
                    <Pressable onPress={handleCopy} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="content-copy" size={20} color={colors.onSurfaceVariant} />
                    </Pressable>
                    <Pressable onPress={handleShareInvite} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="share-variant" size={20} color={colors.onSurfaceVariant} />
                    </Pressable>
                  </View>
                }
              />
              <Divider />

              <View style={{ paddingVertical: 8 }}>
                <Text style={[Typography.titleSmall, { color: colors.onSurfaceVariant } as any]}>
                  {t('settings_members')}
                </Text>
                {members.map((m) => (
                  <Text
                    key={m.userId}
                    style={[
                      Typography.bodyMedium,
                      { color: colors.onSurface, marginTop: 6 } as any,
                    ]}
                  >
                    {m.displayName || m.userId}
                  </Text>
                ))}
              </View>
              <Divider />

              <Pressable
                onPress={() => setShowLeave(true)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}
              >
                <MaterialCommunityIcons name="exit-to-app" size={18} color={colors.error} />
                <Text
                  style={[
                    Typography.labelLarge,
                    { color: colors.error, fontWeight: '600' } as any,
                  ]}
                >
                  {t('settings_leave_household')}
                </Text>
              </Pressable>
            </SalinoSurfaceCard>
          )}

          <View style={{ height: 14 }} />

          <SalinoSurfaceCard>
            <Text
              style={[
                Typography.titleLarge,
                { color: colors.primary } as any,
              ]}
            >
              {t('settings_account_section')}
            </Text>
            <View style={{ height: 14 }} />
            {profile && (
              <View style={{ paddingVertical: 8 }}>
                <Text style={[Typography.bodyLarge, { color: colors.onSurface } as any]}>
                  {profile.displayName}
                </Text>
                <Text
                  style={[
                    Typography.bodyMedium,
                    { color: colors.onSurfaceVariant, marginTop: 2 } as any,
                  ]}
                >
                  {profile.email}
                </Text>
              </View>
            )}
            <Divider />
            <Pressable
              onPress={() => setShowSignOut(true)}
              style={{ paddingVertical: 12 }}
            >
              <Text
                style={[
                  Typography.labelLarge,
                  { color: colors.error, fontWeight: '600', textAlign: 'center' } as any,
                ]}
              >
                {t('settings_sign_out')}
              </Text>
            </Pressable>
          </SalinoSurfaceCard>

          <View style={{ height: 14 }} />

          <SalinoSurfaceCard>
            <Text
              style={[
                Typography.titleLarge,
                { color: colors.primary } as any,
              ]}
            >
              {t('settings_language')}
            </Text>
            <View style={{ height: 14 }} />
            <Pressable
              onPress={() => setShowLanguage(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            >
              <MaterialCommunityIcons name="translate" size={22} color={colors.onSurfaceVariant} />
              <Text style={[Typography.bodyLarge, { flex: 1, color: colors.onSurface } as any]}>
                {SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.label || i18n.language}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          </SalinoSurfaceCard>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={showLeave} onDismiss={() => setShowLeave(false)}>
          <Dialog.Title>{t('settings_leave_household')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('settings_leave_household_confirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowLeave(false)}>{t('no')}</Button>
            <Button onPress={handleLeave} textColor={colors.error}>{t('yes')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showSignOut} onDismiss={() => setShowSignOut(false)}>
          <Dialog.Title>{t('settings_sign_out')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('settings_sign_out_confirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSignOut(false)}>{t('no')}</Button>
            <Button onPress={handleSignOut} textColor={colors.error}>{t('yes')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showEditName} onDismiss={() => setShowEditName(false)}>
          <Dialog.Title>{t('settings_edit_household_name')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={newName}
              onChangeText={setNewName}
              placeholder={t('household_name_hint')}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditName(false)}>{t('cancel')}</Button>
            <Button onPress={handleSaveName}>{t('ok')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showLanguage} onDismiss={() => setShowLanguage(false)}>
          <Dialog.Title>{t('settings_language')}</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLanguageChange(lang.code)}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={[Typography.bodyLarge, { color: colors.onSurface } as any]}>
                    {lang.label}
                  </Text>
                  {i18n.language === lang.code && (
                    <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </SalinoGradientBackground>
  );
}

function Row({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]}>{title}</Text>
        <Text
          style={[
            Typography.bodySmall,
            { color: colors.onSurfaceVariant, marginTop: 2 } as any,
          ]}
        >
          {subtitle}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

function Divider() {
  const colors = useThemeColors();
  return <View style={{ height: 1, backgroundColor: colors.outlineVariant + '80', marginVertical: 4 }} />;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    paddingHorizontal: Layout.horizontalPadding,
  },
});
