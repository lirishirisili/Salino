package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.RecurringItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RecurringItemDao {
    @Query("SELECT * FROM recurring_items WHERE householdId = :householdId ORDER BY updatedAtMillis DESC")
    fun observeRecurringItems(householdId: String): Flow<List<RecurringItemEntity>>

    @Query("SELECT * FROM recurring_items WHERE householdId = :householdId AND enabled = 1 AND (nextDueAtMillis IS NULL OR nextDueAtMillis <= :nowMillis) ORDER BY nextDueAtMillis ASC")
    fun observeDueRecurringItems(householdId: String, nowMillis: Long): Flow<List<RecurringItemEntity>>

    @Query("SELECT * FROM recurring_items WHERE householdId = :householdId AND normalizedName = :normalizedName LIMIT 1")
    suspend fun findByNormalizedName(householdId: String, normalizedName: String): RecurringItemEntity?

    @Query("SELECT * FROM recurring_items WHERE householdId = :householdId AND id = :recurringId LIMIT 1")
    suspend fun getRecurringItem(householdId: String, recurringId: String): RecurringItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItems(items: List<RecurringItemEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItem(item: RecurringItemEntity)

    @Query("DELETE FROM recurring_items WHERE householdId = :householdId AND id = :recurringId")
    suspend fun deleteItem(householdId: String, recurringId: String)

    @Query("SELECT id FROM recurring_items WHERE householdId = :householdId")
    suspend fun getIds(householdId: String): List<String>

    @Query("DELETE FROM recurring_items WHERE householdId = :householdId AND id IN (:recurringIds)")
    suspend fun deleteByIds(householdId: String, recurringIds: List<String>)

    @Query("DELETE FROM recurring_items WHERE householdId = :householdId")
    suspend fun deleteAllForHousehold(householdId: String)
}
