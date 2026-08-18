package com.salino.sali.ui.components

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.salino.sali.util.UnityAdsConfig
import com.unity3d.ads.BannerAd
import com.unity3d.ads.BannerConfiguration
import com.unity3d.ads.BannerShowListener
import com.unity3d.ads.BannerSize
import com.unity3d.ads.LoadListener
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsError

/**
 * Bottom Unity banner. By default takes no layout space until an ad actually loads,
 * and collapses again if load/show fails — so empty slots never cut into the UI.
 *
 * @param collapseWhenFailed When true (default), hide the slot until load succeeds.
 * @param onAdVisible Called when visible slot height changes (after load success / failure).
 */
@Composable
fun BottomBannerAd(
    modifier: Modifier = Modifier,
    collapseWhenFailed: Boolean = true,
    onAdVisible: ((Boolean) -> Unit)? = null,
) {
    var adLoaded by remember { mutableStateOf(false) }
    var loadFailed by remember { mutableStateOf(false) }
    val showSlot = !collapseWhenFailed || adLoaded

    LaunchedEffect(showSlot) {
        onAdVisible?.invoke(showSlot)
    }

    DisposableEffect(Unit) {
        Log.i(TAG_HOST, "component mount collapseWhenFailed=$collapseWhenFailed")
        onDispose {
            Log.i(TAG_HOST, "component unmount")
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
            .height(
                if (showSlot) UnityAdsConfig.BANNER_HEIGHT_DP.dp else 0.dp,
            ),
        factory = { ctx ->
            FrameLayout(ctx).apply {
                clipChildren = false
                clipToPadding = false
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                Log.i(TAG_HOST, "banner native view creation")
                tag = BannerHostController(
                    host = this,
                    onLoaded = { adLoaded = true; loadFailed = false },
                    onFailed = { adLoaded = false; loadFailed = true },
                ).also { it.start() }
            }
        },
        onRelease = { view ->
            (view.tag as? BannerHostController)?.destroy()
        },
    )
}

private class BannerHostController(
    private val host: FrameLayout,
    private val onLoaded: () -> Unit,
    private val onFailed: () -> Unit,
) {
    private var bannerAd: BannerAd? = null
    private var destroyed = false
    private var attempt = 0
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    fun start() {
        attemptLoad()
    }

    fun destroy() {
        destroyed = true
        handler.removeCallbacksAndMessages(null)
        host.removeAllViews()
        bannerAd = null
    }

    private fun attemptLoad() {
        if (destroyed) return
        if (!UnityAds.isInitialized) {
            if (attempt < MAX_INIT_WAIT_ATTEMPTS) {
                attempt += 1
                Log.w(TAG, "banner load waiting for initialization retry=$attempt")
                handler.postDelayed({ attemptLoad() }, RETRY_DELAY_MS)
            } else {
                Log.w(TAG, "Unity Ads not initialized; giving up banner load")
                onFailed()
            }
            return
        }

        val activity = host.context.findActivity()
        if (activity == null) {
            Log.e(TAG, "No Activity for Unity banner")
            onFailed()
            return
        }

        val showListener = object : BannerShowListener {
            override fun onImpression(ad: BannerAd) {
                Log.i(TAG, "banner impression placement=${UnityAdsConfig.BANNER_PLACEMENT_ID}")
            }
            override fun onClicked(ad: BannerAd) {
                Log.i(TAG, "banner click placement=${UnityAdsConfig.BANNER_PLACEMENT_ID}")
            }
            override fun onFailedToShow(ad: BannerAd, error: UnityAdsError) {
                Log.e(TAG, "Banner failed to show: ${error.code} ${error.message}")
                if (!destroyed) onFailed()
            }
        }

        val config = BannerConfiguration.Builder(
            UnityAdsConfig.BANNER_PLACEMENT_ID,
            BannerSize(320, 50),
            showListener,
        ).build()

        Log.i(TAG, "Loading Unity banner placement=${UnityAdsConfig.BANNER_PLACEMENT_ID}")
        BannerAd.load(
            config,
            object : LoadListener<BannerAd> {
                override fun onAdLoaded(ad: BannerAd?, error: UnityAdsError?) {
                    if (destroyed) return
                    host.post {
                        if (destroyed) return@post
                        if (ad == null || error != null) {
                            Log.e(TAG, "Banner load failed: ${error?.code} ${error?.message}")
                            scheduleRetryOrFail()
                            return@post
                        }
                        val adView = ad.view
                        if (adView == null) {
                            Log.e(TAG, "Banner loaded without a view")
                            scheduleRetryOrFail()
                            return@post
                        }
                        bannerAd = ad
                        host.removeAllViews()
                        (adView.parent as? ViewGroup)?.removeView(adView)
                        host.addView(
                            adView,
                            FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT,
                            ),
                        )
                        Log.i(
                            TAG,
                            "banner view attached to UI host=${host.width}x${host.height} " +
                                "adView=${adView.width}x${adView.height}",
                        )
                        onLoaded()
                    }
                }
            },
        )
    }

    private fun scheduleRetryOrFail() {
        if (destroyed) return
        if (attempt < MAX_LOAD_ATTEMPTS) {
            attempt += 1
            handler.postDelayed({ attemptLoad() }, RETRY_DELAY_MS * attempt)
        } else {
            onFailed()
        }
    }

    companion object {
        private const val TAG = "HaserliUnityAds"
        private const val MAX_INIT_WAIT_ATTEMPTS = 40
        private const val MAX_LOAD_ATTEMPTS = 3
        private const val RETRY_DELAY_MS = 2_000L
    }
}

private const val TAG_HOST = "HaserliUnityAds"

private fun Context.findActivity(): Activity? {
    var current: Context? = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return current as? Activity
}
