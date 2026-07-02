package com.salino.sali

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.compose.rememberNavController
import com.salino.sali.feature.tour.TourHost
import com.salino.sali.navigation.SalinoNavGraph
import com.salino.sali.ui.theme.SalinoTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SalinoTheme {
                val navController = rememberNavController()
                TourHost(navController = navController) {
                    SalinoNavGraph(navController = navController)
                }
            }
        }
    }
}
