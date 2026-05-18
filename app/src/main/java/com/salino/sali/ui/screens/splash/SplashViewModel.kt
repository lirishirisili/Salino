package com.salino.sali.ui.screens.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.salino.sali.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SplashDestination {
    data object Auth : SplashDestination()
    data object VerifyEmail : SplashDestination()
    data object HouseholdSetup : SplashDestination()
    data object ShoppingList : SplashDestination()
}

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _destination = MutableStateFlow<SplashDestination?>(null)
    val destination: StateFlow<SplashDestination?> = _destination

    init {
        checkAuthState()
    }

    private fun checkAuthState() {
        viewModelScope.launch {
            if (!authRepository.isSignedIn) {
                _destination.value = SplashDestination.Auth
                return@launch
            }

            // Gate: email/password users must verify their email
            if (authRepository.isPasswordProvider && !authRepository.isEmailVerified) {
                _destination.value = SplashDestination.VerifyEmail
                return@launch
            }

            try {
                val user = authRepository.observeCurrentUser().first()
                _destination.value = when {
                    user == null -> SplashDestination.Auth
                    user.activeHouseholdId.isNullOrBlank() -> SplashDestination.HouseholdSetup
                    else -> SplashDestination.ShoppingList
                }
            } catch (_: Exception) {
                _destination.value = SplashDestination.Auth
            }
        }
    }
}
