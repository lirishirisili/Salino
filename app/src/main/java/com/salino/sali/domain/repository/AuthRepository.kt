package com.salino.sali.domain.repository

import com.salino.sali.data.model.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val currentUserId: String?
    val isSignedIn: Boolean
    val isEmailVerified: Boolean
    val currentUserEmail: String?
    val isPasswordProvider: Boolean

    fun observeCurrentUser(): Flow<User?>
    suspend fun signInWithGoogle(idToken: String): Result<User>
    suspend fun signInWithEmail(email: String, password: String): Result<User>
    suspend fun registerWithEmail(email: String, password: String): Result<User>
    suspend fun getOrCreateUserProfile(): Result<User>
    suspend fun sendPasswordReset(email: String): Result<Unit>
    suspend fun sendVerificationEmail(): Result<Unit>
    suspend fun reloadUser(): Boolean
    suspend fun signOut()
}
