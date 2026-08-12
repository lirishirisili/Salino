import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { BrandLogo, SalinoPrimaryButton, SalinoSurfaceCard } from '../brand';
import { BorderRadius, Layout, Typography, useThemeColors } from '../../theme';
import { buildInviteUrl } from '../../constants/urls';

export interface OnboardingGuideStep {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}

interface OnboardingGuideDialogProps {
  steps: OnboardingGuideStep[];
  currentStepIndex: number;
  onNext: () => void;
  onSkip?: () => void;
  inviteCode?: string | null;
}

export function OnboardingGuideDialog({
  steps,
  currentStepIndex,
  onNext,
  onSkip,
  inviteCode,
}: OnboardingGuideDialogProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const step = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const showInviteBlock =
    inviteCode != null && currentStepIndex === 1 && steps.length >= 2;

  const handleCopy = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('', t('household_invite_code_copied'));
  };

  const handleShare = async () => {
    if (!inviteCode) return;
    const inviteUrl = buildInviteUrl(inviteCode);
    await Share.share({
      message: t('settings_share_invite_message', { code: inviteCode, url: inviteUrl }),
      url: inviteUrl,
    });
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.extraLarge,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <BrandLogo iconSize={56} showWordmark={false} showGlow={false} />

            <View style={{ height: 16 }} />

            <StepIndicator stepCount={steps.length} currentIndex={currentStepIndex} />

            <View style={{ height: 20 }} />

            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name={step.icon}
                size={32}
                color={colors.primary}
              />
            </View>

            <View style={{ height: 16 }} />

            <Text
              style={[
                Typography.headlineSmall,
                styles.title,
                { color: colors.onSurface },
              ]}
            >
              {step.title}
            </Text>

            <View style={{ height: 10 }} />

            <Text
              style={[
                Typography.bodyLarge,
                styles.body,
                { color: colors.onSurfaceVariant },
              ]}
            >
              {step.body}
            </Text>

            {showInviteBlock && inviteCode ? (
              <>
                <View style={{ height: 20 }} />
                <SalinoSurfaceCard>
                  <Text
                    style={[
                      Typography.titleMedium,
                      { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {t('household_invite_code_title')}
                  </Text>
                  <View style={{ height: 8 }} />
                  <Text
                    style={[
                      Typography.bodyMedium,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {t('household_invite_code_share')}
                  </Text>
                  <View style={{ height: 12 }} />
                  <View style={styles.inviteRow}>
                    <Text
                      style={[
                        Typography.headlineMedium,
                        styles.inviteCode,
                        { color: colors.onSurface },
                      ]}
                    >
                      {inviteCode}
                    </Text>
                    <Pressable onPress={handleCopy} style={styles.iconBtn}>
                      <MaterialCommunityIcons
                        name="content-copy"
                        size={24}
                        color={colors.primary}
                      />
                    </Pressable>
                    <Pressable onPress={handleShare} style={styles.iconBtn}>
                      <MaterialCommunityIcons
                        name="share-variant"
                        size={24}
                        color={colors.primary}
                      />
                    </Pressable>
                  </View>
                </SalinoSurfaceCard>
              </>
            ) : null}

            <View style={{ height: 24 }} />

            <SalinoPrimaryButton
              text={
                isLastStep ? t('onboarding_get_started') : t('onboarding_next')
              }
              onPress={onNext}
              style={{ width: '100%' }}
            />

            {onSkip && !isLastStep ? (
              <Pressable onPress={onSkip} style={styles.skipBtn}>
                <Text
                  style={[
                    Typography.labelLarge,
                    { color: colors.primary },
                  ]}
                >
                  {t('onboarding_skip')}
                </Text>
              </Pressable>
            ) : null}

            <Text
              style={[
                Typography.labelMedium,
                styles.counter,
                { color: colors.outline },
              ]}
            >
              {t('onboarding_step_counter', {
                current: currentStepIndex + 1,
                total: steps.length,
              })}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StepIndicator({
  stepCount,
  currentIndex,
}: {
  stepCount: number;
  currentIndex: number;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: stepCount }).map((_, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: active ? 10 : 8,
                height: active ? 10 : 8,
                backgroundColor: active
                  ? colors.primary
                  : done
                    ? `${colors.primary}73`
                    : colors.outlineVariant,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.horizontalPadding,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    maxHeight: '92%',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  body: {
    textAlign: 'center',
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    borderRadius: 999,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCode: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 3,
  },
  iconBtn: {
    padding: 8,
  },
  skipBtn: {
    marginTop: 8,
    paddingVertical: 8,
  },
  counter: {
    marginTop: 8,
    textAlign: 'center',
  },
});
