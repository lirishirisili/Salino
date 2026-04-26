package com.salino.sali.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthException
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
                        errorMessage = mapAuthError(error)
                    )
                }
        }
    }

    fun signInWithEmail(email: String, password: String, register: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            val authResult = if (register) {
                authRepository.registerWithEmail(email.trim(), password)
            } else {
                authRepository.signInWithEmail(email.trim(), password)
            }

            authResult
                .onSuccess {
                    val user = authRepository.observeCurrentUser().first()
                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        hasHousehold = !user?.activeHouseholdId.isNullOrBlank()
                    )
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState(
                        errorMessage = mapAuthError(error)
                    )
                }
        }
    }

    fun onGoogleSignInCancelled() {
        _uiState.value = AuthUiState(errorMessage = "Google sign-in was cancelled.")
    }

    fun onGoogleSignInFailed() {
        _uiState.value = AuthUiState(errorMessage = "Google sign-in failed. Please try again.")
    }

    private fun mapAuthError(error: Throwable): String {
        val code = (error as? FirebaseAuthException)?.errorCode
        return when (code) {
            "ERROR_WRONG_PASSWORD", "ERROR_INVALID_CREDENTIAL", "ERROR_INVALID_LOGIN_CREDENTIALS" ->
                "Incorrect email or password."
            "ERROR_USER_NOT_FOUND" -> "No account found for this email."
            "ERROR_INVALID_EMAIL" -> "Please enter a valid email address."
            "ERROR_EMAIL_ALREADY_IN_USE" -> "This email is already in use."
            "ERROR_WEAK_PASSWORD" -> "Password is too weak (minimum 6 characters)."
            "ERROR_TOO_MANY_REQUESTS" -> "Too many attempts. Try again later."
            else -> "Something went wrong. Try again."
        }
    }
}
