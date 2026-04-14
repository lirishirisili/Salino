package com.salino.sali.ui.screens.edititem

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for EditItemState — verifies isUrgent field behavior in UI state.
 */
class EditItemStateTest {

    @Test
    fun `default state has isUrgent false`() {
        val state = EditItemState()
        assertFalse(state.isUrgent)
    }

    @Test
    fun `state can be created with isUrgent true`() {
        val state = EditItemState(isUrgent = true)
        assertTrue(state.isUrgent)
    }

    @Test
    fun `copy preserves isUrgent when changing other fields`() {
        val state = EditItemState(isUrgent = true, name = "Milk")
        val updated = state.copy(name = "Bread", isSaving = true)
        assertTrue(updated.isUrgent)
    }

    @Test
    fun `copy can toggle isUrgent`() {
        val state = EditItemState(isUrgent = false)
        val toggled = state.copy(isUrgent = true)
        assertTrue(toggled.isUrgent)
        val unToggled = toggled.copy(isUrgent = false)
        assertFalse(unToggled.isUrgent)
    }

    @Test
    fun `isUrgent is independent of isDeleted and isSaved`() {
        val state = EditItemState(isUrgent = true, isSaved = true, isDeleted = false)
        assertTrue(state.isUrgent)
        val deleted = state.copy(isDeleted = true)
        assertTrue(deleted.isUrgent)
    }

    @Test
    fun `loading state preserves isUrgent after load completes`() {
        val loading = EditItemState(isLoading = true, isUrgent = false)
        val loaded = loading.copy(
            isLoading = false,
            name = "Soap",
            isUrgent = true
        )
        assertTrue(loaded.isUrgent)
        assertFalse(loaded.isLoading)
    }
}
