package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.PendingSyncOperationEntity

@Dao
interface PendingSyncOperationDao {
    @Query("SELECT * FROM pending_sync_operations WHERE householdId = :householdId ORDER BY createdAtMillis ASC")
    suspend fun getPendingOperations(householdId: String): List<PendingSyncOperationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertOperation(operation: PendingSyncOperationEntity)

    @Query("DELETE FROM pending_sync_operations WHERE id = :operationId")
    suspend fun deleteOperation(operationId: String)

    @Query("SELECT targetId FROM pending_sync_operations WHERE householdId = :householdId AND targetType = :targetType")
    suspend fun getPendingTargetIds(householdId: String, targetType: String): List<String>

    @Query("DELETE FROM pending_sync_operations WHERE householdId = :householdId")
    suspend fun deleteAllForHousehold(householdId: String)
}
