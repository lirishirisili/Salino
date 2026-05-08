import Foundation
import Combine

struct ItemFormState {
    var name = ""
    var quantity = "1"
    var unit: ItemUnit?
    var category: ItemCategory = .other
    var note = ""
    var duplicateMatch: DuplicateMatch?
    var suggestions: [SuggestionItem] = []
    var isRecurring = false
    var recurrenceDays = "7"
    var isUrgent = false
    var isCategoryAutoDetected = false
    var isLoading = false
    var errorMessage: String?
    var isSaved = false
    var isDeleted = false
}

@MainActor
final class AddItemViewModel: ObservableObject {
    @Published var state = ItemFormState()
    private let shoppingRepository: ShoppingRepository
    private let authRepository: AuthRepository
    private let suggestionsRepository: SuggestionsRepository
    private let recurringRepository: RecurringRepository
    private let categoryAutoDetector: CategoryAutoDetector
    private let duplicateDetector: DuplicateDetector
    private let voiceInputParser: VoiceInputParser

    private var householdId = ""
    private var currentUserId = ""
    private var currentUserName = ""
    private var activeItems: [ShoppingItem] = []
    private var categoryManuallyChanged = false
    private var tasks: [Task<Void, Never>] = []
    private let day: TimeInterval = 24 * 60 * 60

    init(container: AppContainer) {
        self.shoppingRepository = container.shoppingRepository
        self.authRepository = container.authRepository
        self.suggestionsRepository = container.suggestionsRepository
        self.recurringRepository = container.recurringRepository
        self.categoryAutoDetector = container.categoryAutoDetector
        self.duplicateDetector = container.duplicateDetector
        self.voiceInputParser = container.voiceInputParser
        Task { await observeContext() }
    }

    deinit { tasks.forEach { $0.cancel() } }

    func onNameChange(_ value: String) {
        let detected = categoryManuallyChanged ? nil : categoryAutoDetector.detectCategory(itemName: value)
        state.name = value
        state.errorMessage = nil
        if let detected {
            state.category = detected
            state.isCategoryAutoDetected = true
        } else if !categoryManuallyChanged {
            state.isCategoryAutoDetected = false
        }
        recomputeDuplicate()
    }

    func onQuantityChange(_ value: String) {
        state.quantity = value.filter { $0.isNumber || $0 == "." || $0 == "," }
    }

    func onUnitChange(_ value: ItemUnit?) { state.unit = value }
    func onCategoryChange(_ value: ItemCategory) {
        categoryManuallyChanged = true
        state.category = value
        state.isCategoryAutoDetected = false
    }
    func onNoteChange(_ value: String) { state.note = value }
    func onRecurringToggle(_ enabled: Bool) { state.isRecurring = enabled }
    func onRecurrenceDaysChange(_ value: String) { state.recurrenceDays = value.filter(\.isNumber) }
    func onUrgentToggle(_ enabled: Bool) { state.isUrgent = enabled }

    func onVoiceResult(_ spokenText: String) {
        let parsed = voiceInputParser.parse(spokenText: spokenText)
        categoryManuallyChanged = false
        state.name = parsed.name
        state.quantity = formatQuantity(parsed.quantity)
        state.unit = parsed.unit ?? state.unit
        state.category = categoryAutoDetector.detectCategory(itemName: parsed.name) ?? .other
        state.isCategoryAutoDetected = true
        recomputeDuplicate()
    }

    func applySuggestion(_ suggestion: SuggestionItem) {
        state.name = suggestion.name
        state.quantity = formatQuantity(suggestion.quantity)
        state.unit = suggestion.unit
        state.category = suggestion.category
        state.note = suggestion.note
        state.isCategoryAutoDetected = false
        categoryManuallyChanged = true
        recomputeDuplicate()
    }

    func mergeWithDuplicate() {
        guard let duplicate = state.duplicateMatch else { return }
        Task {
            var merged = duplicate.item
            merged.quantity += parseQuantity(state.quantity) ?? 1
            if merged.note.isEmpty { merged.note = state.note.trimmingCharacters(in: .whitespacesAndNewlines) }
            try? await shoppingRepository.updateItem(householdId: householdId, item: merged)
            await saveRecurringTemplateIfNeeded(item: merged)
            state.isSaved = true
        }
    }

