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
}

export interface HouseholdMember {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: Timestamp | null;
}

export interface NotificationPreferences {
  itemAdded: boolean;
  urgentItem: boolean;
  shoppingComplete: boolean;
  memberJoined: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  activeHouseholdId: string | null;
  fcmTokens?: string[];
  notificationPreferences?: NotificationPreferences;
  language?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  itemAdded: true,
  urgentItem: true,
  shoppingComplete: true,
  memberJoined: true,
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
