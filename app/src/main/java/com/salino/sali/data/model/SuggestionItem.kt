package com.salino.sali.data.model

enum class SuggestionSource {
    FREQUENT,
    RECENT,
    RECURRING
}

data class SuggestionItem(
    val id: String,
    val name: String,
    val normalizedName: String,
    val quantity: Double = 1.0,
    val unit: String? = null,
    val category: String = ItemCategory.OTHER.name,
    val note: String = "",
    val reason: String,
    val source: SuggestionSource,
    val recurringItemId: String? = null
)
