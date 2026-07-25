package com.salino.sali

import android.app.Application
import android.util.Log
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.salino.sali.data.service.SalinoMessagingService
import com.salino.sali.di.AutocompleteWarmupEntryPoint
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.android.EntryPointAccessors
import java.util.Locale

@HiltAndroidApp
class SalinoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            FirebaseAnalytics.getInstance(this).apply {
                setAnalyticsCollectionEnabled(true)
                logEvent(FirebaseAnalytics.Event.APP_OPEN, null)
            }
        } catch (e: Throwable) {
            Log.e(TAG, "Firebase Analytics init failed", e)
        }
        try {
            if (BuildConfig.DEBUG) {
                MobileAds.setRequestConfiguration(
                    RequestConfiguration.Builder()
                        .setTestDeviceIds(listOf(AdRequest.DEVICE_ID_EMULATOR))
                        .build(),
                )
            }
            MobileAds.initialize(applicationContext) { }
        } catch (e: Throwable) {
            Log.e(TAG, "AdMob init failed", e)
        }
        try {
            EntryPointAccessors.fromApplication(this, AutocompleteWarmupEntryPoint::class.java)
                .itemNameAutocompleteStore()
                .ensureStarted()
        } catch (e: Throwable) {
            Log.e(TAG, "Autocomplete warmup failed", e)
        }
        try {
            SalinoMessagingService.ensureChannel(this)
            // Register the FCM token whenever a user is signed in (covers both
            // returning users and fresh sign-ins within this process).
            FirebaseAuth.getInstance().addAuthStateListener { firebaseAuth ->
                if (firebaseAuth.currentUser != null) {
                    registerPushTokenIfSignedIn()
                }
            }
        } catch (e: Throwable) {
            Log.e(TAG, "Push notifications init failed", e)
        }
    }

    private fun registerPushTokenIfSignedIn() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (token.isNullOrBlank()) return@addOnSuccessListener
                FirebaseFirestore.getInstance()
                    .collection("users")
                    .document(uid)
                    .set(
                        mapOf(
                            "fcmTokens" to FieldValue.arrayUnion(token),
                            "language" to Locale.getDefault().language
                        ),
                        SetOptions.merge()
                    )
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "FCM token fetch failed", e)
            }
    }

    private companion object {
        private const val TAG = "SalinoApp"
    }
}
