import Foundation

@MainActor
final class SyncQueueProcessor {
    private let localStore: LocalStore
    private let shoppingRemoteDataSource: ShoppingRemoteDataSource
    private let activityRemoteDataSource: ActivityRemoteDataSource
    private let recurringRemoteDataSource: RecurringRemoteDataSource

    init(
        localStore: LocalStore,
        shoppingRemoteDataSource: ShoppingRemoteDataSource,
        activityRemoteDataSource: ActivityRemoteDataSource,
        recurringRemoteDataSource: RecurringRemoteDataSource
    ) {
        self.localStore = localStore
        self.shoppingRemoteDataSource = shoppingRemoteDataSource
        self.activityRemoteDataSource = activityRemoteDataSource
        self.recurringRemoteDataSource = recurringRemoteDataSource
    }

    func enqueueUpsert(householdId: String, targetType: SyncTargetType, targetId: String) {
        localStore.enqueueSync(householdId: householdId, targetType: targetType, operationType: .upsert, targetId: targetId)
    }

    func enqueueDelete(householdId: String, targetType: SyncTargetType, targetId: String) {
        localStore.enqueueSync(householdId: householdId, targetType: targetType, operationType: .delete, targetId: targetId)
    }

    func flush(householdId: String) async throws {
        let operations = localStore.pendingOperations(householdId: householdId)
        for operation in operations {
            do {
                try await sync(operation)
                localStore.deletePendingOperation(operation.id)
            } catch {
                throw error
            }
        }
    }

    private func sync(_ operation: PendingSyncOperationRecord) async throws {
        switch (operation.targetType, operation.operationType) {
        case ("ITEM", "DELETE"):
            try await shoppingRemoteDataSource.deleteItem(householdId: operation.householdId, itemId: operation.targetId)
        case ("ITEM", "UPSERT"):
            guard let item = localStore.fetchShoppingItem(householdId: operation.householdId, itemId: operation.targetId) else { return }
            try await shoppingRemoteDataSource.upsertItem(householdId: operation.householdId, item: item)
        case ("ACTIVITY", "UPSERT"):
            guard let activity = localStore.fetchActivityLog(householdId: operation.householdId, activityId: operation.targetId) else { return }
            try await activityRemoteDataSource.upsertActivity(householdId: operation.householdId, activityLog: activity)
        case ("RECURRING", "DELETE"):
            try await recurringRemoteDataSource.deleteRecurringItem(householdId: operation.householdId, recurringItemId: operation.targetId)
        case ("RECURRING", "UPSERT"):
            guard let recurring = localStore.fetchRecurringItem(householdId: operation.householdId, recurringItemId: operation.targetId) else { return }
            try await recurringRemoteDataSource.upsertRecurringItem(householdId: operation.householdId, item: recurring)
        default:
            return
        }
    }
}
