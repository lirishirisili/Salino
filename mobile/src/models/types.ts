import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus, ItemUnit } from './enums';

export interface ShoppingItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: ItemCategory;
  note: string;
  status: ItemStatus;
  addedBy: string;
  addedByName: string;
  boughtBy: string | null;
  boughtByName: string | null;
  isFavorite: boolean;
  isUrgent: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp | null;
  inviteCode: string;
  /** Set only for temporary (trip) homes: after this moment the home is read-only. */
  expiresAt?: Timestamp | null;
  /** Server-only bookkeeping for the expiry job (reminder / expired pushes). */
  reminderSentAt?: Timestamp | null;
  expiredNotifiedAt?: Timestamp | null;
}

export interface HouseholdMember {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: Timestamp | null;
  /** Invite code used to join; Firestore rules check it against the home's current code. */
  joinCode?: string;
}

export interface NotificationPreferences {
  itemAdded: boolean;
  urgentItem: boolean;
  shoppingComplete: boolean;
  memberJoined: boolean;
  /** Daily reminder when a recurring item comes due and is not on the list. */
  recurringDue: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  activeHouseholdId: string | null;
  /** Every home the user belongs to, the active one included. */
  householdIds?: string[];
  fcmTokens?: string[];
  notificationPreferences?: NotificationPreferences;
  /** Homes the user muted (no pushes except trip-home notices). */
  mutedHouseholdIds?: string[];
  language?: string;
}

/**
 * Applied to every key the user never toggled. All notifications are opt-in
 * (off until switched on in Settings) — product decision. Must match DEFAULT_ON
 * in functions/src/notificationLogic.ts.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  itemAdded: false,
  urgentItem: false,
  shoppingComplete: false,
  memberJoined: false,
  recurringDue: false,
};

export interface ActivityLog {
  id: string;
  householdId: string;
  type: string;
  itemId: string | null;
  itemName: string;
  actorUserId: string;
  actorDisplayName: string;
  message: string;
  createdAt: Timestamp | null;
}

export interface RecurringItem {
  id: string;
  householdId: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: ItemCategory;
  note: string;
  intervalDays: number;
  enabled: boolean;
  nextDueAt: Timestamp | null;
  lastCompletedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SuggestionItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: ItemCategory;
  note: string;
  reason: string;
  source: string;
  recurringItemId: string | null;
}

export interface DuplicateMatch {
  item: ShoppingItem;
  reason: string;
  score: number;
  suggestedQuantity: number;
}

export interface ParsedVoiceItem {
  name: string;
  quantity: number;
  unit: ItemUnit | null;
}
