import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct SalinoApp: App {
    @StateObject private var container: AppContainer

    init() {
        FirebaseBootstrap.configureIfPossible()
        _container = StateObject(wrappedValue: AppContainer.bootstrap())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(container)
                .modelContainer(container.localStore.container)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}

enum FirebaseBootstrap {
    static func configureIfPossible() {
        guard FirebaseApp.app() == nil else { return }
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            return
        }
        FirebaseApp.configure()
    }
}
