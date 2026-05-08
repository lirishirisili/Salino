import Foundation

enum DuplicateReason: Equatable {
    case exactDuplicate
    case possibleDuplicate
    case similarItem
}

struct DuplicateMatch: Equatable {
    var item: ShoppingItem
    var reason: DuplicateReason
    var score: Double
    var suggestedQuantity: Double
}

struct ParsedVoiceItem: Equatable {
    var name: String
    var quantity: Double
    var unit: ItemUnit?
}

protocol CategoryAutoDetector {
    func detectCategory(itemName: String) -> ItemCategory?
}

protocol DuplicateDetector {
    func findDuplicate(
        draftName: String,
        existingItems: [ShoppingItem],
        excludeItemId: String?
    ) -> DuplicateMatch?
}

protocol SuggestionEngine {
    func buildSuggestions(
        activeItems: [ShoppingItem],
        boughtItems: [ShoppingItem],
        recurringItems: [RecurringItem],
        now: Date
    ) -> [SuggestionItem]
}

protocol VoiceInputParser {
    func parse(spokenText: String) -> ParsedVoiceItem
}
