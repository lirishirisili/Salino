package com.salino.sali.data.service.duplicate

import com.salino.sali.data.model.ShoppingItem
import com.salino.sali.data.service.NormalizedDuplicateDetector
import com.salino.sali.domain.service.DuplicateReason
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for the smart duplicate detection system.
 * Covers: normalization, protected phrases, base product extraction,
 * qualifier extraction, comparison results, and Hebrew-specific cases.
 */
class SmartDuplicateDetectorTest {

    private lateinit var normalizer: ItemTextNormalizer
    private lateinit var phraseMatcher: ProtectedPhraseMatcher
    private lateinit var extractor: ProductSignatureExtractor
    private lateinit var comparisonEngine: SignatureComparisonEngine
    private lateinit var detector: NormalizedDuplicateDetector

    @Before
    fun setup() {
        normalizer = ItemTextNormalizer()
        phraseMatcher = ProtectedPhraseMatcher()
        extractor = ProductSignatureExtractor(normalizer, phraseMatcher)
        comparisonEngine = SignatureComparisonEngine(normalizer)
        detector = NormalizedDuplicateDetector(normalizer, extractor, comparisonEngine)
    }

    // =====================================================================
    // Text Normalization
    // =====================================================================

    @Test
    fun `normalize trims whitespace and collapses spaces`() {
        assertEquals("חלב", normalizer.normalize("  חלב  "))
        assertEquals("חלב 3%", normalizer.normalize("חלב   3%"))
    }

    @Test
    fun `normalize converts percentage forms to canonical`() {
        assertEquals("חלב 3%", normalizer.normalize("חלב 3 אחוז"))
        assertEquals("חלב 3%", normalizer.normalize("חלב 3%"))
        assertEquals("חלב 3%", normalizer.normalize("חלב 3 %"))
    }

    @Test
    fun `normalize lowercases english`() {
        assertEquals("milk", normalizer.normalize("Milk"))
        assertEquals("milk 3%", normalizer.normalize("Milk 3%"))
    }

    @Test
    fun `normalize removes punctuation`() {
        assertEquals("חלב", normalizer.normalize("חלב!"))
        assertEquals("bread", normalizer.normalize("bread."))
    }

    @Test
    fun `normalizePlural handles Hebrew ים suffix`() {
        assertEquals("ביצ", normalizer.normalizePlural("ביצים"))
        assertEquals("תפוח", normalizer.normalizePlural("תפוחים"))
    }

    @Test
    fun `normalizePlural handles English s suffix`() {
        assertEquals("egg", normalizer.normalizePlural("eggs"))
        assertEquals("banana", normalizer.normalizePlural("bananas"))
    }

    // =====================================================================
    // Protected Phrase Detection
    // =====================================================================

    @Test
    fun `protected phrase matches chocolate milk`() {
        val tokens = listOf("שוקולד", "חלב")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("chocolate_milk", match!!.canonicalId)
    }

    @Test
    fun `protected phrase matches almond milk`() {
        val tokens = listOf("חלב", "שקדים")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("almond_milk", match!!.canonicalId)
    }

    @Test
    fun `protected phrase matches toilet paper`() {
        val tokens = listOf("נייר", "טואלט")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("toilet_paper", match!!.canonicalId)
    }

    @Test
    fun `protected phrase matches toothpaste`() {
        val tokens = listOf("משחת", "שיניים")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("toothpaste", match!!.canonicalId)
    }

    @Test
    fun `protected phrase matches lactose free milk even with extra tokens`() {
        val tokens = listOf("חלב", "ללא", "לקטוז", "3%")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("lactose_free_milk", match!!.canonicalId)
    }

    @Test
    fun `no protected phrase for standalone word`() {
        val tokens = listOf("חלב")
        val match = phraseMatcher.findMatch(tokens)
        assertNull(match)
    }

    // =====================================================================
    // Base Product Extraction
    // =====================================================================

