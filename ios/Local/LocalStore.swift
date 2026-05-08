import Foundation
import SwiftData

@MainActor
final class LocalStore {
    let container: ModelContainer
    private let context: ModelContext

    private var shoppingContinuations: [String: [UUID: AsyncStream<[ShoppingItem]>.Continuation]] = [:]
    private var recurringContinuations: [String: [UUID: AsyncStream<[RecurringItem]>.Continuation]] = [:]
    private var activityContinuations: [String: [UUID: AsyncStream<[ActivityLog]>.Continuation]] = [:]
    private var householdContinuations: [String: [UUID: AsyncStream<Household?>.Continuation]] = [:]
    private var memberContinuations: [String: [UUID: AsyncStream<[HouseholdMember]>.Continuation]] = [:]

    init(container: ModelContainer) {
        self.container = container
        self.context = ModelContext(container)
    }

    static func makeDefaultContainer(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([
            ShoppingItemRecord.self,
            RecurringItemRecord.self,
            ActivityLogRecord.self,
            HouseholdRecord.self,
            HouseholdMemberRecord.self,
            PendingSyncOperationRecord.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        return try ModelContainer(for: schema, configurations: [configuration])
    }

    func observeShoppingItems(householdId: String, status: ItemStatus?) -> AsyncStream<[ShoppingItem]> {
        let key = shoppingKey(householdId: householdId, status: status)
        return AsyncStream { continuation in
            let id = UUID()
            shoppingContinuations[key, default: [:]][id] = continuation
            continuation.yield(fetchShoppingItems(householdId: householdId, status: status))
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.shoppingContinuations[key]?.removeValue(forKey: id) }
            }
        }
    }

