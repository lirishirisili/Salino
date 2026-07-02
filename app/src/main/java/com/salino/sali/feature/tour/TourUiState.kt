package com.salino.sali.feature.tour

data class TourOverlayState(
    val title: String,
    val body: String,
    val stepLabel: String,
    val isLast: Boolean,
    val sheetPlacement: TourSheetPlacement,
)

data class TourUiState(
    val active: Boolean = false,
    val stepIndex: Int = 0,
    val activeAnchorId: TourAnchorId? = null,
    val overlay: TourOverlayState? = null,
    val replayRequested: Boolean = false,
    val shoppingListReady: Boolean = false,
    val uid: String? = null,
    val currentRoute: String? = null,
)
