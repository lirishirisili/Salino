package com.salino.sali.ui.components

import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.salino.sali.ads.LevelPlayInitializer
import com.salino.sali.util.LevelPlayConfig
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.banner.LevelPlayBannerAdView
import com.unity3d.mediation.banner.LevelPlayBannerAdViewListener

/** Tablet / unfolded foldable — keep banner host phone-width, not full-bleed. */
private const val WIDE_LAYOUT_MIN_WIDTH_DP = 600

/**
 * Bottom Unity LevelPlay banner.
 *
 * Matches the working RN behavior:
 * - Parent (Scaffold bottomBar) reports **0 height** until an ad loads (no empty gap).
 * - The native LevelPlay view is still measured at a real banner height while loading
 *   (like RN `position: 'absolute'`), so mediation can lay out and fill.
 * - Collapses on persistent load failure.
 * - On wide screens, uses fixed BANNER (320×50) centered instead of full-bleed adaptive.
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
    var slotWidthDp by remember { mutableIntStateOf(320) }
    val density = LocalDensity.current
    val configuration = LocalConfiguration.current
    val isWideLayout = configuration.screenWidthDp >= WIDE_LAYOUT_MIN_WIDTH_DP
    val showSlot = !collapseWhenFailed || adLoaded

    LaunchedEffect(showSlot) {
        onAdVisible?.invoke(showSlot)
    }

    DisposableEffect(Unit) {
        Log.i(TAG, "component mount collapseWhenFailed=$collapseWhenFailed wide=$isWideLayout")
        onDispose {
            Log.i(TAG, "component unmount")
            onAdVisible?.invoke(false)
        }
    }

    if (collapseWhenFailed && loadFailed && !adLoaded) {
        return
    }

    val slotHeightPx = with(density) { slotHeightDp.dp.roundToPx().coerceAtLeast(1) }
    val slotWidthPx = with(density) { slotWidthDp.dp.roundToPx().coerceAtLeast(1) }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            modifier = Modifier
                .width(slotWidthDp.dp)
                .alpha(if (adLoaded) 1f else 0f)
                // Measure at real banner size; report 0 height to Scaffold until fill.
                .layout { measurable, constraints ->
                    val placeable = measurable.measure(
                        constraints.copy(
                            minWidth = slotWidthPx,
                            maxWidth = slotWidthPx,
                            minHeight = slotHeightPx,
                            maxHeight = slotHeightPx,
                        ),
                    )
                    val reportedHeight = if (adLoaded) placeable.height else 0
                    layout(placeable.width, reportedHeight) {
                        placeable.placeRelative(0, 0)
                    }
                },
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
                        isWideLayout = isWideLayout,
                        onSize = { widthDp, heightDp ->
                            if (widthDp > 0) slotWidthDp = widthDp
                            if (heightDp > 0) slotHeightDp = heightDp
                        },
                        onLoaded = { widthDp, heightDp ->
                            if (widthDp > 0) slotWidthDp = widthDp
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
            update = { view ->
                view.layoutParams = view.layoutParams.apply {
                    width = slotWidthPx
                    height = slotHeightPx
                }
            },
            onRelease = { view ->
                (view.tag as? LevelPlayBannerController)?.destroy()
            },
        )
    }
}

private class LevelPlayBannerController(
    private val host: FrameLayout,
    private val isWideLayout: Boolean,
    private val onSize: (widthDp: Int, heightDp: Int) -> Unit,
    private val onLoaded: (widthDp: Int, heightDp: Int) -> Unit,
    private val onFailed: () -> Unit,
) {
    private var banner: LevelPlayBannerAdView? = null
    private var destroyed = false
    private var attempt = 0
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var readyListener: ((Boolean) -> Unit)? = null
    private var loadRequested = false
    private var sizeWidthDp = 320
    private var sizeHeightDp = LevelPlayConfig.BANNER_HEIGHT_DP

    fun start() {
        Log.i(TAG, "controller start isReady=${LevelPlayInitializer.isReady} wide=$isWideLayout")
        if (LevelPlayInitializer.isReady) {
            createAndLoad()
            return
        }
        val listener: (Boolean) -> Unit = { ready ->
            Log.i(TAG, "ready listener ready=$ready destroyed=$destroyed")
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
        // Phones: adaptive. Wide / foldable: fixed BANNER so the creative stays phone-sized.
        val adSize = if (isWideLayout) {
            LevelPlayAdSize.BANNER
        } else {
            try {
                LevelPlayAdSize.createAdaptiveAdSize(ctx) ?: LevelPlayAdSize.BANNER
            } catch (e: Throwable) {
                Log.w(TAG, "createAdaptiveAdSize failed; using BANNER", e)
                LevelPlayAdSize.BANNER
            }
        }
        sizeHeightDp = adSize.height.takeIf { it > 0 } ?: LevelPlayConfig.BANNER_HEIGHT_DP
        sizeWidthDp = adSize.width.takeIf { it > 0 } ?: 320
        val heightPx = (sizeHeightDp * density).toInt().coerceAtLeast(1)
        val widthPx = (sizeWidthDp * density).toInt().coerceAtLeast(1)
        host.post { if (!destroyed) onSize(sizeWidthDp, sizeHeightDp) }

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
                Log.i(
                    TAG,
                    "loaded network=${adInfo.adNetwork} placement=${adInfo.placementName} " +
                        "adUnit=${adInfo.adUnitId} size=${sizeWidthDp}x$sizeHeightDp",
                )
                host.post { if (!destroyed) onLoaded(sizeWidthDp, sizeHeightDp) }
            }

            override fun onAdLoadFailed(error: LevelPlayAdError) {
                if (destroyed) return
                Log.w(TAG, "load failed code=${error.errorCode} message=${error.errorMessage}")
                scheduleRetryOrFail()
            }

            override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {
                Log.i(TAG, "displayed network=${adInfo.adNetwork}")
                Log.i(
                    TAG,
                    "impression adUnit=${adInfo.adUnitId} network=${adInfo.adNetwork} revenue=${adInfo.revenue}",
                )
            }

            override fun onAdDisplayFailed(adInfo: LevelPlayAdInfo, error: LevelPlayAdError) {
                Log.w(TAG, "display failed code=${error.errorCode} message=${error.errorMessage}")
                scheduleRetryOrFail()
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
            FrameLayout.LayoutParams(widthPx, heightPx),
        )
        // Force a layout pass before load — mirrors RN onLayout gate.
        host.post {
            if (destroyed) return@post
            if (!loadRequested) {
                loadRequested = true
                Log.i(
                    TAG,
                    "load requested adUnit=${LevelPlayConfig.BANNER_AD_UNIT_ID} " +
                        "size=${widthPx}x$heightPx adaptive=${adSize.isAdaptive} wide=$isWideLayout",
                )
                view.loadAd()
            }
        }
    }

    private fun scheduleRetryOrFail() {
        if (destroyed) return
        if (attempt < MAX_LOAD_ATTEMPTS) {
            attempt += 1
            loadRequested = false
            Log.i(TAG, "scheduling retry attempt=$attempt in ${RETRY_BACKOFF_MS}ms")
            handler.postDelayed({
                if (destroyed) return@postDelayed
                loadRequested = true
                Log.i(TAG, "retry loadAd attempt=$attempt")
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
        private const val RETRY_BACKOFF_MS = 15_000L
    }
}

private const val TAG = "BANNER"
