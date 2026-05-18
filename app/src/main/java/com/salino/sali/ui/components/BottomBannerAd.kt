package com.salino.sali.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.salino.sali.BuildConfig
import com.salino.sali.util.AdMobConfig

@Composable
fun BottomBannerAd(modifier: Modifier = Modifier) {
    val unitId = remember {
        if (BuildConfig.DEBUG) AdMobConfig.TEST_BANNER_AD_UNIT_ID else AdMobConfig.BANNER_AD_UNIT_ID
    }

    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            .height(AdMobConfig.BANNER_HEIGHT_DP.dp),
        factory = { ctx ->
            AdView(ctx).apply {
                setAdSize(AdSize.BANNER)
                adUnitId = unitId
                loadAd(AdRequest.Builder().build())
            }
        },
    )
}
