package com.salino.sali.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.HouseholdRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsState(
    val user: User? = null,
    val household: Household? = null,
    val members: List<HouseholdMember> = emptyList(),
    val inviteCode: String = "",
    val isLoading: Boolean = true,
    val isSignedOut: Boolean = false,
    val hasLeftHousehold: Boolean = false,
    val showEditNameDialog: Boolean = false,
    val showLeaveDialog: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val householdRepository: HouseholdRepository,
    private val shoppingRepository: ShoppingRepository,
    private val recurringRepository: RecurringRepository,
    private val activityRepository: ActivityRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsState())
    val uiState: StateFlow<SettingsState> = _uiState

    init {
        loadSettings()
    }

    private fun loadSettings() {
        viewModelScope.launch {
            val user = authRepository.observeCurrentUser().first() ?: return@launch
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
            shoppingRepository.clearListeners()
            recurringRepository.clearListeners()
            activityRepository.clearListeners()
            householdRepository.clearListeners()
            authRepository.signOut()
            _uiState.value = _uiState.value.copy(isSignedOut = true)
        }
    }

    fun showEditNameDialog() {
        _uiState.value = _uiState.value.copy(showEditNameDialog = true)
    }

    fun dismissEditNameDialog() {
        _uiState.value = _uiState.value.copy(showEditNameDialog = false)
    }

    fun updateHouseholdName(newName: String) {
        val householdId = _uiState.value.household?.id ?: return
        viewModelScope.launch {
            householdRepository.updateHouseholdName(householdId, newName)
            _uiState.value = _uiState.value.copy(showEditNameDialog = false)
        }
    }

    fun showLeaveDialog() {
        _uiState.value = _uiState.value.copy(showLeaveDialog = true)
    }

    fun dismissLeaveDialog() {
        _uiState.value = _uiState.value.copy(showLeaveDialog = false)
    }

    fun leaveHousehold() {
        val householdId = _uiState.value.household?.id ?: return
        viewModelScope.launch {
            val result = householdRepository.leaveHousehold(householdId)
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(showLeaveDialog = false, hasLeftHousehold = true)
            } else {
                _uiState.value = _uiState.value.copy(showLeaveDialog = false)
            }
        }
    }
}
