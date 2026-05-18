package com.salino.sali.ui.screens.verifyemail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VerifyEmailUiState(
    val email: String = "",
    val isChecking: Boolean = false,
    val resendCooldown: Int = 0,
    val isVerified: Boolean = false,
    val hasHousehold: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class VerifyEmailViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(VerifyEmailUiState())
    val uiState: StateFlow<VerifyEmailUiState> = _uiState

    init {
        _uiState.value = _uiState.value.copy(
            email = authRepository.currentUserEmail ?: ""
        )
    }

    fun checkEmailVerified() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isChecking = true, errorMessage = null)
            val verified = authRepository.reloadUser()
            if (verified) {
                val user = authRepository.observeCurrentUser().first()
                _uiState.value = _uiState.value.copy(
                    isChecking = false,
                    isVerified = true,
                    hasHousehold = !user?.activeHouseholdId.isNullOrBlank()
                )
            } else {
                _uiState.value = _uiState.value.copy(isChecking = false)
            }
        }
    }

    fun resendVerificationEmail() {
        if (_uiState.value.resendCooldown > 0) return
        viewModelScope.launch {
            authRepository.sendVerificationEmail()
            _uiState.value = _uiState.value.copy(resendCooldown = 60)
            startCooldownTimer()
        }
    }

    private fun startCooldownTimer() {
        viewModelScope.launch {
            while (_uiState.value.resendCooldown > 0) {
                kotlinx.coroutines.delay(1000)
                _uiState.value = _uiState.value.copy(
                    resendCooldown = _uiState.value.resendCooldown - 1
                )
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
        }
    }
}
