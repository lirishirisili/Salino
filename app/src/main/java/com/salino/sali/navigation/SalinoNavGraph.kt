package com.salino.sali.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.salino.sali.ui.screens.additem.AddItemScreen
import com.salino.sali.ui.screens.activityfeed.ActivityFeedScreen
import com.salino.sali.ui.screens.auth.AuthScreen
import com.salino.sali.ui.screens.edititem.EditItemScreen
import com.salino.sali.ui.screens.history.HistoryScreen
import com.salino.sali.ui.screens.household.HouseholdSetupScreen
import com.salino.sali.ui.screens.settings.SettingsScreen
import com.salino.sali.ui.screens.shoppinglist.ShoppingListScreen
import com.salino.sali.ui.screens.splash.SplashScreen
import com.salino.sali.ui.screens.supermarket.SupermarketModeScreen
import com.salino.sali.util.Constants

@Composable
fun SalinoNavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToAuth = {
                    navController.navigate(Screen.Auth.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToHouseholdSetup = {
                    navController.navigate(Screen.HouseholdSetup.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToShoppingList = {
                    navController.navigate(Screen.ShoppingList.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Auth.route) {
            AuthScreen(
                onAuthSuccess = { hasHousehold ->
                    val destination = if (hasHousehold) {
                        Screen.ShoppingList.route
                    } else {
                        Screen.HouseholdSetup.route
                    }
                    navController.navigate(destination) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.HouseholdSetup.route) {
            HouseholdSetupScreen(
                onHouseholdReady = {
                    navController.navigate(Screen.ShoppingList.route) {
                        popUpTo(Screen.HouseholdSetup.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.ShoppingList.route) {
            ShoppingListScreen(
                onNavigateToAddItem = {
                    navController.navigate(Screen.AddItem.route)
                },
                onNavigateToEditItem = { itemId ->
                    navController.navigate(Screen.EditItem.createRoute(itemId))
                },
                onNavigateToHistory = {
                    navController.navigate(Screen.History.route)
                },
                onNavigateToActivityFeed = {
                    navController.navigate(Screen.ActivityFeed.route)
                },
                onNavigateToSupermarketMode = {
                    navController.navigate(Screen.SupermarketMode.route)
                },
                onNavigateToSettings = {
                    navController.navigate(Screen.Settings.route)
                }
            )
        }

        composable(Screen.AddItem.route) {
            AddItemScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.EditItem.route,
            arguments = listOf(
                navArgument(Constants.ARG_ITEM_ID) { type = NavType.StringType }
            )
        ) {
            EditItemScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.History.route) {
            HistoryScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.ActivityFeed.route) {
            ActivityFeedScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.SupermarketMode.route) {
            SupermarketModeScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onNavigateBack = { navController.popBackStack() },
                onSignedOut = {
                    navController.navigate(Screen.Auth.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onHouseholdLeft = {
                    navController.navigate(Screen.HouseholdSetup.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}
