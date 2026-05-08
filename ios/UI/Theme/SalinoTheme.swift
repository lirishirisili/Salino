import SwiftUI

enum SalinoColors {
    static let primary = Color(red: 0.05, green: 0.58, blue: 0.53)
    static let primarySoft = Color(red: 0.80, green: 0.98, blue: 0.94)
    static let tertiary = Color(red: 1.0, green: 0.54, blue: 0.36)
    static let background = Color(red: 0.96, green: 0.98, blue: 0.97)
    static let surface = Color.white
    static let text = Color(red: 0.09, green: 0.12, blue: 0.11)
    static let secondaryText = Color(red: 0.29, green: 0.36, blue: 0.34)
    static let border = Color(red: 0.80, green: 0.86, blue: 0.84)
}

struct SalinoBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(
                    colors: [SalinoColors.background, Color(red: 1.0, green: 0.96, blue: 0.92)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
    }
}

extension View {
    func salinoBackground() -> some View {
        modifier(SalinoBackground())
    }
}
