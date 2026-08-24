package com.salino.sali.util

/**
 * Unity LevelPlay configuration for the native Android app.
 *
 * Banner mediation matches PoofCam / Tohav / Expo mobile:
 * ironSource bidding + Unity Ads bidding (Game ID 6164602,
 * placement Banner_Android_Bidding).
 *
 * IMPORTANT: [ANDROID_APP_KEY] is the LevelPlay App Key and must never be
 * confused with [BANNER_AD_UNIT_ID], the banner Ad Unit ID.
 */
object LevelPlayConfig {
    const val ANDROID_APP_KEY = "279039915"
    const val BANNER_AD_UNIT_ID = "0l7rb6asf9irqd31"

    /** Optional placement name; blank lets LevelPlay use the default placement. */
    const val BANNER_PLACEMENT_NAME = ""

    /** Standard banner slot height (320x50) used to reserve layout space. */
    const val BANNER_HEIGHT_DP = 50
}
