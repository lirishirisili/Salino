package com.salino.sali.data.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.getSystemService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.salino.sali.MainActivity
import com.salino.sali.R

/**
 * Receives FCM messages. Notification-type messages are shown automatically by
 * the system when the app is in the background; this service handles the
 * foreground case and keeps the device token in sync.
 */
class SalinoMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        FirebaseFirestore.getInstance()
            .collection("users")
            .document(uid)
            .set(mapOf("fcmTokens" to FieldValue.arrayUnion(token)), SetOptions.merge())
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val notification = message.notification
        val title = notification?.title
            ?: message.data["title"]
            ?: getString(R.string.app_name)
        val body = notification?.body ?: message.data["body"] ?: return

        showNotification(title, body)
    }

    private fun showNotification(title: String, body: String) {
        ensureChannel(this)

        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            NotificationManagerCompat.from(this)
                .notify(System.currentTimeMillis().toInt(), builder.build())
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS not granted; ignore.
        }
    }

    companion object {
        const val CHANNEL_ID = "shopping_updates"

        /** Creates the notification channel if it does not already exist. */
        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService<NotificationManager>() ?: return
            if (manager.getNotificationChannel(CHANNEL_ID) != null) return
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_shopping_updates),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notification_channel_shopping_updates_desc)
            }
            manager.createNotificationChannel(channel)
        }
    }
}
