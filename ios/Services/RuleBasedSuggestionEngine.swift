import Foundation

final class RuleBasedSuggestionEngine: SuggestionEngine {
    func buildSuggestions(
        activeItems: [ShoppingItem],
        boughtItems: [ShoppingItem],
        recurringItems: [RecurringItem],
        now: Date = Date()
    ) -> [SuggestionItem] {
        let activeNames = Set(activeItems.map { $0.normalizedName.isEmpty ? normalizeItemName($0.name) : $0.normalizedName })
        var suggestions: [String: SuggestionItem] = [:]
        var order: [String] = []

        func insert(_ key: String, _ suggestion: SuggestionItem) {
            guard suggestions[key] == nil else { return }
            suggestions[key] = suggestion
            order.append(key)
        }

        recurringItems
            .filter { $0.enabled && ($0.nextDueAt == nil || $0.nextDueAt! <= now) }
            .forEach { recurring in
                let normalized = recurring.normalizedName.isEmpty ? normalizeItemName(recurring.name) : recurring.normalizedName
                guard !activeNames.contains(normalized) else { return }
                insert(normalized, SuggestionItem(
                    id: "recurring_\(recurring.id)",
                    name: recurring.name,
                    normalizedName: normalized,
                    quantity: recurring.quantity,
                    unit: recurring.unit,
                    category: recurring.category,
                    note: recurring.note,
                    reason: "due",
                    source: .recurring,
                    recurringItemId: recurring.id
                ))
            }

        Dictionary(grouping: boughtItems, by: { $0.normalizedName.isEmpty ? normalizeItemName($0.name) : $0.normalizedName })
            .sorted { $0.value.count > $1.value.count }
            .prefix(4)
            .forEach { key, items in
                guard let first = items.first, !activeNames.contains(key) else { return }
                insert(key, SuggestionItem(
                    id: "frequent_\(key)",
                    name: first.name,
                    normalizedName: key,
                    quantity: 1,
                    unit: first.unit,
                    category: first.category,
                    note: first.note,
                    reason: "frequent",
                    source: .frequent
                ))
            }

        boughtItems
            .sorted { ($0.updatedAt ?? .distantPast) > ($1.updatedAt ?? .distantPast) }
            .prefix(4)
            .forEach { item in
                let normalized = item.normalizedName.isEmpty ? normalizeItemName(item.name) : item.normalizedName
                guard !activeNames.contains(normalized) else { return }
                insert(normalized, SuggestionItem(
                    id: "recent_\(item.id)",
                    name: item.name,
                    normalizedName: normalized,
                    quantity: 1,
                    unit: item.unit,
                    category: item.category,
                    note: item.note,
                    reason: "recent",
                    source: .recent
                ))
            }

        return order.compactMap { suggestions[$0] }.prefix(6).map { $0 }
    }
}
