package com.salino.sali.data.model

import com.google.firebase.Timestamp

data class RecurringItem(
    val id: String = "",
    val householdId: String = "",
    val name: String = "",
    val normalizedName: String = "",
    val quantity: Double = 1.0,
    val unit: String? = null,
    val category: String = ItemCategory.OTHER.name,
    val note: String = "",
    val intervalDays: Int = 7,
    val enabled: Boolean = true,
    val nextDueAt: Timestamp? = null,
    val lastCompletedAt: Timestamp? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
) {
    constructor() : this(
        id = "",
        householdId = "",
        name = "",
        normalizedName = "",
        quantity = 1.0,
        unit = null,
        category = ItemCategory.OTHER.name,
        note = "",
        intervalDays = 7,
        enabled = true,
        nextDueAt = null,
        lastCompletedAt = null,
        createdAt = null,
        updatedAt = null
    )
}
