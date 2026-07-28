import ExpoModulesCore
import UnityAds

public class UnityAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UnityAds")

    AsyncFunction("initialize") { (gameId: String, testMode: Bool, promise: Promise) in
      if Self.isInitialized, Self.initializedGameId == gameId {
        promise.resolve(true)
        return
      }

      let config = UADSInitializationConfigurationBuilder(gameId: gameId)
        .with(testMode: testMode)
        .build()

      UnityAds.initialize(config) { error in
        if let error {
          Self.isInitialized = false
          promise.reject("ERR_UNITY_ADS_INIT", error.localizedDescription, error)
          return
        }

        Self.initializedGameId = gameId
        Self.isInitialized = true
        promise.resolve(true)
      }
    }
    .runOnQueue(.main)

    View(UnityAdsView.self) {
      Events("onAdLoaded", "onAdFailedToLoad")

      Prop("placementId") { (view: UnityAdsView, placementId: String?) in
        view.setPlacementId(placementId)
      }
    }
  }

  private static var initializedGameId: String?
  private static var isInitialized = false
}
