package com.salino.sali.data.repository

import com.salino.sali.data.local.OnboardingPreferences
import com.salino.sali.domain.repository.OnboardingRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OnboardingRepositoryImpl @Inject constructor(
    private val preferences: OnboardingPreferences
) : OnboardingRepository {

    override suspend fun shouldShowHouseholdCreatedGuide(): Boolean =
        preferences.shouldShowHouseholdCreatedGuide()

    override suspend fun markHouseholdCreatedGuideSeen() {
        preferences.markHouseholdCreatedGuideSeen()
    }

    override suspend fun shouldShowJoinWelcome(): Boolean =
        preferences.shouldShowJoinWelcome()

    override suspend fun markJoinWelcomeSeen() {
        preferences.markJoinWelcomeSeen()
    }

    override suspend fun shouldShowShoppingListGuide(): Boolean =
        preferences.shouldShowShoppingListGuide()

    override suspend fun markShoppingListGuideSeen() {
        preferences.markShoppingListGuideSeen()
    }

    override suspend fun resetHouseholdOnboarding() {
        preferences.resetHouseholdOnboarding()
    }
}
