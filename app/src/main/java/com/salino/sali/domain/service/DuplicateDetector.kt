package com.salino.sali.domain.service

import com.salino.sali.data.model.ShoppingItem

enum class DuplicateReason {
    EXACT_DUPLICATE,
    POSSIBLE_DUPLICATE,
    SIMILAR_ITEM
}

data class DuplicateMatch(
    val item: ShoppingItem,
    val reason: DuplicateReason,
    val score: Double = 0.0,
    val suggestedQuantity: Double
)

interface DuplicateDetector {
    fun findDuplicate(
        draftName: String,
        existingItems: List<ShoppingItem>,
        excludeItemId: String? = null
    ): DuplicateMatch?
}
