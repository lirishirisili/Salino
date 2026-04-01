package com.salino.sali.data.local.source

import androidx.room.withTransaction
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.mapper.toEntity
import com.salino.sali.data.local.mapper.toModel
import com.salino.sali.data.model.RecurringItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class RecurringLocalDataSource @Inject constructor(
    private val database: SalinoDatabase
) {
    fun observeRecurringItems(householdId: String): Flow<List<RecurringItem>> =
        database.recurringItemDao().observeRecurringItems(householdId)
            .map { items -> items.map { it.toModel() } }

    fun observeDueRecurringItems(householdId: String, nowMillis: Long): Flow<List<RecurringItem>> =
        database.recurringItemDao().observeDueRecurringItems(householdId, nowMillis)
            .map { items -> items.map { it.toModel() } }

    suspend fun findByNormalizedName(householdId: String, normalizedName: String): RecurringItem? =
        database.recurringItemDao().findByNormalizedName(householdId, normalizedName)?.toModel()

    suspend fun getRecurringItem(householdId: String, recurringItemId: String): RecurringItem? =
        database.recurringItemDao().getRecurringItem(householdId, recurringItemId)?.toModel()

    suspend fun upsertRecurringItem(item: RecurringItem) {
        database.recurringItemDao().upsertItem(item.toEntity())
    }

    suspend fun deleteRecurringItem(householdId: String, recurringItemId: String) {
        database.recurringItemDao().deleteItem(householdId, recurringItemId)
    }

    suspend fun mergeRemoteRecurringItems(householdId: String, items: List<RecurringItem>) {
        database.withTransaction {
            val protectedIds = database.pendingSyncOperationDao()
                .getPendingTargetIds(householdId, SyncTargetType.RECURRING)
                .toSet()
            database.recurringItemDao().upsertItems(items.map { it.toEntity() })
            val remoteIds = items.map { it.id }.toSet()
            val staleIds = database.recurringItemDao().getIds(householdId)
                .filter { id -> id !in remoteIds && id !in protectedIds }
            if (staleIds.isNotEmpty()) {
                database.recurringItemDao().deleteByIds(householdId, staleIds)
            }
        }
    }
}
