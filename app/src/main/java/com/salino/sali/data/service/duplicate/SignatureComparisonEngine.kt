package com.salino.sali.data.service.duplicate

import com.salino.sali.domain.service.DuplicateReason
import javax.inject.Inject

/**
 * Score-based comparison engine for ProductSignatures.
 * Returns a score and a DuplicateReason based on tunable thresholds.
 */
class SignatureComparisonEngine @Inject constructor(
    private val normalizer: ItemTextNormalizer
) {

    data class ComparisonResult(
        val score: Double,
        val reason: DuplicateReason?
    ) {
        companion object {
            val NO_MATCH = ComparisonResult(0.0, null)
        }
    }

    fun compare(draft: ProductSignature, existing: ProductSignature): ComparisonResult {
        if (draft.normalizedText.isBlank() || existing.normalizedText.isBlank()) {
            return ComparisonResult.NO_MATCH
        }

        var score = 0.0

        // 1. Exact normalized text match
        if (draft.normalizedText == existing.normalizedText) {
            return ComparisonResult(SCORE_EXACT_TEXT, DuplicateReason.EXACT_DUPLICATE)
        }

        // 2. Protected phrase comparison
        if (draft.matchedPhraseId != null && existing.matchedPhraseId != null) {
            if (draft.matchedPhraseId == existing.matchedPhraseId) {
                score += SCORE_SAME_PHRASE
            } else {
                // Different protected phrases → these are different products
                return ComparisonResult.NO_MATCH
            }
        } else if (draft.matchedPhraseId != null && existing.matchedPhraseId == null) {
            // Draft is a compound product (e.g., "שוקולד חלב"), existing is simple (e.g., "חלב")
            // These should NOT match
            if (draft.baseProduct != existing.baseProduct) {
                return ComparisonResult.NO_MATCH
            }
            // Same base but one has phrase, one doesn't → different products
            // e.g., "chocolate_milk" phrase vs "milk" base → NO_MATCH
            return ComparisonResult.NO_MATCH
        } else if (draft.matchedPhraseId == null && existing.matchedPhraseId != null) {
            // Reverse: existing is compound, draft is simple
            if (draft.baseProduct != existing.baseProduct) {
                return ComparisonResult.NO_MATCH
            }
            return ComparisonResult.NO_MATCH
        }

        // 3. Base product comparison
        if (draft.baseProduct != null && existing.baseProduct != null) {
            if (draft.baseProduct == existing.baseProduct) {
                score += SCORE_SAME_BASE_PRODUCT
            } else {
                // Entirely different base products
                return ComparisonResult.NO_MATCH
            }
        } else if (draft.baseProduct == null && existing.baseProduct == null) {
            // Neither has a known base product — use plural-normalized token overlap
            score += computeTokenOverlapScore(draft, existing)
        } else {
            // One has base product, other doesn't — check token overlap as fallback
            score += computeTokenOverlapScore(draft, existing)
            if (score < SCORE_MIN_TOKEN_OVERLAP) {
                return ComparisonResult.NO_MATCH
            }
        }

        // 4. Percentage qualifier
        if (draft.percentageQualifier != null || existing.percentageQualifier != null) {
            if (draft.percentageQualifier == existing.percentageQualifier) {
                score += SCORE_SAME_PERCENTAGE
            } else if (draft.percentageQualifier != null && existing.percentageQualifier != null) {
                // Different percentages → different variant, reduce score
                score -= SCORE_CONFLICTING_PERCENTAGE
            }
            // One has percentage, other doesn't → treat as possible variant, no penalty
        }

        // 5. Strong qualifiers
        val commonStrong = draft.strongQualifiers.intersect(existing.strongQualifiers)
        val draftOnlyStrong = draft.strongQualifiers - existing.strongQualifiers
        val existingOnlyStrong = existing.strongQualifiers - draft.strongQualifiers

        score += commonStrong.size * SCORE_PER_COMMON_STRONG_QUALIFIER

        if (draftOnlyStrong.isNotEmpty() || existingOnlyStrong.isNotEmpty()) {
            // Conflicting strong qualifiers that change product identity
            val conflictCount = draftOnlyStrong.size + existingOnlyStrong.size
            score -= conflictCount * SCORE_PER_CONFLICTING_STRONG_QUALIFIER
        }

        // 6. Weak qualifiers — small bonus, no penalty for differences
        val commonWeak = draft.weakQualifiers.intersect(existing.weakQualifiers)
        score += commonWeak.size * SCORE_PER_COMMON_WEAK_QUALIFIER

        // 7. Category match bonus
        if (draft.category != null && existing.category != null && draft.category == existing.category) {
            score += SCORE_SAME_CATEGORY
        }

        // 8. Plural-aware single-token match
        // If both are single-token and their plurals match
        val draftTokens = normalizer.tokenize(draft.normalizedText)
        val existingTokens = normalizer.tokenize(existing.normalizedText)
        if (draftTokens.size == 1 && existingTokens.size == 1) {
            val draftNorm = normalizer.normalizePlural(draftTokens[0])
            val existingNorm = normalizer.normalizePlural(existingTokens[0])
            if (draftNorm == existingNorm && draftNorm != draftTokens[0]) {
                // Singular/plural of same word, e.g. "ביצים" vs "ביצה"
                score += SCORE_PLURAL_MATCH_BONUS
            }
        }

        // Determine result based on thresholds
        val reason = when {
            score >= THRESHOLD_EXACT_DUPLICATE -> DuplicateReason.EXACT_DUPLICATE
            score >= THRESHOLD_POSSIBLE_DUPLICATE -> DuplicateReason.POSSIBLE_DUPLICATE
            score >= THRESHOLD_SIMILAR_ITEM -> DuplicateReason.SIMILAR_ITEM
            else -> null
        }

        return ComparisonResult(score, reason)
    }

    /**
     * Compute a token overlap score using plural-normalized tokens.
     * Useful when base products are unknown.
     */
    private fun computeTokenOverlapScore(a: ProductSignature, b: ProductSignature): Double {
        val aTokens = normalizer.tokenize(a.normalizedText).map { normalizer.normalizePlural(it) }.toSet()
        val bTokens = normalizer.tokenize(b.normalizedText).map { normalizer.normalizePlural(it) }.toSet()
        if (aTokens.isEmpty() || bTokens.isEmpty()) return 0.0

        val intersection = aTokens.intersect(bTokens).size
        val union = aTokens.union(bTokens).size
        if (union == 0) return 0.0

        val jaccard = intersection.toDouble() / union.toDouble()
        return jaccard * SCORE_MAX_TOKEN_OVERLAP
    }

    companion object {
        // --- Scoring constants (tunable) ---
        const val SCORE_EXACT_TEXT = 100.0
        const val SCORE_SAME_PHRASE = 60.0
        const val SCORE_SAME_BASE_PRODUCT = 50.0
        const val SCORE_SAME_PERCENTAGE = 15.0
        const val SCORE_CONFLICTING_PERCENTAGE = 5.0
        const val SCORE_PER_COMMON_STRONG_QUALIFIER = 10.0
        const val SCORE_PER_CONFLICTING_STRONG_QUALIFIER = 20.0
        const val SCORE_PER_COMMON_WEAK_QUALIFIER = 3.0
        const val SCORE_SAME_CATEGORY = 5.0
        const val SCORE_PLURAL_MATCH_BONUS = 30.0
        const val SCORE_MAX_TOKEN_OVERLAP = 45.0
        const val SCORE_MIN_TOKEN_OVERLAP = 15.0

        // --- Thresholds (tunable) ---
        const val THRESHOLD_EXACT_DUPLICATE = 75.0
        const val THRESHOLD_POSSIBLE_DUPLICATE = 45.0
        const val THRESHOLD_SIMILAR_ITEM = 25.0
    }
}
