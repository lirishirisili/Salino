package com.salino.sali.data.repository

import com.salino.sali.domain.repository.TourRepository
import com.salino.sali.feature.tour.TourPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TourRepositoryImpl @Inject constructor(
    private val preferences: TourPreferences
) : TourRepository {

    override suspend fun hasCompletedTour(uid: String): Boolean =
        preferences.hasCompletedTour(uid)

    override suspend fun markTourCompleted(uid: String) {
        preferences.markTourCompleted(uid)
    }

    override suspend fun clearTourCompleted(uid: String) {
        preferences.clearTourCompleted(uid)
    }
}
