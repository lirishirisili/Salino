import { ShoppingItem, DuplicateMatch, DuplicateReason } from '../models';
import { normalizeItemName } from '../utils/textUtils';

/**
 * Duplicate detection service matching Android's NormalizedDuplicateDetector.
 */
export function findDuplicate(
  draftName: string,
  existingItems: ShoppingItem[],
  excludeItemId?: string
): DuplicateMatch | null {
  if (!draftName.trim()) return null;

  const normalizedDraft = normalizeItemName(draftName);
  if (!normalizedDraft) return null;

  let bestMatch: DuplicateMatch | null = null;
  let bestScore = 0;

  for (const item of existingItems) {
    if (excludeItemId && item.id === excludeItemId) continue;

    const normalizedExisting = item.normalizedName || normalizeItemName(item.name);
    const score = calculateSimilarity(normalizedDraft, normalizedExisting);

    if (score > bestScore) {
      bestScore = score;
      let reason: DuplicateReason;
      if (score >= 0.95) {
        reason = DuplicateReason.EXACT_DUPLICATE;
      } else if (score >= 0.75) {
        reason = DuplicateReason.POSSIBLE_DUPLICATE;
      } else {
        reason = DuplicateReason.SIMILAR_ITEM;
      }

      bestMatch = {
        item,
        reason,
        score,
        suggestedQuantity: item.quantity + 1,
      };
    }
  }

  // Only return if score is above threshold
  return bestScore >= 0.6 ? bestMatch : null;
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0;

  // Check containment
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }

  // Token-based similarity
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matchCount = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / Math.max(tokensA.length, tokensB.length);
}
