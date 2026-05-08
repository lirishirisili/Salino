import SwiftUI
import UIKit

struct AuthScreen: View {
    @StateObject private var viewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var registerMode = false
    let onAuthSuccess: (Bool) -> Void

    init(container: AppContainer, onAuthSuccess: @escaping (Bool) -> Void) {
        _viewModel = StateObject(wrappedValue: AuthViewModel(authRepository: container.authRepository))
        self.onAuthSuccess = onAuthSuccess
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                BrandHeader(subtitleKey: "auth_welcome_subtitle")
                    .padding(.top, 48)

                if let error = viewModel.state.errorMessage {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                SurfaceCard {
                    Button {
                        if let presenter = UIApplication.shared.topMostViewController {
                            viewModel.signInWithGoogle(presenting: presenter)
                        }
                    } label: {
                        HStack {
                            Image(systemName: "g.circle.fill")
                            Text(LocalizedStringKey("auth_sign_in_google"))
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(SalinoColors.text)
                    .background(Color.white, in: Capsule())
                    .overlay(Capsule().stroke(SalinoColors.border, lineWidth: 1))

                    Text(LocalizedStringKey("auth_or"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SalinoColors.secondaryText)
                        .frame(maxWidth: .infinity)

                    TextField(LocalizedStringKey("auth_email_hint"), text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                    SecureField(LocalizedStringKey("auth_password_hint"), text: $password)
                        .textContentType(registerMode ? .newPassword : .password)
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                    PrimaryButton(
                        titleKey: registerMode ? "auth_register_email" : "auth_sign_in_email",
                        systemImage: "envelope.fill",
                        isLoading: viewModel.state.isLoading
                    ) {
                        viewModel.signInWithEmail(email: email, password: password, register: registerMode)
                    }
                    .disabled(email.isEmpty || password.count < 6 || viewModel.state.isLoading)

                    Button(registerMode ? localized("auth_has_account_sign_in") : localized("auth_no_account_register")) {
                        registerMode.toggle()
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(SalinoColors.primary)
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(20)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .salinoBackground()
        .onChange(of: viewModel.state.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                onAuthSuccess(viewModel.state.hasHousehold)
            }
        }
    }
}
