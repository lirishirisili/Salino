import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingGuideDialog, OnboardingGuideStep } from './OnboardingGuideDialog';
import { OnboardingFullScreenOverlay } from './OnboardingFullScreenOverlay';

interface Props {
  onComplete: () => void;
}

export function ShoppingListOnboardingFlow({ onComplete }: Props) {
  const { t } = useTranslation();
  const steps: OnboardingGuideStep[] = useMemo(
    () => [
      {
        icon: 'plus',
        title: t('onboarding_list_add_title'),
        body: t('onboarding_list_add_body'),
      },
      {
        icon: 'sync',
        title: t('onboarding_list_sync_title'),
        body: t('onboarding_list_sync_body'),
      },
      {
        icon: 'cog',
        title: t('onboarding_list_settings_title'),
        body: t('onboarding_list_settings_body'),
      },
      {
        icon: 'store',
        title: t('onboarding_list_extras_title'),
        body: t('onboarding_list_extras_body'),
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
          onNext={handleNext}
          onSkip={onComplete}
        />
      </View>
    </OnboardingFullScreenOverlay>
  );
}
