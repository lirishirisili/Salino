import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingGuideDialog, OnboardingGuideStep } from './OnboardingGuideDialog';
import { OnboardingFullScreenOverlay } from './OnboardingFullScreenOverlay';

interface CreatedFlowProps {
  inviteCode: string;
  onComplete: () => void;
}

export function HouseholdCreatedOnboardingFlow({
  inviteCode,
  onComplete,
}: CreatedFlowProps) {
  const { t } = useTranslation();
  const steps: OnboardingGuideStep[] = useMemo(
    () => [
      {
        icon: 'home',
        title: t('onboarding_created_title'),
        body: t('onboarding_created_body'),
      },
      {
        icon: 'account-plus',
        title: t('onboarding_invite_step_title'),
        body: t('onboarding_invite_step_body'),
      },
      {
        icon: 'account-group',
        title: t('onboarding_share_step_title'),
        body: t('onboarding_share_step_body'),
      },
    ],
    [t]
  );

  const [stepIndex, setStepIndex] = useState(0);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      onComplete();
    }
  };

  return (
    <OnboardingFullScreenOverlay>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <OnboardingGuideDialog
          steps={steps}
          currentStepIndex={stepIndex}
          inviteCode={inviteCode}
          onNext={handleNext}
          onSkip={onComplete}
        />
      </View>
    </OnboardingFullScreenOverlay>
  );
}

interface JoinedFlowProps {
  onComplete: () => void;
}

export function HouseholdJoinedOnboardingFlow({ onComplete }: JoinedFlowProps) {
  const { t } = useTranslation();
  const steps: OnboardingGuideStep[] = useMemo(
    () => [
      {
        icon: 'hand-wave',
        title: t('onboarding_join_title'),
        body: t('onboarding_join_body'),
      },
    ],
    [t]
  );

  return (
    <OnboardingFullScreenOverlay>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <OnboardingGuideDialog
          steps={steps}
          currentStepIndex={0}
          onNext={onComplete}
        />
      </View>
    </OnboardingFullScreenOverlay>
  );
}
