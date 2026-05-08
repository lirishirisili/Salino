import Foundation
import UIKit

@MainActor
protocol AuthRepository {
    var currentUserId: String? { get }
    var isSignedIn: Bool { get }

    func observeCurrentUser() -> AsyncStream<UserProfile?>
    func signInWithGoogle(presenting viewController: UIViewController) async throws -> UserProfile
    func signInWithEmail(email: String, password: String) async throws -> UserProfile
    func registerWithEmail(email: String, password: String) async throws -> UserProfile
    func getOrCreateUserProfile() async throws -> UserProfile
    func signOut() async
}

@MainActor
protocol HouseholdRepository {
    func createHousehold(name: String) async throws -> Household
    func joinHousehold(inviteCode: String) async throws -> Household
    func getHousehold(householdId: String) async throws -> Household
    func observeHousehold(householdId: String) -> AsyncStream<Household?>
    func observeHouseholdMembers(householdId: String) -> AsyncStream<[HouseholdMember]>
    func getInviteCode(householdId: String) async throws -> String
    func updateHouseholdName(householdId: String, newName: String) async throws
    func leaveHousehold(householdId: String) async throws
    func clearListeners()
}

@MainActor
protocol ShoppingRepository {
    func observeActiveItems(householdId: String) -> AsyncStream<[ShoppingItem]>
    func observeBoughtItems(householdId: String) -> AsyncStream<[ShoppingItem]>
    func observeAllItems(householdId: String) -> AsyncStream<[ShoppingItem]>
    func addItem(householdId: String, item: ShoppingItem) async throws -> String
    func updateItem(householdId: String, item: ShoppingItem) async throws
    func markAsBought(householdId: String, itemId: String, userId: String, userName: String) async throws
    func markAsActive(householdId: String, itemId: String) async throws
    func deleteItem(householdId: String, itemId: String) async throws
    func getItem(householdId: String, itemId: String) async throws -> ShoppingItem
    func toggleFavorite(householdId: String, itemId: String, isFavorite: Bool) async throws
    func flushPendingSync(householdId: String) async throws
    func forceRefreshSync(householdId: String)
    func clearListeners()
}

@MainActor
protocol RecurringRepository {
    func observeRecurringItems(householdId: String) -> AsyncStream<[RecurringItem]>
    func observeDueRecurringItems(householdId: String) -> AsyncStream<[RecurringItem]>
    func upsertRecurringItem(householdId: String, recurringItem: RecurringItem) async throws -> String
    func deleteRecurringItem(householdId: String, recurringItemId: String) async throws
    func findByNormalizedName(householdId: String, normalizedName: String) async throws -> RecurringItem?
    func updateNextDueDate(householdId: String, normalizedName: String, completedAt: Date) async throws
    func flushPendingSync(householdId: String) async throws
    func clearListeners()
}

@MainActor
protocol ActivityRepository {
    func observeActivityFeed(householdId: String) -> AsyncStream<[ActivityLog]>
    func logActivity(_ activityLog: ActivityLog) async throws
    func flushPendingSync(householdId: String) async throws
    func clearListeners()
}

@MainActor
protocol SuggestionsRepository {
    func observeSuggestions(householdId: String) -> AsyncStream<[SuggestionItem]>
}
