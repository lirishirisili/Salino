package com.salino.sali.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.Household
import com.salino.sali.data.model.HouseholdMember
import com.salino.sali.data.model.NotificationPreferences
import com.salino.sali.data.model.User
import com.salino.sali.data.repository.NotificationRepository
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.HouseholdRepository
import com.salino.sali.domain.repository.TourRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class NotificationType(val key: String) {
    ITEM_ADDED("itemAdded"),
    URGENT_ITEM("urgentItem"),
    SHOPPING_COMPLETE("shoppingComplete"),
    MEMBER_JOINED("memberJoined")
}

data class SettingsState(
    val user: User? = null,
    val household: Household? = null,
    val members: List<HouseholdMember> = emptyList(),
    val inviteCode: String = "",
    val isLoading: Boolean = true,
    val isSignedOut: Boolean = false,
    val hasLeftHousehold: Boolean = false,
    val showEditNameDialog: Boolean = false,
    val showLeaveDialog: Boolean = false,
    val notificationPreferences: NotificationPreferences = NotificationPreferences(),
    val notificationsPermitted: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val householdRepository: HouseholdRepository,
    private val shoppingRepository: ShoppingRepository,
    private val recurringRepository: RecurringRepository,
    private val activityRepository: ActivityRepository,
    private val tourRepository: TourRepository,
    private val notificationRepository: NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsState())
    val uiState: StateFlow<SettingsState> = _uiState

    init {
        loadSettings()
        loadNotificationPreferences()
    }

    private fun loadNotificationPreferences() {
        viewModelScope.launch {
            val prefs = notificationRepository.getPreferences()
            _uiState.value = _uiState.value.copy(notificationPreferences = prefs)
        }
    }

    /** Reflects the OS-level notification permission state in the UI. */
    fun setNotificationsPermitted(granted: Boolean) {
        _uiState.value = _uiState.value.copy(notificationsPermitted = granted)
        if (granted) {
            viewModelScope.launch {
                notificationRepository.registerCurrentToken()
            }
        }
    }

    fun setNotificationPreference(type: NotificationType, enabled: Boolean) {
        val current = _uiState.value.notificationPreferences
        val updated = when (type) {
            NotificationType.ITEM_ADDED -> current.copy(itemAdded = enabled)
            NotificationType.URGENT_ITEM -> current.copy(urgentItem = enabled)
            NotificationType.SHOPPING_COMPLETE -> current.copy(shoppingComplete = enabled)
            NotificationType.MEMBER_JOINED -> current.copy(memberJoined = enabled)
        }
        _uiState.value = _uiState.value.copy(notificationPreferences = updated)
        viewModelScope.launch {
            val result = notificationRepository.updatePreference(type.key, enabled)
            if (result.isFailure) {
                // Revert on persistence failure.
                _uiState.value = _uiState.value.copy(notificationPreferences = current)
            }
        }
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
            // Remove this device's push token before the session is torn down.
            notificationRepository.unregisterCurrentToken()
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
                val uid = _uiState.value.user?.id
                if (!uid.isNullOrBlank()) {
                    tourRepository.clearTourCompleted(uid)
                }
                _uiState.value = _uiState.value.copy(showLeaveDialog = false, hasLeftHousehold = true)
            } else {
                _uiState.value = _uiState.value.copy(showLeaveDialog = false)
            }
        }
    }
}
