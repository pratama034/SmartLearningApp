package com.smartlearning.app

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.smartlearning.focus.FocusEnforcementModule
import com.smartlearning.focus.FocusPrefs
import org.json.JSONObject
import java.util.UUID

class FocusNotificationListener : NotificationListenerService() {

  companion object {
    private const val TAG = "FocusNotification"
    var reactContext: ReactContext? = null
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      val selectedApps = FocusPrefs.blockedPackages(this)
      if (!FocusPrefs.isActive(this) || sbn.packageName == packageName || sbn.packageName !in selectedApps) return

      val extras = sbn.notification.extras
      val title = extras?.getString(Notification.EXTRA_TITLE)
        ?: extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        ?: "Tidak Diketahui"

      val text = extras?.getString(Notification.EXTRA_TEXT)
        ?: extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        ?: ""

      val appName = try {
        val pm = packageManager
        val appInfo = pm.getApplicationInfo(sbn.packageName, 0)
        pm.getApplicationLabel(appInfo).toString()
      } catch (e: Exception) {
        when (sbn.packageName) {
          "com.instagram.android" -> "Instagram"
          "com.zhiliaoapp.musically" -> "TikTok"
          "com.whatsapp" -> "WhatsApp"
          "com.twitter.android" -> "X (Twitter)"
          "org.telegram.messenger" -> "Telegram"
          "com.google.android.youtube" -> "YouTube"
          else -> sbn.packageName.substringAfterLast('.')
        }
      }

      val notificationId = UUID.randomUUID().toString()

      FocusPrefs.addHeldNotification(this, JSONObject().apply {
        put("id", notificationId)
        put("packageName", sbn.packageName)
        put("appName", appName)
        put("title", title)
        put("text", text)
        put("receivedAt", sbn.postTime)
      })

      // Kirim event realtime dari Kotlin ke React Native
      val targetReactContext = reactContext ?: FocusEnforcementModule.reactContext
      if (targetReactContext != null) {
        val blockedDataMap = Arguments.createMap().apply {
          putString("id", notificationId)
          putString("packageName", sbn.packageName)
          putString("appName", appName)
          putString("title", title)
          putString("text", text)
          putDouble("receivedAt", sbn.postTime.toDouble())
        }
        targetReactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("onNotificationBlocked", blockedDataMap)
      }

      cancelNotification(sbn.key)
      Log.d(TAG, "Notifikasi dari $appName ($title) berhasil ditahan dan dikirim ke React Native.")
    } catch (err: Exception) {
      Log.w(TAG, "Gagal memproses notifikasi: ${err.message}")
    }
  }
}