    func addItem() {
        guard !state.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state.errorMessage = "empty_name"
            return
        }
        Task {
            state.isLoading = true
            let item = ShoppingItem(
                name: state.name.trimmingCharacters(in: .whitespacesAndNewlines),
                normalizedName: normalizeItemName(state.name),
                quantity: parseQuantity(state.quantity) ?? 1,
                unit: state.unit,
                category: state.category,
                note: state.note.trimmingCharacters(in: .whitespacesAndNewlines),
                addedBy: currentUserId,
                addedByName: currentUserName,
                isUrgent: state.isUrgent
            )
            do {
                _ = try await shoppingRepository.addItem(householdId: householdId, item: item)
                await saveRecurringTemplateIfNeeded(item: item)
                state.isLoading = false
                state.isSaved = true
            } catch {
                state.isLoading = false
                state.errorMessage = "generic"
            }
        }
    }

    private func observeContext() async {
        guard let user = await firstCurrentUser(from: authRepository),
              let activeHouseholdId = user.activeHouseholdId else { return }
        householdId = activeHouseholdId
        currentUserId = user.id
        currentUserName = user.displayName

        tasks.append(Task { @MainActor in
            for await items in shoppingRepository.observeActiveItems(householdId: activeHouseholdId) {
                activeItems = items
                recomputeDuplicate()
            }
        })
        tasks.append(Task { @MainActor in
            for await suggestions in suggestionsRepository.observeSuggestions(householdId: activeHouseholdId) {
                state.suggestions = suggestions
            }
        })
    }

    private func recomputeDuplicate() {
        state.duplicateMatch = duplicateDetector.findDuplicate(draftName: state.name, existingItems: activeItems, excludeItemId: nil)
    }

    private func saveRecurringTemplateIfNeeded(item: ShoppingItem) async {
        guard state.isRecurring, !householdId.isEmpty else { return }
        let interval = max(Int(state.recurrenceDays) ?? 7, 1)
        try? await recurringRepository.upsertRecurringItem(
            householdId: householdId,
            recurringItem: RecurringItem(
                householdId: householdId,
                name: item.name,
                normalizedName: item.normalizedName.isEmpty ? normalizeItemName(item.name) : item.normalizedName,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                note: item.note,
                intervalDays: interval,
                nextDueAt: Date().addingTimeInterval(TimeInterval(interval) * day)
            )
        )
    }
}

@MainActor
final class EditItemViewModel: ObservableObject {
    @Published var state = ItemFormState(isLoading: true)
    private let itemId: String
    private let shoppingRepository: ShoppingRepository
    private let authRepository: AuthRepository
    private let recurringRepository: RecurringRepository
    private let categoryAutoDetector: CategoryAutoDetector
    private let duplicateDetector: DuplicateDetector
    private let voiceInputParser: VoiceInputParser
    private var householdId = ""
    private var originalItem: ShoppingItem?
    private var recurringItemId: String?
    private var activeItems: [ShoppingItem] = []
    private var categoryManuallyChanged = false
    private var tasks: [Task<Void, Never>] = []
    private let day: TimeInterval = 24 * 60 * 60

    init(itemId: String, container: AppContainer) {
        self.itemId = itemId
        self.shoppingRepository = container.shoppingRepository
        self.authRepository = container.authRepository
        self.recurringRepository = container.recurringRepository
        self.categoryAutoDetector = container.categoryAutoDetector
        self.duplicateDetector = container.duplicateDetector
        self.voiceInputParser = container.voiceInputParser
        Task { await loadItem() }
    }

    deinit { tasks.forEach { $0.cancel() } }

    func onNameChange(_ value: String) {
        let detected = categoryManuallyChanged ? nil : categoryAutoDetector.detectCategory(itemName: value)
        state.name = value
        state.errorMessage = nil
        if let detected {
            state.category = detected
            state.isCategoryAutoDetected = true
        }
        recomputeDuplicate()
    }

    func onQuantityChange(_ value: String) { state.quantity = value.filter { $0.isNumber || $0 == "." || $0 == "," } }
    func onUnitChange(_ value: ItemUnit?) { state.unit = value }
    func onCategoryChange(_ value: ItemCategory) {
        categoryManuallyChanged = true
        state.category = value
        state.isCategoryAutoDetected = false
    }
    func onNoteChange(_ value: String) { state.note = value }
    func onRecurringToggle(_ enabled: Bool) { state.isRecurring = enabled }
    func onRecurrenceDaysChange(_ value: String) { state.recurrenceDays = value.filter(\.isNumber) }
    func onUrgentToggle(_ enabled: Bool) { state.isUrgent = enabled }

