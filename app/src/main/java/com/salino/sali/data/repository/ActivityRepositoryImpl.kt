package com.salino.sali.data.repository

import com.google.firebase.firestore.ListenerRegistration
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.source.ActivityLocalDataSource
import com.salino.sali.data.remote.source.ActivityRemoteDataSource
import com.salino.sali.data.sync.SyncQueueProcessor
import com.salino.sali.di.IoDispatcher
import com.salino.sali.domain.repository.ActivityRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActivityRepositoryImpl @Inject constructor(
    private val activityLocalDataSource: ActivityLocalDataSource,
    private val activityRemoteDataSource: ActivityRemoteDataSource,
    private val syncQueueProcessor: SyncQueueProcessor,
    @IoDispatcher ioDispatcher: CoroutineDispatcher
) : ActivityRepository {

    private val scope = CoroutineScope(SupervisorJob() + ioDispatcher)
    private val listeners = mutableMapOf<String, ListenerRegistration>()

    override fun observeActivityFeed(householdId: String): Flow<List<com.salino.sali.data.model.ActivityLog>> {
        ensureRemoteSync(householdId)
        return activityLocalDataSource.observeActivityFeed(householdId)
    }

    override suspend fun logActivity(activityLog: com.salino.sali.data.model.ActivityLog): Result<Unit> = runCatching {
        activityLocalDataSource.upsertActivity(activityLog)
        syncQueueProcessor.enqueueUpsert(activityLog.householdId, SyncTargetType.ACTIVITY, activityLog.id)
        syncQueueProcessor.flush(activityLog.householdId)
    }

    override suspend fun flushPendingSync(householdId: String): Result<Unit> = runCatching {
        syncQueueProcessor.flush(householdId)
    }

    override fun clearListeners() {
        listeners.values.forEach { it.remove() }
        listeners.clear()
    }

    private fun ensureRemoteSync(householdId: String) {
        if (listeners.containsKey(householdId)) return
        listeners[householdId] = activityRemoteDataSource.listenToActivity(householdId) { logs ->
            scope.launch {
                activityLocalDataSource.mergeRemoteActivity(householdId, logs)
                syncQueueProcessor.flush(householdId)
            }
        }
    }
}
