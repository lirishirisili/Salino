import Foundation

final class KeywordCategoryAutoDetector: CategoryAutoDetector {
    func detectCategory(itemName: String) -> ItemCategory? {
        let normalized = normalizeItemName(itemName)
        guard !normalized.isEmpty else { return nil }

        let tokens = Set(normalized.split(separator: " ").map(String.init))
        let scored = keywordMap.mapValues { keywords in
            keywords.reduce(0) { score, keyword in
                let normalizedKeyword = normalizeItemName(keyword)
                if normalized == normalizedKeyword { return score + 120 }
                if normalized.contains(normalizedKeyword) { return score + (normalizedKeyword.contains(" ") ? 65 : 40) }
                if tokens.contains(normalizedKeyword) { return score + 26 }
                return score
            }
        }

        guard let best = scored.max(by: { $0.value < $1.value }), best.value >= 24 else {
            return nil
        }
        return best.key
    }

    private let keywordMap: [ItemCategory: [String]] = [
        .dairy: [
            "milk", "cheese", "yogurt", "butter", "cream", "cottage",
            "חלב", "גבינה", "יוגורט", "חמאה", "שמנת",
            "leche", "queso", "yogur", "lait", "fromage", "yaourt",
            "молоко", "сыр", "йогурт", "حليب", "جبنة", "لبن", "ወተት", "አይብ"
        ],
        .vegetables: [
            "tomato", "cucumber", "onion", "potato", "carrot", "pepper",
            "עגבניה", "מלפפון", "בצל", "תפוח אדמה", "גזר", "פלפל",
            "tomate", "pepino", "cebolla", "concombre", "oignon",
            "помидор", "огурец", "лук", "طماطم", "خيار", "بصل", "ቲማቲም"
        ],
        .fruits: [
            "apple", "banana", "orange", "melon", "grape", "pear",
            "תפוח", "בננה", "תפוז", "ענבים", "אגס",
            "manzana", "plátano", "pomme", "banane", "orange",
            "яблоко", "банан", "تفاح", "موز", "برتقال", "ፖም", "ሙዝ"
        ],
        .meatFish: [
            "chicken", "beef", "fish", "salmon", "turkey", "meat",
            "עוף", "בשר", "דג", "סלמון", "הודו",
            "pollo", "pescado", "poulet", "poisson",
            "курица", "рыба", "دجاج", "سمك", "ዶሮ", "ዓሣ"
        ],
        .bakery: [
            "bread", "roll", "bagel", "pita", "croissant", "cake",
            "לחם", "לחמניה", "פיתה", "עוגה",
            "pan", "pain", "baguette", "хлеб", "خبز", "ዳቦ"
        ],
        .cleaning: [
            "detergent", "bleach", "sponge", "cleaner", "trash bag", "dish soap",
            "אקונומיקה", "ספוג", "מנקה", "שקיות זבל", "סבון כלים",
            "detergente", "lejía", "lessive", "eponge", "отбеливатель", "منظف"
        ],
        .pantry: [
            "rice", "pasta", "flour", "oil", "salt", "sugar", "lentils", "ketchup",
            "אורז", "פסטה", "קמח", "שמן", "מלח", "סוכר",
            "arroz", "harina", "riz", "farine", "рис", "رز", "ዱቄት"
        ],
        .snacks: [
            "chips", "cookie", "cracker", "chocolate", "snack", "popcorn",
            "ציפס", "עוגיות", "שוקולד", "חטיף", "במבה",
            "galleta", "chocolat", "печенье", "شوكولاتة", "ቸኮሌት"
        ],
        .beverages: [
            "water", "juice", "cola", "coffee", "tea", "drink", "wine", "beer",
            "מים", "מיץ", "קולה", "קפה", "תה", "בירה",
            "agua", "jugo", "eau", "jus", "вода", "сок", "ماء", "عصير", "ውሃ"
        ],
        .pharmacy: [
            "vitamin", "painkiller", "shampoo", "toothpaste", "medicine", "bandage",
            "ויטמין", "אקמול", "שמפו", "משחת שיניים", "תרופה", "פלסטר",
            "vitamina", "champú", "shampoing", "médicament", "лекарство", "دواء"
        ]
    ]
}
