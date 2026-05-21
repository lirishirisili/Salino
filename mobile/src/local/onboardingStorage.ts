import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persisted across sign-out (excluded from localClearAll). Reset on leave household. */
export const ONBOARDING_KEYS = {
  HOUSEHOLD_CREATED: '@onboarding_household_created_seen',
  JOIN_WELCOME: '@onboarding_join_welcome_seen',
  SHOPPING_LIST: '@onboarding_shopping_list_seen',
} as const;

async function isSeen(key: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key)) === 'true';
}

async function markSeen(key: string): Promise<void> {
  await AsyncStorage.setItem(key, 'true');
}

export const shouldShowHouseholdCreatedGuide = () =>
  isSeen(ONBOARDING_KEYS.HOUSEHOLD_CREATED).then((seen) => !seen);

export const markHouseholdCreatedGuideSeen = () =>
  markSeen(ONBOARDING_KEYS.HOUSEHOLD_CREATED);

export const shouldShowJoinWelcome = () =>
  isSeen(ONBOARDING_KEYS.JOIN_WELCOME).then((seen) => !seen);

export const markJoinWelcomeSeen = () => markSeen(ONBOARDING_KEYS.JOIN_WELCOME);

export const shouldShowShoppingListGuide = () =>
  isSeen(ONBOARDING_KEYS.SHOPPING_LIST).then((seen) => !seen);

export const markShoppingListGuideSeen = () => markSeen(ONBOARDING_KEYS.SHOPPING_LIST);

export const resetHouseholdOnboarding = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    ONBOARDING_KEYS.HOUSEHOLD_CREATED,
    ONBOARDING_KEYS.JOIN_WELCOME,
    ONBOARDING_KEYS.SHOPPING_LIST,
  ]);
};
