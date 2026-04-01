package com.salino.sali.data.local.source

import com.salino.sali.data.local.dao.PendingSyncOperationDao
import com.salino.sali.data.local.entity.PendingSyncOperationEntity
import javax.inject.Inject

class PendingSyncLocalDataSource @Inject constructor(
    private val dao: PendingSyncOperationDao
) {
    suspend fun getPendingOperations(householdId: String): List<PendingSyncOperationEntity> =
        dao.getPendingOperations(householdId)

    suspend fun upsertOperation(operation: PendingSyncOperationEntity) {
        dao.upsertOperation(operation)
    }

    suspend fun deleteOperation(operationId: String) {
        dao.deleteOperation(operationId)
    }

    suspend fun getPendingTargetIds(householdId: String, targetType: String): Set<String> =
        dao.getPendingTargetIds(householdId, targetType).toSet()
}
