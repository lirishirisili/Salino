package com.salino.sali.ui.screens.household

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.HouseholdRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HouseholdSetupState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isComplete: Boolean = false,
    val inviteCode: String? = null
)

@HiltViewModel
class HouseholdSetupViewModel @Inject constructor(
    private val householdRepository: HouseholdRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HouseholdSetupState())
    val uiState: StateFlow<HouseholdSetupState> = _uiState

    fun createHousehold(name: String) {
        if (name.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "empty_name")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            householdRepository.createHousehold(name)
                .onSuccess { household ->
                    _uiState.value = HouseholdSetupState(
                        isComplete = true,
                        inviteCode = household.inviteCode
                    )
                }
                .onFailure { error ->
                    _uiState.value = HouseholdSetupState(
                        errorMessage = error.message ?: "generic"
                    )
                }
        }
    }

    fun joinHousehold(inviteCode: String) {
        if (inviteCode.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "empty_code")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            householdRepository.joinHousehold(inviteCode)
                .onSuccess {
                    _uiState.value = HouseholdSetupState(isComplete = true)
                }
                .onFailure { error ->
                    val msg = if (error is IllegalArgumentException) "invalid_code" else "generic"
                    _uiState.value = HouseholdSetupState(errorMessage = msg)
                }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
