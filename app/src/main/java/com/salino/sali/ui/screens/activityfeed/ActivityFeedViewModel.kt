package com.salino.sali.ui.screens.activityfeed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ActivityFeedState(
    val entries: List<ActivityLog> = emptyList(),
    val isLoading: Boolean = true
)

@HiltViewModel
class ActivityFeedViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val activityRepository: ActivityRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActivityFeedState())
    val uiState: StateFlow<ActivityFeedState> = _uiState

    init {
        viewModelScope.launch {
            authRepository.observeCurrentUser().filterNotNull().collect { user ->
                val householdId = user.activeHouseholdId ?: return@collect
                activityRepository.observeActivityFeed(householdId).collect { entries ->
                    _uiState.value = ActivityFeedState(entries = entries, isLoading = false)
                }
            }
        }
    }
}
