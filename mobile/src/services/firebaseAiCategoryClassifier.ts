import { httpsCallable } from 'firebase/functions';
import { functions } from '../remote/firebase';
import { ItemCategory } from '../models';

const FUNCTION_NAME = 'classifyItemCategory';

const validCategories = new Set(Object.values(ItemCategory) as string[]);

/**
 * Calls the `classifyItemCategory` Cloud Function (Gemini-backed).
 * Mirrors Android `FirebaseAiCategoryClassifier`.
 *
 * All errors are swallowed — returns `null` on network failure, rate limit,
 * unauthenticated, invalid response, etc.
 */
export async function classifyWithAi(itemName: string): Promise<ItemCategory | null> {
  const trimmed = itemName.trim();
  if (trimmed.length < 2) return null;

  try {
    const callable = httpsCallable<{ itemName: string }, { category: string | null }>(
      functions,
      FUNCTION_NAME,
    );
    const result = await callable({ itemName: trimmed });
    const categoryName = result.data?.category;
    if (!categoryName) return null;

    const upper = categoryName.toUpperCase();
    if (validCategories.has(upper)) return upper as ItemCategory;
    return null;
  } catch {
    return null;
  }
}
