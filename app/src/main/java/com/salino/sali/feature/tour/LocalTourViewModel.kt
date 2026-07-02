package com.salino.sali.feature.tour

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf

val LocalTourViewModel = staticCompositionLocalOf<TourViewModel> {
    error("TourViewModel not provided")
}
