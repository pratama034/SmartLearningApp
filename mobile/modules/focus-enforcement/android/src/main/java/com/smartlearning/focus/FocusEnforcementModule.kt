package com.smartlearning.focus

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.text.TextUtils
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusEnforcementModule : Module() {

  companion object {
    var reactContext: ReactContext? = null

    fun rebindListener(context: Context) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        runCatching {
          val component = ComponentName(context.packageName, "${context.packageName}.FocusNotificationListener")
          NotificationListenerService.requestRebind(component)
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("FocusEnforcement")

    OnCreate {
      val ctx = appContext.reactContext as? ReactContext
      reactContext = ctx
      val context = appContext.reactContext
      if (context != null) {
        runCatching {
          val listenerClass = Class.forName("${context.packageName}.FocusNotificationListener")
          val field = listenerClass.getDeclaredField("reactContext")
          field.isAccessible = true
          field.set(null, ctx)
        }
        rebindListener(context)
      }
    }

    Function("setFocusEnabled") { enabled: Boolean, blockedPackages: List<String> ->
      val context = appContext.reactContext
      if (context != null) {
        val ctx = context as? ReactContext
        reactContext = ctx
        runCatching {
          val listenerClass = Class.forName("${context.packageName}.FocusNotificationListener")
          val field = listenerClass.getDeclaredField("reactContext")
          field.isAccessible = true
          field.set(null, ctx)
        }
        FocusPrefs.setFocus(context, enabled, blockedPackages)
        if (enabled) {
          rebindListener(context)
        }
      }
      true
    }

    Function("setBlockedPackages") { blockedPackages: List<String> ->
      val context = appContext.reactContext
      if (context != null) {
        val ctx = context as? ReactContext
        reactContext = ctx
        runCatching {
          val listenerClass = Class.forName("${context.packageName}.FocusNotificationListener")
          val field = listenerClass.getDeclaredField("reactContext")
          field.isAccessible = true
          field.set(null, ctx)
        }
        FocusPrefs.setBlockedPackages(context, blockedPackages)
        rebindListener(context)
      }
      true
    }

    Function("rebindNotificationListener") {
      val context = appContext.reactContext
      if (context != null) {
        rebindListener(context)
      }
      true
    }

    Function("isFocusEnabled") {
      val context = appContext.reactContext
      if (context != null) {
        FocusPrefs.isActive(context)
      } else {
        false
      }
    }

    Function("isAccessibilityEnabled") {
      val context = appContext.reactContext
      if (context == null) {
        false
      } else {
        val expected = ComponentName(context, FocusAccessibilityService::class.java).flattenToString()
        val enabledServices = Settings.Secure.getString(
          context.contentResolver,
          Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        )
        if (enabledServices.isNullOrBlank()) {
          false
        } else {
          val splitter = TextUtils.SimpleStringSplitter(':')
          splitter.setString(enabledServices)
          var found = false
          while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) {
              found = true
              break
            }
          }
          found
        }
      }
    }

    Function("isNotificationAccessEnabled") {
      val context = appContext.reactContext
      if (context == null) {
        false
      } else {
        val listeners = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        if (listeners.isNullOrBlank()) {
          false
        } else {
          listeners.contains("${context.packageName}/.FocusNotificationListener") ||
            listeners.contains("${context.packageName}/${context.packageName}.FocusNotificationListener") ||
            listeners.contains("FocusNotificationListener")
        }
      }
    }

    Function("openAccessibilitySettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        appContext.reactContext?.startActivity(intent)
      }
      true
    }

    Function("openNotificationSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        appContext.reactContext?.startActivity(intent)
      }
      true
    }

    Function("openBatteryOptimizationSettings") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val activity = appContext.currentActivity
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent)
        }
      }
      true
    }

    Function("getHeldNotifications") {
      val context = appContext.reactContext
      if (context != null) {
        FocusPrefs.heldNotifications(context)
      } else {
        emptyList<Map<String, Any>>()
      }
    }

    Function("clearHeldNotifications") {
      val context = appContext.reactContext
      if (context != null) {
        FocusPrefs.clearHeldNotifications(context)
      }
      true
    }
  }
}
