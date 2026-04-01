package com.salino.sali.data.local.source

import androidx.room.withTransaction
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.mapper.toEntity
import com.salino.sali.data.local.mapper.toModel
import com.salino.sali.data.model.ActivityLog
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class ActivityLocalDataSource @Inject constructor(
    private val database: SalinoDatabase
) {
    fun observeActivityFeed(householdId: String): Flow<List<ActivityLog>> =
        database.activityLogDao().observeActivityFeed(householdId)
            .map { logs -> logs.map { it.toModel() } }

    suspend fun upsertActivity(log: ActivityLog) {
        database.activityLogDao().upsertLog(log.toEntity())
    }

    suspend fun getActivity(householdId: String, activityId: String): ActivityLog? =
        database.activityLogDao().getActivity(householdId, activityId)?.toModel()

    suspend fun mergeRemoteActivity(householdId: String, logs: List<ActivityLog>) {
        database.withTransaction {
            val protectedIds = database.pendingSyncOperationDao()
                .getPendingTargetIds(householdId, SyncTargetType.ACTIVITY)
                .toSet()
            database.activityLogDao().upsertLogs(logs.map { it.toEntity() })
            val remoteIds = logs.map { it.id }.toSet()
            val staleIds = database.activityLogDao().getIds(householdId)
                .filter { id -> id !in remoteIds && id !in protectedIds }
            if (staleIds.isNotEmpty()) {
                database.activityLogDao().deleteByIds(householdId, staleIds)
            }
        }
    }
}
