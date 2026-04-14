package com.salino.sali.data.local.entity

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for ShoppingItemEntity — verifies isUrgent field in Room schema.
 */
class ShoppingItemEntityTest {

    private fun createEntity(
        isFavorite: Boolean = false,
        isUrgent: Boolean = false
    ) = ShoppingItemEntity(
        id = "item-1",
        householdId = "hh-1",
        name = "Test",
        normalizedName = "test",
        quantity = 1.0,
        unit = null,
        category = "OTHER",
        note = "",
        status = "ACTIVE",
        addedBy = "user-1",
        addedByName = "User",
        boughtBy = null,
        boughtByName = null,
        isFavorite = isFavorite,
        isUrgent = isUrgent,
        createdAtMillis = 1000L,
        updatedAtMillis = 2000L
    )

    @Test
    fun `default isUrgent is false`() {
        val entity = createEntity()
        assertFalse(entity.isUrgent)
    }

    @Test
    fun `isUrgent can be set to true`() {
        val entity = createEntity(isUrgent = true)
        assertTrue(entity.isUrgent)
    }

    @Test
    fun `default isFavorite is false`() {
        val entity = createEntity()
        assertFalse(entity.isFavorite)
    }

    @Test
    fun `isFavorite can be set to true`() {
        val entity = createEntity(isFavorite = true)
        assertTrue(entity.isFavorite)
    }

    @Test
    fun `copy preserves isUrgent`() {
        val entity = createEntity(isUrgent = true)
        val copied = entity.copy(name = "Updated")
        assertTrue(copied.isUrgent)
        assertEquals("Updated", copied.name)
    }

    @Test
    fun `both flags can be true simultaneously`() {
        val entity = createEntity(isFavorite = true, isUrgent = true)
        assertTrue(entity.isFavorite)
        assertTrue(entity.isUrgent)
    }
}
