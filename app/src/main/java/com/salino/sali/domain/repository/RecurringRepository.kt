package com.salino.sali.domain.repository

import com.salino.sali.data.model.RecurringItem
import kotlinx.coroutines.flow.Flow

interface RecurringRepository {
    fun observeRecurringItems(householdId: String): Flow<List<RecurringItem>>
    fun observeDueRecurringItems(householdId: String): Flow<List<RecurringItem>>
    suspend fun upsertRecurringItem(householdId: String, recurringItem: RecurringItem): Result<String>
    suspend fun deleteRecurringItem(householdId: String, recurringItemId: String): Result<Unit>
    suspend fun findByNormalizedName(householdId: String, normalizedName: String): Result<RecurringItem?>
    suspend fun updateNextDueDate(householdId: String, normalizedName: String, completedAtMillis: Long): Result<Unit>
    suspend fun flushPendingSync(householdId: String): Result<Unit>
}
