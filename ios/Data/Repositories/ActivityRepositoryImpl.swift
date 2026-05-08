import Foundation
import FirebaseFirestore

@MainActor
final class ActivityRepositoryImpl: ActivityRepository {
    private let localStore: LocalStore
    private let remoteDataSource: ActivityRemoteDataSource
    private let syncQueueProcessor: SyncQueueProcessor
    private var listeners: [String: ListenerRegistration] = [:]

    init(localStore: LocalStore, remoteDataSource: ActivityRemoteDataSource, syncQueueProcessor: SyncQueueProcessor) {
        self.localStore = localStore
        self.remoteDataSource = remoteDataSource
        self.syncQueueProcessor = syncQueueProcessor
    }

    func observeActivityFeed(householdId: String) -> AsyncStream<[ActivityLog]> {
        ensureRemoteSync(householdId)
        return localStore.observeActivity(householdId: householdId)
    }

    func logActivity(_ activityLog: ActivityLog) async throws {
        localStore.upsertActivity(activityLog)
        syncQueueProcessor.enqueueUpsert(householdId: activityLog.householdId, targetType: .activity, targetId: activityLog.id)
        try? await syncQueueProcessor.flush(householdId: activityLog.householdId)
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
        listeners[householdId] = remoteDataSource.listenToActivity(householdId: householdId) { [weak self] logs in
            Task { @MainActor in
                guard let self else { return }
                localStore.mergeRemoteActivity(householdId: householdId, logs: logs)
                try? await syncQueueProcessor.flush(householdId: householdId)
            }
        }
    }
}
