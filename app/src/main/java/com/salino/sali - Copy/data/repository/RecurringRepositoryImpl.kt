package com.salino.sali.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.source.ActivityLocalDataSource
import com.salino.sali.data.local.source.RecurringLocalDataSource
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.ActivityType
import com.salino.sali.data.model.RecurringItem
import com.salino.sali.data.remote.source.RecurringRemoteDataSource
import com.salino.sali.data.sync.SyncQueueProcessor
import com.salino.sali.di.IoDispatcher
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.util.normalizeItemName
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.Date
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecurringRepositoryImpl @Inject constructor(
    private val recurringLocalDataSource: RecurringLocalDataSource,
    private val recurringRemoteDataSource: RecurringRemoteDataSource,
    private val activityLocalDataSource: ActivityLocalDataSource,
    private val authRepository: AuthRepository,
    private val syncQueueProcessor: SyncQueueProcessor,
    @IoDispatcher ioDispatcher: CoroutineDispatcher
) : RecurringRepository {

    private val scope = CoroutineScope(SupervisorJob() + ioDispatcher)
    private val listeners = mutableMapOf<String, ListenerRegistration>()

    override fun observeRecurringItems(householdId: String): Flow<List<RecurringItem>> {
        ensureRemoteSync(householdId)
        return recurringLocalDataSource.observeRecurringItems(householdId)
    }

    override fun observeDueRecurringItems(householdId: String): Flow<List<RecurringItem>> {
        ensureRemoteSync(householdId)
        return recurringLocalDataSource.observeDueRecurringItems(householdId, System.currentTimeMillis())
    }

    override suspend fun upsertRecurringItem(householdId: String, recurringItem: RecurringItem): Result<String> = runCatching {
        val now = Timestamp.now()
        val normalizedName = normalizeItemName(recurringItem.name)
        val recurringId = recurringItem.id.ifBlank { UUID.randomUUID().toString() }
        val updated = recurringItem.copy(
            id = recurringId,
            householdId = householdId,
            normalizedName = normalizedName,
            createdAt = recurringItem.createdAt ?: now,
            updatedAt = now,
            nextDueAt = recurringItem.nextDueAt ?: Timestamp(Date(System.currentTimeMillis() + recurringItem.intervalDays * DAY_MS))
        )
        recurringLocalDataSource.upsertRecurringItem(updated)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.RECURRING, recurringId)

        val user = authRepository.observeCurrentUser().first()
        val type = if (recurringItem.id.isBlank()) ActivityType.RECURRING_CREATED else ActivityType.RECURRING_UPDATED
        val activity = ActivityLog(
            id = UUID.randomUUID().toString(),
            householdId = householdId,
            type = type.name,
            itemId = recurringId,
            itemName = updated.name,
            actorUserId = user?.id.orEmpty(),
            actorDisplayName = user?.displayName.orEmpty(),
            createdAt = now
        )
        activityLocalDataSource.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        syncQueueProcessor.flush(householdId)
        recurringId
    }

    override suspend fun deleteRecurringItem(householdId: String, recurringItemId: String): Result<Unit> = runCatching {
        recurringLocalDataSource.deleteRecurringItem(householdId, recurringItemId)
        syncQueueProcessor.enqueueDelete(householdId, SyncTargetType.RECURRING, recurringItemId)
        syncQueueProcessor.flush(householdId)
    }

    override suspend fun findByNormalizedName(householdId: String, normalizedName: String): Result<RecurringItem?> = runCatching {
        recurringLocalDataSource.findByNormalizedName(householdId, normalizedName)
    }

    override suspend fun updateNextDueDate(householdId: String, normalizedName: String, completedAtMillis: Long): Result<Unit> = runCatching {
        val current = recurringLocalDataSource.findByNormalizedName(householdId, normalizedName) ?: return@runCatching
        val nextDueAt = Timestamp(Date(completedAtMillis + current.intervalDays * DAY_MS))
        val updated = current.copy(
            lastCompletedAt = Timestamp(Date(completedAtMillis)),
            nextDueAt = nextDueAt,
            updatedAt = Timestamp.now()
        )
        recurringLocalDataSource.upsertRecurringItem(updated)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.RECURRING, updated.id)
        syncQueueProcessor.flush(householdId)
    }

    override suspend fun flushPendingSync(householdId: String): Result<Unit> = runCatching {
        syncQueueProcessor.flush(householdId)
    }

    private fun ensureRemoteSync(householdId: String) {
        if (listeners.containsKey(householdId)) return
        listeners[householdId] = recurringRemoteDataSource.listenToRecurringItems(householdId) { items ->
            scope.launch {
                recurringLocalDataSource.mergeRemoteRecurringItems(householdId, items)
                syncQueueProcessor.flush(householdId)
            }
        }
    }

    companion object {
        private const val DAY_MS = 24 * 60 * 60 * 1000L
    }
}
