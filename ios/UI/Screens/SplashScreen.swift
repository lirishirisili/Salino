import SwiftUI
import Combine

struct SplashScreen: View {
    @StateObject private var viewModel: SplashViewModel
    let onDestination: (SplashDestination) -> Void

    init(container: AppContainer, onDestination: @escaping (SplashDestination) -> Void) {
        _viewModel = StateObject(wrappedValue: SplashViewModel(authRepository: container.authRepository))
        self.onDestination = onDestination
    }

    var body: some View {
        VStack(spacing: 24) {
            BrandHeader(subtitleKey: "brand_tagline")
            ProgressView()
                .tint(SalinoColors.primary)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .salinoBackground()
        .onReceive(viewModel.$destination.compactMap { $0 }) { destination in
            onDestination(destination)
        }
    }
}
