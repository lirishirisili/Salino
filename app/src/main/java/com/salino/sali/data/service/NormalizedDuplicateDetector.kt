package com.salino.sali.data.service

import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.service.duplicate.ItemTextNormalizer
import com.salino.sali.data.service.duplicate.ProductSignatureExtractor
import com.salino.sali.data.service.duplicate.SignatureComparisonEngine
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import javax.inject.Inject

/**
 * Smart duplicate detector using product signatures and scoring-based comparison.
 *
 * Compares draft item against active items using:
 * - Text normalization (percentage forms, Hebrew niqqud, plural)
 * - Protected phrase detection (e.g. "שוקולד חלב" treated as one concept)
 * - Base product extraction via synonym dictionary
 * - Strong/weak qualifier classification
 * - Score-based comparison with tunable thresholds
 *
 * // TODO: Future — learn from user accept/reject behavior per household
 * // TODO: Future — allow household-specific protected phrases
 */
class NormalizedDuplicateDetector @Inject constructor(
    private val normalizer: ItemTextNormalizer,
    private val extractor: ProductSignatureExtractor,
    private val comparisonEngine: SignatureComparisonEngine
) : DuplicateDetector {

    override fun findDuplicate(
        draftName: String,
        existingItems: List<ShoppingItem>,
        excludeItemId: String?
    ): DuplicateMatch? {
        val normalized = normalizer.normalize(draftName)
        if (normalized.isBlank() || normalized.length < 2) return null

        val draftSignature = extractor.extract(draftName)

        var bestMatch: DuplicateMatch? = null
        var bestScore = 0.0

        for (item in existingItems) {
            if (item.id == excludeItemId) continue
            val itemSignature = extractor.extract(item.name, item.category)
            val result = comparisonEngine.compare(draftSignature, itemSignature)

            if (result.reason != null && result.score > bestScore) {
                bestScore = result.score
                bestMatch = DuplicateMatch(
                    item = item,
                    reason = result.reason,
                    score = result.score,
                    suggestedQuantity = item.quantity + 1.0
                )
            }
        }

        return bestMatch
    }
}
