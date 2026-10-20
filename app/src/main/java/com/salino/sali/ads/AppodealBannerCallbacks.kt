package com.salino.sali.ads

import android.util.Log
import com.appodeal.ads.BannerCallbacks

/**
 * Process-wide banner callbacks (loaded / failed / shown / clicked).
 * Registered once before [AppodealInitializer] finishes initializing.
 */
object AppodealBannerCallbacks : BannerCallbacks {
    private const val TAG = "BANNER"

    override fun onBannerLoaded(height: Int, isPrecache: Boolean) {
        Log.i(TAG, "loaded height=$height precache=$isPrecache")
    }

    override fun onBannerFailedToLoad() {
        Log.w(TAG, "failed to load")
    }

    override fun onBannerShown() {
        Log.i(TAG, "shown")
        Log.i(TAG, "Banner [Notify Shown]")
    }

    override fun onBannerShowFailed() {
        Log.w(TAG, "show failed")
    }

    override fun onBannerClicked() {
        Log.i(TAG, "clicked")
    }

    override fun onBannerExpired() {
        Log.i(TAG, "expired")
    }
}
