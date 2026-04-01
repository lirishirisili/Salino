package com.salino.sali.domain.repository

import com.salino.sali.data.model.ShoppingItem
import kotlinx.coroutines.flow.Flow

interface ShoppingRepository {
    fun observeActiveItems(householdId: String): Flow<List<ShoppingItem>>
    fun observeBoughtItems(householdId: String): Flow<List<ShoppingItem>>
    fun observeAllItems(householdId: String): Flow<List<ShoppingItem>>
    suspend fun addItem(householdId: String, item: ShoppingItem): Result<String>
    suspend fun updateItem(householdId: String, item: ShoppingItem): Result<Unit>
    suspend fun markAsBought(householdId: String, itemId: String, userId: String, userName: String): Result<Unit>
    suspend fun markAsActive(householdId: String, itemId: String): Result<Unit>
    suspend fun deleteItem(householdId: String, itemId: String): Result<Unit>
    suspend fun getItem(householdId: String, itemId: String): Result<ShoppingItem>
    suspend fun flushPendingSync(householdId: String): Result<Unit>
    fun forceRefreshSync(householdId: String)
}
