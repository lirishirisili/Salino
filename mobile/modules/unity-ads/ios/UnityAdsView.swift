import ExpoModulesCore
import UIKit
import UnityAds

private final class BannerShowDelegate: NSObject, UADSBannerAdDelegate {
  var onFailed: ((String) -> Void)?

  func bannerImpression(_ banner: UADSBannerAd) {}

  func bannerDidClick(_ banner: UADSBannerAd) {}

  func bannerDidFailShow(_ banner: UADSBannerAd, error: any UnityAdsError) {
    onFailed?(error.message ?? "Unity banner failed to show")
  }
}

class UnityAdsView: ExpoView {
  let onAdLoaded = EventDispatcher()
  let onAdFailedToLoad = EventDispatcher()

  private var placementId: String?
  private var bannerAd: UADSBannerAd?
  private var bannerChild: UIView?
  private let showDelegate = BannerShowDelegate()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    showDelegate.onFailed = { [weak self] message in
      guard let self else { return }
      self.onAdFailedToLoad([
        "placementId": self.placementId ?? "",
        "message": message
      ])
    }
  }

  func setPlacementId(_ nextPlacementId: String?) {
    if placementId == nextPlacementId {
      return
    }
    placementId = nextPlacementId
    loadBanner()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    bannerChild?.frame = bounds
  }

  private func loadBanner() {
    clearBanner()
    guard let placementId, !placementId.isEmpty else {
      return
    }

    let config = UADSBannerLoadConfigurationBuilder(
      placementId: placementId,
      bannerSize: CGSize(width: 320, height: 50),
      delegate: showDelegate
    ).build()

    UADSBannerAd.load(config) { [weak self] ad, error in
      guard let self else { return }

      if let error {
        self.onAdFailedToLoad([
          "placementId": placementId,
          "message": error.message ?? "Unknown Unity banner load error"
        ])
        return
      }

      guard let ad else {
        self.onAdFailedToLoad([
          "placementId": placementId,
          "message": "Unity Ads returned no banner ad"
        ])
        return
      }

      let adView = ad.view
      adView.frame = self.bounds
      adView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      self.addSubview(adView)
      self.bannerChild = adView
      self.bannerAd = ad
      self.onAdLoaded([
        "placementId": placementId
      ])
    }
  }

  private func clearBanner() {
    bannerChild?.removeFromSuperview()
    bannerChild = nil
    bannerAd = nil
  }

  deinit {
    clearBanner()
  }
}
