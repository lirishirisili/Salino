package com.salino.sali.feature.tour

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.TourRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TourViewModel @Inject constructor(
    val anchorRegistry: TourAnchorRegistry,
    private val tourRepository: TourRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TourUiState())
    val uiState: StateFlow<TourUiState> = _uiState.asStateFlow()

    private var autoStartChecked = false

    val steps: List<TourStep> = stepsForUser()

    fun setUid(uid: String?) {
        _uiState.update { it.copy(uid = uid) }
    }

    fun setCurrentRoute(route: String?) {
        _uiState.update { it.copy(currentRoute = route) }
    }

    fun setShoppingListReady(ready: Boolean) {
        _uiState.update { it.copy(shoppingListReady = ready) }
    }

    fun tryAutoStart(currentRoute: String? = _uiState.value.currentRoute) {
        if (!TOUR_ENABLED || autoStartChecked) return
        val state = _uiState.value
        if (state.uid.isNullOrBlank() || !state.shoppingListReady) return
        if (currentRoute != com.salino.sali.navigation.Screen.ShoppingList.route) return

        autoStartChecked = true
        viewModelScope.launch {
            val done = tourRepository.hasCompletedTour(state.uid!!)
            if (!done) {
                start()
            }
        }
    }

    fun start() {
        if (!TOUR_ENABLED) return
        _uiState.update {
            it.copy(
                active = true,
                stepIndex = 0,
                activeAnchorId = null,
                overlay = null,
                replayRequested = false,
            )
        }
    }

    fun requestReplay() {
        _uiState.update { it.copy(replayRequested = true) }
    }

    fun clearReplayRequest() {
        _uiState.update { it.copy(replayRequested = false) }
    }

    fun stop() {
        _uiState.update {
            it.copy(
                active = false,
                stepIndex = 0,
                activeAnchorId = null,
                overlay = null,
            )
        }
    }

    fun next() {
        _uiState.update { state ->
            state.copy(
                stepIndex = state.stepIndex + 1,
                activeAnchorId = null,
                overlay = null,
            )
        }
    }

    fun setActiveAnchor(anchorId: TourAnchorId?) {
        _uiState.update { it.copy(activeAnchorId = anchorId) }
    }

    fun showOverlay(overlay: TourOverlayState) {
        _uiState.update { it.copy(overlay = overlay) }
    }

    fun hideOverlay() {
        _uiState.update { it.copy(overlay = null) }
    }

    fun finishTour(completed: Boolean) {
        val uid = _uiState.value.uid
        stop()
        if (completed && !uid.isNullOrBlank()) {
            viewModelScope.launch {
                tourRepository.markTourCompleted(uid)
            }
        }
    }

    fun onNext() {
        val state = _uiState.value
        if (state.stepIndex >= steps.lastIndex) {
            finishTour(completed = true)
        } else {
            next()
        }
    }

    fun onSkip() {
        finishTour(completed = true)
    }

    fun clearTourForUser(uid: String) {
        viewModelScope.launch {
            tourRepository.clearTourCompleted(uid)
        }
        autoStartChecked = false
    }

    fun resetAutoStartCheck() {
        autoStartChecked = false
    }
}
