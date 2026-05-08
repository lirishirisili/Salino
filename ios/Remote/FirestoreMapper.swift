import Foundation
import FirebaseFirestore

enum FirestoreCollections {
    static let users = "users"
    static let households = "households"
    static let members = "members"
    static let items = "items"
    static let recurringItems = "recurringItems"
    static let activity = "activity"
}

func firestoreTimestamp(_ date: Date?) -> Any {
    guard let date else { return NSNull() }
    return Timestamp(date: date)
}

func firestoreNullable(_ value: Any?) -> Any {
    value ?? NSNull()
}

func dateValue(_ value: Any?) -> Date? {
    if let timestamp = value as? Timestamp { return timestamp.dateValue() }
    if let date = value as? Date { return date }
    return nil
}

extension DocumentSnapshot {
    var dataOrEmpty: [String: Any] { data() ?? [:] }
}

extension UserProfile {
    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            displayName: data["displayName"] as? String ?? "",
            email: data["email"] as? String ?? "",
            activeHouseholdId: data["activeHouseholdId"] as? String
        )
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "displayName": displayName,
            "email": email,
            "activeHouseholdId": firestoreNullable(activeHouseholdId)
        ]
    }
}

extension Household {
    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            name: data["name"] as? String ?? "",
            createdBy: data["createdBy"] as? String ?? "",
            createdAt: dateValue(data["createdAt"]),
            inviteCode: data["inviteCode"] as? String ?? ""
        )
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "name": name,
            "createdBy": createdBy,
            "createdAt": firestoreTimestamp(createdAt),
            "inviteCode": inviteCode
        ]
    }
}

extension HouseholdMember {
    init(data: [String: Any]) {
        self.init(
            userId: data["userId"] as? String ?? "",
            displayName: data["displayName"] as? String ?? "",
            role: MemberRole(rawValue: data["role"] as? String ?? "") ?? .member,
            joinedAt: dateValue(data["joinedAt"])
        )
    }

    var firestoreData: [String: Any] {
        [
            "userId": userId,
            "displayName": displayName,
            "role": role.rawValue,
            "joinedAt": firestoreTimestamp(joinedAt)
        ]
    }
}

extension ShoppingItem {
    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            name: data["name"] as? String ?? "",
            normalizedName: data["normalizedName"] as? String ?? "",
            quantity: data["quantity"] as? Double ?? 1.0,
            unit: ItemUnit.from(data["unit"] as? String),
            category: ItemCategory.from(data["category"] as? String),
            note: data["note"] as? String ?? "",
            status: ItemStatus(rawValue: data["status"] as? String ?? "") ?? .active,
            addedBy: data["addedBy"] as? String ?? "",
            addedByName: data["addedByName"] as? String ?? "",
            boughtBy: data["boughtBy"] as? String,
            boughtByName: data["boughtByName"] as? String,
            isFavorite: data["isFavorite"] as? Bool ?? false,
            isUrgent: data["isUrgent"] as? Bool ?? false,
            createdAt: dateValue(data["createdAt"]),
            updatedAt: dateValue(data["updatedAt"])
        )
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "name": name,
            "normalizedName": normalizedName,
            "quantity": quantity,
            "unit": firestoreNullable(unit?.rawValue),
            "category": category.rawValue,
            "note": note,
            "status": status.rawValue,
            "addedBy": addedBy,
            "addedByName": addedByName,
            "boughtBy": firestoreNullable(boughtBy),
            "boughtByName": firestoreNullable(boughtByName),
            "isFavorite": isFavorite,
            "isUrgent": isUrgent,
            "createdAt": firestoreTimestamp(createdAt),
            "updatedAt": firestoreTimestamp(updatedAt)
        ]
    }
}

extension RecurringItem {
    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            householdId: data["householdId"] as? String ?? "",
            name: data["name"] as? String ?? "",
            normalizedName: data["normalizedName"] as? String ?? "",
            quantity: data["quantity"] as? Double ?? 1.0,
            unit: ItemUnit.from(data["unit"] as? String),
            category: ItemCategory.from(data["category"] as? String),
            note: data["note"] as? String ?? "",
            intervalDays: data["intervalDays"] as? Int ?? 7,
            enabled: data["enabled"] as? Bool ?? true,
            nextDueAt: dateValue(data["nextDueAt"]),
            lastCompletedAt: dateValue(data["lastCompletedAt"]),
            createdAt: dateValue(data["createdAt"]),
            updatedAt: dateValue(data["updatedAt"])
        )
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "householdId": householdId,
            "name": name,
            "normalizedName": normalizedName,
            "quantity": quantity,
            "unit": firestoreNullable(unit?.rawValue),
            "category": category.rawValue,
            "note": note,
            "intervalDays": intervalDays,
            "enabled": enabled,
            "nextDueAt": firestoreTimestamp(nextDueAt),
            "lastCompletedAt": firestoreTimestamp(lastCompletedAt),
            "createdAt": firestoreTimestamp(createdAt),
            "updatedAt": firestoreTimestamp(updatedAt)
        ]
    }
}

extension ActivityLog {
    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            householdId: data["householdId"] as? String ?? "",
            type: ActivityType(rawValue: data["type"] as? String ?? "") ?? .itemAdded,
            itemId: data["itemId"] as? String,
            itemName: data["itemName"] as? String ?? "",
            actorUserId: data["actorUserId"] as? String ?? "",
            actorDisplayName: data["actorDisplayName"] as? String ?? "",
            message: data["message"] as? String ?? "",
            createdAt: dateValue(data["createdAt"])
        )
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "householdId": householdId,
            "type": type.rawValue,
            "itemId": firestoreNullable(itemId),
            "itemName": itemName,
            "actorUserId": actorUserId,
            "actorDisplayName": actorDisplayName,
            "message": message,
            "createdAt": firestoreTimestamp(createdAt)
        ]
    }
}
