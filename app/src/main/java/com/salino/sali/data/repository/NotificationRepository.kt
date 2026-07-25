package com.salino.sali.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.salino.sali.data.model.NotificationPreferences
import com.salino.sali.data.model.User
import kotlinx.coroutines.tasks.await
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages this device's FCM registration token and the signed-in user's
 * notification preferences in Firestore (users/{uid}).
 */
@Singleton
class NotificationRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val messaging: FirebaseMessaging
) {

    /** Fetches the current FCM token and stores it on the user's profile. */
    suspend fun registerCurrentToken(): Result<Unit> = runCatching {
        val uid = auth.currentUser?.uid ?: return@runCatching
        val token = messaging.token.await()
        if (token.isNullOrBlank()) return@runCatching
        firestore.collection(USERS).document(uid)
            .set(
                mapOf(
                    "fcmTokens" to FieldValue.arrayUnion(token),
                    "language" to Locale.getDefault().language
                ),
                SetOptions.merge()
            )
            .await()
    }

    /** Removes this device's token from the profile and deletes it locally. */
    suspend fun unregisterCurrentToken(): Result<Unit> = runCatching {
        val uid = auth.currentUser?.uid
        val token = runCatching { messaging.token.await() }.getOrNull()
        if (uid != null && !token.isNullOrBlank()) {
            firestore.collection(USERS).document(uid)
                .update("fcmTokens", FieldValue.arrayRemove(token))
                .await()
        }
        runCatching { messaging.deleteToken().await() }
    }

    suspend fun getPreferences(): NotificationPreferences {
        val uid = auth.currentUser?.uid ?: return NotificationPreferences()
        return runCatching {
            val snapshot = firestore.collection(USERS).document(uid).get().await()
            snapshot.toObject(User::class.java)?.notificationPreferences ?: NotificationPreferences()
        }.getOrDefault(NotificationPreferences())
    }

    /**
     * Updates a single preference flag. [key] must match a
     * [NotificationPreferences] field name (itemAdded, urgentItem,
     * shoppingComplete, memberJoined).
     */
    suspend fun updatePreference(key: String, value: Boolean): Result<Unit> = runCatching {
        val uid = auth.currentUser?.uid ?: return@runCatching
        firestore.collection(USERS).document(uid)
            .set(
                mapOf("notificationPreferences" to mapOf(key to value)),
                SetOptions.merge()
            )
            .await()
    }

    private companion object {
        const val USERS = "users"
    }
}
