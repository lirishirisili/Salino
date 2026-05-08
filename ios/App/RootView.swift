import SwiftUI

enum RootDestination {
    case splash
    case auth
    case householdSetup
    case shoppingList
}

enum AppRoute: Hashable {
    case addItem
    case editItem(String)
    case history
    case activityFeed
    case supermarketMode
    case settings
}

struct RootView: View {
    @EnvironmentObject private var container: AppContainer
    @State private var rootDestination: RootDestination = .splash
    @State private var path = NavigationPath()

    var body: some View {
        Group {
            switch rootDestination {
            case .splash:
                SplashScreen(container: container) { destination in
                    switch destination {
                    case .auth: rootDestination = .auth
                    case .householdSetup: rootDestination = .householdSetup
                    case .shoppingList: rootDestination = .shoppingList
                    }
                }
            case .auth:
                AuthScreen(container: container) { hasHousehold in
                    rootDestination = hasHousehold ? .shoppingList : .householdSetup
                }
            case .householdSetup:
                HouseholdSetupScreen(container: container) {
                    rootDestination = .shoppingList
                }
            case .shoppingList:
                NavigationStack(path: $path) {
                    ShoppingListScreen(
                        container: container,
                        onNavigateToAddItem: { path.append(AppRoute.addItem) },
                        onNavigateToEditItem: { path.append(AppRoute.editItem($0)) },
                        onNavigateToHistory: { path.append(AppRoute.history) },
                        onNavigateToActivityFeed: { path.append(AppRoute.activityFeed) },
                        onNavigateToSupermarketMode: { path.append(AppRoute.supermarketMode) },
                        onNavigateToSettings: { path.append(AppRoute.settings) }
                    )
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .addItem:
                            AddItemScreen(container: container) { path.removeLast() }
                        case .editItem(let itemId):
                            EditItemScreen(itemId: itemId, container: container) { path.removeLast() }
                        case .history:
                            HistoryScreen(container: container)
                        case .activityFeed:
                            ActivityFeedScreen(container: container)
                        case .supermarketMode:
                            SupermarketModeScreen(container: container) {
                                path.append(AppRoute.addItem)
                            }
                        case .settings:
                            SettingsScreen(container: container) { event in
                                path = NavigationPath()
                                rootDestination = event == .signedOut ? .auth : .householdSetup
                            }
                        }
                    }
                }
            }
        }
        .environment(\.layoutDirection, Locale.current.language.languageCode?.identifier == "ar" || Locale.current.language.languageCode?.identifier == "he" ? .rightToLeft : .leftToRight)
    }
}

enum SettingsExitEvent {
    case signedOut
    case leftHousehold
}
