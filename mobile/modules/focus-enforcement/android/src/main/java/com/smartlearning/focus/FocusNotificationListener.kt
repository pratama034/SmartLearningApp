package com.smartlearning.focus

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import java.util.UUID

class FocusNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val selectedApps = FocusPrefs.blockedPackages(this)
    if (!FocusPrefs.isActive(this) || sbn.packageName == packageName || sbn.packageName !in selectedApps) return

    val extras = sbn.notification.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras?.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()

    FocusPrefs.addHeldNotification(this, JSONObject().apply {
      put("id", UUID.randomUUID().toString())
      put("packageName", sbn.packageName)
      put("appName", when (sbn.packageName) {
        "com.instagram.android" -> "Instagram"
        "com.zhiliaoapp.musically" -> "TikTok"
        "com.whatsapp" -> "WhatsApp"
        else -> sbn.packageName.substringAfterLast('.')
      })
      put("title", title)
      put("text", text)
      put("receivedAt", sbn.postTime)
    })
    cancelNotification(sbn.key)
  }
}
