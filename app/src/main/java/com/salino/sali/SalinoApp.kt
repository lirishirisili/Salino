package com.salino.sali

import android.app.Application
import com.salino.sali.data.service.ActivityNotificationOrchestrator
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class SalinoApp : Application() {
    @Inject
    lateinit var activityNotificationOrchestrator: ActivityNotificationOrchestrator

    override fun onCreate() {
        super.onCreate()
        activityNotificationOrchestrator.start()
    }
}
