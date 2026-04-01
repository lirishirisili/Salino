package com.salino.sali.ui

/**
 * Generic sealed class for screen UI states.
 * Use this in ViewModels to represent loading, success, and error.
 */
sealed class UiState<out T> {
    data object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
