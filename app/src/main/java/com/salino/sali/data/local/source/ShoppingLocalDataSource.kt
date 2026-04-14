package com.salino.sali.data.local.source

import androidx.room.withTransaction
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.local.entity.SyncTargetType
import com.salino.sali.data.local.mapper.toEntity
import com.salino.sali.data.local.mapper.toModel
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ShoppingItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class ShoppingLocalDataSource @Inject constructor(
    private val database: SalinoDatabase
) {
    fun observeActiveItems(householdId: String): Flow<List<ShoppingItem>> =
        database.shoppingItemDao().observeItemsByStatus(householdId, ItemStatus.ACTIVE.name)
            .map { items -> items.map { it.toModel() } }

    fun observeBoughtItems(householdId: String): Flow<List<ShoppingItem>> =
        database.shoppingItemDao().observeItemsByStatus(householdId, ItemStatus.BOUGHT.name)
            .map { items -> items.map { it.toModel() } }

    fun observeAllItems(householdId: String): Flow<List<ShoppingItem>> =
        database.shoppingItemDao().observeAllItems(householdId)
            .map { items -> items.map { it.toModel() } }

    suspend fun getItem(householdId: String, itemId: String): ShoppingItem? =
        database.shoppingItemDao().getItem(householdId, itemId)?.toModel()

    suspend fun upsertItem(householdId: String, item: ShoppingItem) {
        database.shoppingItemDao().upsertItem(item.toEntity(householdId))
    }

    suspend fun deleteItem(householdId: String, itemId: String) {
        database.shoppingItemDao().deleteItem(householdId, itemId)
    }

    suspend fun mergeRemoteItems(householdId: String, items: List<ShoppingItem>) {
        database.withTransaction {
            val protectedIds = database.pendingSyncOperationDao()
                .getPendingTargetIds(householdId, SyncTargetType.ITEM)
                .toSet()
            val safeItems = items.filter { it.id !in protectedIds }
            database.shoppingItemDao().upsertItems(safeItems.map { it.toEntity(householdId) })
            val remoteIds = items.map { it.id }.toSet()
            val staleIds = database.shoppingItemDao().getItemIds(householdId)
                .filter { id -> id !in remoteIds && id !in protectedIds }
            if (staleIds.isNotEmpty()) {
                database.shoppingItemDao().deleteItemsByIds(householdId, staleIds)
            }
        }
    }
}
