// ─── Enums ───

export type ItemStatus = 'ACTIVE' | 'BOUGHT';

export type ItemCategory =
  | 'DAIRY'
  | 'VEGETABLES'
  | 'FRUITS'
  | 'MEAT_FISH'
  | 'BAKERY'
  | 'CLEANING'
  | 'PANTRY'
  | 'SNACKS'
  | 'BEVERAGES'
  | 'PHARMACY'
  | 'OTHER';

export type ItemUnit = 'PIECES' | 'KG' | 'GRAMS' | 'LITERS' | 'PACKS' | 'BOTTLES' | 'BAGS';

export type MemberRole = 'OWNER' | 'MEMBER';

export type ActivityType =
  | 'ITEM_ADDED'
  | 'ITEM_UPDATED'
  | 'ITEM_BOUGHT'
  | 'ITEM_RESTORED'
  | 'ITEM_DELETED'
  | 'RECURRING_CREATED'
  | 'RECURRING_UPDATED'
  | 'RECURRING_SUGGESTION_SURFACED'
  | 'SUGGESTION_ACCEPTED';

export type SuggestionSource = 'FREQUENT' | 'RECENT' | 'RECURRING';

export type DuplicateReason = 'EXACT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'SIMILAR_ITEM';
export type NotificationMode = 'IMMEDIATE_IMPORTANT' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'SILENT';
export type ImportantEvent = 'ITEM_ADDED' | 'ITEM_BOUGHT' | 'ITEM_UPDATED' | 'ITEM_DELETED';

// ─── Data Models ───

export interface User {
  id: string;
  displayName: string;
  email: string;
  activeHouseholdId: string | null;
  notificationPrefs: NotificationPrefs;
}

export interface NotificationPrefs {
  mode: NotificationMode;
  importantEvents: ImportantEvent[];
  maxImmediatePerHour: number;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date | null;
  inviteCode: string;
}

export interface HouseholdMember {
  userId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: Date | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: string;
  note: string;
  status: ItemStatus;
  addedBy: string;
  addedByName: string;
  boughtBy: string | null;
  boughtByName: string | null;
  isFavorite: boolean;
  isUrgent: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RecurringItem {
  id: string;
  householdId: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: string;
  note: string;
  intervalDays: number;
  enabled: boolean;
  nextDueAt: Date | null;
  lastCompletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ActivityLog {
  id: string;
  householdId: string;
  type: ActivityType;
  itemId: string | null;
  itemName: string;
  actorUserId: string;
  actorDisplayName: string;
  message: string;
  createdAt: Date | null;
}

export interface SuggestionItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: ItemUnit | null;
  category: string;
  note: string;
  reason: string;
  source: SuggestionSource;
  recurringItemId?: string;
}

export interface DuplicateMatch {
  item: ShoppingItem;
  reason: DuplicateReason;
  score: number;
  suggestedQuantity: number;
}

// ─── Category metadata ───

export const ALL_CATEGORIES: ItemCategory[] = [
  'DAIRY', 'VEGETABLES', 'FRUITS', 'MEAT_FISH', 'BAKERY',
  'CLEANING', 'PANTRY', 'SNACKS', 'BEVERAGES', 'PHARMACY', 'OTHER',
];

export const CATEGORY_COLORS: Record<ItemCategory, string> = {
  DAIRY: '#42A5F5',
  VEGETABLES: '#4CAF50',
  FRUITS: '#FF7A59',
  MEAT_FISH: '#E45B5B',
  BAKERY: '#F6B93B',
  CLEANING: '#6C7BFF',
  PANTRY: '#9A6C4A',
  SNACKS: '#B15EFF',
  BEVERAGES: '#33B7D8',
  PHARMACY: '#16A085',
  OTHER: '#7A8895',
};

export const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  DAIRY: '🥛',
  VEGETABLES: '🥬',
  FRUITS: '🍎',
  MEAT_FISH: '🥩',
  BAKERY: '🍞',
  CLEANING: '🧹',
  PANTRY: '🫙',
  SNACKS: '🍫',
  BEVERAGES: '☕',
  PHARMACY: '💊',
  OTHER: '📦',
};

export const ALL_UNITS: ItemUnit[] = ['PIECES', 'KG', 'GRAMS', 'LITERS', 'PACKS', 'BOTTLES', 'BAGS'];
