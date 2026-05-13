import { ItemCategory } from '../models';
import { Colors } from '../theme';

export function getCategoryIcon(category: ItemCategory): string {
  switch (category) {
    case ItemCategory.DAIRY: return '🥛';
    case ItemCategory.VEGETABLES: return '🥬';
    case ItemCategory.FRUITS: return '🍎';
    case ItemCategory.MEAT_FISH: return '🥩';
    case ItemCategory.BAKERY: return '🍞';
    case ItemCategory.CLEANING: return '🧹';
    case ItemCategory.PANTRY: return '🫙';
    case ItemCategory.SNACKS: return '🍿';
    case ItemCategory.BEVERAGES: return '🥤';
    case ItemCategory.PHARMACY: return '💊';
    case ItemCategory.OTHER: return '📦';
    default: return '📦';
  }
}

export function getCategoryColor(category: ItemCategory): string {
  switch (category) {
    case ItemCategory.DAIRY: return '#3B82F6';
    case ItemCategory.VEGETABLES: return '#22C55E';
    case ItemCategory.FRUITS: return '#F97316';
    case ItemCategory.MEAT_FISH: return '#EF4444';
    case ItemCategory.BAKERY: return '#A16207';
    case ItemCategory.CLEANING: return '#06B6D4';
    case ItemCategory.PANTRY: return '#8B5CF6';
    case ItemCategory.SNACKS: return '#EC4899';
    case ItemCategory.BEVERAGES: return '#14B8A6';
    case ItemCategory.PHARMACY: return '#6366F1';
    case ItemCategory.OTHER: return '#6B7280';
    default: return '#6B7280';
  }
}
