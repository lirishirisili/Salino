package com.salino.sali.data.service

import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.DuplicateMatch
import com.salino.sali.util.normalizeItemName
import javax.inject.Inject

class NormalizedDuplicateDetector @Inject constructor() : DuplicateDetector {
    override fun findDuplicate(
        draftName: String,
        existingItems: List<ShoppingItem>,
        excludeItemId: String?
    ): DuplicateMatch? {
        val normalizedDraft = normalizeItemName(draftName)
        if (normalizedDraft.isBlank()) return null

        val match = existingItems.firstOrNull { item ->
            item.id != excludeItemId && normalizeItemName(item.name) == normalizedDraft
        } ?: return null

        return DuplicateMatch(
            item = match,
            reason = "same_normalized_name",
            suggestedQuantity = match.quantity + 1.0
        )
    }
}
