package com.salino.sali.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "recurring_items",
    indices = [
        Index(value = ["householdId", "normalizedName"], unique = true),
        Index(value = ["householdId", "enabled", "nextDueAtMillis"])
    ]
)
data class RecurringItemEntity(
    @PrimaryKey val id: String,
    val householdId: String,
    val name: String,
    val normalizedName: String,
    val quantity: Double,
    val unit: String?,
    val category: String,
    val note: String,
    val intervalDays: Int,
    val enabled: Boolean,
    val nextDueAtMillis: Long?,
    val lastCompletedAtMillis: Long?,
    val createdAtMillis: Long?,
    val updatedAtMillis: Long?
)
