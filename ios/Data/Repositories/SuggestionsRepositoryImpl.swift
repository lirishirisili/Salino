import Foundation

@MainActor
final class SuggestionsRepositoryImpl: SuggestionsRepository {
    private let shoppingRepository: ShoppingRepository
    private let recurringRepository: RecurringRepository
    private let suggestionEngine: SuggestionEngine

    init(shoppingRepository: ShoppingRepository, recurringRepository: RecurringRepository, suggestionEngine: SuggestionEngine) {
        self.shoppingRepository = shoppingRepository
        self.recurringRepository = recurringRepository
        self.suggestionEngine = suggestionEngine
    }

    func observeSuggestions(householdId: String) -> AsyncStream<[SuggestionItem]> {
        let engine = suggestionEngine
        return AsyncStream { continuation in
            var activeItems: [ShoppingItem] = []
            var boughtItems: [ShoppingItem] = []
            var recurringItems: [RecurringItem] = []

            func yield() {
                continuation.yield(engine.buildSuggestions(
                    activeItems: activeItems,
                    boughtItems: boughtItems,
                    recurringItems: recurringItems,
                    now: Date()
                ))
            }

            let activeTask = Task { @MainActor in
                for await items in shoppingRepository.observeActiveItems(householdId: householdId) {
                    activeItems = items
                    yield()
                }
            }

            let boughtTask = Task { @MainActor in
                for await items in shoppingRepository.observeBoughtItems(householdId: householdId) {
                    boughtItems = items
                    yield()
                }
            }

            let recurringTask = Task { @MainActor in
                for await items in recurringRepository.observeRecurringItems(householdId: householdId) {
                    recurringItems = items
                    yield()
                }
            }

            continuation.onTermination = { _ in
                activeTask.cancel()
                boughtTask.cancel()
                recurringTask.cancel()
            }
        }
    }
}
