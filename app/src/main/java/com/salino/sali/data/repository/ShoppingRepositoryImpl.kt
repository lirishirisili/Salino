package com.salino.sali.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.source.ActivityLocalDataSource
import com.salino.sali.data.local.source.RecurringLocalDataSource
import com.salino.sali.data.local.source.ShoppingLocalDataSource
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.ActivityType
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.remote.source.ShoppingRemoteDataSource
import com.salino.sali.data.sync.SyncQueueProcessor
import com.salino.sali.di.IoDispatcher
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.ShoppingRepository
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
class ShoppingRepositoryImpl @Inject constructor(
    private val shoppingLocalDataSource: ShoppingLocalDataSource,
    private val shoppingRemoteDataSource: ShoppingRemoteDataSource,
    private val activityLocalDataSource: ActivityLocalDataSource,
    private val recurringLocalDataSource: RecurringLocalDataSource,
    private val authRepository: AuthRepository,
    private val syncQueueProcessor: SyncQueueProcessor,
    @IoDispatcher ioDispatcher: CoroutineDispatcher
) : ShoppingRepository {

    private val scope = CoroutineScope(SupervisorJob() + ioDispatcher)
    private val itemListeners = mutableMapOf<String, ListenerRegistration>()

    override fun observeActiveItems(householdId: String): Flow<List<ShoppingItem>> {
        ensureRemoteSync(householdId)
        return shoppingLocalDataSource.observeActiveItems(householdId)
    }

    override fun observeBoughtItems(householdId: String): Flow<List<ShoppingItem>> {
        ensureRemoteSync(householdId)
        return shoppingLocalDataSource.observeBoughtItems(householdId)
    }

    override fun observeAllItems(householdId: String): Flow<List<ShoppingItem>> {
        ensureRemoteSync(householdId)
        return shoppingLocalDataSource.observeAllItems(householdId)
    }

    override suspend fun addItem(householdId: String, item: ShoppingItem): Result<String> = runCatching {
        val now = Timestamp.now()
        val newItem = item.copy(
            id = item.id.ifBlank { UUID.randomUUID().toString() },
            normalizedName = normalizeItemName(item.name),
            status = ItemStatus.ACTIVE.name,
            createdAt = item.createdAt ?: now,
            updatedAt = now
        )
        shoppingLocalDataSource.upsertItem(householdId, newItem)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ITEM, newItem.id)

        val activity = createActivityLog(
            householdId = householdId,
            type = ActivityType.ITEM_ADDED,
            item = newItem,
            actorUserId = newItem.addedBy,
            actorDisplayName = newItem.addedByName
        )
        activityLocalDataSource.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        syncQueueProcessor.flush(householdId)
        newItem.id
    }

    override suspend fun updateItem(householdId: String, item: ShoppingItem): Result<Unit> = runCatching {
        val updatedItem = item.copy(
            normalizedName = normalizeItemName(item.name),
            updatedAt = Timestamp.now()
        )
        shoppingLocalDataSource.upsertItem(householdId, updatedItem)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ITEM, updatedItem.id)

        val actor = authRepository.observeCurrentUser().first()
        val activity = createActivityLog(
            householdId = householdId,
            type = ActivityType.ITEM_UPDATED,
            item = updatedItem,
            actorUserId = actor?.id ?: updatedItem.addedBy,
            actorDisplayName = actor?.displayName ?: updatedItem.addedByName
        )
        activityLocalDataSource.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        syncQueueProcessor.flush(householdId)
    }

    override suspend fun markAsBought(
        householdId: String,
        itemId: String,
        userId: String,
        userName: String
    ): Result<Unit> = runCatching {
        val currentItem = getItem(householdId, itemId).getOrThrow()
        val boughtAt = System.currentTimeMillis()
        val updatedItem = currentItem.copy(
            status = ItemStatus.BOUGHT.name,
            boughtBy = userId,
            boughtByName = userName,
            updatedAt = Timestamp(Date(boughtAt))
        )
        shoppingLocalDataSource.upsertItem(householdId, updatedItem)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ITEM, updatedItem.id)

        recurringLocalDataSource.findByNormalizedName(householdId, updatedItem.normalizedName)
            ?.let { recurring ->
                val updatedRecurring = recurring.copy(
                    lastCompletedAt = Timestamp(Date(boughtAt)),
                    nextDueAt = Timestamp(Date(boughtAt + recurring.intervalDays * DAY_MS)),
                    updatedAt = Timestamp.now()
                )
                recurringLocalDataSource.upsertRecurringItem(updatedRecurring)
                syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.RECURRING, updatedRecurring.id)
            }

        val activity = createActivityLog(
            householdId = householdId,
            type = ActivityType.ITEM_BOUGHT,
            item = updatedItem,
            actorUserId = userId,
            actorDisplayName = userName
        )
        activityLocalDataSource.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        syncQueueProcessor.flush(householdId)
    }

    override suspend fun markAsActive(householdId: String, itemId: String): Result<Unit> = runCatching {
        val currentItem = getItem(householdId, itemId).getOrThrow()
        val actor = authRepository.observeCurrentUser().first()
        val updatedItem = currentItem.copy(
            status = ItemStatus.ACTIVE.name,
            boughtBy = null,
            boughtByName = null,
            updatedAt = Timestamp.now()
        )
        shoppingLocalDataSource.upsertItem(householdId, updatedItem)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ITEM, updatedItem.id)

        val activity = createActivityLog(
            householdId = householdId,
            type = ActivityType.ITEM_RESTORED,
            item = updatedItem,
            actorUserId = actor?.id.orEmpty(),
            actorDisplayName = actor?.displayName.orEmpty()
        )
        activityLocalDataSource.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        syncQueueProcessor.flush(householdId)
    }

    override suspend fun deleteItem(householdId: String, itemId: String): Result<Unit> = runCatching {
        val currentItem = shoppingLocalDataSource.getItem(householdId, itemId)
        val actor = authRepository.observeCurrentUser().first()
        shoppingLocalDataSource.deleteItem(householdId, itemId)
        syncQueueProcessor.enqueueDelete(householdId, SyncTargetType.ITEM, itemId)

        if (currentItem != null) {
            val activity = createActivityLog(
                householdId = householdId,
                type = ActivityType.ITEM_DELETED,
                item = currentItem,
                actorUserId = actor?.id.orEmpty(),
                actorDisplayName = actor?.displayName.orEmpty()
            )
            activityLocalDataSource.upsertActivity(activity)
            syncQueueProcessor.enqueueUpsert(householdId, SyncTargetType.ACTIVITY, activity.id)
        }

        syncQueueProcessor.flush(householdId)
    }

    override suspend fun getItem(householdId: String, itemId: String): Result<ShoppingItem> = runCatching {
        shoppingLocalDataSource.getItem(householdId, itemId)
            ?: shoppingRemoteDataSource.getItem(householdId, itemId).also {
                shoppingLocalDataSource.upsertItem(householdId, it)
            }
    }

    override suspend fun flushPendingSync(householdId: String): Result<Unit> = runCatching {
        syncQueueProcessor.flush(householdId)
    }

    private fun ensureRemoteSync(householdId: String) {
        if (itemListeners.containsKey(householdId)) return
        registerListener(householdId)
    }

    override fun forceRefreshSync(householdId: String) {
        // Remove old listener (may be stale after backgrounding)
        itemListeners.remove(householdId)?.remove()
        registerListener(householdId)
    }

    override fun clearListeners() {
        itemListeners.values.forEach { it.remove() }
        itemListeners.clear()
    }

    private fun registerListener(householdId: String) {
        itemListeners[householdId] = shoppingRemoteDataSource.listenToItems(householdId) { items ->
            scope.launch {
                shoppingLocalDataSource.mergeRemoteItems(householdId, items)
                syncQueueProcessor.flush(householdId)
            }
        }
    }

    private fun createActivityLog(
        householdId: String,
        type: ActivityType,
        item: ShoppingItem,
        actorUserId: String,
        actorDisplayName: String
    ): ActivityLog = ActivityLog(
        id = UUID.randomUUID().toString(),
        householdId = householdId,
        type = type.name,
        itemId = item.id,
        itemName = item.name,
        actorUserId = actorUserId,
        actorDisplayName = actorDisplayName,
        createdAt = Timestamp.now()
    )

    companion object {
        private const val DAY_MS = 24 * 60 * 60 * 1000L
    }
}