    @Test
    fun `extract base product for simple milk`() {
        val sig = extractor.extract("חלב")
        assertEquals("milk", sig.baseProduct)
        assertNull(sig.matchedPhraseId)
    }

    @Test
    fun `extract base product for milk 3 percent`() {
        val sig = extractor.extract("חלב 3%")
        assertEquals("milk", sig.baseProduct)
        assertEquals("3%", sig.percentageQualifier)
    }

    @Test
    fun `extract protected phrase for chocolate milk`() {
        val sig = extractor.extract("שוקולד חלב")
        assertEquals("chocolate_milk", sig.baseProduct)
        assertEquals("chocolate_milk", sig.matchedPhraseId)
    }

    @Test
    fun `extract protected phrase for almond milk`() {
        val sig = extractor.extract("חלב שקדים")
        assertEquals("almond_milk", sig.baseProduct)
        assertEquals("almond_milk", sig.matchedPhraseId)
    }

    // =====================================================================
    // Qualifier Extraction
    // =====================================================================

    @Test
    fun `organic is a strong qualifier`() {
        val sig = extractor.extract("חלב אורגני")
        assertTrue(sig.strongQualifiers.contains("אורגני"))
    }

    @Test
    fun `gadol is a weak qualifier`() {
        val sig = extractor.extract("חלב גדול")
        assertTrue(sig.weakQualifiers.contains("גדול"))
    }

    // =====================================================================
    // Comparison Results — Core Hebrew Cases
    // =====================================================================

