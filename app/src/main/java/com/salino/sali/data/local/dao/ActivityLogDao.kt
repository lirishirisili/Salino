package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.ActivityLogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ActivityLogDao {
    @Query("SELECT * FROM activity_logs WHERE householdId = :householdId ORDER BY createdAtMillis DESC")
    fun observeActivityFeed(householdId: String): Flow<List<ActivityLogEntity>>

    @Query("SELECT * FROM activity_logs WHERE householdId = :householdId AND id = :activityId LIMIT 1")
    suspend fun getActivity(householdId: String, activityId: String): ActivityLogEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLogs(logs: List<ActivityLogEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLog(log: ActivityLogEntity)

    @Query("SELECT id FROM activity_logs WHERE householdId = :householdId")
    suspend fun getIds(householdId: String): List<String>

    @Query("DELETE FROM activity_logs WHERE householdId = :householdId AND id IN (:activityIds)")
    suspend fun deleteByIds(householdId: String, activityIds: List<String>)

    @Query("DELETE FROM activity_logs WHERE householdId = :householdId")
    suspend fun deleteAllForHousehold(householdId: String)
}
