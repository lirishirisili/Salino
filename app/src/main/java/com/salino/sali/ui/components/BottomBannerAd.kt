package com.salino.sali.ui.components

import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.salino.sali.ads.LevelPlayInitializer
import com.salino.sali.util.LevelPlayConfig
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.banner.LevelPlayBannerAdView
import com.unity3d.mediation.banner.LevelPlayBannerAdViewListener

/**
 * Bottom Unity LevelPlay banner.
 *
 * Layout contract (same as Expo / Tohav UX):
 * - Takes **no Scaffold space** until an ad actually loads.
 * - While loading, the native view still gets a real [requiredHeight] so LevelPlay
 *   can measure/layout, but Compose reports 0.dp height to the parent.
 * - Collapses again on persistent load failure.
 */
@Composable
fun BottomBannerAd(
    modifier: Modifier = Modifier,
    collapseWhenFailed: Boolean = true,
    onAdVisible: ((Boolean) -> Unit)? = null,
) {
    var adLoaded by remember { mutableStateOf(false) }
    var loadFailed by remember { mutableStateOf(false) }
    var slotHeightDp by remember { mutableIntStateOf(LevelPlayConfig.BANNER_HEIGHT_DP) }
    val showSlot = !collapseWhenFailed || adLoaded

    LaunchedEffect(showSlot) {
        onAdVisible?.invoke(showSlot)
    }

    DisposableEffect(Unit) {
        Log.i(TAG, "component mount collapseWhenFailed=$collapseWhenFailed")
        onDispose {
            Log.i(TAG, "component unmount")
            onAdVisible?.invoke(false)
        }
    }

    // No empty reserved bar when ads are unavailable.
    if (collapseWhenFailed && loadFailed && !adLoaded) {
        return
    }

    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            // Parent only sees height after a real fill.
            .height(if (showSlot) slotHeightDp.dp else 0.dp)
            // Force a measurable native size even while parent height is 0.
            .requiredHeight(slotHeightDp.dp)
            .alpha(if (adLoaded) 1f else 0f),
        factory = { ctx ->
            FrameLayout(ctx).apply {
                clipChildren = false
                clipToPadding = false
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                Log.i(TAG, "component mount host created")
                tag = LevelPlayBannerController(
                    host = this,
                    onLoaded = { heightDp ->
                        if (heightDp > 0) slotHeightDp = heightDp
                        adLoaded = true
                        loadFailed = false
                    },
                    onFailed = {
                        adLoaded = false
                        loadFailed = true
                    },
                ).also { it.start() }
            }
        },
        onRelease = { view ->
            (view.tag as? LevelPlayBannerController)?.destroy()
        },
    )
}

private class LevelPlayBannerController(
    private val host: FrameLayout,
    private val onLoaded: (Int) -> Unit,
    private val onFailed: () -> Unit,
) {
    private var banner: LevelPlayBannerAdView? = null
    private var destroyed = false
    private var attempt = 0
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var readyListener: ((Boolean) -> Unit)? = null
    private var loadRequested = false

    fun start() {
        if (LevelPlayInitializer.isReady) {
            createAndLoad()
            return
        }
        val listener: (Boolean) -> Unit = { ready ->
            if (ready) {
                host.post { if (!destroyed) createAndLoad() }
            } else if (!destroyed) {
                onFailed()
            }
        }
        readyListener = listener
        LevelPlayInitializer.addReadyListener(listener)
    }

    private fun createAndLoad() {
        if (destroyed || banner != null) return
        val ctx = host.context
        val density = ctx.resources.displayMetrics.density
        val adSize = try {
            LevelPlayAdSize.createAdaptiveAdSize(ctx) ?: LevelPlayAdSize.BANNER
        } catch (e: Throwable) {
            Log.w(TAG, "createAdaptiveAdSize failed; using BANNER", e)
            LevelPlayAdSize.BANNER
        }
        val heightDp = adSize.height.takeIf { it > 0 } ?: LevelPlayConfig.BANNER_HEIGHT_DP
        val heightPx = (heightDp * density).toInt().coerceAtLeast(1)

        val configBuilder = LevelPlayBannerAdView.Config.Builder().setAdSize(adSize)
        if (LevelPlayConfig.BANNER_PLACEMENT_NAME.isNotEmpty()) {
            configBuilder.setPlacementName(LevelPlayConfig.BANNER_PLACEMENT_NAME)
        }
        val view = LevelPlayBannerAdView(ctx, LevelPlayConfig.BANNER_AD_UNIT_ID, configBuilder.build())
        view.setBannerListener(object : LevelPlayBannerAdViewListener {
            override fun onAdLoaded(adInfo: LevelPlayAdInfo) {
                if (destroyed) return
                attempt = 0
                loadRequested = true
                Log.i(TAG, "loaded network=${adInfo.adNetwork} placement=${adInfo.placementName}")
                host.post { if (!destroyed) onLoaded(heightDp) }
            }

            override fun onAdLoadFailed(error: LevelPlayAdError) {
                if (destroyed) return
                Log.w(TAG, "load failed code=${error.errorCode} message=${error.errorMessage}")
                scheduleRetryOrFail()
            }

            override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "displayed network=${adInfo.adNetwork}")
                Log.i(TAG, "impression adUnit=${adInfo.adUnitId} network=${adInfo.adNetwork} revenue=${adInfo.revenue}")
            }

            override fun onAdDisplayFailed(adInfo: LevelPlayAdInfo, error: LevelPlayAdError) {
                Log.w(TAG, "display failed code=${error.errorCode} message=${error.errorMessage}")
            }

            override fun onAdClicked(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "clicked network=${adInfo.adNetwork}")
            }

            override fun onAdExpanded(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "expanded")
            }

            override fun onAdCollapsed(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "collapsed")
            }

            override fun onAdLeftApplication(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "left application")
            }
        })

        banner = view
        host.removeAllViews()
        host.addView(
            view,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                heightPx,
            ),
        )
        if (!loadRequested) {
            loadRequested = true
            Log.i(TAG, "load requested adUnit=${LevelPlayConfig.BANNER_AD_UNIT_ID}")
            view.loadAd()
        }
    }

    private fun scheduleRetryOrFail() {
        if (destroyed) return
        if (attempt < MAX_LOAD_ATTEMPTS) {
            attempt += 1
            loadRequested = false
            handler.postDelayed({
                if (destroyed) return@postDelayed
                loadRequested = true
                banner?.loadAd()
            }, RETRY_BACKOFF_MS)
        } else {
            Log.w(TAG, "giving up after $MAX_LOAD_ATTEMPTS attempts (slot collapsed)")
            onFailed()
        }
    }

    fun destroy() {
        destroyed = true
        handler.removeCallbacksAndMessages(null)
        readyListener?.let { LevelPlayInitializer.removeReadyListener(it) }
        readyListener = null
        try {
            banner?.destroy()
        } catch (e: Throwable) {
            Log.w(TAG, "banner destroy failed", e)
        }
        host.removeAllViews()
        banner = null
        Log.i(TAG, "destroyed")
    }

    companion object {
        private const val MAX_LOAD_ATTEMPTS = 3
        private const val RETRY_BACKOFF_MS = 30_000L
    }
}

private const val TAG = "BANNER"
