import SwiftUI

struct SettingsScreen: View {
    @StateObject private var viewModel: SettingsViewModel
    @State private var editedName = ""
    let onExit: (SettingsExitEvent) -> Void

    init(container: AppContainer, onExit: @escaping (SettingsExitEvent) -> Void) {
        _viewModel = StateObject(wrappedValue: SettingsViewModel(container: container))
        self.onExit = onExit
    }

    var body: some View {
        List {
            if let user = viewModel.state.user {
                Section(LocalizedStringKey("settings_account_section")) {
                    VStack(alignment: .leading) {
                        Text(user.displayName.isEmpty ? user.email : user.displayName)
                            .font(.headline)
                        Text(user.email)
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                    }
                    Button(role: .destructive, action: viewModel.signOut) {
                        Label(LocalizedStringKey("settings_sign_out"), systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }

            Section(LocalizedStringKey("settings_household_section")) {
                if let household = viewModel.state.household {
                    HStack {
                        Text(LocalizedStringKey("settings_household_name"))
                        Spacer()
                        Text(household.name).foregroundStyle(SalinoColors.secondaryText)
                    }
                    HStack {
                        Text(LocalizedStringKey("settings_invite_code"))
                        Spacer()
                        Text(viewModel.state.inviteCode).textSelection(.enabled)
                    }
                    Button(LocalizedStringKey("settings_edit_household_name")) {
                        editedName = household.name
                        viewModel.state.showEditNameDialog = true
                    }
                    Button(role: .destructive) {
                        viewModel.state.showLeaveDialog = true
                    } label: {
                        Text(LocalizedStringKey("settings_leave_household"))
                    }
                }
            }

            Section(LocalizedStringKey("settings_members")) {
                ForEach(viewModel.state.members) { member in
                    HStack {
                        Text(member.displayName.isEmpty ? member.userId : member.displayName)
                        Spacer()
                        Text(member.role.rawValue)
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                    }
                }
            }

            Section(LocalizedStringKey("settings_language")) {
                Text(LocalizedStringKey("settings_language_system"))
                HStack {
                    Text(LocalizedStringKey("language_he"))
                    Text("-")
                    Text(LocalizedStringKey("language_ar"))
                    Text("-")
                    Text(LocalizedStringKey("language_ru"))
                }
                .font(.caption)
                .foregroundStyle(SalinoColors.secondaryText)
            }
        }
        .scrollContentBackground(.hidden)
        .salinoBackground()
        .navigationTitle(LocalizedStringKey("settings_title"))
        .alert(LocalizedStringKey("settings_edit_household_name"), isPresented: Binding(
            get: { viewModel.state.showEditNameDialog },
            set: { viewModel.state.showEditNameDialog = $0 }
        )) {
            TextField(LocalizedStringKey("settings_household_name"), text: $editedName)
            Button(LocalizedStringKey("item_save")) { viewModel.updateHouseholdName(editedName) }
            Button(LocalizedStringKey("cancel"), role: .cancel) {}
        }
        .alert(LocalizedStringKey("settings_leave_household"), isPresented: Binding(
            get: { viewModel.state.showLeaveDialog },
            set: { viewModel.state.showLeaveDialog = $0 }
        )) {
            Button(LocalizedStringKey("settings_leave_household"), role: .destructive) { viewModel.leaveHousehold() }
            Button(LocalizedStringKey("cancel"), role: .cancel) {}
        } message: {
            Text(LocalizedStringKey("settings_leave_household_confirm"))
        }
        .onChange(of: viewModel.state.isSignedOut) { _, signedOut in
            if signedOut { onExit(.signedOut) }
        }
        .onChange(of: viewModel.state.hasLeftHousehold) { _, left in
            if left { onExit(.leftHousehold) }
        }
    }
}
