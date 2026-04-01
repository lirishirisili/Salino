package com.salino.sali.domain.service

import com.salino.sali.data.model.ShoppingItem

data class DuplicateMatch(
    val item: ShoppingItem,
    val reason: String,
    val suggestedQuantity: Double
)

interface DuplicateDetector {
    fun findDuplicate(
        draftName: String,
        existingItems: List<ShoppingItem>,
        excludeItemId: String? = null
    ): DuplicateMatch?
}
