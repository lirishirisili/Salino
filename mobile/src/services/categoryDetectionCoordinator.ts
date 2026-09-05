import { ItemCategory } from '../models';
import { normalizeItemName } from '../utils/textUtils';
import { detectCategory } from './categoryDetector';
import { classifyWithAi } from './firebaseAiCategoryClassifier';
import { categoryClassificationCache } from '../local/categoryClassificationCache';

/**
 * Two-stage classification: strict local keywords first, Gemini only when
 * keywords abstain.  Mirrors Android `CategoryDetectionCoordinator`.
 */
export function detectWithKeywords(itemName: string): ItemCategory | null {
  return detectCategory(itemName);
}

export async function detectWithAi(itemName: string): Promise<ItemCategory | null> {
  const normalized = normalizeItemName(itemName);
  if (normalized.length < 2) return null;

  const cached = await categoryClassificationCache.get(normalized);
  if (cached) return cached;

  const category = await classifyWithAi(itemName);
  if (!category) return null;

  await categoryClassificationCache.put(normalized, category);
  return category;
}

/** Auto-detected badge should only show for real categories, not OTHER. */
export function isAutoDetectable(category: ItemCategory): boolean {
  return category !== ItemCategory.OTHER;
}
