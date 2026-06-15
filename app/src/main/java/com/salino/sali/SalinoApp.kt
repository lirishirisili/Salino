package com.salino.sali

import android.app.Application
import android.util.Log
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.firebase.analytics.FirebaseAnalytics
import com.salino.sali.di.AutocompleteWarmupEntryPoint
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.android.EntryPointAccessors

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
    }

    private companion object {
        private const val TAG = "SalinoApp"
    }
}
