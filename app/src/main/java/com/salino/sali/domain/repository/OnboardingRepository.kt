package com.salino.sali.domain.repository

interface OnboardingRepository {
    suspend fun shouldShowHouseholdCreatedGuide(): Boolean
    suspend fun markHouseholdCreatedGuideSeen()
    suspend fun shouldShowJoinWelcome(): Boolean
    suspend fun markJoinWelcomeSeen()
    suspend fun shouldShowShoppingListGuide(): Boolean
    suspend fun markShoppingListGuideSeen()
    suspend fun resetHouseholdOnboarding()
}
