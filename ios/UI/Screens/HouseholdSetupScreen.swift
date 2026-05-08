import SwiftUI

struct HouseholdSetupScreen: View {
    @StateObject private var viewModel: HouseholdSetupViewModel
    @State private var mode = 0
    @State private var householdName = ""
    @State private var inviteCode = ""
    let onComplete: () -> Void

    init(container: AppContainer, onComplete: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: HouseholdSetupViewModel(householdRepository: container.householdRepository))
        self.onComplete = onComplete
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                BrandHeader(subtitleKey: "household_setup_subtitle")
                    .padding(.top, 36)

                SurfaceCard {
                    Picker("", selection: $mode) {
                        Text(LocalizedStringKey("household_create")).tag(0)
                        Text(LocalizedStringKey("household_join")).tag(1)
                    }
                    .pickerStyle(.segmented)

                    if mode == 0 {
                        TextField(LocalizedStringKey("household_name_hint"), text: $householdName)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                        Text(LocalizedStringKey("household_create_hint"))
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                        PrimaryButton(titleKey: "household_create_button", systemImage: "house.fill", isLoading: viewModel.state.isLoading) {
                            viewModel.createHousehold(name: householdName)
                        }
                    } else {
                        TextField(LocalizedStringKey("household_invite_code_hint"), text: $inviteCode)
                            .textInputAutocapitalization(.characters)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                        Text(LocalizedStringKey("household_join_hint"))
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                        PrimaryButton(titleKey: "household_join_button", systemImage: "person.2.fill", isLoading: viewModel.state.isLoading) {
                            viewModel.joinHousehold(inviteCode: inviteCode)
                        }
                    }

                    if let error = viewModel.state.errorMessage {
                        Text(errorText(error))
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .salinoBackground()
        .alert(LocalizedStringKey("household_invite_code_title"), isPresented: Binding(
            get: { viewModel.state.inviteCode != nil },
            set: { if !$0 { onComplete() } }
        )) {
            Button(LocalizedStringKey("ok")) { onComplete() }
        } message: {
            Text(viewModel.state.inviteCode ?? "")
        }
        .onChange(of: viewModel.state.isComplete) { _, complete in
            if complete, viewModel.state.inviteCode == nil {
                onComplete()
            }
        }
    }

    private func errorText(_ code: String) -> String {
        switch code {
        case "empty_name": localized("household_error_empty_name")
        case "empty_code": localized("household_error_empty_code")
        case "invalid_code": localized("household_error_invalid_code")
        default: localized("household_error_generic")
        }
    }
}
