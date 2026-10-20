package com.salino.sali.ui.components

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.appodeal.ads.Appodeal
import com.appodeal.ads.BannerView
import com.salino.sali.ads.AppodealInitializer
import com.salino.sali.util.AppodealConfig

/** Tablet / unfolded foldable — keep banner host phone-width, not full-bleed. */
private const val WIDE_LAYOUT_MIN_WIDTH_DP = 600

/**
 * Bottom Appodeal banner.
 *
 * Preserves prior LevelPlay host behavior:
 * - Parent (Scaffold bottomBar) reports **0 height** until an ad loads (no empty gap).
 * - The native banner view is still measured at a real banner height while loading.
 * - Collapses on persistent load failure.
 * - On wide screens, centers a phone-width (~320dp) host instead of full-bleed.
 */
@Composable
fun BottomBannerAd(
    modifier: Modifier = Modifier,
    collapseWhenFailed: Boolean = true,
    onAdVisible: ((Boolean) -> Unit)? = null,
) {
    var adLoaded by remember { mutableStateOf(false) }
    var loadFailed by remember { mutableStateOf(false) }
    var slotHeightDp by remember { mutableIntStateOf(AppodealConfig.BANNER_HEIGHT_DP) }
    var slotWidthDp by remember { mutableIntStateOf(320) }
    val density = LocalDensity.current
    val configuration = LocalConfiguration.current
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
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

    if (activity == null) {
        Log.w(TAG, "no Activity — banner skipped")
        return
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
                    tag = AppodealBannerController(
                        host = this,
                        activity = activity,
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
                (view.tag as? AppodealBannerController)?.destroy()
            },
        )
    }
}

private class AppodealBannerController(
    private val host: FrameLayout,
    private val activity: Activity,
    private val isWideLayout: Boolean,
    private val onSize: (widthDp: Int, heightDp: Int) -> Unit,
    private val onLoaded: (widthDp: Int, heightDp: Int) -> Unit,
    private val onFailed: () -> Unit,
) {
    private var bannerView: BannerView? = null
    private var destroyed = false
    private var attempt = 0
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var readyListener: ((Boolean) -> Unit)? = null
    private var sizeWidthDp = 320
    private var sizeHeightDp = AppodealConfig.BANNER_HEIGHT_DP
    private var showRequested = false

    fun start() {
        Log.i(TAG, "controller start isReady=${AppodealInitializer.isReady} wide=$isWideLayout")
        // Phone-width banner; disable 728×90 tablet banners to match prior 320×50 slot.
        Appodeal.set728x90Banners(false)
        if (isWideLayout) {
            Appodeal.setSmartBanners(false)
        }

        if (AppodealInitializer.isReady) {
            createAndShow()
            return
        }
        val listener: (Boolean) -> Unit = { ready ->
            Log.i(TAG, "ready listener ready=$ready destroyed=$destroyed")
            if (ready) {
                host.post { if (!destroyed) createAndShow() }
            } else if (!destroyed) {
                onFailed()
            }
        }
        readyListener = listener
        AppodealInitializer.addReadyListener(listener)
    }

    private fun createAndShow() {
        if (destroyed || bannerView != null) return

        sizeHeightDp = AppodealConfig.BANNER_HEIGHT_DP
        sizeWidthDp = 320
        val density = host.resources.displayMetrics.density
        val heightPx = (sizeHeightDp * density).toInt().coerceAtLeast(1)
        val widthPx = (sizeWidthDp * density).toInt().coerceAtLeast(1)
        host.post { if (!destroyed) onSize(sizeWidthDp, sizeHeightDp) }

        val view = Appodeal.getBannerView(activity)
        bannerView = view
        host.removeAllViews()
        host.addView(view, FrameLayout.LayoutParams(widthPx, heightPx))

        // Poll load state so we can expand the Compose slot (same UX as LevelPlay onAdLoaded).
        scheduleLoadWatch()

        host.post {
            if (destroyed) return@post
            showRequested = true
            Log.i(TAG, "show BANNER_VIEW requested size=${widthPx}x$heightPx wide=$isWideLayout")
            val shown = Appodeal.show(activity, Appodeal.BANNER_VIEW)
            Log.i(TAG, "show returned=$shown isLoaded=${Appodeal.isLoaded(Appodeal.BANNER)}")
            if (Appodeal.isLoaded(Appodeal.BANNER)) {
                onLoaded(sizeWidthDp, sizeHeightDp)
            }
        }
    }

    private fun scheduleLoadWatch() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                if (destroyed) return
                if (Appodeal.isLoaded(Appodeal.BANNER)) {
                    attempt = 0
                    Log.i(TAG, "loaded (isLoaded=true)")
                    onLoaded(sizeWidthDp, sizeHeightDp)
                    return
                }
                if (attempt < MAX_LOAD_WATCH_ATTEMPTS) {
                    attempt += 1
                    handler.postDelayed(this, LOAD_WATCH_INTERVAL_MS)
                } else {
                    Log.w(TAG, "giving up after waiting for banner load (slot collapsed)")
                    onFailed()
                }
            }
        }, LOAD_WATCH_INTERVAL_MS)
    }

    fun destroy() {
        destroyed = true
        handler.removeCallbacksAndMessages(null)
        readyListener?.let { AppodealInitializer.removeReadyListener(it) }
        readyListener = null
        try {
            if (showRequested) {
                Appodeal.hide(activity, Appodeal.BANNER)
            }
        } catch (e: Throwable) {
            Log.w(TAG, "banner hide failed", e)
        }
        host.removeAllViews()
        bannerView = null
        Log.i(TAG, "destroyed")
    }

    companion object {
        private const val MAX_LOAD_WATCH_ATTEMPTS = 40
        private const val LOAD_WATCH_INTERVAL_MS = 500L
    }
}

private fun Context.findActivity(): Activity? {
    var ctx = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private const val TAG = "BANNER"
