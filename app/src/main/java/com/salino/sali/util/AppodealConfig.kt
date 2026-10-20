package com.salino.sali.util

/**
 * Appodeal configuration for the native Android app (banner only).
 *
 * Do not initialize INTERSTITIAL / REWARDED_VIDEO / NATIVE / MREC.
 */
object AppodealConfig {
    const val ANDROID_APP_KEY = "41f889143680e0eac194f70b75943e3d365cb43ebc64365b"

    /** Standard banner slot height (320×50) used to reserve layout space. */
    const val BANNER_HEIGHT_DP = 50

    /**
     * First verification build only. Set to false before any store / production build
     * so live ads and Autoconnection network activation work normally.
     */
    const val ENABLE_TEST_MODE = true
}
