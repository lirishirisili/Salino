package com.salino.sali.domain.model

import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemUnit

enum class ItemNameAutocompleteSource {
    HOUSEHOLD_HISTORY,
    CATEGORY_CATALOG
}

data class ItemNameAutocompleteSuggestion(
    val displayName: String,
    val source: ItemNameAutocompleteSource,
    val category: ItemCategory? = null,
    val unit: ItemUnit? = null,
    val quantity: Double = 1.0,
    val purchaseCount: Int = 0,
    val lastUsedAtMillis: Long = 0L
)
