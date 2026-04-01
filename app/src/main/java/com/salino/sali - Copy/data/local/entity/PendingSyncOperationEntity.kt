package com.salino.sali.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_sync_operations")
data class PendingSyncOperationEntity(
    @PrimaryKey val id: String,
    val householdId: String,
    val targetType: String,
    val operationType: String,
    val targetId: String,
    val createdAtMillis: Long
)

object SyncTargetType {
    const val ITEM = "ITEM"
    const val ACTIVITY = "ACTIVITY"
    const val RECURRING = "RECURRING"
}

object SyncOperationType {
    const val UPSERT = "UPSERT"
    const val DELETE = "DELETE"
}
