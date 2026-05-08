import Foundation
import SwiftData

@Model
final class ShoppingItemRecord {
    @Attribute(.unique) var id: String
    var householdId: String
    var name: String
    var normalizedName: String
    var quantity: Double
    var unit: String?
    var category: String
    var note: String
    var status: String
    var addedBy: String
    var addedByName: String
    var boughtBy: String?
    var boughtByName: String?
    var isFavorite: Bool
    var isUrgent: Bool
    var createdAt: Date?
    var updatedAt: Date?

    init(
        id: String,
        householdId: String,
        name: String,
        normalizedName: String,
        quantity: Double,
        unit: String?,
        category: String,
        note: String,
        status: String,
        addedBy: String,
        addedByName: String,
        boughtBy: String?,
        boughtByName: String?,
        isFavorite: Bool,
        isUrgent: Bool,
        createdAt: Date?,
        updatedAt: Date?
    ) {
        self.id = id
        self.householdId = householdId
        self.name = name
        self.normalizedName = normalizedName
        self.quantity = quantity
        self.unit = unit
        self.category = category
        self.note = note
        self.status = status
        self.addedBy = addedBy
        self.addedByName = addedByName
        self.boughtBy = boughtBy
        self.boughtByName = boughtByName
        self.isFavorite = isFavorite
        self.isUrgent = isUrgent
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class RecurringItemRecord {
    @Attribute(.unique) var id: String
    var householdId: String
    var name: String
    var normalizedName: String
    var quantity: Double
    var unit: String?
    var category: String
    var note: String
    var intervalDays: Int
    var enabled: Bool
    var nextDueAt: Date?
    var lastCompletedAt: Date?
    var createdAt: Date?
    var updatedAt: Date?

    init(
        id: String,
        householdId: String,
        name: String,
        normalizedName: String,
        quantity: Double,
        unit: String?,
        category: String,
        note: String,
        intervalDays: Int,
        enabled: Bool,
        nextDueAt: Date?,
        lastCompletedAt: Date?,
        createdAt: Date?,
        updatedAt: Date?
    ) {
        self.id = id
        self.householdId = householdId
        self.name = name
        self.normalizedName = normalizedName
        self.quantity = quantity
        self.unit = unit
        self.category = category
        self.note = note
        self.intervalDays = intervalDays
        self.enabled = enabled
        self.nextDueAt = nextDueAt
        self.lastCompletedAt = lastCompletedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class ActivityLogRecord {
    @Attribute(.unique) var id: String
    var householdId: String
    var type: String
    var itemId: String?
    var itemName: String
    var actorUserId: String
    var actorDisplayName: String
    var message: String
    var createdAt: Date?

    init(
        id: String,
        householdId: String,
        type: String,
        itemId: String?,
        itemName: String,
        actorUserId: String,
        actorDisplayName: String,
        message: String,
        createdAt: Date?
    ) {
        self.id = id
        self.householdId = householdId
        self.type = type
        self.itemId = itemId
        self.itemName = itemName
        self.actorUserId = actorUserId
        self.actorDisplayName = actorDisplayName
        self.message = message
        self.createdAt = createdAt
    }
}

@Model
final class HouseholdRecord {
    @Attribute(.unique) var id: String
    var name: String
    var createdBy: String
    var createdAt: Date?
    var inviteCode: String
    var isCurrent: Bool

    init(id: String, name: String, createdBy: String, createdAt: Date?, inviteCode: String, isCurrent: Bool) {
        self.id = id
        self.name = name
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.inviteCode = inviteCode
        self.isCurrent = isCurrent
    }
}

@Model
final class HouseholdMemberRecord {
    @Attribute(.unique) var compoundId: String
    var householdId: String
    var userId: String
    var displayName: String
    var role: String
    var joinedAt: Date?

    init(householdId: String, userId: String, displayName: String, role: String, joinedAt: Date?) {
        self.compoundId = "\(householdId)_\(userId)"
        self.householdId = householdId
        self.userId = userId
        self.displayName = displayName
        self.role = role
        self.joinedAt = joinedAt
    }
}

@Model
final class PendingSyncOperationRecord {
    @Attribute(.unique) var id: String
    var householdId: String
    var targetType: String
    var operationType: String
    var targetId: String
    var createdAt: Date

    init(id: String, householdId: String, targetType: String, operationType: String, targetId: String, createdAt: Date) {
        self.id = id
        self.householdId = householdId
        self.targetType = targetType
        self.operationType = operationType
        self.targetId = targetId
        self.createdAt = createdAt
    }
}

enum SyncTargetType: String {
    case item = "ITEM"
    case activity = "ACTIVITY"
    case recurring = "RECURRING"
}

enum SyncOperationType: String {
    case upsert = "UPSERT"
    case delete = "DELETE"
}

extension ShoppingItemRecord {
    func toModel() -> ShoppingItem {
        ShoppingItem(
            id: id,
            name: name,
            normalizedName: normalizedName,
            quantity: quantity,
            unit: ItemUnit.from(unit),
            category: ItemCategory.from(category),
            note: note,
            status: ItemStatus(rawValue: status) ?? .active,
            addedBy: addedBy,
            addedByName: addedByName,
            boughtBy: boughtBy,
            boughtByName: boughtByName,
            isFavorite: isFavorite,
            isUrgent: isUrgent,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    func apply(_ item: ShoppingItem, householdId: String) {
        self.householdId = householdId
        name = item.name
        normalizedName = item.normalizedName
        quantity = item.quantity
        unit = item.unit?.rawValue
        category = item.category.rawValue
        note = item.note
        status = item.status.rawValue
        addedBy = item.addedBy
        addedByName = item.addedByName
        boughtBy = item.boughtBy
        boughtByName = item.boughtByName
        isFavorite = item.isFavorite
        isUrgent = item.isUrgent
        createdAt = item.createdAt
        updatedAt = item.updatedAt
    }
}

extension RecurringItemRecord {
    func toModel() -> RecurringItem {
        RecurringItem(
            id: id,
            householdId: householdId,
            name: name,
            normalizedName: normalizedName,
            quantity: quantity,
            unit: ItemUnit.from(unit),
            category: ItemCategory.from(category),
            note: note,
            intervalDays: intervalDays,
            enabled: enabled,
            nextDueAt: nextDueAt,
            lastCompletedAt: lastCompletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    func apply(_ item: RecurringItem) {
        householdId = item.householdId
        name = item.name
        normalizedName = item.normalizedName
        quantity = item.quantity
        unit = item.unit?.rawValue
        category = item.category.rawValue
        note = item.note
        intervalDays = item.intervalDays
        enabled = item.enabled
        nextDueAt = item.nextDueAt
        lastCompletedAt = item.lastCompletedAt
        createdAt = item.createdAt
        updatedAt = item.updatedAt
    }
}

extension ActivityLogRecord {
    func toModel() -> ActivityLog {
        ActivityLog(
            id: id,
            householdId: householdId,
            type: ActivityType(rawValue: type) ?? .itemAdded,
            itemId: itemId,
            itemName: itemName,
            actorUserId: actorUserId,
            actorDisplayName: actorDisplayName,
            message: message,
            createdAt: createdAt
        )
    }
}

extension HouseholdRecord {
    func toModel() -> Household {
        Household(id: id, name: name, createdBy: createdBy, createdAt: createdAt, inviteCode: inviteCode)
    }
}

extension HouseholdMemberRecord {
    func toModel() -> HouseholdMember {
        HouseholdMember(
            userId: userId,
            displayName: displayName,
            role: MemberRole(rawValue: role) ?? .member,
            joinedAt: joinedAt
        )
    }
}
