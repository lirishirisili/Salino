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
        Log.i(
          TAG,
          "initialize skipped (already initialized) gameId=$gameId " +
            "unityIsInitialized=${UnityAds.isInitialized} testModeWas=$lastTestMode",
        )
        promise.resolve(true)
        return@AsyncFunction
      }

      val reactContext = requireNotNull(appContext.reactContext)
      val debuggable =
        (reactContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
      // Debug APKs embed a production JS bundle (__DEV__=false). Always enable Unity
      // test mode when the Android package is debuggable so banners actually fill.
      val effectiveTestMode = testMode || debuggable
      lastTestMode = effectiveTestMode

      Log.i(
        TAG,
        "initialization starting gameId=$gameId testMode=$effectiveTestMode " +
          "(jsTestMode=$testMode debuggable=$debuggable alreadyInitialized=${UnityAds.isInitialized})",
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
            Log.i(
              TAG,
              "initialization success gameId=$gameId testMode=$effectiveTestMode " +
                "unityIsInitialized=${UnityAds.isInitialized}",
            )
            promise.resolve(true)
          }

          override fun onInitializationFailed(
            error: UnityAds.UnityAdsInitializationError,
            message: String,
          ) {
            isInitialized = false
            Log.e(
              TAG,
              "initialization failure gameId=$gameId testMode=$effectiveTestMode " +
                "error=$error message=$message unityIsInitialized=${UnityAds.isInitialized}",
            )
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

      OnViewDestroys { view: UnityAdsView ->
        Log.i(TAG, "component unmount (native OnViewDestroys)")
        view.destroyBanner("OnViewDestroys")
      }
    }
  }

  companion object {
    private const val TAG = "HaserliUnityAds"
    private var initializedGameId: String? = null
    private var isInitialized = false
    private var lastTestMode: Boolean? = null
  }
}
