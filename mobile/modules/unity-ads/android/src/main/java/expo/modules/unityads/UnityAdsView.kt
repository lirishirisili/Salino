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
  private var attachedOnce = false

  init {
    clipToPadding = false
    clipChildren = false
    Log.i(
      TAG,
      "banner native view creation class=${this::class.java.simpleName} " +
        "context=${context.javaClass.simpleName}",
    )
  }

  fun setPlacementId(nextPlacementId: String?) {
    if (placementId == nextPlacementId) {
      Log.i(TAG, "setPlacementId unchanged placement=$nextPlacementId; skip reload")
      return
    }
    Log.i(TAG, "setPlacementId previous=$placementId next=$nextPlacementId")
    placementId = nextPlacementId
    initRetryCount = 0
    loadBanner()
  }

  fun destroyBanner(reason: String) {
    Log.i(
      TAG,
      "component unmount/destroy reason=$reason placement=$placementId " +
        "hasChild=${bannerChild != null} attached=$attachedOnce",
    )
    clearBanner()
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
    val currentPlacementId = placementId?.takeIf { it.isNotBlank() } ?: run {
      Log.w(TAG, "banner load skipped: blank placementId")
      return
    }
    val activity = resolveActivity()
    if (activity == null) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount += 1
        Log.w(TAG, "banner load waiting for Activity retry=$initRetryCount")
        postDelayed({ loadBanner() }, RETRY_DELAY_MS)
        return
      }
      Log.e(TAG, "banner load failure NO_ACTIVITY placement=$currentPlacementId")
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
        Log.w(
          TAG,
          "banner load waiting for initialization retry=$initRetryCount " +
            "placement=$currentPlacementId",
        )
        postDelayed({ loadBanner() }, RETRY_DELAY_MS)
        return
      }
      Log.e(TAG, "banner load failure NOT_INITIALIZED placement=$currentPlacementId")
      emitFailed(
        currentPlacementId,
        "NOT_INITIALIZED",
        "Unity Ads SDK did not initialize in time.",
      )
      return
    }

    initRetryCount = 0
    val generation = loadGeneration
    Log.i(
      TAG,
      "banner load starting placement=$currentPlacementId gen=$generation " +
        "size=320x50 activity=${activity.javaClass.simpleName} " +
        "host=${width}x${height} vis=$visibility windowToken=${windowToken != null}",
    )

    val showListener = object : BannerShowListener {
      override fun onImpression(ad: BannerAd) {
        logViewState("banner impression", ad)
      }

      override fun onClicked(ad: BannerAd) {
        logViewState("banner click", ad)
      }

      override fun onFailedToShow(ad: BannerAd, error: UnityAdsError) {
        Log.e(
          TAG,
          "banner failed to show placement=$currentPlacementId " +
            "code=${error.code} message=${error.message} error=$error",
        )
        if (generation != loadGeneration) return
        emitFailed(currentPlacementId, error.code.toString(), error.message ?: error.toString())
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
            Log.w(
              TAG,
              "banner load callback ignored stale gen=$generation current=$loadGeneration",
            )
            return
          }
          if (ad == null || error != null) {
            val message = error?.message ?: "Unknown banner load error"
            val code = error?.code?.toString() ?: "LOAD_FAILED"
            Log.e(
              TAG,
              "banner load failure placement=$currentPlacementId code=$code " +
                "message=$message error=$error adNull=${ad == null}",
            )
            emitFailed(currentPlacementId, code, message)
            return
          }

          val adView = ad.view
          if (adView == null) {
            Log.e(TAG, "banner load failure NULL_VIEW placement=$currentPlacementId")
            emitFailed(currentPlacementId, "NULL_VIEW", "Banner loaded without a view")
            return
          }

          Log.i(
            TAG,
            "banner load success placement=$currentPlacementId " +
              "adView=${adView.javaClass.name} adViewSize=${adView.width}x${adView.height} " +
              "hostBeforeAttach=${width}x${height}",
          )
          bannerAd = ad
          bannerChild = adView
          (adView.parent as? ViewGroup)?.removeView(adView)
          addView(
            adView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
          )
          adView.visibility = VISIBLE
          visibility = VISIBLE
          alpha = 1f
          Log.i(
            TAG,
            "banner view attached to UI placement=$currentPlacementId " +
              "childCount=$childCount host=${width}x${height} " +
              "adView=${adView.measuredWidth}x${adView.measuredHeight} " +
              "adViewVis=${adView.visibility} hostVis=$visibility",
          )
          post { logViewState("banner attached post-layout", ad) }
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

  private fun logViewState(event: String, ad: BannerAd? = bannerAd) {
    val child = bannerChild ?: ad?.view
    val loc = IntArray(2)
    getLocationOnScreen(loc)
    Log.i(
      TAG,
      "$event placement=$placementId host=${width}x${height} " +
        "hostMeasured=${measuredWidth}x${measuredHeight} screen=(${loc[0]},${loc[1]}) " +
        "vis=$visibility alpha=$alpha attached=$attachedOnce " +
        "child=${child?.width}x${child?.height} childVis=${child?.visibility} " +
        "childClass=${child?.javaClass?.name} windowToken=${windowToken != null}",
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachedOnce = true
    Log.i(TAG, "component mount (native attach) placement=$placementId")
    logViewState("native attachedToWindow")
  }

  override fun onDetachedFromWindow() {
    Log.i(
      TAG,
      "native detachedFromWindow placement=$placementId " +
        "(banner kept; destroy only on real unmount)",
    )
    super.onDetachedFromWindow()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    if (changed) {
      Log.i(
        TAG,
        "banner layout changed placement=$placementId " +
          "width=${right - left} height=${bottom - top} " +
          "child=${bannerChild?.width}x${bannerChild?.height}",
      )
    }
  }

  companion object {
    private const val TAG = "HaserliUnityAds"
    private const val MAX_INIT_RETRIES = 40
    private const val RETRY_DELAY_MS = 250L
  }
}
