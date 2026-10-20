package com.salino.sali.ads

import android.app.Activity
import android.util.Log
import com.appodeal.ads.Appodeal
import com.appodeal.ads.initializing.ApdInitializationCallback
import com.appodeal.ads.initializing.ApdInitializationError
import com.appodeal.ads.utils.Log as AppodealLog
import com.salino.sali.BuildConfig
import com.salino.sali.util.AppodealConfig
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Owns the single Appodeal initialization for the native Android app.
 *
 * Initializes [Appodeal.BANNER] only. Stack Consent Manager runs automatically
 * on initialize (no AdMob App ID required when the AdMob adapter is excluded).
 */
object AppodealInitializer {

    private const val TAG = "APPODEAL"

    @Volatile
    var isReady: Boolean = false
        private set

    private var started = false
    private val readyListeners = CopyOnWriteArraySet<(Boolean) -> Unit>()

    /** Initialize Appodeal once from an Activity. Safe to call multiple times. */
    @Synchronized
    fun initialize(activity: Activity) {
        if (started) return
        started = true

        Log.i(TAG, "init started")
        Log.i(TAG, "platform android appKey=${AppodealConfig.ANDROID_APP_KEY}")

        if (BuildConfig.DEBUG) {
            Appodeal.setLogLevel(AppodealLog.LogLevel.verbose)
            Log.i(TAG, "verbose SDK logging enabled (debug)")
        }

        // First verification build only — disable via AppodealConfig.ENABLE_TEST_MODE.
        if (AppodealConfig.ENABLE_TEST_MODE) {
            Appodeal.setTesting(true)
            Log.w(TAG, "TEST MODE ENABLED — disable AppodealConfig.ENABLE_TEST_MODE for production")
        }

        Appodeal.setBannerCallbacks(AppodealBannerCallbacks)

        Appodeal.initialize(
            activity,
            AppodealConfig.ANDROID_APP_KEY,
            Appodeal.BANNER,
            object : ApdInitializationCallback {
                override fun onInitializationFinished(errors: List<ApdInitializationError>?) {
                    if (errors.isNullOrEmpty()) {
                        isReady = true
                        Log.i(TAG, "init success (BANNER only)")
                        notifyListeners(true)
                    } else {
                        isReady = false
                        errors.forEach { err ->
                            Log.e(TAG, "init error: $err")
                        }
                        // Partial init can still serve ads; treat as ready if banner type is up.
                        val bannerOk = Appodeal.isInitialized(Appodeal.BANNER)
                        isReady = bannerOk
                        Log.w(TAG, "init finished with errors; bannerInitialized=$bannerOk")
                        notifyListeners(bannerOk)
                    }
                }
            },
        )
    }

    fun addReadyListener(listener: (Boolean) -> Unit) {
        readyListeners.add(listener)
        if (isReady) listener(true)
    }

    fun removeReadyListener(listener: (Boolean) -> Unit) {
        readyListeners.remove(listener)
    }

    private fun notifyListeners(ready: Boolean) {
        readyListeners.forEach { cb ->
            try {
                cb(ready)
            } catch (e: Throwable) {
                Log.w(TAG, "ready listener failed", e)
            }
        }
    }
}
