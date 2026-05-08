import Foundation

struct ProductSignature {
    var normalizedText: String
    var baseProduct: String?
    var matchedPhraseId: String?
    var strongQualifiers: Set<String>
    var weakQualifiers: Set<String>
    var percentageQualifier: String?
    var category: ItemCategory?
}

final class ItemTextNormalizer {
    func normalize(_ text: String) -> String {
        normalizeItemName(text)
            .replacingOccurrences(of: #"\b(\d+)\s+percent\b"#, with: "$1%", options: .regularExpression)
    }

    func tokenize(_ normalizedText: String) -> [String] {
        normalizedText.split(separator: " ").map(String.init)
    }

    func normalizePlural(_ token: String) -> String {
        guard token.count > 2 else { return token }
        if token.hasSuffix("ים") || token.hasSuffix("ות") { return String(token.dropLast(2)) }
        if token.hasSuffix("es"), token.count > 4 { return String(token.dropLast(2)) }
        if token.hasSuffix("s"), token.count > 3 { return String(token.dropLast()) }
        return token
    }
}

final class ProtectedPhraseMatcher {
    struct PhraseMatch {
        var canonicalId: String
        var tokensConsumed: [String]
    }

    func findMatch(tokens: [String]) -> PhraseMatch? {
        for (phrase, canonical) in protectedPhrases {
            guard phrase.allSatisfy({ tokens.contains($0) }) else { continue }
            return PhraseMatch(canonicalId: canonical, tokensConsumed: phrase)
        }
        return nil
    }

    private let protectedPhrases: [([String], String)] = [
        (["chocolate", "milk"], "chocolate_milk"),
        (["almond", "milk"], "almond_milk"),
        (["soy", "milk"], "soy_milk"),
        (["oat", "milk"], "oat_milk"),
        (["toilet", "paper"], "toilet_paper"),
        (["paper", "towels"], "paper_towels"),
        (["olive", "oil"], "olive_oil"),
        (["peanut", "butter"], "peanut_butter"),
        (["tomato", "paste"], "tomato_paste"),
        (["חלב", "שוקולד"], "chocolate_milk"),
        (["חלב", "שקדים"], "almond_milk"),
        (["נייר", "טואלט"], "toilet_paper"),
        (["שמן", "זית"], "olive_oil")
    ]
}

final class ProductSignatureExtractor {
    private let normalizer: ItemTextNormalizer
    private let phraseMatcher: ProtectedPhraseMatcher

    init(normalizer: ItemTextNormalizer, phraseMatcher: ProtectedPhraseMatcher) {
        self.normalizer = normalizer
        self.phraseMatcher = phraseMatcher
    }

