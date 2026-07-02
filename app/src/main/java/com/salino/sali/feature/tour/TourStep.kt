package com.salino.sali.feature.tour

import com.salino.sali.navigation.Screen

data class TourStep(
    val id: String,
    val titleRes: Int,
    val bodyRes: Int,
    val route: String = Screen.ShoppingList.route,
    val anchorId: TourAnchorId? = null,
    val scrollIntoView: Boolean = false,
)

val TOUR_STEPS: List<TourStep> = listOf(
    TourStep(
        id = "hero",
        titleRes = com.salino.sali.R.string.tour_step_hero_title,
        bodyRes = com.salino.sali.R.string.tour_step_hero_body,
        anchorId = TourAnchorId.ListHero,
    ),
    TourStep(
        id = "filters",
        titleRes = com.salino.sali.R.string.tour_step_filters_title,
        bodyRes = com.salino.sali.R.string.tour_step_filters_body,
        anchorId = TourAnchorId.ListFilters,
    ),
    TourStep(
        id = "addFab",
        titleRes = com.salino.sali.R.string.tour_step_add_fab_title,
        bodyRes = com.salino.sali.R.string.tour_step_add_fab_body,
        anchorId = TourAnchorId.ListAddFab,
    ),
    TourStep(
        id = "supermarketFab",
        titleRes = com.salino.sali.R.string.tour_step_supermarket_title,
        bodyRes = com.salino.sali.R.string.tour_step_supermarket_fab_body,
        anchorId = TourAnchorId.ListSupermarketFab,
    ),
    TourStep(
        id = "settings",
        titleRes = com.salino.sali.R.string.tour_step_settings_title,
        bodyRes = com.salino.sali.R.string.tour_step_settings_body,
        anchorId = TourAnchorId.ListSettings,
    ),
    TourStep(
        id = "invite",
        titleRes = com.salino.sali.R.string.tour_step_invite_title,
        bodyRes = com.salino.sali.R.string.tour_step_invite_body,
        route = Screen.Settings.route,
        anchorId = TourAnchorId.SettingsInvite,
        scrollIntoView = true,
    ),
    TourStep(
        id = "activity",
        titleRes = com.salino.sali.R.string.tour_step_activity_title,
        bodyRes = com.salino.sali.R.string.tour_step_activity_body,
        anchorId = TourAnchorId.ListActivity,
    ),
    TourStep(
        id = "history",
        titleRes = com.salino.sali.R.string.tour_step_history_title,
        bodyRes = com.salino.sali.R.string.tour_step_history_body,
        route = Screen.History.route,
        anchorId = TourAnchorId.HistoryTitle,
    ),
    TourStep(
        id = "done",
        titleRes = com.salino.sali.R.string.tour_step_done_title,
        bodyRes = com.salino.sali.R.string.tour_step_done_body,
    ),
)

fun stepsForUser(): List<TourStep> = TOUR_STEPS
