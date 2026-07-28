import ExpoModulesCore
import UnityAds

private final class UnityAdsInitDelegate: NSObject, UnityAdsInitializationDelegate {
  private let gameId: String
  private let promise: Promise
  private let onFinished: (UnityAdsInitDelegate) -> Void

  init(
    gameId: String,
    promise: Promise,
    onFinished: @escaping (UnityAdsInitDelegate) -> Void
  ) {
    self.gameId = gameId
    self.promise = promise
    self.onFinished = onFinished
  }

  func initializationComplete() {
    UnityAdsModule.markInitialized(gameId: gameId)
    promise.resolve(true)
    onFinished(self)
  }

  func initializationFailed(
    _ error: UnityAdsInitializationError,
    withMessage message: String
  ) {
    UnityAdsModule.markInitializationFailed()
    promise.reject(
      "ERR_UNITY_ADS_INIT",
      "Unity Ads failed to initialize: \(message)",
      nil
    )
    onFinished(self)
  }
}

public class UnityAdsModule: Module {
  // Retain init delegates until the callback fires.
  private static var pendingInitDelegates = [UnityAdsInitDelegate]()
  private static var initializedGameId: String?
  private static var isInitialized = false

  static func markInitialized(gameId: String) {
    initializedGameId = gameId
    isInitialized = true
  }

  static func markInitializationFailed() {
    isInitialized = false
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoUnityAds")

    AsyncFunction("initialize") { (gameId: String, testMode: Bool, promise: Promise) in
      if Self.isInitialized, Self.initializedGameId == gameId {
        promise.resolve(true)
        return
      }

      let delegate = UnityAdsInitDelegate(gameId: gameId, promise: promise) { finished in
        Self.pendingInitDelegates.removeAll { $0 === finished }
      }
      Self.pendingInitDelegates.append(delegate)

      UnityAds.initialize(
        gameId,
        testMode: testMode,
        initializationDelegate: delegate
      )
    }
    .runOnQueue(.main)

    View(UnityAdsView.self) {
      Events("onAdLoaded", "onAdFailedToLoad")

      Prop("placementId") { (view: UnityAdsView, placementId: String?) in
        view.setPlacementId(placementId)
      }
    }
  }
}
