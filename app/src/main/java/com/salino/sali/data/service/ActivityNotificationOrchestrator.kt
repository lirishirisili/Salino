package com.salino.sali.data.service

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.salino.sali.MainActivity
import com.salino.sali.R
import com.salino.sali.data.model.ActivityLog
import com.salino.sali.data.model.ImportantEvent
import com.salino.sali.data.model.NotificationMode
import com.salino.sali.data.model.User
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.domain.repository.AuthRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActivityNotificationOrchestrator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val authRepository: AuthRepository,
    private val activityRepository: ActivityRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val prefs: SharedPreferences =
        context.getSharedPreferences("salino_notification_state", Context.MODE_PRIVATE)
    private var started = false

    fun start() {
        if (started) return
        started = true
        ensureChannel()

        scope.launch {
            authRepository.observeCurrentUser().collectLatest { user ->
                if (user?.activeHouseholdId.isNullOrBlank()) return@collectLatest
                val currentUser = user ?: return@collectLatest
                val householdId = currentUser.activeHouseholdId ?: return@collectLatest

                activityRepository.observeActivityFeed(householdId).collect { logs ->
                    processLogs(currentUser, householdId, logs)
                }
            }
        }
    }

    private fun processLogs(user: User, householdId: String, logs: List<ActivityLog>) {
        if (logs.isEmpty()) return
        val sorted = logs.sortedBy { it.createdAt?.toDate()?.time ?: 0L }
        val newestTs = sorted.last().createdAt?.toDate()?.time ?: 0L

        val processedKey = key(user.id, householdId, "last_processed")
        val currentLastProcessed = prefs.getLong(processedKey, 0L)
        if (currentLastProcessed == 0L) {
            prefs.edit().putLong(processedKey, newestTs).apply()
            return
        }

        val freshLogs = sorted.filter { log ->
            val ts = log.createdAt?.toDate()?.time ?: 0L
            ts > currentLastProcessed && log.actorUserId != user.id
        }
        if (freshLogs.isEmpty()) return

        val notificationPrefs = user.notificationPrefs
        val importantEvents = notificationPrefs.importantEvents.ifEmpty { listOf(ImportantEvent.ITEM_ADDED) }

        updateDigestState(user.id, householdId, freshLogs)

        if (notificationPrefs.mode == NotificationMode.IMMEDIATE_IMPORTANT && canNotify()) {
            val sentKey = key(user.id, householdId, "sent_at")
            val oneHourAgo = System.currentTimeMillis() - 60 * 60 * 1000
            val sentAt = prefs.getString(sentKey, "")
                .orEmpty()
                .split(",")
                .mapNotNull { it.toLongOrNull() }
                .filter { it > oneHourAgo }
                .toMutableList()

            freshLogs.forEach { log ->
                if (!isImportantEvent(log.type, importantEvents)) return@forEach
                if (sentAt.size >= notificationPrefs.maxImmediatePerHour) return@forEach
                postImmediateNotification(log)
                sentAt += System.currentTimeMillis()
            }

            prefs.edit().putString(sentKey, sentAt.joinToString(",")).apply()
        }

        if ((notificationPrefs.mode == NotificationMode.DAILY_DIGEST || notificationPrefs.mode == NotificationMode.WEEKLY_DIGEST) && canNotify()) {
            maybeSendDigest(user.id, householdId, notificationPrefs.mode)
        }

        prefs.edit().putLong(processedKey, maxOf(currentLastProcessed, newestTs)).apply()
    }

    private fun isImportantEvent(type: String, importantEvents: List<ImportantEvent>): Boolean {
        return importantEvents.any { it.name == type }
    }

    private fun postImmediateNotification(log: ActivityLog) {
        val (title, body) = when (log.type) {
            ImportantEvent.ITEM_BOUGHT.name -> context.getString(R.string.notification_title_item_bought) to
                context.getString(R.string.notification_body_item_bought, log.itemName)
            ImportantEvent.ITEM_UPDATED.name -> context.getString(R.string.notification_title_item_updated) to
                context.getString(R.string.notification_body_item_updated, log.itemName)
            ImportantEvent.ITEM_DELETED.name -> context.getString(R.string.notification_title_item_deleted) to
                context.getString(R.string.notification_body_item_deleted, log.itemName)
            else -> context.getString(R.string.notification_title_item_added) to
                context.getString(R.string.notification_body_item_added, log.itemName)
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_salino_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(buildOpenAppPendingIntent())
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify(log.id.hashCode(), notification)
    }

    private fun maybeSendDigest(userId: String, householdId: String, mode: NotificationMode) {
        val lastSentKey = key(userId, householdId, "digest_last_sent")
        val lastSent = prefs.getLong(lastSentKey, 0L)
        val intervalMs = if (mode == NotificationMode.DAILY_DIGEST) 24 * 60 * 60 * 1000L else 7 * 24 * 60 * 60 * 1000L
        if (System.currentTimeMillis() - lastSent < intervalMs) return

        val digestAdded = prefs.getInt(key(userId, householdId, "digest_added"), 0)
        val digestOther = prefs.getInt(key(userId, householdId, "digest_other"), 0)
        if (digestAdded + digestOther <= 0) return

        val body = buildString {
            if (digestAdded > 0) append(context.getString(R.string.notification_digest_line_items_added, digestAdded))
            if (digestOther > 0) {
                if (isNotEmpty()) append(" · ")
                append(context.getString(R.string.notification_digest_line_other_changes, digestOther))
            }
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_salino_launcher)
            .setContentTitle(context.getString(R.string.notification_digest_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(buildOpenAppPendingIntent())
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify((householdId + "_digest").hashCode(), notification)
        prefs.edit()
            .putLong(lastSentKey, System.currentTimeMillis())
            .putInt(key(userId, householdId, "digest_added"), 0)
            .putInt(key(userId, householdId, "digest_other"), 0)
            .apply()
    }

    private fun updateDigestState(userId: String, householdId: String, logs: List<ActivityLog>) {
        var added = prefs.getInt(key(userId, householdId, "digest_added"), 0)
        var other = prefs.getInt(key(userId, householdId, "digest_other"), 0)
        logs.forEach { log ->
            if (log.type == ImportantEvent.ITEM_ADDED.name) added += 1 else other += 1
        }
        prefs.edit()
            .putInt(key(userId, householdId, "digest_added"), added)
            .putInt(key(userId, householdId, "digest_other"), other)
            .apply()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.notification_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    private fun canNotify(): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    private fun buildOpenAppPendingIntent(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, 0, intent, pendingFlags)
    }

    private fun key(userId: String, householdId: String, suffix: String): String =
        "notif_${userId}_${householdId}_$suffix"

    private companion object {
        const val CHANNEL_ID = "salino_activity_notifications"
    }
}
