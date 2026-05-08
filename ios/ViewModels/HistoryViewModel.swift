import Foundation
import Combine

struct DayGroup: Identifiable {
    var id: String { dateLabel }
    var dateLabel: String
    var items: [ShoppingItem]
}

struct HistoryState {
    var dayGroups: [DayGroup] = []
    var expandedDays: Set<String> = []
    var items: [ShoppingItem] = []
    var isLoading = true
}

@MainActor
final class HistoryViewModel: ObservableObject {
    @Published var state = HistoryState()
    private let shoppingRepository: ShoppingRepository
    private let authRepository: AuthRepository
    private var householdId = ""
    private var task: Task<Void, Never>?

    init(shoppingRepository: ShoppingRepository, authRepository: AuthRepository) {
        self.shoppingRepository = shoppingRepository
        self.authRepository = authRepository
        task = Task { await observeBoughtItems() }
    }

    deinit { task?.cancel() }

    func toggleDay(_ dateLabel: String) {
        if state.expandedDays.contains(dateLabel) {
            state.expandedDays.remove(dateLabel)
        } else {
            state.expandedDays.insert(dateLabel)
        }
    }

    func returnToList(itemId: String) {
        Task { try? await shoppingRepository.markAsActive(householdId: householdId, itemId: itemId) }
    }

    private func observeBoughtItems() async {
        guard let user = await firstCurrentUser(from: authRepository), let activeHouseholdId = user.activeHouseholdId else {
            state.isLoading = false
            return
        }
        householdId = activeHouseholdId
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM/yyyy"
        for await items in shoppingRepository.observeBoughtItems(householdId: activeHouseholdId) {
            let sorted = items.sorted { ($0.updatedAt ?? .distantPast) > ($1.updatedAt ?? .distantPast) }
            let grouped = Dictionary(grouping: sorted) { item in
                item.updatedAt.map { formatter.string(from: $0) } ?? ""
            }
            state.dayGroups = grouped
                .map { DayGroup(dateLabel: $0.key, items: $0.value) }
                .sorted { $0.dateLabel > $1.dateLabel }
            state.items = sorted
            state.isLoading = false
        }
    }
}
