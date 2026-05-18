package com.salino.sali.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import com.salino.sali.BuildConfig
import com.salino.sali.util.AdMobConfig

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
    val unitId = remember {
        if (BuildConfig.DEBUG) AdMobConfig.TEST_BANNER_AD_UNIT_ID else AdMobConfig.BANNER_AD_UNIT_ID
    }
    var adLoaded by remember { mutableStateOf(false) }

    val showSlot = !collapseWhenFailed || adLoaded

    LaunchedEffect(showSlot) {
        onAdVisible?.invoke(showSlot)
    }

    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            .height(
                if (showSlot) AdMobConfig.BANNER_HEIGHT_DP.dp else 0.dp,
            ),
        factory = { ctx ->
            AdView(ctx).apply {
                setAdSize(AdSize.BANNER)
                adUnitId = unitId
                adListener = object : AdListener() {
                    override fun onAdLoaded() {
                        adLoaded = true
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        adLoaded = false
                    }
                }
                loadAd(AdRequest.Builder().build())
            }
        },
    )
}
