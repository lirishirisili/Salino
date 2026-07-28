package com.salino.sali.ui.components

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
import com.salino.sali.BuildConfig
import com.salino.sali.util.UnityAdsConfig
import com.unity3d.services.banners.BannerErrorInfo
import com.unity3d.services.banners.BannerView
import com.unity3d.services.banners.UnityBannerSize

/**
 * @param collapseWhenFailed When true, reserved height is removed if the ad fails to load
 *   (e.g. ad blocker). Other screens keep a fixed slot so layout stays stable when ads load slowly.
 * @param onAdVisible Called when visible slot height changes (after load success / failure).
 */
@Composable
fun BottomBannerAd(
    modifier: Modifier = Modifier,
    collapseWhenFailed: Boolean = false,
    onAdVisible: ((Boolean) -> Unit)? = null,
) {
    var adLoaded by remember { mutableStateOf(false) }
    val showSlot = !collapseWhenFailed || adLoaded

    LaunchedEffect(showSlot) {
        onAdVisible?.invoke(showSlot)
    }

    DisposableEffect(Unit) {
        onDispose {
            onAdVisible?.invoke(false)
        }
    }

    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            .height(
                if (showSlot) UnityAdsConfig.BANNER_HEIGHT_DP.dp else 0.dp,
            ),
        factory = { ctx ->
            BannerView(
                ctx,
                UnityAdsConfig.BANNER_PLACEMENT_ID,
                UnityBannerSize(320, 50),
            ).apply {
                listener = object : BannerView.IListener {
                    override fun onBannerLoaded(bannerAdView: BannerView) {
                        adLoaded = true
                    }

                    override fun onBannerFailedToLoad(
                        bannerAdView: BannerView,
                        errorInfo: BannerErrorInfo,
                    ) {
                        adLoaded = false
                    }

                    override fun onBannerClick(bannerAdView: BannerView) = Unit

                    override fun onBannerShown(bannerAdView: BannerView) = Unit

                    override fun onBannerLeftApplication(bannerAdView: BannerView) = Unit
                }
                load()
            }
        },
    )
}
