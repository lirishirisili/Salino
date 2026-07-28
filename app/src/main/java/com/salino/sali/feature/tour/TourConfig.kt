package com.salino.sali.feature.tour

/** Master switch — set false to disable the tour without removing code. */
const val TOUR_ENABLED = true

/** Wait after switching screens before showing a step. */
const val TOUR_ROUTE_SWITCH_MS = 450L

/** Wait after programmatic scroll before showing highlight. */
const val TOUR_SCROLL_SETTLE_MS = 300L

/** Shopping-list top bar height estimate (below safe area). */
const val TOUR_TOP_BAR_HEIGHT = 100

/** Bottom FAB row clearance on shopping list. */
const val TOUR_FAB_ROW_HEIGHT = 80

    /** Standard bottom banner height + padding estimate (dp). */
const val TOUR_AD_BANNER_HEIGHT = 58

/** Approximate height of the tour bottom/top sheet card (dp). */
const val TOUR_SHEET_APPROX_HEIGHT = 260

/** Layout frames to wait before measuring anchor position. */
const val TOUR_LAYOUT_FRAMES = 3
