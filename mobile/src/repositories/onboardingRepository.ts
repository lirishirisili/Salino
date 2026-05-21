import {
  markHouseholdCreatedGuideSeen,
  markJoinWelcomeSeen,
  markShoppingListGuideSeen,
  resetHouseholdOnboarding,
  shouldShowHouseholdCreatedGuide,
  shouldShowJoinWelcome,
  shouldShowShoppingListGuide,
} from '../local/onboardingStorage';

export const onboardingRepository = {
  shouldShowHouseholdCreatedGuide,
  markHouseholdCreatedGuideSeen,
  shouldShowJoinWelcome,
  markJoinWelcomeSeen,
  shouldShowShoppingListGuide,
  markShoppingListGuideSeen,
  resetHouseholdOnboarding,
};
