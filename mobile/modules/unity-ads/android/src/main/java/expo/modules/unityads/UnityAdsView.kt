package expo.modules.unityads

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import com.unity3d.ads.BannerAd
import com.unity3d.ads.BannerConfiguration
import com.unity3d.ads.BannerShowListener
import com.unity3d.ads.BannerSize
import com.unity3d.ads.LoadListener
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsError

class UnityAdsView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onAdLoaded by EventDispatcher()
  private val onAdFailedToLoad by EventDispatcher()
  private var placementId: String? = null
  private var bannerAd: BannerAd? = null
  private var bannerChild: View? = null
  private var initRetryCount = 0
  private var loadGeneration = 0

  init {
    clipToPadding = true
  }

  fun setPlacementId(nextPlacementId: String?) {
    if (placementId == nextPlacementId) {
      return
    }
    placementId = nextPlacementId
    initRetryCount = 0
    loadBanner()
  }

  private fun resolveActivity(): Activity? {
    appContext.currentActivity?.let { return it }
    var current: Context? = context
    while (current is ContextWrapper) {
      if (current is Activity) {
        return current
      }
      current = current.baseContext
    }
    return current as? Activity
  }

  private fun loadBanner() {
    clearBanner()
    val currentPlacementId = placementId?.takeIf { it.isNotBlank() } ?: return
    val activity = resolveActivity()
    if (activity == null) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount += 1
        postDelayed({ loadBanner() }, RETRY_DELAY_MS)
        return
      }
      Log.e(TAG, "Unity banner requires an Activity context")
      emitFailed(
        currentPlacementId,
        "NO_ACTIVITY",
        "Unity Ads requires an Activity context to load ads.",
      )
      return
    }

    if (!UnityAds.isInitialized) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount += 1
        Log.w(TAG, "Unity Ads not initialized yet; retry $initRetryCount")
        postDelayed({ loadBanner() }, RETRY_DELAY_MS)
        return
      }
      emitFailed(
        currentPlacementId,
        "NOT_INITIALIZED",
        "Unity Ads SDK did not initialize in time.",
      )
      return
    }

    initRetryCount = 0
    val generation = loadGeneration
    Log.i(TAG, "Loading banner placement=$currentPlacementId gen=$generation")

    val showListener = object : BannerShowListener {
      override fun onImpression(ad: BannerAd) {
        Log.d(TAG, "Banner impression: $currentPlacementId")
      }

      override fun onClicked(ad: BannerAd) = Unit

      override fun onFailedToShow(ad: BannerAd, error: UnityAdsError) {
        Log.e(TAG, "Banner failed to show: ${error.code} ${error.message}")
        if (generation != loadGeneration) return
        emitFailed(currentPlacementId, error.code.toString(), error.message)
      }
    }

    val config = BannerConfiguration.Builder(
      currentPlacementId,
      BannerSize(320, 50),
      showListener,
    ).build()

    BannerAd.load(
      config,
      object : LoadListener<BannerAd> {
        override fun onAdLoaded(ad: BannerAd?, error: UnityAdsError?) {
          if (generation != loadGeneration) {
            return
          }
          if (ad == null || error != null) {
            val message = error?.message ?: "Unknown banner load error"
            val code = error?.code?.toString() ?: "LOAD_FAILED"
            Log.e(TAG, "Banner failed to load: [$code] $message")
            emitFailed(currentPlacementId, code, message)
            return
          }

          val adView = ad.view
          if (adView == null) {
            Log.e(TAG, "Banner loaded but view is null")
            emitFailed(currentPlacementId, "NULL_VIEW", "Banner loaded without a view")
            return
          }

          Log.i(TAG, "Banner loaded: $currentPlacementId")
          bannerAd = ad
          bannerChild = adView
          (adView.parent as? ViewGroup)?.removeView(adView)
          addView(
            adView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
          )
          onAdLoaded(mapOf("placementId" to currentPlacementId))
        }
      },
    )
  }

  private fun emitFailed(placementId: String, code: String, message: String) {
    onAdFailedToLoad(
      mapOf(
        "placementId" to placementId,
        "message" to message,
        "code" to code,
      ),
    )
  }

  private fun clearBanner() {
    loadGeneration += 1
    bannerChild?.let { child ->
      removeView(child)
    }
    bannerChild = null
    bannerAd = null
  }

  override fun onDetachedFromWindow() {
    clearBanner()
    super.onDetachedFromWindow()
  }

  companion object {
    private const val TAG = "UnityAdsBanner"
    private const val MAX_INIT_RETRIES = 40
    private const val RETRY_DELAY_MS = 250L
  }
}
