import Foundation

struct UserProfile: Identifiable, Codable, Equatable {
    var id: String = ""
    var displayName: String = ""
    var email: String = ""
    var activeHouseholdId: String?
}

struct Household: Identifiable, Codable, Equatable {
    var id: String = ""
    var name: String = ""
    var createdBy: String = ""
    var createdAt: Date?
    var inviteCode: String = ""
}

struct HouseholdMember: Identifiable, Codable, Equatable {
    var id: String { userId }
    var userId: String = ""
    var displayName: String = ""
    var role: MemberRole = .member
    var joinedAt: Date?
}

struct ShoppingItem: Identifiable, Codable, Equatable {
    var id: String = ""
    var name: String = ""
    var normalizedName: String = ""
    var quantity: Double = 1.0
    var unit: ItemUnit?
    var category: ItemCategory = .other
    var note: String = ""
    var status: ItemStatus = .active
    var addedBy: String = ""
    var addedByName: String = ""
    var boughtBy: String?
    var boughtByName: String?
    var isFavorite: Bool = false
    var isUrgent: Bool = false
    var createdAt: Date?
    var updatedAt: Date?

    var isActive: Bool { status == .active }
    var isBought: Bool { status == .bought }
}

struct RecurringItem: Identifiable, Codable, Equatable {
    var id: String = ""
    var householdId: String = ""
    var name: String = ""
    var normalizedName: String = ""
    var quantity: Double = 1.0
    var unit: ItemUnit?
    var category: ItemCategory = .other
    var note: String = ""
    var intervalDays: Int = 7
    var enabled: Bool = true
    var nextDueAt: Date?
    var lastCompletedAt: Date?
    var createdAt: Date?
    var updatedAt: Date?
}

struct ActivityLog: Identifiable, Codable, Equatable {
    var id: String = ""
    var householdId: String = ""
    var type: ActivityType = .itemAdded
    var itemId: String?
    var itemName: String = ""
    var actorUserId: String = ""
    var actorDisplayName: String = ""
    var message: String = ""
    var createdAt: Date?
}

struct SuggestionItem: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var normalizedName: String
    var quantity: Double = 1.0
    var unit: ItemUnit?
    var category: ItemCategory = .other
    var note: String = ""
    var reason: String
    var source: SuggestionSource
    var recurringItemId: String?
}

enum ItemCategory: String, CaseIterable, Codable, Identifiable, Comparable {
    case dairy = "DAIRY"
    case vegetables = "VEGETABLES"
    case fruits = "FRUITS"
    case meatFish = "MEAT_FISH"
    case bakery = "BAKERY"
    case cleaning = "CLEANING"
    case pantry = "PANTRY"
    case snacks = "SNACKS"
    case beverages = "BEVERAGES"
    case pharmacy = "PHARMACY"
    case other = "OTHER"

    var id: String { rawValue }

    var localizedKey: String {
        switch self {
        case .dairy: "category_dairy"
        case .vegetables: "category_vegetables"
        case .fruits: "category_fruits"
        case .meatFish: "category_meat_fish"
        case .bakery: "category_bakery"
        case .cleaning: "category_cleaning"
        case .pantry: "category_pantry"
        case .snacks: "category_snacks"
        case .beverages: "category_beverages"
        case .pharmacy: "category_pharmacy"
        case .other: "category_other"
        }
    }

    static func < (lhs: ItemCategory, rhs: ItemCategory) -> Bool {
        allCases.firstIndex(of: lhs)! < allCases.firstIndex(of: rhs)!
    }

    static func from(_ value: String?) -> ItemCategory {
        guard let value else { return .other }
        return ItemCategory(rawValue: value.uppercased()) ?? .other
    }
}

enum ItemStatus: String, Codable {
    case active = "ACTIVE"
    case bought = "BOUGHT"
}

enum ItemUnit: String, CaseIterable, Codable, Identifiable {
    case pieces = "PIECES"
    case kg = "KG"
    case grams = "GRAMS"
    case liters = "LITERS"
    case packs = "PACKS"
    case bottles = "BOTTLES"
    case bags = "BAGS"

    var id: String { rawValue }

    var localizedKey: String {
        switch self {
        case .pieces: "unit_pieces"
        case .kg: "unit_kg"
        case .grams: "unit_grams"
        case .liters: "unit_liters"
        case .packs: "unit_packs"
        case .bottles: "unit_bottles"
        case .bags: "unit_bags"
        }
    }

    static func from(_ value: String?) -> ItemUnit? {
        guard let value else { return nil }
        return ItemUnit(rawValue: value.uppercased())
    }
}

enum MemberRole: String, Codable {
    case owner = "OWNER"
    case member = "MEMBER"
}

enum ActivityType: String, Codable {
    case itemAdded = "ITEM_ADDED"
    case itemUpdated = "ITEM_UPDATED"
    case itemBought = "ITEM_BOUGHT"
    case itemRestored = "ITEM_RESTORED"
    case itemDeleted = "ITEM_DELETED"
    case recurringCreated = "RECURRING_CREATED"
    case recurringUpdated = "RECURRING_UPDATED"
    case recurringSuggestionSurfaced = "RECURRING_SUGGESTION_SURFACED"
    case suggestionAccepted = "SUGGESTION_ACCEPTED"

    var localizedKey: String {
        switch self {
        case .itemAdded: "activity_type_item_added"
        case .itemUpdated: "activity_type_item_updated"
        case .itemBought: "activity_type_item_bought"
        case .itemRestored: "activity_type_item_restored"
        case .itemDeleted: "activity_type_item_deleted"
        case .recurringCreated: "activity_type_recurring_created"
        case .recurringUpdated: "activity_type_recurring_updated"
        case .recurringSuggestionSurfaced: "activity_type_recurring_updated"
        case .suggestionAccepted: "activity_type_suggestion_accepted"
        }
    }
}

enum SuggestionSource: String, Codable {
    case frequent = "FREQUENT"
    case recent = "RECENT"
    case recurring = "RECURRING"
}
