package com.salino.sali.data.local.mapper

import com.salino.sali.data.local.entity.ShoppingItemEntity
import com.salino.sali.data.model.ItemCategory
import com.salino.sali.data.model.ItemStatus
import com.salino.sali.data.model.ShoppingItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for ShoppingItem ↔ ShoppingItemEntity mappers.
 * Verifies that isUrgent and isFavorite are correctly mapped in both directions.
 */
class ShoppingItemMapperTest {

    private val sampleEntity = ShoppingItemEntity(
        id = "item-1",
        householdId = "hh-1",
        name = "Milk",
        normalizedName = "milk",
        quantity = 2.0,
        unit = "LITER",
        category = ItemCategory.DAIRY.name,
        note = "3% fat",
        status = ItemStatus.ACTIVE.name,
        addedBy = "user-1",
        addedByName = "Alice",
        boughtBy = null,
        boughtByName = null,
        isFavorite = true,
        isUrgent = true,
        createdAtMillis = 1000L,
        updatedAtMillis = 2000L
    )

    private val sampleItem = ShoppingItem(
        id = "item-2",
        name = "Bread",
        normalizedName = "bread",
        quantity = 1.0,
        unit = null,
        category = ItemCategory.BAKERY.name,
        note = "",
        status = ItemStatus.ACTIVE.name,
        addedBy = "user-2",
        addedByName = "Bob",
        boughtBy = null,
        boughtByName = null,
        isFavorite = true,
        isUrgent = true,
        createdAt = null,
        updatedAt = null
    )

    // =====================================================================
    // Entity → Model
    // =====================================================================

    @Test
    fun `toModel maps isUrgent true correctly`() {
        val model = sampleEntity.toModel()
        assertTrue(model.isUrgent)
    }

    @Test
    fun `toModel maps isFavorite true correctly`() {
        val model = sampleEntity.toModel()
        assertTrue(model.isFavorite)
    }

    @Test
    fun `toModel maps isUrgent false correctly`() {
        val entity = sampleEntity.copy(isUrgent = false)
        val model = entity.toModel()
        assertFalse(model.isUrgent)
    }

    @Test
    fun `toModel maps isFavorite false correctly`() {
        val entity = sampleEntity.copy(isFavorite = false)
        val model = entity.toModel()
        assertFalse(model.isFavorite)
    }

    @Test
    fun `toModel maps all basic fields`() {
        val model = sampleEntity.toModel()
        assertEquals("item-1", model.id)
        assertEquals("Milk", model.name)
        assertEquals("milk", model.normalizedName)
        assertEquals(2.0, model.quantity, 0.001)
        assertEquals("LITER", model.unit)
        assertEquals(ItemCategory.DAIRY.name, model.category)
        assertEquals("3% fat", model.note)
        assertEquals(ItemStatus.ACTIVE.name, model.status)
        assertEquals("user-1", model.addedBy)
        assertEquals("Alice", model.addedByName)
    }

    // =====================================================================
    // Model → Entity
    // =====================================================================

    @Test
    fun `toEntity maps isUrgent true correctly`() {
        val entity = sampleItem.toEntity("hh-1")
        assertTrue(entity.isUrgent)
    }

    @Test
    fun `toEntity maps isFavorite true correctly`() {
        val entity = sampleItem.toEntity("hh-1")
        assertTrue(entity.isFavorite)
    }

    @Test
    fun `toEntity maps isUrgent false correctly`() {
        val item = sampleItem.copy(isUrgent = false)
        val entity = item.toEntity("hh-1")
        assertFalse(entity.isUrgent)
    }

    @Test
    fun `toEntity maps isFavorite false correctly`() {
        val item = sampleItem.copy(isFavorite = false)
        val entity = item.toEntity("hh-1")
        assertFalse(entity.isFavorite)
    }

    @Test
    fun `toEntity sets householdId`() {
        val entity = sampleItem.toEntity("my-household")
        assertEquals("my-household", entity.householdId)
    }

    @Test
    fun `toEntity maps all basic fields`() {
        val entity = sampleItem.toEntity("hh-1")
        assertEquals("item-2", entity.id)
        assertEquals("Bread", entity.name)
        assertEquals("bread", entity.normalizedName)
        assertEquals(1.0, entity.quantity, 0.001)
        assertEquals(null, entity.unit)
        assertEquals(ItemCategory.BAKERY.name, entity.category)
    }

    // =====================================================================
    // Round-trip: Model → Entity → Model
    // =====================================================================

    @Test
    fun `round trip preserves isUrgent true`() {
        val item = ShoppingItem(name = "Eggs", isUrgent = true)
        val roundTripped = item.toEntity("hh").toModel()
        assertTrue(roundTripped.isUrgent)
    }

    @Test
    fun `round trip preserves isUrgent false`() {
        val item = ShoppingItem(name = "Eggs", isUrgent = false)
        val roundTripped = item.toEntity("hh").toModel()
        assertFalse(roundTripped.isUrgent)
    }

    @Test
    fun `round trip preserves isFavorite true`() {
        val item = ShoppingItem(name = "Eggs", isFavorite = true)
        val roundTripped = item.toEntity("hh").toModel()
        assertTrue(roundTripped.isFavorite)
    }

    @Test
    fun `round trip preserves isFavorite false`() {
        val item = ShoppingItem(name = "Eggs", isFavorite = false)
        val roundTripped = item.toEntity("hh").toModel()
        assertFalse(roundTripped.isFavorite)
    }

    @Test
    fun `round trip preserves both flags together`() {
        val item = ShoppingItem(
            name = "Soap",
            isFavorite = true,
            isUrgent = true
        )
        val roundTripped = item.toEntity("hh").toModel()
        assertTrue(roundTripped.isFavorite)
        assertTrue(roundTripped.isUrgent)
    }

    @Test
    fun `round trip preserves name and quantity`() {
        val item = ShoppingItem(name = "Bananas", quantity = 6.0, unit = "KG")
        val roundTripped = item.toEntity("hh").toModel()
        assertEquals("Bananas", roundTripped.name)
        assertEquals(6.0, roundTripped.quantity, 0.001)
        assertEquals("KG", roundTripped.unit)
    }

    // =====================================================================
    // Entity → Model → Entity round-trip
    // =====================================================================

    @Test
    fun `entity round trip preserves isUrgent`() {
        val entity = sampleEntity.copy(isUrgent = true)
        val roundTripped = entity.toModel().toEntity("hh-1")
        assertTrue(roundTripped.isUrgent)
        assertEquals(entity.householdId, roundTripped.householdId)
    }
}