    func extract(_ rawName: String, category: ItemCategory? = nil) -> ProductSignature {
        let normalized = normalizer.normalize(rawName)
        let tokens = normalizer.tokenize(normalized)
        let phrase = phraseMatcher.findMatch(tokens: tokens)
        let percentage = tokens.first { $0.range(of: #"^\d+%$"#, options: .regularExpression) != nil }
        let consumed = Set((phrase?.tokensConsumed ?? []) + [percentage].compactMap { $0 })
        var strong = Set<String>()
        var weak = Set<String>()
        var unclassified: [String] = []

        for token in tokens where !consumed.contains(token) {
            if strongQualifiers.contains(token) { strong.insert(token) }
            else if weakQualifiers.contains(token) { weak.insert(token) }
            else if noiseTokens.contains(token) {}
            else { unclassified.append(token) }
        }

        let baseProduct = phrase?.canonicalId ?? resolveBaseProduct(tokens: tokens, consumed: consumed)
        if let baseProduct, phrase == nil {
            unclassified.removeAll { baseProductSynonyms[$0] == baseProduct || baseProductSynonyms[normalizer.normalizePlural($0)] == baseProduct }
        }
        strong.formUnion(unclassified)

        return ProductSignature(
            normalizedText: normalized,
            baseProduct: baseProduct,
            matchedPhraseId: phrase?.canonicalId,
            strongQualifiers: strong,
            weakQualifiers: weak,
            percentageQualifier: percentage,
            category: category
        )
    }

    private func resolveBaseProduct(tokens: [String], consumed: Set<String>) -> String? {
        for token in tokens where !consumed.contains(token) {
            let plural = normalizer.normalizePlural(token)
            if let value = baseProductSynonyms[token] ?? baseProductSynonyms[plural] { return value }
        }
        return nil
    }

    private let strongQualifiers: Set<String> = [
        "almond", "coconut", "soy", "oat", "goat", "lactose", "gluten", "sugar",
        "organic", "vegan", "white", "yellow", "sweet", "spicy", "חריף", "מתוק", "לבן"
    ]

    private let weakQualifiers: Set<String> = [
        "large", "small", "medium", "family", "regular", "pack", "box", "bag", "bottle",
        "גדול", "קטן", "משפחתי"
    ]

    private let noiseTokens: Set<String> = [
        "the", "a", "an", "of", "with", "and", "or", "של", "עם", "או", "de", "du", "la", "el"
    ]

    private let baseProductSynonyms: [String: String] = [
        "milk": "milk", "חלב": "milk", "leche": "milk", "lait": "milk",
        "cheese": "cheese", "גבינה": "cheese", "queso": "cheese", "fromage": "cheese",
        "bread": "bread", "לחם": "bread", "pan": "bread", "pain": "bread",
        "apple": "apple", "apples": "apple", "תפוח": "apple",
        "banana": "banana", "bananas": "banana", "בננה": "banana",
        "tomato": "tomato", "tomatoes": "tomato", "עגבניה": "tomato",
        "chicken": "chicken", "עוף": "chicken",
        "fish": "fish", "דג": "fish",
        "rice": "rice", "אורז": "rice",
        "pasta": "pasta", "פסטה": "pasta",
        "water": "water", "מים": "water",
        "soap": "soap", "סבון": "soap",
        "chocolate": "chocolate", "שוקולד": "chocolate",
        "eggs": "eggs", "egg": "eggs", "ביצה": "eggs", "ביצים": "eggs"
    ]
}

final class SignatureComparisonEngine {
    private let normalizer: ItemTextNormalizer

    init(normalizer: ItemTextNormalizer) {
        self.normalizer = normalizer
    }

    func compare(draft: ProductSignature, existing: ProductSignature) -> (score: Double, reason: DuplicateReason?) {
        guard !draft.normalizedText.isEmpty, !existing.normalizedText.isEmpty else { return (0, nil) }
        if draft.normalizedText == existing.normalizedText { return (100, .exactDuplicate) }

        var score = 0.0
        if let draftPhrase = draft.matchedPhraseId ?? draft.baseProduct,
           let existingPhrase = existing.matchedPhraseId ?? existing.baseProduct {
            guard draftPhrase == existingPhrase else { return (0, nil) }
            score += draft.matchedPhraseId != nil ? 60 : 50
        } else {
            score += tokenOverlapScore(draft.normalizedText, existing.normalizedText)
            if score < 15 { return (0, nil) }
        }

        if draft.percentageQualifier != nil || existing.percentageQualifier != nil {
            if draft.percentageQualifier == existing.percentageQualifier { score += 15 }
            else if draft.percentageQualifier != nil && existing.percentageQualifier != nil { score -= 5 }
        }

        score += Double(draft.strongQualifiers.intersection(existing.strongQualifiers).count) * 10
        let strongDiff = draft.strongQualifiers.symmetricDifference(existing.strongQualifiers)
        score -= Double(strongDiff.count) * 20
        score += Double(draft.weakQualifiers.intersection(existing.weakQualifiers).count) * 3

        if draft.category == existing.category, draft.category != nil { score += 5 }

        let reason: DuplicateReason? = if score >= 75 {
            .exactDuplicate
        } else if score >= 45 {
            .possibleDuplicate
        } else if score >= 25 {
            .similarItem
        } else {
            nil
        }
        return (score, reason)
    }

    private func tokenOverlapScore(_ a: String, _ b: String) -> Double {
        let aTokens = Set(normalizer.tokenize(a).map(normalizer.normalizePlural))
        let bTokens = Set(normalizer.tokenize(b).map(normalizer.normalizePlural))
        guard !aTokens.isEmpty, !bTokens.isEmpty else { return 0 }
        return Double(aTokens.intersection(bTokens).count) / Double(aTokens.union(bTokens).count) * 45
    }
}

final class NormalizedDuplicateDetector: DuplicateDetector {
    private let normalizer: ItemTextNormalizer
    private let extractor: ProductSignatureExtractor
    private let comparisonEngine: SignatureComparisonEngine

    init(normalizer: ItemTextNormalizer, extractor: ProductSignatureExtractor, comparisonEngine: SignatureComparisonEngine) {
        self.normalizer = normalizer
        self.extractor = extractor
        self.comparisonEngine = comparisonEngine
    }

    func findDuplicate(draftName: String, existingItems: [ShoppingItem], excludeItemId: String? = nil) -> DuplicateMatch? {
        let normalized = normalizer.normalize(draftName)
        guard normalized.count >= 2 else { return nil }

        let draft = extractor.extract(draftName)
        var bestMatch: DuplicateMatch?
        var bestScore = 0.0

        for item in existingItems where item.id != excludeItemId {
            let existing = extractor.extract(item.name, category: item.category)
            let result = comparisonEngine.compare(draft: draft, existing: existing)
            guard let reason = result.reason, result.score > bestScore else { continue }
            bestScore = result.score
            bestMatch = DuplicateMatch(item: item, reason: reason, score: result.score, suggestedQuantity: item.quantity + 1)
        }

        return bestMatch
    }
}
