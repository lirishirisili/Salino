package com.salino.sali.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.salino.sali.data.local.entity.ShoppingItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ShoppingItemDao {
    @Query("SELECT * FROM shopping_items WHERE householdId = :householdId AND status = :status ORDER BY createdAtMillis DESC")
    fun observeItemsByStatus(householdId: String, status: String): Flow<List<ShoppingItemEntity>>

    @Query("SELECT * FROM shopping_items WHERE householdId = :householdId ORDER BY updatedAtMillis DESC, createdAtMillis DESC")
    fun observeAllItems(householdId: String): Flow<List<ShoppingItemEntity>>

    @Query("SELECT * FROM shopping_items WHERE householdId = :householdId AND id = :itemId LIMIT 1")
    suspend fun getItem(householdId: String, itemId: String): ShoppingItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItems(items: List<ShoppingItemEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItem(item: ShoppingItemEntity)

    @Query("DELETE FROM shopping_items WHERE householdId = :householdId AND id = :itemId")
    suspend fun deleteItem(householdId: String, itemId: String)

    @Query("SELECT id FROM shopping_items WHERE householdId = :householdId")
    suspend fun getItemIds(householdId: String): List<String>

    @Query("DELETE FROM shopping_items WHERE householdId = :householdId AND id IN (:itemIds)")
    suspend fun deleteItemsByIds(householdId: String, itemIds: List<String>)
}
