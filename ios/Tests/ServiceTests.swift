import XCTest
@testable import Salino

final class ServiceTests: XCTestCase {
    func testNormalizeItemNameCollapsesPunctuationAndWhitespace() {
        XCTAssertEqual(normalizeItemName("  Milk--2%!!  "), "milk 2%")
    }

    func testVoiceParserExtractsQuantityUnitAndName() {
        let parser = KeywordVoiceInputParser()
        let parsed = parser.parse(spokenText: "3 kg tomatoes")
        XCTAssertEqual(parsed.name, "tomatoes")
        XCTAssertEqual(parsed.quantity, 3)
        XCTAssertEqual(parsed.unit, .kg)
    }

    func testSuggestionEngineSurfacesDueRecurringItemsBeforeHistory() {
        let engine = RuleBasedSuggestionEngine()
        let recurring = RecurringItem(
            id: "r1",
            householdId: "h1",
            name: "Milk",
            normalizedName: "milk",
            category: .dairy,
            nextDueAt: Date().addingTimeInterval(-60)
        )

        let suggestions = engine.buildSuggestions(
            activeItems: [],
            boughtItems: [],
            recurringItems: [recurring],
            now: Date()
        )

        XCTAssertEqual(suggestions.first?.source, .recurring)
        XCTAssertEqual(suggestions.first?.name, "Milk")
    }

    func testDuplicateDetectorFindsExactDuplicate() {
        let normalizer = ItemTextNormalizer()
        let matcher = ProtectedPhraseMatcher()
        let extractor = ProductSignatureExtractor(normalizer: normalizer, phraseMatcher: matcher)
        let comparison = SignatureComparisonEngine(normalizer: normalizer)
        let detector = NormalizedDuplicateDetector(normalizer: normalizer, extractor: extractor, comparisonEngine: comparison)

        let existing = ShoppingItem(id: "1", name: "Milk", normalizedName: "milk", category: .dairy)
        let duplicate = detector.findDuplicate(draftName: "milk", existingItems: [existing], excludeItemId: nil)

        XCTAssertEqual(duplicate?.reason, .exactDuplicate)
        XCTAssertEqual(duplicate?.item.id, "1")
    }

    func testDuplicateDetectorDoesNotMergeProtectedMilkVariantWithPlainMilk() {
        let normalizer = ItemTextNormalizer()
        let matcher = ProtectedPhraseMatcher()
        let extractor = ProductSignatureExtractor(normalizer: normalizer, phraseMatcher: matcher)
        let comparison = SignatureComparisonEngine(normalizer: normalizer)
        let detector = NormalizedDuplicateDetector(normalizer: normalizer, extractor: extractor, comparisonEngine: comparison)

        let existing = ShoppingItem(id: "1", name: "Milk", normalizedName: "milk", category: .dairy)
        let duplicate = detector.findDuplicate(draftName: "chocolate milk", existingItems: [existing], excludeItemId: nil)

        XCTAssertNil(duplicate)
    }
}
