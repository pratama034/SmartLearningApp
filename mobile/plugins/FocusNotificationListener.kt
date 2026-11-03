package com.smartlearning.app

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
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
    var isConnected = false

    fun isFocusActive(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return prefs.getBoolean(KEY_ACTIVE, false)
    }

    fun getBlockedPackages(context: Context): Set<String> {
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

    fun isPackageBlocked(pkg: String, blocked: Set<String>): Boolean {
      if (pkg in blocked) return true
      if (pkg == "com.whatsapp.w4b" && "com.whatsapp" in blocked) return true
      if (pkg.contains("whatsapp", ignoreCase = true) && ("com.whatsapp" in blocked || "com.whatsapp.w4b" in blocked)) return true
      if (pkg.contains("instagram", ignoreCase = true) && "com.instagram.android" in blocked) return true
      if (pkg.contains("telegram", ignoreCase = true) && "org.telegram.messenger" in blocked) return true
      if (pkg.contains("musically", ignoreCase = true) && "com.zhiliaoapp.musically" in blocked) return true
      if (pkg.contains("twitter", ignoreCase = true) && "com.twitter.android" in blocked) return true
      return false
    }

    fun addHeldNotification(context: Context, item: JSONObject) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(KEY_NOTIFICATIONS, "[]")
      val old = runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
      val next = JSONArray()
      val start = (old.length() - 99).coerceAtLeast(0)
      for (index in start until old.length()) next.put(old.getJSONObject(index))
      next.put(item)
      prefs.edit().putString(KEY_NOTIFICATIONS, next.toString()).commit()
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    isConnected = true
    Log.d(TAG, "FocusNotificationListener terhubung ke sistem notifikasi Android.")
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    isConnected = false
    Log.w(TAG, "FocusNotificationListener terputus. Mencoba rebind otomatis...")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      runCatching {
        requestRebind(ComponentName(this, FocusNotificationListener::class.java))
      }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      val selectedApps = getBlockedPackages(this)
      val isBlocked = isPackageBlocked(sbn.packageName, selectedApps)
      val active = isFocusActive(this)

      if (!active || sbn.packageName == packageName || !isBlocked) {
        return
      }

      // 1. Batalkan dan redam notifikasi sesegera mungkin dari status bar & heads-up banner
      runCatching { cancelNotification(sbn.key) }
      runCatching { cancelNotification(sbn.packageName, sbn.tag, sbn.id) }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        runCatching { snoozeNotification(sbn.key, 1000L * 60 * 60 * 24) }
      }

      // 2. Ekstrak data pengirim dan isi pesan
      val extras = sbn.notification.extras
      var title = extras?.getString(Notification.EXTRA_TITLE)
        ?: extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        ?: ""

      var text = extras?.getString(Notification.EXTRA_TEXT)
        ?: extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        ?: ""

      if (text.isBlank()) {
        val textLines = extras?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
        text = textLines?.lastOrNull()?.toString() ?: ""
      }

      val appName = try {
        val pm = packageManager
        val appInfo = pm.getApplicationInfo(sbn.packageName, 0)
        pm.getApplicationLabel(appInfo).toString()
      } catch (e: Exception) {
        when {
          sbn.packageName.contains("whatsapp", ignoreCase = true) -> "WhatsApp"
          sbn.packageName.contains("instagram", ignoreCase = true) -> "Instagram"
          sbn.packageName.contains("telegram", ignoreCase = true) -> "Telegram"
          sbn.packageName.contains("musically", ignoreCase = true) -> "TikTok"
          sbn.packageName.contains("twitter", ignoreCase = true) -> "X (Twitter)"
          sbn.packageName.contains("youtube", ignoreCase = true) -> "YouTube"
          else -> sbn.packageName.substringAfterLast('.')
        }
      }

      if (title.isBlank()) {
        title = appName
      }

      val notificationId = UUID.randomUUID().toString()

      // 3. Simpan ke SharedPreferences secara sinkron
      addHeldNotification(this, JSONObject().apply {
        put("id", notificationId)
        put("packageName", sbn.packageName)
        put("appName", appName)
        put("title", title)
        put("text", text)
        put("receivedAt", sbn.postTime)
      })

      // 4. Kirim broadcast internal Android
      runCatching {
        val broadcastIntent = Intent("com.smartlearning.focus.NOTIFICATION_BLOCKED").apply {
          putExtra("id", notificationId)
          putExtra("packageName", sbn.packageName)
          putExtra("appName", appName)
          putExtra("title", title)
          putExtra("text", text)
          putExtra("receivedAt", sbn.postTime)
          setPackage(packageName)
        }
        sendBroadcast(broadcastIntent)
      }

      // 5. Kirim event realtime ke React Native
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

      // Batalkan kembali untuk menjamin tidak muncul di Samsung One UI
      runCatching { cancelNotification(sbn.key) }
      Log.d(TAG, "Notifikasi dari $appName ($title) berhasil ditahan.")
    } catch (err: Exception) {
      Log.w(TAG, "Gagal memproses notifikasi: ${err.message}")
    }
  }
}
