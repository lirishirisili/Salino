package com.salino.sali.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "activity_logs",
    indices = [Index(value = ["householdId", "createdAtMillis"])]
)
data class ActivityLogEntity(
    @PrimaryKey val id: String,
    val householdId: String,
    val type: String,
    val itemId: String?,
    val itemName: String,
    val actorUserId: String,
    val actorDisplayName: String,
    val message: String,
    val createdAtMillis: Long?
)
