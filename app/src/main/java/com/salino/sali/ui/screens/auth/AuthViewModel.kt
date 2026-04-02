package com.salino.sali.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isAuthenticated: Boolean = false,
    val hasHousehold: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            authRepository.signInWithGoogle(idToken)
                .onSuccess {
                    val user = authRepository.observeCurrentUser().first()
                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        hasHousehold = !user?.activeHouseholdId.isNullOrBlank()
                    )
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState(
                        errorMessage = error.message ?: "Authentication failed"
                    )
                }
        }
    }

    fun onGoogleSignInFailed(message: String) {
        _uiState.value = AuthUiState(errorMessage = message)
    }
}
