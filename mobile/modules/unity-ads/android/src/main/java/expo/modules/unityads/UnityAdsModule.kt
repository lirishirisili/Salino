package expo.modules.unityads

import android.content.pm.ApplicationInfo
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.unity3d.ads.IUnityAdsInitializationListener
import com.unity3d.ads.UnityAds

class UnityAdsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoUnityAds")

    AsyncFunction("initialize") { gameId: String, testMode: Boolean, promise: Promise ->
      if (isInitialized && initializedGameId == gameId) {
        promise.resolve(true)
        return@AsyncFunction
      }

      val reactContext = requireNotNull(appContext.reactContext)
      val debuggable =
        (reactContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
      // Debug APKs embed a production JS bundle (__DEV__=false). Always enable Unity
      // test mode when the Android package is debuggable so banners actually fill.
      val effectiveTestMode = testMode || debuggable

      Log.i(
        TAG,
        "Initializing Unity Ads gameId=$gameId testMode=$effectiveTestMode (js=$testMode debuggable=$debuggable)",
      )
      UnityAds.debugMode = debuggable

      UnityAds.initialize(
        reactContext.applicationContext,
        gameId,
        effectiveTestMode,
        object : IUnityAdsInitializationListener {
          override fun onInitializationComplete() {
            initializedGameId = gameId
            isInitialized = true
            Log.i(TAG, "Unity Ads initialized (testMode=$effectiveTestMode)")
            promise.resolve(true)
          }

          override fun onInitializationFailed(
            error: UnityAds.UnityAdsInitializationError,
            message: String,
          ) {
            isInitialized = false
            Log.e(TAG, "Unity Ads init failed: $error - $message")
            promise.reject(
              "ERR_UNITY_ADS_INIT",
              "Unity Ads failed to initialize: $error - $message",
              null,
            )
          }
        },
      )
    }.runOnQueue(Queues.MAIN)

    View(UnityAdsView::class) {
      Events("onAdLoaded", "onAdFailedToLoad")

      Prop("placementId") { view: UnityAdsView, placementId: String? ->
        view.setPlacementId(placementId)
      }
    }
  }

  companion object {
    private const val TAG = "UnityAdsModule"
    private var initializedGameId: String? = null
    private var isInitialized = false
  }
}
