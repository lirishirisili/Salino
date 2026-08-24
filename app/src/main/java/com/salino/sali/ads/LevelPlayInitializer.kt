package com.salino.sali.ads

import android.content.Context
import android.util.Log
import com.salino.sali.BuildConfig
import com.salino.sali.util.LevelPlayConfig
import com.unity3d.mediation.LevelPlay
import com.unity3d.mediation.LevelPlayConfiguration
import com.unity3d.mediation.LevelPlayInitError
import com.unity3d.mediation.LevelPlayInitListener
import com.unity3d.mediation.LevelPlayInitRequest
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Owns the single Unity LevelPlay initialization for the native Android app.
 *
 * - Initializes exactly once per process.
 * - Registers success/failure callbacks BEFORE calling init.
 * - Exposes readiness so banners are only created after [ready] is true.
 */
object LevelPlayInitializer {

    private const val TAG = "LEVELPLAY"

    @Volatile
    var isReady: Boolean = false
        private set

    private var started = false
    private val readyListeners = CopyOnWriteArraySet<(Boolean) -> Unit>()

    /** Initialize LevelPlay once. Safe to call multiple times. */
    @Synchronized
    fun initialize(context: Context) {
        if (started) return
        started = true

        Log.i(TAG, "init started")
        Log.i(TAG, "platform android appKey=${LevelPlayConfig.ANDROID_APP_KEY}")

        // Development diagnostics — must run before init. Removed automatically in
        // release because BuildConfig.DEBUG is false.
        if (BuildConfig.DEBUG) {
            try {
                LevelPlay.setAdaptersDebug(true)
            } catch (e: Throwable) {
                Log.w(TAG, "setAdaptersDebug failed", e)
            }
            try {
                LevelPlay.validateIntegration(context.applicationContext)
            } catch (e: Throwable) {
                Log.w(TAG, "validateIntegration failed", e)
            }
        }

        val initListener = object : LevelPlayInitListener {
            override fun onInitSuccess(configuration: LevelPlayConfiguration) {
                isReady = true
                Log.i(TAG, "init success")
                notifyListeners(true)
            }

            override fun onInitFailed(error: LevelPlayInitError) {
                isReady = false
                Log.e(
                    TAG,
                    "init failed code=${error.errorCode} message=${error.errorMessage}",
                )
                notifyListeners(false)
            }
        }

        try {
            val initRequest = LevelPlayInitRequest.Builder(LevelPlayConfig.ANDROID_APP_KEY)
                .build()
            LevelPlay.init(context.applicationContext, initRequest, initListener)
        } catch (e: Throwable) {
            Log.e(TAG, "init failed (exception)", e)
            notifyListeners(false)
        }
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
