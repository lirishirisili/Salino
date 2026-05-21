package com.salino.sali.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.onboardingDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "onboarding_preferences"
)

@Singleton
class OnboardingPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.onboardingDataStore

    private val householdCreatedGuideSeen = booleanPreferencesKey("household_created_guide_seen")
    private val joinWelcomeSeen = booleanPreferencesKey("join_welcome_seen")
    private val shoppingListGuideSeen = booleanPreferencesKey("shopping_list_guide_seen")

    suspend fun shouldShowHouseholdCreatedGuide(): Boolean =
        !dataStore.data.map { it[householdCreatedGuideSeen] ?: false }.first()

    suspend fun markHouseholdCreatedGuideSeen() {
        dataStore.edit { it[householdCreatedGuideSeen] = true }
    }

    suspend fun shouldShowJoinWelcome(): Boolean =
        !dataStore.data.map { it[joinWelcomeSeen] ?: false }.first()

    suspend fun markJoinWelcomeSeen() {
        dataStore.edit { it[joinWelcomeSeen] = true }
    }

    suspend fun shouldShowShoppingListGuide(): Boolean =
        !dataStore.data.map { it[shoppingListGuideSeen] ?: false }.first()

    suspend fun markShoppingListGuideSeen() {
        dataStore.edit { it[shoppingListGuideSeen] = true }
    }

    suspend fun resetHouseholdOnboarding() {
        dataStore.edit {
            it.remove(householdCreatedGuideSeen)
            it.remove(joinWelcomeSeen)
            it.remove(shoppingListGuideSeen)
        }
    }
}
