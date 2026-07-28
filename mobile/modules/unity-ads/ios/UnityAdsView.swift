import ExpoModulesCore
import UIKit
import UnityAds

class UnityAdsView: ExpoView, UADSBannerViewDelegate {
  let onAdLoaded = EventDispatcher()
  let onAdFailedToLoad = EventDispatcher()

  private var placementId: String?
  private var bannerView: UADSBannerView?

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
    bannerView?.frame = bounds
  }

  func bannerViewDidLoad(_ bannerView: UADSBannerView!) {
    onAdLoaded([
      "placementId": placementId ?? ""
    ])
  }

  func bannerViewDidClick(_ bannerView: UADSBannerView!) {}

  func bannerViewDidLeaveApplication(_ bannerView: UADSBannerView!) {}

  func bannerViewDidError(_ bannerView: UADSBannerView!, error: UADSBannerError!) {
    let message: String
    if let error {
      message = error.localizedDescription
    } else {
      message = "Unknown Unity banner error"
    }
    onAdFailedToLoad([
      "placementId": placementId ?? "",
      "message": message
    ])
  }

  private func loadBanner() {
    clearBanner()
    guard let placementId, !placementId.isEmpty else {
      return
    }

    let banner = UADSBannerView(
      placementId: placementId,
      size: CGSize(width: 320, height: 50)
    )
    banner.delegate = self
    banner.frame = bounds
    banner.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(banner)
    bannerView = banner
    banner.load()
  }

  private func clearBanner() {
    bannerView?.delegate = nil
    bannerView?.removeFromSuperview()
    bannerView = nil
  }

  deinit {
    clearBanner()
  }
}
