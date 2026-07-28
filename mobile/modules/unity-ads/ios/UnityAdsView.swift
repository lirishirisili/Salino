import ExpoModulesCore
import UIKit
import UnityAds

class UnityAdsView: ExpoView, UADSBannerAdDelegate {
  let onAdLoaded = EventDispatcher()
  let onAdFailedToLoad = EventDispatcher()

  private var placementId: String?
  private var bannerAd: UADSBannerAd?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
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
    bannerAd?.view.frame = bounds
  }

  func bannerImpression(_ banner: UADSBannerAd) {}

  func bannerDidClick(_ banner: UADSBannerAd) {}

  func bannerDidFailShow(_ banner: UADSBannerAd, error: any UnityAdsError) {
    onAdFailedToLoad([
      "placementId": placementId ?? "",
      "message": error.localizedDescription
    ])
  }

  private func loadBanner() {
    clearBanner()
    guard let placementId, !placementId.isEmpty else {
      return
    }

    let config = UADSBannerLoadConfigurationBuilder(
      placementId: placementId,
      bannerSize: CGSize(width: 320, height: 50),
      delegate: self
    ).build()

    UADSBannerAd.load(config) { [weak self] ad, error in
      guard let self else {
        return
      }

      if let error {
        self.onAdFailedToLoad([
          "placementId": placementId,
          "message": error.localizedDescription
        ])
        return
      }

      guard let ad else {
        self.onAdFailedToLoad([
          "placementId": placementId,
          "message": "Unity Ads returned no banner ad."
        ])
        return
      }

      self.bannerAd = ad
      let bannerView = ad.view
      bannerView.frame = self.bounds
      bannerView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      self.addSubview(bannerView)
      self.onAdLoaded([
        "placementId": placementId
      ])
    }
  }

  private func clearBanner() {
    bannerAd?.view.removeFromSuperview()
    bannerAd = nil
  }

  deinit {
    clearBanner()
  }
}
