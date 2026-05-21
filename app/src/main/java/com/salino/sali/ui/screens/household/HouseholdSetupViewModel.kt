package com.salino.sali.ui.screens.household

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.HouseholdRepository
import com.salino.sali.domain.repository.OnboardingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class HouseholdSetupGuide {
    NONE,
    CREATED,
    JOINED
}

data class HouseholdSetupState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isComplete: Boolean = false,
    val inviteCode: String? = null,
    val activeGuide: HouseholdSetupGuide = HouseholdSetupGuide.NONE
)

@HiltViewModel
class HouseholdSetupViewModel @Inject constructor(
    private val householdRepository: HouseholdRepository,
    private val onboardingRepository: OnboardingRepository
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
                    val showGuide = onboardingRepository.shouldShowHouseholdCreatedGuide()
                    _uiState.value = HouseholdSetupState(
                        inviteCode = household.inviteCode,
                        activeGuide = if (showGuide) HouseholdSetupGuide.CREATED else HouseholdSetupGuide.NONE,
                        isComplete = !showGuide
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
                    val showWelcome = onboardingRepository.shouldShowJoinWelcome()
                    _uiState.value = HouseholdSetupState(
                        activeGuide = if (showWelcome) HouseholdSetupGuide.JOINED else HouseholdSetupGuide.NONE,
                        isComplete = !showWelcome
                    )
                }
                .onFailure { error ->
                    val msg = if (error is IllegalArgumentException) "invalid_code" else "generic"
                    _uiState.value = HouseholdSetupState(errorMessage = msg)
                }
        }
    }

    fun completeCreatedGuide() {
        viewModelScope.launch {
            onboardingRepository.markHouseholdCreatedGuideSeen()
            _uiState.value = _uiState.value.copy(
                activeGuide = HouseholdSetupGuide.NONE,
                isComplete = true
            )
        }
    }

    fun completeJoinedGuide() {
        viewModelScope.launch {
            onboardingRepository.markJoinWelcomeSeen()
            _uiState.value = _uiState.value.copy(
                activeGuide = HouseholdSetupGuide.NONE,
                isComplete = true
            )
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
