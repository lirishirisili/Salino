package com.salino.sali.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthException
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.util.PasswordError
import com.salino.sali.util.validatePassword
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val passwordError: PasswordError? = null,
    val resetEmailSent: Boolean = false,
    val isAuthenticated: Boolean = false,
    val hasHousehold: Boolean = false,
    val needsEmailVerification: Boolean = false
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
                .onSuccess { user ->
                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        hasHousehold = !user.activeHouseholdId.isNullOrBlank()
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
        // Validate password on registration
        if (register) {
            val passwordError = validatePassword(password)
            if (passwordError != null) {
                _uiState.value = _uiState.value.copy(passwordError = passwordError, errorMessage = null)
                return
            }
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, passwordError = null)

            val authResult = if (register) {
                authRepository.registerWithEmail(email.trim(), password)
            } else {
                authRepository.signInWithEmail(email.trim(), password)
            }

            authResult
                .onSuccess {
                    // After registration or sign-in, check if email needs verification
                    if (authRepository.isPasswordProvider && !authRepository.isEmailVerified) {
                        _uiState.value = AuthUiState(needsEmailVerification = true)
                    } else {
                        val profile = authRepository.getOrCreateUserProfile().getOrThrow()
                        _uiState.value = AuthUiState(
                            isAuthenticated = true,
                            hasHousehold = !profile.activeHouseholdId.isNullOrBlank()
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState(
                        errorMessage = mapAuthError(error)
                    )
                }
        }
    }

    fun sendPasswordReset(email: String) {
        if (email.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter your email address.")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            authRepository.sendPasswordReset(email.trim())
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, resetEmailSent = true)
                }
                .onFailure {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = mapAuthError(it))
                }
        }
    }

    fun clearResetSent() {
        _uiState.value = _uiState.value.copy(resetEmailSent = false)
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
            "ERROR_WEAK_PASSWORD" -> "Password is too weak."
            "ERROR_TOO_MANY_REQUESTS" -> "Too many attempts. Try again later."
            else -> "Something went wrong. Try again."
        }
    }
}
