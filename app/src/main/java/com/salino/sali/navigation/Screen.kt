package com.salino.sali.navigation

sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Auth : Screen("auth")
    data object HouseholdSetup : Screen("household_setup")
    data object ShoppingList : Screen("shopping_list")
    data object SupermarketMode : Screen("supermarket_mode")
    data object AddItem : Screen("add_item")
    data object EditItem : Screen("edit_item/{itemId}") {
        fun createRoute(itemId: String) = "edit_item/$itemId"
    }
    data object History : Screen("history")
    data object ActivityFeed : Screen("activity_feed")
    data object Settings : Screen("settings")
}