    func onVoiceResult(_ spokenText: String) {
        let parsed = voiceInputParser.parse(spokenText: spokenText)
        state.name = parsed.name
        state.quantity = formatQuantity(parsed.quantity)
        state.unit = parsed.unit ?? state.unit
        state.category = categoryAutoDetector.detectCategory(itemName: parsed.name) ?? .other
        state.isCategoryAutoDetected = true
        recomputeDuplicate()
    }

    func mergeWithDuplicate() {
        guard let duplicate = state.duplicateMatch, let current = originalItem else { return }
        Task {
            var merged = duplicate.item
            merged.quantity += parseQuantity(state.quantity) ?? 1
            try? await shoppingRepository.updateItem(householdId: householdId, item: merged)
            try? await shoppingRepository.deleteItem(householdId: householdId, itemId: current.id)
            await saveRecurringPreference(name: current.name)
            state.isDeleted = true
        }
    }

    func saveItem() {
        guard !state.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state.errorMessage = "empty_name"
            return
        }
        guard var item = originalItem else { return }
        Task {
            state.isLoading = true
            item.name = state.name.trimmingCharacters(in: .whitespacesAndNewlines)
            item.normalizedName = normalizeItemName(state.name)
            item.quantity = parseQuantity(state.quantity) ?? 1
            item.unit = state.unit
            item.category = state.category
            item.note = state.note.trimmingCharacters(in: .whitespacesAndNewlines)
            item.isUrgent = state.isUrgent
            do {
                try await shoppingRepository.updateItem(householdId: householdId, item: item)
                await saveRecurringPreference(name: item.name)
                state.isLoading = false
                state.isSaved = true
            } catch {
                state.isLoading = false
                state.errorMessage = "generic"
            }
        }
    }

    func deleteItem() {
        Task {
            try? await shoppingRepository.deleteItem(householdId: householdId, itemId: itemId)
            state.isDeleted = true
        }
    }

    private func loadItem() async {
        guard let user = await firstCurrentUser(from: authRepository),
              let activeHouseholdId = user.activeHouseholdId else {
            state = ItemFormState(isLoading: false, errorMessage: "generic")
            return
        }
        householdId = activeHouseholdId
        tasks.append(Task { @MainActor in
            for await items in shoppingRepository.observeActiveItems(householdId: activeHouseholdId) {
                activeItems = items
                recomputeDuplicate()
            }
        })

        do {
            let item = try await shoppingRepository.getItem(householdId: activeHouseholdId, itemId: itemId)
            originalItem = item
            let recurring: RecurringItem?
            do {
                recurring = try await recurringRepository.findByNormalizedName(householdId: activeHouseholdId, normalizedName: item.normalizedName)
            } catch {
                recurring = nil
            }
            recurringItemId = recurring?.id
            state = ItemFormState(
                name: item.name,
                quantity: formatQuantity(item.quantity),
                unit: item.unit,
                category: item.category,
                note: item.note,
                isRecurring: recurring != nil,
                recurrenceDays: recurring?.intervalDays.description ?? "7",
                isUrgent: item.isUrgent,
                isLoading: false
            )
            recomputeDuplicate()
        } catch {
            state = ItemFormState(isLoading: false, errorMessage: "generic")
        }
    }

    private func recomputeDuplicate() {
        state.duplicateMatch = duplicateDetector.findDuplicate(draftName: state.name, existingItems: activeItems, excludeItemId: itemId)
    }

    private func saveRecurringPreference(name: String) async {
        if state.isRecurring {
            let interval = max(Int(state.recurrenceDays) ?? 7, 1)
            let recurring = RecurringItem(
                id: recurringItemId ?? "",
                householdId: householdId,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                normalizedName: normalizeItemName(name),
                quantity: parseQuantity(state.quantity) ?? 1,
                unit: state.unit,
                category: state.category,
                note: state.note.trimmingCharacters(in: .whitespacesAndNewlines),
                intervalDays: interval,
                nextDueAt: Date().addingTimeInterval(TimeInterval(interval) * day)
            )
            recurringItemId = try? await recurringRepository.upsertRecurringItem(householdId: householdId, recurringItem: recurring)
        } else if let recurringItemId {
            try? await recurringRepository.deleteRecurringItem(householdId: householdId, recurringItemId: recurringItemId)
        }
    }
}
