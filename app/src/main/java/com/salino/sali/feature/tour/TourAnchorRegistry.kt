package com.salino.sali.feature.tour

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.IntSize
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TourAnchorRegistry @Inject constructor() {
    private val bounds = ConcurrentHashMap<TourAnchorId, Rect>()
    private val scrollHandlers = ConcurrentHashMap<TourAnchorId, suspend () -> Unit>()

    fun updateBounds(id: TourAnchorId, rect: Rect) {
        bounds[id] = rect
    }

    fun removeBounds(id: TourAnchorId) {
        bounds.remove(id)
    }

    fun measureAnchor(id: TourAnchorId): Rect? = bounds[id]

    fun registerScrollHandler(id: TourAnchorId, handler: suspend () -> Unit) {
        scrollHandlers[id] = handler
    }

    fun unregisterScrollHandler(id: TourAnchorId) {
        scrollHandlers.remove(id)
    }

    suspend fun scrollAnchorIntoView(id: TourAnchorId) {
        scrollHandlers[id]?.invoke()
    }
}

enum class TourSheetPlacement {
    Top,
    Bottom,
}

fun resolveSheetPlacement(
    registry: TourAnchorRegistry,
    anchorId: TourAnchorId?,
    screenSize: IntSize,
    safeTopPx: Float,
    safeBottomPx: Float,
): TourSheetPlacement {
    if (anchorId == null) return TourSheetPlacement.Bottom

    val rect = registry.measureAnchor(anchorId) ?: return TourSheetPlacement.Bottom

    val density = screenSize.width.toFloat().coerceAtLeast(1f) / 360f
    val fabRowPx = TOUR_FAB_ROW_HEIGHT * density
    val adBannerPx = TOUR_AD_BANNER_HEIGHT * density
    val sheetHeightPx = TOUR_SHEET_APPROX_HEIGHT * density
    val anchorGapPx = 20f * density

    val screenH = screenSize.height.toFloat()
    val bottomReserved = safeBottomPx + fabRowPx + adBannerPx + sheetHeightPx
    val sheetTopY = screenH - bottomReserved
    val anchorBottom = rect.bottom

    if (anchorBottom > sheetTopY - anchorGapPx) {
        return TourSheetPlacement.Top
    }

    val anchorCenterY = rect.top + rect.height / 2f
    if (anchorCenterY > screenH * 0.52f) {
        return TourSheetPlacement.Top
    }

    return TourSheetPlacement.Bottom
}
