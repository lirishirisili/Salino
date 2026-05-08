import Foundation
import Combine

struct ShoppingListState {
    var activeItems: [ShoppingItem] = []
    var boughtItems: [ShoppingItem] = []
    var suggestions: [SuggestionItem] = []
    var isLoading = true
    var errorMessage: String?
    var searchQuery = ""
    var selectedCategory: ItemCategory?
    var currentUserId = ""
    var currentUserName = ""
}

@MainActor
final class ShoppingListViewModel: ObservableObject {
    @Published var state = ShoppingListState()
    private let shoppingRepository: ShoppingRepository
    private let authRepository: AuthRepository
    private let suggestionsRepository: SuggestionsRepository
    private let activityRepository: ActivityRepository
    private var householdId = ""
    private var tasks: [Task<Void, Never>] = []

    init(
        shoppingRepository: ShoppingRepository,
        authRepository: AuthRepository,
        suggestionsRepository: SuggestionsRepository,
        activityRepository: ActivityRepository
    ) {
        self.shoppingRepository = shoppingRepository
        self.authRepository = authRepository
        self.suggestionsRepository = suggestionsRepository
        self.activityRepository = activityRepository
        Task { await loadData() }
    }

    deinit {
        tasks.forEach { $0.cancel() }
    }

    var filteredActiveItems: [ShoppingItem] {
        var filtered = state.activeItems
        if !state.searchQuery.isEmpty {
            filtered = filtered.filter { $0.name.localizedCaseInsensitiveContains(state.searchQuery) }
        }
        if let category = state.selectedCategory {
            filtered = filtered.filter { $0.category == category }
        }
        return filtered.sorted {
            if $0.isFavorite != $1.isFavorite { return $0.isFavorite && !$1.isFavorite }
            if $0.isUrgent != $1.isUrgent { return $0.isUrgent && !$1.isUrgent }
            return $0.name < $1.name
        }
    }

    func onSearchQueryChange(_ query: String) {
        state.searchQuery = query
    }

    func onCategorySelected(_ category: ItemCategory?) {
        state.selectedCategory = state.selectedCategory == category ? nil : category
    }

    func markAsBought(itemId: String) {
        Task {
            try? await shoppingRepository.markAsBought(
                householdId: householdId,
                itemId: itemId,
                userId: state.currentUserId,
                userName: state.currentUserName
            )
        }
    }

    func markAsActive(itemId: String) {
        Task { try? await shoppingRepository.markAsActive(householdId: householdId, itemId: itemId) }
    }

    func deleteItem(itemId: String) {
        Task { try? await shoppingRepository.deleteItem(householdId: householdId, itemId: itemId) }
    }

    func toggleFavorite(itemId: String, isFavorite: Bool) {
        Task { try? await shoppingRepository.toggleFavorite(householdId: householdId, itemId: itemId, isFavorite: isFavorite) }
    }

    func addSuggestion(_ suggestion: SuggestionItem) {
        Task {
            do {
                _ = try await shoppingRepository.addItem(
                    householdId: householdId,
                    item: ShoppingItem(
                        name: suggestion.name,
                        normalizedName: suggestion.normalizedName,
                        quantity: suggestion.quantity,
                        unit: suggestion.unit,
                        category: suggestion.category,
                        note: suggestion.note,
                        addedBy: state.currentUserId,
                        addedByName: state.currentUserName
                    )
                )
                try await activityRepository.logActivity(ActivityLog(
                    id: UUID().uuidString,
                    householdId: householdId,
                    type: .suggestionAccepted,
                    itemName: suggestion.name,
                    actorUserId: state.currentUserId,
                    actorDisplayName: state.currentUserName,
                    createdAt: Date()
                ))
            } catch {}
        }
    }

    func forceRefresh() {
        guard !householdId.isEmpty else { return }
        shoppingRepository.forceRefreshSync(householdId: householdId)
    }

    private func loadData() async {
        guard let user = await firstCurrentUser(from: authRepository),
              let activeHouseholdId = user.activeHouseholdId,
              !activeHouseholdId.isEmpty else {
            state.isLoading = false
            return
        }

        householdId = activeHouseholdId
        state.currentUserId = user.id
        state.currentUserName = user.displayName

        tasks.append(Task { @MainActor in
            for await items in shoppingRepository.observeActiveItems(householdId: activeHouseholdId) {
                state.activeItems = items
                state.isLoading = false
            }
        })

        tasks.append(Task { @MainActor in
            for await items in shoppingRepository.observeBoughtItems(householdId: activeHouseholdId) {
                state.boughtItems = Array(items.prefix(5))
            }
        })

        tasks.append(Task { @MainActor in
            for await suggestions in suggestionsRepository.observeSuggestions(householdId: activeHouseholdId) {
                state.suggestions = suggestions
            }
        })

        shoppingRepository.forceRefreshSync(householdId: activeHouseholdId)
    }
}
