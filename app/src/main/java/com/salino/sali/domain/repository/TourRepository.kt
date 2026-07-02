package com.salino.sali.domain.repository

interface TourRepository {
    suspend fun hasCompletedTour(uid: String): Boolean
    suspend fun markTourCompleted(uid: String)
    suspend fun clearTourCompleted(uid: String)
}
