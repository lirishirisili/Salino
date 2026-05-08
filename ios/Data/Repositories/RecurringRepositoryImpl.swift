import Foundation
import FirebaseFirestore

@MainActor
final class RecurringRepositoryImpl: RecurringRepository {
    private let localStore: LocalStore
    private let remoteDataSource: RecurringRemoteDataSource
    private let authRepository: AuthRepository
    private let syncQueueProcessor: SyncQueueProcessor
    private var listeners: [String: ListenerRegistration] = [:]
    private let day: TimeInterval = 24 * 60 * 60

    init(localStore: LocalStore, remoteDataSource: RecurringRemoteDataSource, authRepository: AuthRepository, syncQueueProcessor: SyncQueueProcessor) {
        self.localStore = localStore
        self.remoteDataSource = remoteDataSource
        self.authRepository = authRepository
        self.syncQueueProcessor = syncQueueProcessor
    }

    func observeRecurringItems(householdId: String) -> AsyncStream<[RecurringItem]> {
        ensureRemoteSync(householdId)
        return localStore.observeRecurringItems(householdId: householdId)
    }

    func observeDueRecurringItems(householdId: String) -> AsyncStream<[RecurringItem]> {
        ensureRemoteSync(householdId)
        return localStore.observeRecurringItems(householdId: householdId, dueOnly: true)
    }

    func upsertRecurringItem(householdId: String, recurringItem: RecurringItem) async throws -> String {
        let now = Date()
        var item = recurringItem
        item.id = item.id.isEmpty ? UUID().uuidString : item.id
        item.householdId = householdId
        item.normalizedName = normalizeItemName(item.name)
        item.createdAt = item.createdAt ?? now
        item.updatedAt = now
        item.nextDueAt = item.nextDueAt ?? now.addingTimeInterval(TimeInterval(item.intervalDays) * day)
        localStore.upsertRecurringItem(item)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .recurring, targetId: item.id)
        try await logRecurringActivity(householdId: householdId, recurring: item, isNew: recurringItem.id.isEmpty)
        try? await syncQueueProcessor.flush(householdId: householdId)
        return item.id
    }

    func deleteRecurringItem(householdId: String, recurringItemId: String) async throws {
        localStore.deleteRecurringItem(householdId: householdId, recurringItemId: recurringItemId)
        syncQueueProcessor.enqueueDelete(householdId: householdId, targetType: .recurring, targetId: recurringItemId)
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func findByNormalizedName(householdId: String, normalizedName: String) async throws -> RecurringItem? {
        localStore.findRecurringItem(householdId: householdId, normalizedName: normalizedName)
    }

    func updateNextDueDate(householdId: String, normalizedName: String, completedAt: Date) async throws {
        guard var current = localStore.findRecurringItem(householdId: householdId, normalizedName: normalizedName) else { return }
        current.lastCompletedAt = completedAt
        current.nextDueAt = completedAt.addingTimeInterval(TimeInterval(current.intervalDays) * day)
        current.updatedAt = Date()
        localStore.upsertRecurringItem(current)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .recurring, targetId: current.id)
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func flushPendingSync(householdId: String) async throws {
        try await syncQueueProcessor.flush(householdId: householdId)
    }

    func clearListeners() {
        listeners.values.forEach { $0.remove() }
        listeners.removeAll()
    }

    private func ensureRemoteSync(_ householdId: String) {
        guard listeners[householdId] == nil else { return }
        listeners[householdId] = remoteDataSource.listenToRecurringItems(householdId: householdId) { [weak self] items in
            Task { @MainActor in
                guard let self else { return }
                localStore.mergeRemoteRecurringItems(householdId: householdId, items: items)
                try? await syncQueueProcessor.flush(householdId: householdId)
            }
        }
    }

    private func logRecurringActivity(householdId: String, recurring: RecurringItem, isNew: Bool) async throws {
        let user = await firstCurrentUser()
        let activity = ActivityLog(
            id: UUID().uuidString,
            householdId: householdId,
            type: isNew ? .recurringCreated : .recurringUpdated,
            itemId: recurring.id,
            itemName: recurring.name,
            actorUserId: user?.id ?? "",
            actorDisplayName: user?.displayName ?? "",
            createdAt: Date()
        )
        localStore.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .activity, targetId: activity.id)
    }

    private func firstCurrentUser() async -> UserProfile? {
        for await user in authRepository.observeCurrentUser() { return user }
        return nil
    }
}