    func observeRecurringItems(householdId: String, dueOnly: Bool = false) -> AsyncStream<[RecurringItem]> {
        let key = recurringKey(householdId: householdId, dueOnly: dueOnly)
        return AsyncStream { continuation in
            let id = UUID()
            recurringContinuations[key, default: [:]][id] = continuation
            continuation.yield(fetchRecurringItems(householdId: householdId, dueOnly: dueOnly))
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.recurringContinuations[key]?.removeValue(forKey: id) }
            }
        }
    }

    func observeActivity(householdId: String) -> AsyncStream<[ActivityLog]> {
        return AsyncStream { continuation in
            let id = UUID()
            activityContinuations[householdId, default: [:]][id] = continuation
            continuation.yield(fetchActivity(householdId: householdId))
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.activityContinuations[householdId]?.removeValue(forKey: id) }
            }
        }
    }

    func observeHousehold(householdId: String) -> AsyncStream<Household?> {
        return AsyncStream { continuation in
            let id = UUID()
            householdContinuations[householdId, default: [:]][id] = continuation
            continuation.yield(fetchHousehold(householdId: householdId))
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.householdContinuations[householdId]?.removeValue(forKey: id) }
            }
        }
    }

    func observeMembers(householdId: String) -> AsyncStream<[HouseholdMember]> {
        return AsyncStream { continuation in
            let id = UUID()
            memberContinuations[householdId, default: [:]][id] = continuation
            continuation.yield(fetchMembers(householdId: householdId))
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.memberContinuations[householdId]?.removeValue(forKey: id) }
            }
        }
    }

    func fetchShoppingItems(householdId: String, status: ItemStatus? = nil) -> [ShoppingItem] {
        do {
            let descriptor: FetchDescriptor<ShoppingItemRecord>
            if let status {
                let statusRawValue = status.rawValue
                descriptor = FetchDescriptor(
                    predicate: #Predicate { $0.householdId == householdId && $0.status == statusRawValue },
                    sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
                )
            } else {
                descriptor = FetchDescriptor(
                    predicate: #Predicate { $0.householdId == householdId },
                    sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
                )
            }
            return try context.fetch(descriptor).map { $0.toModel() }
        } catch {
            return []
        }
    }

    func fetchShoppingItem(householdId: String, itemId: String) -> ShoppingItem? {
        do {
            var descriptor = FetchDescriptor<ShoppingItemRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == itemId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first?.toModel()
        } catch {
            return nil
        }
    }

    func upsertShoppingItem(householdId: String, item: ShoppingItem) {
        let record = fetchShoppingRecord(householdId: householdId, itemId: item.id) ?? ShoppingItemRecord(
            id: item.id,
            householdId: householdId,
            name: item.name,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unit: item.unit?.rawValue,
            category: item.category.rawValue,
            note: item.note,
            status: item.status.rawValue,
            addedBy: item.addedBy,
            addedByName: item.addedByName,
            boughtBy: item.boughtBy,
            boughtByName: item.boughtByName,
            isFavorite: item.isFavorite,
            isUrgent: item.isUrgent,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.apply(item, householdId: householdId)
        saveAndEmitShopping(householdId)
    }

    func deleteShoppingItem(householdId: String, itemId: String) {
        if let record = fetchShoppingRecord(householdId: householdId, itemId: itemId) {
            context.delete(record)
            saveAndEmitShopping(householdId)
        }
    }

    func mergeRemoteShoppingItems(householdId: String, items: [ShoppingItem]) {
        let protectedIds = pendingTargetIds(householdId: householdId, targetType: .item)
        let safeItems = items.filter { !protectedIds.contains($0.id) }
        safeItems.forEach { upsertShoppingItemWithoutEmit(householdId: householdId, item: $0) }
        let remoteIds = Set(items.map(\.id))
        fetchShoppingRecords(householdId: householdId)
            .filter { !remoteIds.contains($0.id) && !protectedIds.contains($0.id) }
            .forEach { context.delete($0) }
        saveAndEmitShopping(householdId)
    }

    func fetchRecurringItems(householdId: String, dueOnly: Bool = false) -> [RecurringItem] {
        do {
            let now = Date()
            let descriptor: FetchDescriptor<RecurringItemRecord>
            if dueOnly {
                descriptor = FetchDescriptor(
                    predicate: #Predicate { $0.householdId == householdId && $0.enabled },
                    sortBy: [SortDescriptor(\.nextDueAt)]
                )
            } else {
                descriptor = FetchDescriptor(
                    predicate: #Predicate { $0.householdId == householdId },
                    sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
                )
            }
            let items = try context.fetch(descriptor).map { $0.toModel() }
            return dueOnly ? items.filter { $0.nextDueAt == nil || $0.nextDueAt! <= now } : items
        } catch {
            return []
        }
    }

    func fetchRecurringItem(householdId: String, recurringItemId: String) -> RecurringItem? {
        do {
            var descriptor = FetchDescriptor<RecurringItemRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == recurringItemId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first?.toModel()
        } catch {
            return nil
        }
    }

    func findRecurringItem(householdId: String, normalizedName: String) -> RecurringItem? {
        do {
            var descriptor = FetchDescriptor<RecurringItemRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.normalizedName == normalizedName }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first?.toModel()
        } catch {
            return nil
        }
    }

    func upsertRecurringItem(_ item: RecurringItem) {
        let record = fetchRecurringRecord(householdId: item.householdId, recurringItemId: item.id) ?? RecurringItemRecord(
            id: item.id,
            householdId: item.householdId,
            name: item.name,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unit: item.unit?.rawValue,
            category: item.category.rawValue,
            note: item.note,
            intervalDays: item.intervalDays,
            enabled: item.enabled,
            nextDueAt: item.nextDueAt,
            lastCompletedAt: item.lastCompletedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.apply(item)
        saveAndEmitRecurring(item.householdId)
    }

    func deleteRecurringItem(householdId: String, recurringItemId: String) {
        if let record = fetchRecurringRecord(householdId: householdId, recurringItemId: recurringItemId) {
            context.delete(record)
            saveAndEmitRecurring(householdId)
        }
    }

    func mergeRemoteRecurringItems(householdId: String, items: [RecurringItem]) {
        let protectedIds = pendingTargetIds(householdId: householdId, targetType: .recurring)
        let safeItems = items.filter { !protectedIds.contains($0.id) }
        safeItems.forEach { upsertRecurringItemWithoutEmit($0) }
        let remoteIds = Set(items.map(\.id))
        fetchRecurringRecords(householdId: householdId)
            .filter { !remoteIds.contains($0.id) && !protectedIds.contains($0.id) }
            .forEach { context.delete($0) }
        saveAndEmitRecurring(householdId)
    }

    func fetchActivity(householdId: String) -> [ActivityLog] {
        do {
            let descriptor = FetchDescriptor<ActivityLogRecord>(
                predicate: #Predicate { $0.householdId == householdId },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
            return try context.fetch(descriptor).map { $0.toModel() }
        } catch {
            return []
        }
    }

    func fetchActivityLog(householdId: String, activityId: String) -> ActivityLog? {
        do {
            var descriptor = FetchDescriptor<ActivityLogRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == activityId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first?.toModel()
        } catch {
            return nil
        }
    }

    func upsertActivity(_ log: ActivityLog) {
        let record = fetchActivityRecord(householdId: log.householdId, activityId: log.id) ?? ActivityLogRecord(
            id: log.id,
            householdId: log.householdId,
            type: log.type.rawValue,
            itemId: log.itemId,
            itemName: log.itemName,
            actorUserId: log.actorUserId,
            actorDisplayName: log.actorDisplayName,
            message: log.message,
            createdAt: log.createdAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.householdId = log.householdId
        record.type = log.type.rawValue
        record.itemId = log.itemId
        record.itemName = log.itemName
        record.actorUserId = log.actorUserId
        record.actorDisplayName = log.actorDisplayName
        record.message = log.message
        record.createdAt = log.createdAt
        saveAndEmitActivity(log.householdId)
    }

    func mergeRemoteActivity(householdId: String, logs: [ActivityLog]) {
        let protectedIds = pendingTargetIds(householdId: householdId, targetType: .activity)
        logs.forEach { upsertActivityWithoutEmit($0) }
        let remoteIds = Set(logs.map(\.id))
        fetchActivityRecords(householdId: householdId)
            .filter { !remoteIds.contains($0.id) && !protectedIds.contains($0.id) }
            .forEach { context.delete($0) }
        saveAndEmitActivity(householdId)
    }

    func fetchHousehold(householdId: String) -> Household? {
        do {
            var descriptor = FetchDescriptor<HouseholdRecord>(predicate: #Predicate { $0.id == householdId })
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first?.toModel()
        } catch {
            return nil
        }
    }

    func cacheHousehold(_ household: Household, markCurrent: Bool = true) {
        if markCurrent {
            do {
                try context.fetch(FetchDescriptor<HouseholdRecord>()).forEach { $0.isCurrent = false }
            } catch {}
        }
        let record = fetchHouseholdRecord(householdId: household.id) ?? HouseholdRecord(
            id: household.id,
            name: household.name,
            createdBy: household.createdBy,
            createdAt: household.createdAt,
            inviteCode: household.inviteCode,
            isCurrent: markCurrent
        )
        if record.modelContext == nil { context.insert(record) }
        record.name = household.name
        record.createdBy = household.createdBy
        record.createdAt = household.createdAt
        record.inviteCode = household.inviteCode
        record.isCurrent = markCurrent
        try? context.save()
        householdContinuations[household.id]?.values.forEach { $0.yield(household) }
    }

    func fetchMembers(householdId: String) -> [HouseholdMember] {
        do {
            let descriptor = FetchDescriptor<HouseholdMemberRecord>(
                predicate: #Predicate { $0.householdId == householdId },
                sortBy: [SortDescriptor(\.joinedAt)]
            )
            return try context.fetch(descriptor).map { $0.toModel() }
        } catch {
            return []
        }
    }

    func replaceMembers(householdId: String, members: [HouseholdMember]) {
        do {
            let descriptor = FetchDescriptor<HouseholdMemberRecord>(predicate: #Predicate { $0.householdId == householdId })
            try context.fetch(descriptor).forEach { context.delete($0) }
        } catch {}
        members.forEach {
            context.insert(HouseholdMemberRecord(
                householdId: householdId,
                userId: $0.userId,
                displayName: $0.displayName,
                role: $0.role.rawValue,
                joinedAt: $0.joinedAt
            ))
        }
        try? context.save()
        memberContinuations[householdId]?.values.forEach { $0.yield(members) }
    }

    func enqueueSync(householdId: String, targetType: SyncTargetType, operationType: SyncOperationType, targetId: String) {
        context.insert(PendingSyncOperationRecord(
            id: UUID().uuidString,
            householdId: householdId,
            targetType: targetType.rawValue,
            operationType: operationType.rawValue,
            targetId: targetId,
            createdAt: Date()
        ))
        try? context.save()
    }

    func pendingOperations(householdId: String) -> [PendingSyncOperationRecord] {
        do {
            let descriptor = FetchDescriptor<PendingSyncOperationRecord>(
                predicate: #Predicate { $0.householdId == householdId },
                sortBy: [SortDescriptor(\.createdAt)]
            )
            return try context.fetch(descriptor)
        } catch {
            return []
        }
    }

    func deletePendingOperation(_ id: String) {
        do {
            var descriptor = FetchDescriptor<PendingSyncOperationRecord>(predicate: #Predicate { $0.id == id })
            descriptor.fetchLimit = 1
            if let record = try context.fetch(descriptor).first {
                context.delete(record)
                try? context.save()
            }
        } catch {}
    }

    func clearAll() {
        try? context.delete(model: ShoppingItemRecord.self)
        try? context.delete(model: RecurringItemRecord.self)
        try? context.delete(model: ActivityLogRecord.self)
        try? context.delete(model: HouseholdRecord.self)
        try? context.delete(model: HouseholdMemberRecord.self)
        try? context.delete(model: PendingSyncOperationRecord.self)
        try? context.save()
    }

    func clearHouseholdData(householdId: String) {
        fetchShoppingRecords(householdId: householdId).forEach { context.delete($0) }
        fetchRecurringRecords(householdId: householdId).forEach { context.delete($0) }
        fetchActivityRecords(householdId: householdId).forEach { context.delete($0) }
        do {
            try context.fetch(FetchDescriptor<PendingSyncOperationRecord>(predicate: #Predicate { $0.householdId == householdId })).forEach { context.delete($0) }
            try context.fetch(FetchDescriptor<HouseholdMemberRecord>(predicate: #Predicate { $0.householdId == householdId })).forEach { context.delete($0) }
        } catch {}
        if let household = fetchHouseholdRecord(householdId: householdId) {
            context.delete(household)
        }
        try? context.save()
        saveAndEmitShopping(householdId)
        saveAndEmitRecurring(householdId)
        saveAndEmitActivity(householdId)
        memberContinuations[householdId]?.values.forEach { $0.yield([]) }
        householdContinuations[householdId]?.values.forEach { $0.yield(nil) }
    }

    private func fetchShoppingRecord(householdId: String, itemId: String) -> ShoppingItemRecord? {
        do {
            var descriptor = FetchDescriptor<ShoppingItemRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == itemId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }

    private func fetchShoppingRecords(householdId: String) -> [ShoppingItemRecord] {
        (try? context.fetch(FetchDescriptor<ShoppingItemRecord>(predicate: #Predicate { $0.householdId == householdId }))) ?? []
    }

    private func upsertShoppingItemWithoutEmit(householdId: String, item: ShoppingItem) {
        let record = fetchShoppingRecord(householdId: householdId, itemId: item.id) ?? ShoppingItemRecord(
            id: item.id,
            householdId: householdId,
            name: item.name,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unit: item.unit?.rawValue,
            category: item.category.rawValue,
            note: item.note,
            status: item.status.rawValue,
            addedBy: item.addedBy,
            addedByName: item.addedByName,
            boughtBy: item.boughtBy,
            boughtByName: item.boughtByName,
            isFavorite: item.isFavorite,
            isUrgent: item.isUrgent,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.apply(item, householdId: householdId)
    }

    private func fetchRecurringRecord(householdId: String, recurringItemId: String) -> RecurringItemRecord? {
        do {
            var descriptor = FetchDescriptor<RecurringItemRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == recurringItemId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }

    private func fetchRecurringRecords(householdId: String) -> [RecurringItemRecord] {
        (try? context.fetch(FetchDescriptor<RecurringItemRecord>(predicate: #Predicate { $0.householdId == householdId }))) ?? []
    }

    private func upsertRecurringItemWithoutEmit(_ item: RecurringItem) {
        let record = fetchRecurringRecord(householdId: item.householdId, recurringItemId: item.id) ?? RecurringItemRecord(
            id: item.id,
            householdId: item.householdId,
            name: item.name,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unit: item.unit?.rawValue,
            category: item.category.rawValue,
            note: item.note,
            intervalDays: item.intervalDays,
            enabled: item.enabled,
            nextDueAt: item.nextDueAt,
            lastCompletedAt: item.lastCompletedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.apply(item)
    }

    private func fetchActivityRecord(householdId: String, activityId: String) -> ActivityLogRecord? {
        do {
            var descriptor = FetchDescriptor<ActivityLogRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.id == activityId }
            )
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }

    private func fetchActivityRecords(householdId: String) -> [ActivityLogRecord] {
        (try? context.fetch(FetchDescriptor<ActivityLogRecord>(predicate: #Predicate { $0.householdId == householdId }))) ?? []
    }

    private func upsertActivityWithoutEmit(_ log: ActivityLog) {
        let record = fetchActivityRecord(householdId: log.householdId, activityId: log.id) ?? ActivityLogRecord(
            id: log.id,
            householdId: log.householdId,
            type: log.type.rawValue,
            itemId: log.itemId,
            itemName: log.itemName,
            actorUserId: log.actorUserId,
            actorDisplayName: log.actorDisplayName,
            message: log.message,
            createdAt: log.createdAt
        )
        if record.modelContext == nil { context.insert(record) }
        record.householdId = log.householdId
        record.type = log.type.rawValue
        record.itemId = log.itemId
        record.itemName = log.itemName
        record.actorUserId = log.actorUserId
        record.actorDisplayName = log.actorDisplayName
        record.message = log.message
        record.createdAt = log.createdAt
    }

    private func fetchHouseholdRecord(householdId: String) -> HouseholdRecord? {
        do {
            var descriptor = FetchDescriptor<HouseholdRecord>(predicate: #Predicate { $0.id == householdId })
            descriptor.fetchLimit = 1
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }

    private func pendingTargetIds(householdId: String, targetType: SyncTargetType) -> Set<String> {
        do {
            let targetTypeRawValue = targetType.rawValue
            let descriptor = FetchDescriptor<PendingSyncOperationRecord>(
                predicate: #Predicate { $0.householdId == householdId && $0.targetType == targetTypeRawValue }
            )
            return Set(try context.fetch(descriptor).map(\.targetId))
        } catch {
            return []
        }
    }

    private func saveAndEmitShopping(_ householdId: String) {
        try? context.save()
        emitShopping(householdId: householdId, status: nil)
        emitShopping(householdId: householdId, status: .active)
        emitShopping(householdId: householdId, status: .bought)
    }

    private func saveAndEmitRecurring(_ householdId: String) {
        try? context.save()
        emitRecurring(householdId: householdId, dueOnly: false)
        emitRecurring(householdId: householdId, dueOnly: true)
    }

    private func saveAndEmitActivity(_ householdId: String) {
        try? context.save()
        activityContinuations[householdId]?.values.forEach { $0.yield(fetchActivity(householdId: householdId)) }
    }

    private func emitShopping(householdId: String, status: ItemStatus?) {
        let key = shoppingKey(householdId: householdId, status: status)
        let value = fetchShoppingItems(householdId: householdId, status: status)
        shoppingContinuations[key]?.values.forEach { $0.yield(value) }
    }

    private func emitRecurring(householdId: String, dueOnly: Bool) {
        let key = recurringKey(householdId: householdId, dueOnly: dueOnly)
        let value = fetchRecurringItems(householdId: householdId, dueOnly: dueOnly)
        recurringContinuations[key]?.values.forEach { $0.yield(value) }
    }

    private func shoppingKey(householdId: String, status: ItemStatus?) -> String {
        "\(householdId)|\(status?.rawValue ?? "ALL")"
    }

    private func recurringKey(householdId: String, dueOnly: Bool) -> String {
        "\(householdId)|\(dueOnly ? "DUE" : "ALL")"
    }
}
