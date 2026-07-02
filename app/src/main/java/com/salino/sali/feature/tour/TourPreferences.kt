package com.salino.sali.feature.tour

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.tourDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "tour_preferences"
)

@Singleton
class TourPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.tourDataStore

    private fun tourKey(uid: String) = stringPreferencesKey("tour_completed_v3_$uid")

    suspend fun hasCompletedTour(uid: String): Boolean =
        dataStore.data.map { prefs ->
            prefs[tourKey(uid)] == "1"
        }.first()

    suspend fun markTourCompleted(uid: String) {
        dataStore.edit { it[tourKey(uid)] = "1" }
    }

    suspend fun clearTourCompleted(uid: String) {
        dataStore.edit { it.remove(tourKey(uid)) }
    }
}
