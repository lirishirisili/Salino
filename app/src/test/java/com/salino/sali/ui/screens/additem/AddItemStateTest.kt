package com.salino.sali.ui.screens.additem

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for AddItemState — verifies isUrgent field behavior in UI state.
 */
class AddItemStateTest {

    @Test
    fun `default state has isUrgent false`() {
        val state = AddItemState()
        assertFalse(state.isUrgent)
    }

    @Test
    fun `copy with isUrgent true`() {
        val state = AddItemState()
        val updated = state.copy(isUrgent = true)
        assertTrue(updated.isUrgent)
    }

    @Test
    fun `copy preserves isUrgent when changing other fields`() {
        val state = AddItemState(isUrgent = true, name = "Milk")
        val updated = state.copy(name = "Bread", quantity = "2")
        assertTrue(updated.isUrgent)
    }

    @Test
    fun `isUrgent is independent of other flags`() {
        val state = AddItemState(isUrgent = true, isRecurring = true)
        assertTrue(state.isUrgent)
        assertTrue(state.isRecurring)
        val updated = state.copy(isRecurring = false)
        assertTrue(updated.isUrgent)
        assertFalse(updated.isRecurring)
    }

    @Test
    fun `isSaved reset does not affect isUrgent`() {
        val state = AddItemState(isUrgent = true, isSaved = true)
        assertTrue(state.isUrgent)
        assertTrue(state.isSaved)
    }
}
