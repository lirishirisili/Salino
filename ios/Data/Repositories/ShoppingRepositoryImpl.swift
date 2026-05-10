import Foundation
import FirebaseFirestore

@MainActor
final class ShoppingRepositoryImpl: ShoppingRepository {
    private let localStore: LocalStore
    private let remoteDataSource: ShoppingRemoteDataSource
    private let authRepository: AuthRepository
    private let syncQueueProcessor: SyncQueueProcessor
    private var itemListeners: [String: ListenerRegistration] = [:]

    init(
        localStore: LocalStore,
        remoteDataSource: ShoppingRemoteDataSource,
        authRepository: AuthRepository,
        syncQueueProcessor: SyncQueueProcessor
    ) {
        self.localStore = localStore
        self.remoteDataSource = remoteDataSource
        self.authRepository = authRepository
        self.syncQueueProcessor = syncQueueProcessor
    }

    func observeActiveItems(householdId: String) -> AsyncStream<[ShoppingItem]> {
        ensureRemoteSync(householdId)
        return localStore.observeShoppingItems(householdId: householdId, status: .active)
    }

    func observeBoughtItems(householdId: String) -> AsyncStream<[ShoppingItem]> {
        ensureRemoteSync(householdId)
        return localStore.observeShoppingItems(householdId: householdId, status: .bought)
    }

    func observeAllItems(householdId: String) -> AsyncStream<[ShoppingItem]> {
        ensureRemoteSync(householdId)
        return localStore.observeShoppingItems(householdId: householdId, status: nil)
    }

    func addItem(householdId: String, item: ShoppingItem) async throws -> String {
        let now = Date()
        let newItem = copy(
            item,
            id: item.id.isEmpty ? UUID().uuidString : item.id,
            normalizedName: normalizeItemName(item.name),
            status: .active,
            createdAt: item.createdAt ?? now,
            updatedAt: now
        )
        localStore.upsertShoppingItem(householdId: householdId, item: newItem)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .item, targetId: newItem.id)
        try await logActivity(householdId: householdId, type: .itemAdded, item: newItem, userId: newItem.addedBy, userName: newItem.addedByName)
        try? await syncQueueProcessor.flush(householdId: householdId)
        return newItem.id
    }

    func updateItem(householdId: String, item: ShoppingItem) async throws {
        let updated = copy(item, normalizedName: normalizeItemName(item.name), updatedAt: Date())
        localStore.upsertShoppingItem(householdId: householdId, item: updated)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .item, targetId: updated.id)
        let actor = await firstCurrentUser()
        try await logActivity(
            householdId: householdId,
            type: .itemUpdated,
            item: updated,
            userId: actor?.id ?? updated.addedBy,
            userName: actor?.displayName ?? updated.addedByName
        )
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func markAsBought(householdId: String, itemId: String, userId: String, userName: String) async throws {
        let current = try await getItem(householdId: householdId, itemId: itemId)
        var updated = current
        updated.status = .bought
        updated.boughtBy = userId
        updated.boughtByName = userName
        updated.updatedAt = Date()
        localStore.upsertShoppingItem(householdId: householdId, item: updated)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .item, targetId: updated.id)
        try await logActivity(householdId: householdId, type: .itemBought, item: updated, userId: userId, userName: userName)
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func markAsActive(householdId: String, itemId: String) async throws {
        let current = try await getItem(householdId: householdId, itemId: itemId)
        let actor = await firstCurrentUser()
        var updated = current
        updated.status = .active
        updated.boughtBy = nil
        updated.boughtByName = nil
        updated.updatedAt = Date()
        localStore.upsertShoppingItem(householdId: householdId, item: updated)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .item, targetId: updated.id)
        try await logActivity(householdId: householdId, type: .itemRestored, item: updated, userId: actor?.id ?? "", userName: actor?.displayName ?? "")
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func deleteItem(householdId: String, itemId: String) async throws {
        let current = localStore.fetchShoppingItem(householdId: householdId, itemId: itemId)
        let actor = await firstCurrentUser()
        localStore.deleteShoppingItem(householdId: householdId, itemId: itemId)
        syncQueueProcessor.enqueueDelete(householdId: householdId, targetType: .item, targetId: itemId)
        if let current {
            try await logActivity(householdId: householdId, type: .itemDeleted, item: current, userId: actor?.id ?? "", userName: actor?.displayName ?? "")
        }
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func getItem(householdId: String, itemId: String) async throws -> ShoppingItem {
        if let local = localStore.fetchShoppingItem(householdId: householdId, itemId: itemId) {
            return local
        }
        let remote = try await remoteDataSource.getItem(householdId: householdId, itemId: itemId)
        localStore.upsertShoppingItem(householdId: householdId, item: remote)
        return remote
    }

    func toggleFavorite(householdId: String, itemId: String, isFavorite: Bool) async throws {
        let current = try await getItem(householdId: householdId, itemId: itemId)
        let updated = copy(current, isFavorite: isFavorite, updatedAt: Date())
        localStore.upsertShoppingItem(householdId: householdId, item: updated)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .item, targetId: updated.id)
        try? await syncQueueProcessor.flush(householdId: householdId)
    }

    func flushPendingSync(householdId: String) async throws {
        try await syncQueueProcessor.flush(householdId: householdId)
    }

    func forceRefreshSync(householdId: String) {
        itemListeners.removeValue(forKey: householdId)?.remove()
        registerListener(householdId)
    }

    func clearListeners() {
        itemListeners.values.forEach { $0.remove() }
        itemListeners.removeAll()
    }

    private func ensureRemoteSync(_ householdId: String) {
        guard itemListeners[householdId] == nil else { return }
        registerListener(householdId)
    }

    private func registerListener(_ householdId: String) {
        itemListeners[householdId] = remoteDataSource.listenToItems(householdId: householdId) { [weak self] items in
            Task { @MainActor in
                guard let self else { return }
                self.localStore.mergeRemoteShoppingItems(householdId: householdId, items: items)
                try? await self.syncQueueProcessor.flush(householdId: householdId)
            }
        }
    }

    private func logActivity(householdId: String, type: ActivityType, item: ShoppingItem, userId: String, userName: String) async throws {
        let activity = ActivityLog(
            id: UUID().uuidString,
            householdId: householdId,
            type: type,
            itemId: item.id,
            itemName: item.name,
            actorUserId: userId,
            actorDisplayName: userName,
            createdAt: Date()
        )
        localStore.upsertActivity(activity)
        syncQueueProcessor.enqueueUpsert(householdId: householdId, targetType: .activity, targetId: activity.id)
    }

    private func firstCurrentUser() async -> UserProfile? {
        for await user in authRepository.observeCurrentUser() { return user }
        return nil
    }

    private func copy(
        _ item: ShoppingItem,
        id: String? = nil,
        normalizedName: String? = nil,
        status: ItemStatus? = nil,
        isFavorite: Bool? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) -> ShoppingItem {
        var item = item
        if let id { item.id = id }
        if let normalizedName { item.normalizedName = normalizedName }
        if let status { item.status = status }
        if let isFavorite { item.isFavorite = isFavorite }
        if let createdAt { item.createdAt = createdAt }
        if let updatedAt { item.updatedAt = updatedAt }
        return item
    }
}
