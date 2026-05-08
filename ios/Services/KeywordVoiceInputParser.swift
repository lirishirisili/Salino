import Foundation

final class KeywordVoiceInputParser: VoiceInputParser {
    func parse(spokenText: String) -> ParsedVoiceItem {
        let trimmed = spokenText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return ParsedVoiceItem(name: "", quantity: 1.0, unit: nil) }

        var remaining = trimmed
        var detectedUnit: ItemUnit?
        var detectedQuantity: Double?

        for (unit, patterns) in unitPatterns {
            if let pattern = patterns.first(where: { remaining.range(of: $0, options: [.regularExpression, .caseInsensitive]) != nil }),
               let range = remaining.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
                detectedUnit = unit
                remaining.removeSubrange(range)
                remaining = remaining.trimmingCharacters(in: .whitespacesAndNewlines)
                break
            }
        }

        if let match = remaining.range(of: #"^\d+(?:[.,]\d+)?"#, options: .regularExpression) {
            detectedQuantity = parseQuantity(String(remaining[match]))
            remaining.removeSubrange(match)
        }

        if detectedQuantity == nil,
           let match = remaining.range(of: #"\d+(?:[.,]\d+)?$"#, options: .regularExpression) {
            detectedQuantity = parseQuantity(String(remaining[match]))
            remaining.removeSubrange(match)
        }

        if detectedQuantity == nil {
            let normalized = normalizeItemName(remaining)
            for (word, value) in numberWords where normalized.split(separator: " ").contains(Substring(word)) {
                detectedQuantity = value
                remaining = remaining.replacingOccurrences(of: word, with: "", options: .caseInsensitive)
                break
            }
        }

        remaining = remaining
            .replacingOccurrences(of: #"^(of|de|של|من)\s+"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+(of|de|של|من)$"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return ParsedVoiceItem(name: remaining.isEmpty ? trimmed : remaining, quantity: detectedQuantity ?? 1.0, unit: detectedUnit)
    }

    private let unitPatterns: [ItemUnit: [String]] = [
        .kg: [#"\b(kilo(?:gram)?s?|kg)\b"#, #"(קילו(?:גרם)?|ק״ג)"#, #"(كيلو|كغ)"#],
        .grams: [#"\b(grams?|gr|g)\b"#, #"(גרם)"#, #"(غرام|غ)"#],
        .liters: [#"\b(liters?|litres?|ltr|l)\b"#, #"(ליטר)"#, #"(لتر)"#],
        .packs: [#"\b(packs?|packages?)\b"#, #"(חבילה|חבילות|אריזה)"#, #"(عبوة|حزمة)"#],
        .bottles: [#"\b(bottles?)\b"#, #"(בקבוק|בקבוקים)"#, #"(زجاجة)"#],
        .bags: [#"\b(bags?)\b"#, #"(שקית|שקיות)"#, #"(كيس|أكياس)"#],
        .pieces: [#"\b(pieces?|pcs)\b"#, #"(יחידה|יחידות|יח׳)"#, #"(قطعة)"#]
    ]

    private let numberWords: [String: Double] = [
        "half": 0.5, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "חצי": 0.5, "אחד": 1, "אחת": 1, "שתיים": 2, "שניים": 2, "שלוש": 3,
        "نصف": 0.5, "واحد": 1, "اثنين": 2, "ثلاثة": 3,
        "un": 1, "une": 1, "deux": 2, "trois": 3,
        "uno": 1, "una": 1, "dos": 2, "tres": 3
    ]
}
