import Foundation

func normalizeItemName(_ name: String) -> String {
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return "" }
    return name
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        .replacingOccurrences(of: "[׳'`\".,!?()\\[\\]{}:;_\\-]+", with: " ", options: .regularExpression)
        .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
}

func parseQuantity(_ value: String) -> Double? {
    Double(value.replacingOccurrences(of: ",", with: "."))
}

func formatQuantity(_ quantity: Double) -> String {
    quantity == Double(Int(quantity)) ? String(Int(quantity)) : String(quantity)
}

func formatShortDate(_ date: Date?) -> String {
    guard let date else { return "" }
    let formatter = DateFormatter()
    formatter.dateFormat = "dd/MM HH:mm"
    return formatter.string(from: date)
}

func localized(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}
