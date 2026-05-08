import Foundation
import Combine

enum SupermarketFilter: String, CaseIterable, Identifiable {
    case all
    case urgent
    case mine
    case pharmacy
    case notFound

    var id: String { rawValue }

    var localizedKey: String {
        switch self {
        case .all: "supermarket_mode_filter_all_label"
        case .urgent: "supermarket_mode_filter_urgent"
        case .mine: "supermarket_mode_filter_mine"
        case .pharmacy: "supermarket_mode_filter_pharmacy_label"
        case .notFound: "supermarket_mode_filter_not_found"
        }
    }
}

struct SupermarketModeState {
    var groupedItems: [ItemCategory: [ShoppingItem]] = [:]
    var remainingCount = 0
    var totalCount = 0
    var boughtInSessionCount = 0
    var isLoading = true
    var currentUserId = ""
    var currentUserName = ""
    var activeFilter: SupermarketFilter = .all
    var lastBoughtItem: ShoppingItem?
    var allDone = false
    var collapsedCategories: Set<ItemCategory> = []
    var notFoundItems: Set<String> = []
    var hideBought = true
    var boughtItems: [ShoppingItem] = []
    var notFoundCount = 0
}

@MainActor
final class SupermarketModeViewModel: ObservableObject {
    @Published var state = SupermarketModeState()
    private let shoppingRepository: ShoppingRepository
    private let authRepository: AuthRepository
    private var householdId = ""
    private var allActiveItems: [ShoppingItem] = []
    private var sessionBoughtItems: [ShoppingItem] = []
    private var sessionStartItemCount = 0
    private var sessionStarted = false
    private var task: Task<Void, Never>?

    init(shoppingRepository: ShoppingRepository, authRepository: AuthRepository) {
        self.shoppingRepository = shoppingRepository
        self.authRepository = authRepository
        task = Task { await observeItems() }
    }

    deinit { task?.cancel() }

    func setFilter(_ filter: SupermarketFilter) {
        state.activeFilter = filter
        updateGroupedItems()
    }

    func toggleCategoryCollapse(_ category: ItemCategory) {
        if state.collapsedCategories.contains(category) { state.collapsedCategories.remove(category) }
        else { state.collapsedCategories.insert(category) }
    }

    func toggleHideBought() {
        state.hideBought.toggle()
    }

    func markAsBought(_ item: ShoppingItem) {
        sessionBoughtItems.append(item)
        state.lastBoughtItem = item
        Task {
            try? await shoppingRepository.markAsBought(
                householdId: householdId,
                itemId: item.id,
                userId: state.currentUserId,
                userName: state.currentUserName
            )
        }
    }

    func markNotFound(_ item: ShoppingItem) {
        state.notFoundItems.insert(item.id)
        updateGroupedItems()
    }

    func undoNotFound(_ item: ShoppingItem) {
        state.notFoundItems.remove(item.id)
        updateGroupedItems()
    }

    func undoLastBought() {
        guard let item = state.lastBoughtItem else { return }
        undoBought(item)
    }

    func undoBought(_ item: ShoppingItem) {
        sessionBoughtItems.removeAll { $0.id == item.id }
        if state.lastBoughtItem?.id == item.id { state.lastBoughtItem = nil }
        Task { try? await shoppingRepository.markAsActive(householdId: householdId, itemId: item.id) }
    }

    func clearLastBought() {
        state.lastBoughtItem = nil
    }

    private func observeItems() async {
        guard let user = await firstCurrentUser(from: authRepository), let activeHouseholdId = user.activeHouseholdId else {
            state.isLoading = false
            return
        }
        householdId = activeHouseholdId
        state.currentUserId = user.id
        state.currentUserName = user.displayName
        for await items in shoppingRepository.observeActiveItems(householdId: activeHouseholdId) {
            allActiveItems = items
            if !sessionStarted {
                sessionStartItemCount = items.count
                sessionStarted = true
            }
            updateGroupedItems()
        }
    }

    private func updateGroupedItems() {
        let activeNonNotFound = allActiveItems.filter { !state.notFoundItems.contains($0.id) }
        let notFoundList = allActiveItems.filter { state.notFoundItems.contains($0.id) }
        let display: [ShoppingItem]
        switch state.activeFilter {
        case .all:
            display = activeNonNotFound
        case .urgent:
            display = activeNonNotFound.filter { $0.isUrgent }
        case .mine:
            display = activeNonNotFound.filter { $0.addedBy == state.currentUserId }
        case .pharmacy:
            display = activeNonNotFound.filter { $0.category == .pharmacy }
        case .notFound:
            display = notFoundList
        }

        let grouped = Dictionary(grouping: display.sorted { lhs, rhs in
            if lhs.isUrgent != rhs.isUrgent { return lhs.isUrgent && !rhs.isUrgent }
            return lhs.name < rhs.name
        }, by: \.category)

        state.groupedItems = grouped
        state.remainingCount = activeNonNotFound.count
        state.totalCount = sessionStartItemCount
        state.boughtInSessionCount = max(sessionStartItemCount - allActiveItems.count, 0)
        state.isLoading = false
        state.allDone = sessionStarted && activeNonNotFound.isEmpty && sessionStartItemCount > 0
        state.boughtItems = sessionBoughtItems
        state.notFoundCount = state.notFoundItems.count
    }
}
