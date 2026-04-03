package com.salino.sali.domain.repository

import com.salino.sali.data.model.ActivityLog
import kotlinx.coroutines.flow.Flow

interface ActivityRepository {
    fun observeActivityFeed(householdId: String): Flow<List<ActivityLog>>
    suspend fun logActivity(activityLog: ActivityLog): Result<Unit>
    suspend fun flushPendingSync(householdId: String): Result<Unit>
    fun clearListeners()
}
