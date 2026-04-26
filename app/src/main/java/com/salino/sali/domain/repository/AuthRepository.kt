package com.salino.sali.domain.repository

import com.salino.sali.data.model.User
import com.salino.sali.data.model.NotificationPrefs
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val currentUserId: String?
    val isSignedIn: Boolean

    fun observeCurrentUser(): Flow<User?>
    suspend fun signInWithGoogle(idToken: String): Result<User>
    suspend fun signInWithEmail(email: String, password: String): Result<User>
    suspend fun registerWithEmail(email: String, password: String): Result<User>
    suspend fun getOrCreateUserProfile(): Result<User>
    suspend fun updateNotificationPrefs(prefs: NotificationPrefs): Result<Unit>
    suspend fun signOut()
}
