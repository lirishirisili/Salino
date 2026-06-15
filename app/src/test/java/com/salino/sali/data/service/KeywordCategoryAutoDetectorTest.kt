package com.salino.sali.data.service

import com.salino.sali.data.model.ItemCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KeywordCategoryAutoDetectorTest {

    private val detector = KeywordCategoryAutoDetector()

    @Test
    fun uncertainItems_abstainForAi() {
        assertNull(detector.detectCategory("גרביים לבנות"))
    }

    @Test
    fun schug_matchesPantryFromExpandedLexicon() {
        assertEquals(ItemCategory.PANTRY, detector.detectCategory("סחוג"))
    }

    @Test
    fun milk_exactTokenMatch() {
        assertEquals(ItemCategory.DAIRY, detector.detectCategory("חלב"))
        assertEquals(ItemCategory.DAIRY, detector.detectCategory("חלב 3%"))
    }

    @Test
    fun sponge_exactTokenMatch() {
        assertEquals(ItemCategory.CLEANING, detector.detectCategory("ספוג"))
    }

    @Test
    fun whiteCheese_phraseMatch() {
        assertEquals(ItemCategory.DAIRY, detector.detectCategory("גבינה לבנה"))
    }

    @Test
    fun dishSoap_phraseMatch() {
        assertEquals(ItemCategory.CLEANING, detector.detectCategory("סבון כלים"))
    }
}
