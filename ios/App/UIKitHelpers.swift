import UIKit

extension UIApplication {
    var topMostViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController?
            .topMostPresented
    }
}

private extension UIViewController {
    var topMostPresented: UIViewController {
        if let presentedViewController {
            return presentedViewController.topMostPresented
        }
        if let navigationController = self as? UINavigationController {
            return navigationController.visibleViewController?.topMostPresented ?? navigationController
        }
        if let tabBarController = self as? UITabBarController {
            return tabBarController.selectedViewController?.topMostPresented ?? tabBarController
        }
        return self
    }
}
