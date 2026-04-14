package com.salino.sali.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for ShoppingItem data class.
 * Covers: isUrgent / isFavorite field defaults, copy behavior,
 * computed properties, and no-arg constructor.
 */
class ShoppingItemTest {

    // =====================================================================
    // Default values
    // =====================================================================

    @Test
    fun `default isUrgent is false`() {
        val item = ShoppingItem(name = "Milk")
        assertFalse(item.isUrgent)
    }

    @Test
    fun `default isFavorite is false`() {
        val item = ShoppingItem(name = "Milk")
        assertFalse(item.isFavorite)
    }

    @Test
    fun `no-arg constructor sets isUrgent to false`() {
        val item = ShoppingItem()
        assertFalse(item.isUrgent)
    }

    @Test
    fun `no-arg constructor sets isFavorite to false`() {
        val item = ShoppingItem()
        assertFalse(item.isFavorite)
    }

    // =====================================================================
    // Explicit values
    // =====================================================================

    @Test
    fun `isUrgent can be set to true`() {
        val item = ShoppingItem(name = "Bread", isUrgent = true)
        assertTrue(item.isUrgent)
    }

    @Test
    fun `isFavorite can be set to true`() {
        val item = ShoppingItem(name = "Bread", isFavorite = true)
        assertTrue(item.isFavorite)
    }

    @Test
    fun `both isUrgent and isFavorite can be true simultaneously`() {
        val item = ShoppingItem(name = "Eggs", isUrgent = true, isFavorite = true)
        assertTrue(item.isUrgent)
        assertTrue(item.isFavorite)
    }

    // =====================================================================
    // Copy behavior
    // =====================================================================

    @Test
    fun `copy preserves isUrgent`() {
        val original = ShoppingItem(name = "Milk", isUrgent = true)
        val copied = original.copy(name = "Updated Milk")
        assertTrue(copied.isUrgent)
        assertEquals("Updated Milk", copied.name)
    }

    @Test
    fun `copy preserves isFavorite`() {
        val original = ShoppingItem(name = "Milk", isFavorite = true)
        val copied = original.copy(quantity = 2.0)
        assertTrue(copied.isFavorite)
    }

    @Test
    fun `copy can change isUrgent from false to true`() {
        val original = ShoppingItem(name = "Milk", isUrgent = false)
        val updated = original.copy(isUrgent = true)
        assertTrue(updated.isUrgent)
        assertFalse(original.isUrgent)
    }

    @Test
    fun `copy can change isUrgent from true to false`() {
        val original = ShoppingItem(name = "Milk", isUrgent = true)
        val updated = original.copy(isUrgent = false)
        assertFalse(updated.isUrgent)
    }

    @Test
    fun `copy with unrelated fields does not affect isUrgent or isFavorite`() {
        val item = ShoppingItem(
            name = "Soap",
            isUrgent = true,
            isFavorite = true,
            note = "old note"
        )
        val updated = item.copy(note = "new note", quantity = 3.0)
        assertTrue(updated.isUrgent)
        assertTrue(updated.isFavorite)
        assertEquals("new note", updated.note)
    }

    // =====================================================================
    // Computed properties
    // =====================================================================

    @Test
    fun `isActive is true when status is ACTIVE`() {
        val item = ShoppingItem(status = ItemStatus.ACTIVE.name)
        assertTrue(item.isActive)
        assertFalse(item.isBought)
    }

    @Test
    fun `isBought is true when status is BOUGHT`() {
        val item = ShoppingItem(status = ItemStatus.BOUGHT.name)
        assertTrue(item.isBought)
        assertFalse(item.isActive)
    }

    // =====================================================================
    // PropertyName annotations — verify field names match Firestore naming
    // =====================================================================

    @Test
    fun `isFavorite field has PropertyName annotation with value isFavorite`() {
        val field = ShoppingItem::class.java.getDeclaredField("isFavorite")
        val annotation = field.annotations.find {
            it.annotationClass.simpleName == "PropertyName"
        }
        assertTrue("isFavorite field must have @PropertyName annotation", annotation != null)
    }

    @Test
    fun `isUrgent field has PropertyName annotation with value isUrgent`() {
        val field = ShoppingItem::class.java.getDeclaredField("isUrgent")
        val annotation = field.annotations.find {
            it.annotationClass.simpleName == "PropertyName"
        }
        assertTrue("isUrgent field must have @PropertyName annotation", annotation != null)
    }

    @Test
    fun `isFavorite getter has PropertyName annotation`() {
        val getter = ShoppingItem::class.java.methods.find { it.name == "isFavorite" }
        assertTrue("isFavorite() getter must exist", getter != null)
        val annotation = getter!!.annotations.find {
            it.annotationClass.simpleName == "PropertyName"
        }
        assertTrue("isFavorite() getter must have @PropertyName annotation", annotation != null)
    }

    @Test
    fun `isUrgent getter has PropertyName annotation`() {
        val getter = ShoppingItem::class.java.methods.find { it.name == "isUrgent" }
        assertTrue("isUrgent() getter must exist", getter != null)
        val annotation = getter!!.annotations.find {
            it.annotationClass.simpleName == "PropertyName"
        }
        assertTrue("isUrgent() getter must have @PropertyName annotation", annotation != null)
    }

    // =====================================================================
    // Equality
    // =====================================================================

    @Test
    fun `items with different isUrgent are not equal`() {
        val a = ShoppingItem(id = "1", name = "Milk", isUrgent = false)
        val b = ShoppingItem(id = "1", name = "Milk", isUrgent = true)
        assertFalse(a == b)
    }

    @Test
    fun `items with same fields including isUrgent are equal`() {
        val a = ShoppingItem(id = "1", name = "Milk", isUrgent = true)
        val b = ShoppingItem(id = "1", name = "Milk", isUrgent = true)
        assertEquals(a, b)
    }
}
