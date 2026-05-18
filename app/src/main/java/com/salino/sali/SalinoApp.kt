package com.salino.sali

import android.app.Application
import android.util.Log
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SalinoApp : Application() {
    override fun onCreate() {
        super.onCreate()
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
    }

    private companion object {
        private const val TAG = "SalinoApp"
    }
}
