package com.salino.sali

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.compose.rememberNavController
import com.salino.sali.navigation.SalinoNavGraph
import com.salino.sali.ui.theme.SalinoTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SalinoTheme {
                val navController = rememberNavController()
                SalinoNavGraph(navController = navController)
            }
        }
    }
}
