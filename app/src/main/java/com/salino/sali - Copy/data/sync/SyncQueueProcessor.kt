package com.salino.sali.data.sync

import com.salino.sali.data.local.entity.PendingSyncOperationEntity
import com.salino.sali.data.local.entity.SyncOperationType
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.source.ActivityLocalDataSource
import com.salino.sali.data.local.source.PendingSyncLocalDataSource
import com.salino.sali.data.local.source.RecurringLocalDataSource
import com.salino.sali.data.local.source.ShoppingLocalDataSource
import com.salino.sali.data.remote.source.ActivityRemoteDataSource
import com.salino.sali.data.remote.source.RecurringRemoteDataSource
import com.salino.sali.data.remote.source.ShoppingRemoteDataSource
import com.salino.sali.di.IoDispatcher
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncQueueProcessor @Inject constructor(
    private val pendingSyncLocalDataSource: PendingSyncLocalDataSource,
    private val shoppingLocalDataSource: ShoppingLocalDataSource,
    private val shoppingRemoteDataSource: ShoppingRemoteDataSource,
    private val activityLocalDataSource: ActivityLocalDataSource,
    private val activityRemoteDataSource: ActivityRemoteDataSource,
    private val recurringLocalDataSource: RecurringLocalDataSource,
    private val recurringRemoteDataSource: RecurringRemoteDataSource,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    suspend fun enqueueUpsert(householdId: String, targetType: String, targetId: String) {
        enqueue(
            PendingSyncOperationEntity(
                id = UUID.randomUUID().toString(),
                householdId = householdId,
                targetType = targetType,
                operationType = SyncOperationType.UPSERT,
                targetId = targetId,
                createdAtMillis = System.currentTimeMillis()
            )
        )
    }

    suspend fun enqueueDelete(householdId: String, targetType: String, targetId: String) {
        enqueue(
            PendingSyncOperationEntity(
                id = UUID.randomUUID().toString(),
                householdId = householdId,
                targetType = targetType,
                operationType = SyncOperationType.DELETE,
                targetId = targetId,
                createdAtMillis = System.currentTimeMillis()
            )
        )
    }

    suspend fun flush(householdId: String) = withContext(ioDispatcher) {
        val operations = pendingSyncLocalDataSource.getPendingOperations(householdId)
        for (operation in operations) {
            val result = runCatching {
                when (operation.targetType) {
                    SyncTargetType.ITEM -> syncItem(operation)
                    SyncTargetType.ACTIVITY -> syncActivity(operation)
                    SyncTargetType.RECURRING -> syncRecurring(operation)
                }
            }

            if (result.isSuccess) {
                pendingSyncLocalDataSource.deleteOperation(operation.id)
            } else {
                break
            }
        }
    }

    private suspend fun enqueue(operation: PendingSyncOperationEntity) {
        pendingSyncLocalDataSource.upsertOperation(operation)
    }

    private suspend fun syncItem(operation: PendingSyncOperationEntity) {
        when (operation.operationType) {
            SyncOperationType.DELETE -> shoppingRemoteDataSource.deleteItem(operation.householdId, operation.targetId)
            SyncOperationType.UPSERT -> {
                val item = shoppingLocalDataSource.getItem(operation.householdId, operation.targetId) ?: return
                shoppingRemoteDataSource.upsertItem(operation.householdId, item)
            }
        }
    }

    private suspend fun syncActivity(operation: PendingSyncOperationEntity) {
        val activity = activityLocalDataSource.getActivity(operation.householdId, operation.targetId) ?: return
        activityRemoteDataSource.upsertActivity(operation.householdId, activity)
    }

    private suspend fun syncRecurring(operation: PendingSyncOperationEntity) {
        when (operation.operationType) {
            SyncOperationType.DELETE -> recurringRemoteDataSource.deleteRecurringItem(operation.householdId, operation.targetId)
            SyncOperationType.UPSERT -> {
                val recurringItem = recurringLocalDataSource.getRecurringItem(operation.householdId, operation.targetId) ?: return
                recurringRemoteDataSource.upsertRecurringItem(operation.householdId, recurringItem)
            }
        }
    }
}
