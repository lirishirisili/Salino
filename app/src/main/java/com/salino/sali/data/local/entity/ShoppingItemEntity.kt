package com.salino.sali.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "shopping_items",
    indices = [
        Index(value = ["householdId", "status"]),
        Index(value = ["householdId", "normalizedName"])
    ]
)
data class ShoppingItemEntity(
    @PrimaryKey val id: String,
    val householdId: String,
    val name: String,
    val normalizedName: String,
    val quantity: Double,
    val unit: String?,
    val category: String,
    val note: String,
    val status: String,
    val addedBy: String,
    val addedByName: String,
    val boughtBy: String?,
    val boughtByName: String?,
    val isFavorite: Boolean = false,
    val isUrgent: Boolean = false,
    val createdAtMillis: Long?,
    val updatedAtMillis: Long?
)
