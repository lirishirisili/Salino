package com.salino.sali.ui.theme

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography

val SalinoFontFamily = FontFamily.Default

val SalinoTypography = Typography(
	headlineLarge = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Bold,
		fontSize = 34.sp,
		lineHeight = 40.sp,
		letterSpacing = (-0.3).sp
	),
	headlineMedium = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Bold,
		fontSize = 28.sp,
		lineHeight = 34.sp
	),
	titleLarge = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.SemiBold,
		fontSize = 22.sp,
		lineHeight = 28.sp
	),
	titleMedium = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.SemiBold,
		fontSize = 18.sp,
		lineHeight = 24.sp
	),
	titleSmall = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.SemiBold,
		fontSize = 15.sp,
		lineHeight = 20.sp
	),
	bodyLarge = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Medium,
		fontSize = 16.sp,
		lineHeight = 24.sp
	),
	bodyMedium = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Normal,
		fontSize = 14.sp,
		lineHeight = 20.sp
	),
	bodySmall = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Normal,
		fontSize = 12.sp,
		lineHeight = 18.sp
	),
	labelLarge = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.SemiBold,
		fontSize = 14.sp,
		lineHeight = 20.sp
	),
	labelMedium = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Medium,
		fontSize = 12.sp,
		lineHeight = 16.sp
	),
	labelSmall = TextStyle(
		fontFamily = SalinoFontFamily,
		fontWeight = FontWeight.Medium,
		fontSize = 11.sp,
		lineHeight = 16.sp
	)
)
