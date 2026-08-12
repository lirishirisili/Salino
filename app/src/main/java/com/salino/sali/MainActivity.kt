package com.salino.sali

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.compose.rememberNavController
import com.salino.sali.feature.tour.TourHost
import com.salino.sali.navigation.SalinoNavGraph
import com.salino.sali.ui.theme.SalinoTheme
import com.salino.sali.util.AppLinks
import com.salino.sali.util.InviteDeepLinkHolder
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleInviteIntent(intent)
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleInviteIntent(intent)
    }

    private fun handleInviteIntent(intent: Intent?) {
        val code = AppLinks.extractInviteCode(intent?.data) ?: return
        InviteDeepLinkHolder.set(code)
    }
}
