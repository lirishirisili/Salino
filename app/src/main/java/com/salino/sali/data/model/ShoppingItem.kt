package com.salino.sali.data.model

import com.google.firebase.Timestamp

/**
 * Firestore document: households/{householdId}/items/{itemId}
 */
data class ShoppingItem(
    val id: String = "",
    val name: String = "",
    val normalizedName: String = "",
    val quantity: Double = 1.0,
    val unit: String? = null,
    val category: String = ItemCategory.OTHER.name,
    val note: String = "",
    val status: String = ItemStatus.ACTIVE.name,
    val addedBy: String = "",
    val addedByName: String = "",
    val boughtBy: String? = null,
    val boughtByName: String? = null,
    val isFavorite: Boolean = false,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
) {
    constructor() : this(
        "", "", "", 1.0, null,
        ItemCategory.OTHER.name, "", ItemStatus.ACTIVE.name,
        "", "", null, null, false, null, null
    )

    val isActive: Boolean get() = status == ItemStatus.ACTIVE.name
    val isBought: Boolean get() = status == ItemStatus.BOUGHT.name
}