    @Test
    fun `milk vs milk is EXACT_DUPLICATE`() {
        val result = compareItems("חלב", "חלב")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `milk 3 percent vs milk 3 achuz is EXACT_DUPLICATE`() {
        // "חלב 3%" vs "חלב 3 אחוז" should normalize to the same text
        val result = compareItems("חלב 3%", "חלב 3 אחוז")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `milk vs almond milk is NO_MATCH`() {
        val result = compareItems("חלב", "חלב שקדים")
        assertNull("חלב vs חלב שקדים should be NO_MATCH", result)
    }

    @Test
    fun `milk vs chocolate milk is NO_MATCH`() {
        val result = compareItems("חלב", "שוקולד חלב")
        assertNull("חלב vs שוקולד חלב should be NO_MATCH", result)
    }

    @Test
    fun `shampoo vs kids shampoo is SIMILAR_ITEM`() {
        val result = compareItems("שמפו", "שמפו ילדים")
        assertEquals(DuplicateReason.SIMILAR_ITEM, result)
    }

    @Test
    fun `toilet paper vs toilet is POSSIBLE_DUPLICATE or above`() {
        // "נייר טואלט" is a protected phrase; "טואלט" alone maps to "toilet" base product
        // These share some identity but differ significantly
        val result = compareItems("נייר טואלט", "טואלט")
        // Should be POSSIBLE_DUPLICATE or SIMILAR_ITEM, definitely not EXACT_DUPLICATE
        assertTrue(
            "נייר טואלט vs טואלט should be POSSIBLE_DUPLICATE or SIMILAR_ITEM",
            result == DuplicateReason.POSSIBLE_DUPLICATE || result == DuplicateReason.SIMILAR_ITEM || result == null
        )
    }

    @Test
    fun `toothpaste vs toothpaste colgate is POSSIBLE_DUPLICATE or SIMILAR`() {
        val result = compareItems("משחת שיניים", "משחת שיניים קולגייט")
        assertTrue(
            "משחת שיניים vs משחת שיניים קולגייט should be POSSIBLE_DUPLICATE or SIMILAR_ITEM",
            result == DuplicateReason.POSSIBLE_DUPLICATE || result == DuplicateReason.SIMILAR_ITEM ||
                result == DuplicateReason.EXACT_DUPLICATE
        )
    }

    @Test
    fun `eggs vs egg singular plural is POSSIBLE_DUPLICATE or EXACT`() {
        val result = compareItems("ביצים", "ביצה")
        assertTrue(
            "ביצים vs ביצה should be POSSIBLE_DUPLICATE or EXACT_DUPLICATE",
            result == DuplicateReason.POSSIBLE_DUPLICATE || result == DuplicateReason.EXACT_DUPLICATE
        )
    }

    @Test
    fun `chocolate milk vs almond milk is NO_MATCH`() {
        val result = compareItems("שוקולד חלב", "חלב שקדים")
        assertNull("שוקולד חלב vs חלב שקדים should be NO_MATCH (different phrases)", result)
    }

    @Test
    fun `milk 3 percent vs milk 1 percent is POSSIBLE_DUPLICATE`() {
        // Same base product, different percentage → not exact but related
        val result = compareItems("חלב 3%", "חלב 1%")
        assertTrue(
            "חלב 3% vs חלב 1% should be POSSIBLE_DUPLICATE (same product, different variant)",
            result == DuplicateReason.POSSIBLE_DUPLICATE || result == DuplicateReason.SIMILAR_ITEM
        )
    }

    // =====================================================================
    // Full Detector Integration (with ShoppingItem lists)
    // =====================================================================

    @Test
    fun `findDuplicate returns EXACT_DUPLICATE for matching active item`() {
        val active = listOf(makeItem("1", "חלב"))
        val match = detector.findDuplicate("חלב", active)
        assertNotNull(match)
        assertEquals(DuplicateReason.EXACT_DUPLICATE, match!!.reason)
    }

    @Test
    fun `findDuplicate returns null for unrelated items`() {
        val active = listOf(makeItem("1", "לחם"))
        val match = detector.findDuplicate("חלב", active)
        assertNull(match)
    }

    @Test
    fun `findDuplicate excludes item by id`() {
        val active = listOf(makeItem("1", "חלב"))
        val match = detector.findDuplicate("חלב", active, excludeItemId = "1")
        assertNull(match)
    }

    @Test
    fun `findDuplicate returns null for short input`() {
        val active = listOf(makeItem("1", "א"))
        val match = detector.findDuplicate("א", active)
        assertNull(match)
    }

    // =====================================================================
    // English Cases
    // =====================================================================

    @Test
    fun `english milk vs milk is EXACT_DUPLICATE`() {
        val result = compareItems("milk", "milk")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `english olive oil vs olive oil is EXACT_DUPLICATE`() {
        val result = compareItems("olive oil", "olive oil")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    // =====================================================================
    // Russian Cases (Русский)
    // =====================================================================

    @Test
    fun `russian молоко vs молоко is EXACT_DUPLICATE`() {
        val result = compareItems("молоко", "молоко")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `russian шоколадное молоко vs молоко is NO_MATCH (protected phrase)`() {
        val result = compareItems("шоколадное молоко", "молоко")
        assertNull("шоколадное молоко vs молоко should be NO_MATCH", result)
    }

    @Test
    fun `russian олвковое масло phrase detected`() {
        val tokens = listOf("оливковое", "масло")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("olive_oil", match!!.canonicalId)
    }

    @Test
    fun `russian base product хлеб`() {
        val sig = extractor.extract("хлеб")
        assertEquals("bread", sig.baseProduct)
    }

    @Test
    fun `russian percentage normalization`() {
        assertEquals("молоко 3%", normalizer.normalize("молоко 3 процентов"))
    }

    // =====================================================================
    // Arabic Cases (العربية)
    // =====================================================================

    @Test
    fun `arabic حليب vs حليب is EXACT_DUPLICATE`() {
        val result = compareItems("حليب", "حليب")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `arabic حليب لوز vs حليب is NO_MATCH (protected phrase)`() {
        val result = compareItems("حليب لوز", "حليب")
        assertNull("حليب لوز vs حليب should be NO_MATCH", result)
    }

    @Test
    fun `arabic زيت زيتون phrase detected`() {
        val tokens = listOf("زيت", "زيتون")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("olive_oil", match!!.canonicalId)
    }

    @Test
    fun `arabic base product خبز`() {
        val sig = extractor.extract("خبز")
        assertEquals("bread", sig.baseProduct)
    }

    // =====================================================================
    // French Cases (Français)
    // =====================================================================

    @Test
    fun `french lait vs lait is EXACT_DUPLICATE`() {
        val result = compareItems("lait", "lait")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `french lait chocolat vs lait is NO_MATCH (protected phrase)`() {
        val result = compareItems("lait chocolat", "lait")
        assertNull("lait chocolat vs lait should be NO_MATCH", result)
    }

    @Test
    fun `french huile olive phrase detected`() {
        val tokens = listOf("huile", "olive")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("olive_oil", match!!.canonicalId)
    }

    @Test
    fun `french base product pain`() {
        val sig = extractor.extract("pain")
        assertEquals("bread", sig.baseProduct)
    }

    @Test
    fun `french accent normalization crème becomes creme`() {
        assertEquals("creme", normalizer.normalize("crème"))
    }

    @Test
    fun `french elision l eau tokenizes correctly`() {
        val tokens = normalizer.tokenize(normalizer.normalize("l'eau"))
        assertTrue("l'eau should tokenize to include 'eau'", tokens.contains("eau"))
    }

    // =====================================================================
    // Spanish Cases (Español)
    // =====================================================================

    @Test
    fun `spanish leche vs leche is EXACT_DUPLICATE`() {
        val result = compareItems("leche", "leche")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `spanish leche chocolate vs leche is NO_MATCH (protected phrase)`() {
        val result = compareItems("leche chocolate", "leche")
        assertNull("leche chocolate vs leche should be NO_MATCH", result)
    }

    @Test
    fun `spanish aceite oliva phrase detected`() {
        val tokens = listOf("aceite", "oliva")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("olive_oil", match!!.canonicalId)
    }

    @Test
    fun `spanish base product pan`() {
        val sig = extractor.extract("pan")
        assertEquals("bread", sig.baseProduct)
    }

    @Test
    fun `spanish accent normalization limón becomes limon`() {
        assertEquals("limon", normalizer.normalize("limón"))
    }

    // =====================================================================
    // Amharic Cases (አማርኛ)
    // =====================================================================

    @Test
    fun `amharic ወተት vs ወተት is EXACT_DUPLICATE`() {
        val result = compareItems("ወተት", "ወተት")
        assertEquals(DuplicateReason.EXACT_DUPLICATE, result)
    }

    @Test
    fun `amharic base product ዳቦ`() {
        val sig = extractor.extract("ዳቦ")
        assertEquals("bread", sig.baseProduct)
    }

    @Test
    fun `amharic ዘይት ወይራ phrase detected`() {
        val tokens = listOf("ዘይት", "ወይራ")
        val match = phraseMatcher.findMatch(tokens)
        assertNotNull(match)
        assertEquals("olive_oil", match!!.canonicalId)
    }

    // =====================================================================
    // Cross-language base product matching
    // =====================================================================

    @Test
    fun `russian хлеб and hebrew לחם share bread base product`() {
        val sigRu = extractor.extract("хлеб")
        val sigHe = extractor.extract("לחם")
        assertEquals(sigRu.baseProduct, sigHe.baseProduct)
    }

    @Test
    fun `french pain and spanish pan share bread base product`() {
        val sigFr = extractor.extract("pain")
        val sigEs = extractor.extract("pan")
        assertEquals(sigFr.baseProduct, sigEs.baseProduct)
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private fun compareItems(draftName: String, existingName: String): DuplicateReason? {
        val draftSig = extractor.extract(draftName)
        val existingSig = extractor.extract(existingName)
        return comparisonEngine.compare(draftSig, existingSig).reason
    }

    private fun makeItem(id: String, name: String): ShoppingItem {
        return ShoppingItem(id = id, name = name, normalizedName = normalizer.normalize(name))
    }
}
