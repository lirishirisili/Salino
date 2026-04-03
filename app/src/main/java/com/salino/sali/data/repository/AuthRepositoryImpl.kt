package com.salino.sali.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val database: SalinoDatabase
) : AuthRepository {

    override val currentUserId: String?
        get() = auth.currentUser?.uid

    override val isSignedIn: Boolean
        get() = auth.currentUser != null

    override fun observeCurrentUser(): Flow<User?> = callbackFlow {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            trySend(null)
            close()
            return@callbackFlow
        }

        val registration = firestore.collection("users")
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(null)
                    return@addSnapshotListener
                }
                val user = snapshot?.toObject(User::class.java)?.copy(id = userId)
                trySend(user)
            }

        awaitClose { registration.remove() }
    }

    override suspend fun signInWithGoogle(idToken: String): Result<User> = runCatching {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
        getOrCreateUserProfile().getOrThrow()
    }

    override suspend fun getOrCreateUserProfile(): Result<User> = runCatching {
        val firebaseUser = auth.currentUser ?: throw IllegalStateException("Not signed in")
        val userId = firebaseUser.uid
        val userDoc = firestore.collection("users").document(userId)
        val snapshot = userDoc.get().await()

        if (snapshot.exists()) {
            snapshot.toObject(User::class.java)?.copy(id = userId)
                ?: throw IllegalStateException("Cannot deserialize user")
        } else {
            val newUser = User(
                id = userId,
                displayName = firebaseUser.displayName ?: "",
                email = firebaseUser.email ?: "",
                activeHouseholdId = null
            )
            userDoc.set(newUser).await()
            newUser
        }
    }

    override suspend fun signOut() {
        withContext(Dispatchers.IO) {
            database.clearAllTables()
        }
        auth.signOut()
    }
}
