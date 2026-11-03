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
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class FocusNotificationListener : NotificationListenerService() {

  companion object {
    private const val TAG = "FocusNotification"
    private const val PREFS = "smartlearning_focus"
    private const val KEY_ACTIVE = "focus_active"
    private const val KEY_PACKAGES = "blocked_packages"
    private const val KEY_NOTIFICATIONS = "held_notifications"

    var reactContext: ReactContext? = null

    private fun isFocusActive(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return prefs.getBoolean(KEY_ACTIVE, false)
    }

    private fun getBlockedPackages(context: Context): Set<String> {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val saved = prefs.getStringSet(KEY_PACKAGES, null)?.toSet()
      if (!saved.isNullOrEmpty()) {
        return saved
      }
      return setOf(
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.instagram.android",
        "com.zhiliaoapp.musically",
        "com.twitter.android",
        "org.telegram.messenger",
        "com.google.android.youtube"
      )
    }

    private fun isPackageBlocked(pkg: String, blocked: Set<String>): Boolean {
      if (pkg in blocked) return true
      if (pkg == "com.whatsapp.w4b" && "com.whatsapp" in blocked) return true
      if (pkg.contains("whatsapp", ignoreCase = true) && ("com.whatsapp" in blocked || "com.whatsapp.w4b" in blocked)) return true
      if (pkg.contains("instagram", ignoreCase = true) && "com.instagram.android" in blocked) return true
      return false
    }

    private fun addHeldNotification(context: Context, item: JSONObject) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(KEY_NOTIFICATIONS, "[]")
      val old = runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
      val next = JSONArray()
      val start = (old.length() - 99).coerceAtLeast(0)
      for (index in start until old.length()) next.put(old.getJSONObject(index))
      next.put(item)
      prefs.edit().putString(KEY_NOTIFICATIONS, next.toString()).apply()
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      val selectedApps = getBlockedPackages(this)
      if (!isFocusActive(this) || sbn.packageName == packageName || !isPackageBlocked(sbn.packageName, selectedApps)) return

      // Batalkan notifikasi dari status bar dan heads-up banner sesegera mungkin
      runCatching { cancelNotification(sbn.key) }
      runCatching { cancelNotification(sbn.packageName, sbn.tag, sbn.id) }

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

      addHeldNotification(this, JSONObject().apply {
        put("id", notificationId)
        put("packageName", sbn.packageName)
        put("appName", appName)
        put("title", title)
        put("text", text)
        put("receivedAt", sbn.postTime)
      })

      // Kirim event realtime dari Kotlin ke React Native
      val targetReactContext = reactContext ?: runCatching {
        val moduleClass = Class.forName("com.smartlearning.focus.FocusEnforcementModule")
        val field = moduleClass.getDeclaredField("reactContext")
        field.isAccessible = true
        field.get(null) as? ReactContext
      }.getOrNull()

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
