package com.smartlearning.focus

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusEnforcementModule : Module() {

  companion object {
    var reactContext: ReactContext? = null
  }

  override fun definition() = ModuleDefinition {
    Name("FocusEnforcement")

    OnCreate {
      val ctx = appContext.reactContext as? ReactContext
      reactContext = ctx
      runCatching {
        val listenerClass = Class.forName("${appContext.reactContext?.packageName}.FocusNotificationListener")
        val field = listenerClass.getDeclaredField("reactContext")
        field.isAccessible = true
        field.set(null, ctx)
      }
    }

    Function("setFocusEnabled") { enabled: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let { ctx ->
        reactContext = ctx as? ReactContext
        FocusPrefs.setFocus(ctx, enabled, blockedPackages)
      }
    }

    Function("setBlockedPackages") { blockedPackages: List<String> ->
      appContext.reactContext?.let { ctx ->
        reactContext = ctx as? ReactContext
        FocusPrefs.setFocus(ctx, true, blockedPackages)
      }
    }

    Function("isFocusEnabled") {
      appContext.reactContext?.let(FocusPrefs::isActive) ?: false
    }

    Function("isAccessibilityEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val expected = ComponentName(context, FocusAccessibilityService::class.java).flattenToString()
      val enabledServices = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
      if (enabledServices.isNullOrBlank()) return@Function false
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

    Function("isNotificationAccessEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val listeners = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      if (listeners.isNullOrBlank()) return@Function false
      listeners.contains("${context.packageName}/.FocusNotificationListener") ||
        listeners.contains("${context.packageName}/${context.packageName}.FocusNotificationListener") ||
        listeners.contains("FocusNotificationListener")
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
    }

    Function("getHeldNotifications") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      FocusPrefs.heldNotifications(context)
    }

    Function("clearHeldNotifications") {
      val context = appContext.reactContext ?: return@Function
      FocusPrefs.clearHeldNotifications(context)
    }
  }
}
