package com.salino.sali.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.HouseholdRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsState(
    val user: User? = null,
    val household: Household? = null,
    val members: List<HouseholdMember> = emptyList(),
    val inviteCode: String = "",
    val isLoading: Boolean = true,
    val isSignedOut: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val householdRepository: HouseholdRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsState())
    val uiState: StateFlow<SettingsState> = _uiState

    init {
        loadSettings()
    }

    private fun loadSettings() {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().filterNotNull().first()
            val householdId = user.activeHouseholdId

            _uiState.value = _uiState.value.copy(user = user)

            if (householdId != null) {
                launch {
                    householdRepository.observeHousehold(householdId).collectLatest { household ->
                        _uiState.value = _uiState.value.copy(
                            household = household,
                            inviteCode = household?.inviteCode.orEmpty(),
                            isLoading = false
                        )
                    }
                }

                launch {
                    householdRepository.observeHouseholdMembers(householdId).collect { members ->
                        _uiState.value = _uiState.value.copy(members = members)
                    }
                }
            } else {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
            _uiState.value = _uiState.value.copy(isSignedOut = true)
        }
    }
}
