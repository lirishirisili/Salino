import type { TFunction } from 'i18next';

import {
  ItemCategory,
  ItemStatus,
  ItemUnit,
  ShoppingItem,
  SuggestionItem,
  SuggestionSource,
} from '../../models';

/** Localized demo suggestions — shown only during the tour on an empty list. */
export function buildTourPreviewSuggestions(t: TFunction): SuggestionItem[] {
  return [
    {
      id: 'tour_demo_s1',
      name: t('tour.preview.suggestion.milk'),
      normalizedName: 'tour_demo_milk',
      quantity: 1,
      unit: ItemUnit.LITERS,
      category: ItemCategory.DAIRY,
      note: '',
      reason: 'frequent',
      source: SuggestionSource.FREQUENT,
      recurringItemId: null,
    },
    {
      id: 'tour_demo_s2',
      name: t('tour.preview.suggestion.bread'),
      normalizedName: 'tour_demo_bread',
      quantity: 1,
      unit: ItemUnit.PIECES,
      category: ItemCategory.BAKERY,
      note: '',
      reason: 'frequent',
      source: SuggestionSource.FREQUENT,
      recurringItemId: null,
    },
    {
      id: 'tour_demo_s3',
      name: t('tour.preview.suggestion.tomatoes'),
      normalizedName: 'tour_demo_tomatoes',
      quantity: 1,
      unit: ItemUnit.KG,
      category: ItemCategory.VEGETABLES,
      note: '',
      reason: 'recent',
      source: SuggestionSource.RECENT,
      recurringItemId: null,
    },
  ];
}

/** Localized demo list items — shown only during the tour on an empty list. */
export function buildTourPreviewItems(t: TFunction): ShoppingItem[] {
  const base = {
    addedBy: 'tour',
    addedByName: '',
    boughtBy: null,
    boughtByName: null,
    isFavorite: false,
    isUrgent: false,
    note: '',
    createdAt: null,
    updatedAt: null,
    status: ItemStatus.ACTIVE,
  } as const;

  return [
    {
      ...base,
      id: 'tour_demo_i1',
      name: t('tour.preview.item.milk'),
      normalizedName: 'tour_demo_milk',
      quantity: 1,
      unit: ItemUnit.LITERS,
      category: ItemCategory.DAIRY,
    },
    {
      ...base,
      id: 'tour_demo_i2',
      name: t('tour.preview.item.bread'),
      normalizedName: 'tour_demo_bread',
      quantity: 1,
      unit: ItemUnit.PIECES,
      category: ItemCategory.BAKERY,
    },
    {
      ...base,
      id: 'tour_demo_i3',
      name: t('tour.preview.item.dish_soap'),
      normalizedName: 'tour_demo_dish_soap',
      quantity: 1,
      unit: ItemUnit.PIECES,
      category: ItemCategory.CLEANING,
    },
  ];
}

export function isTourPreviewId(id: string): boolean {
  return id.startsWith('tour_demo_');
}
