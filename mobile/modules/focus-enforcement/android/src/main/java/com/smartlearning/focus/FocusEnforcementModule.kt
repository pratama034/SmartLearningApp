package com.smartlearning.focus

import android.content.ComponentName
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
      val ctx = appContext.reactContext
      reactContext = ctx
      FocusNotificationListener.reactContext = ctx
    }

    Function("setFocusEnabled") { enabled: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let {
        reactContext = it
        FocusNotificationListener.reactContext = it
        FocusPrefs.setFocus(it, enabled, blockedPackages)
      }
    }

    Function("setBlockedPackages") { blockedPackages: List<String> ->
      appContext.reactContext?.let {
        reactContext = it
        FocusNotificationListener.reactContext = it
        FocusPrefs.setFocus(it, true, blockedPackages)
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
      !enabledServices.isNullOrBlank() && TextUtils.SimpleStringSplitter(':').run {
        setString(enabledServices)
        var found = false
        while (hasNext()) if (next().equals(expected, ignoreCase = true)) found = true
        found
      }
    }

    Function("isNotificationAccessEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val expected = ComponentName(context, FocusNotificationListener::class.java).flattenToString()
      val listeners = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      if (listeners.isNullOrBlank()) return@Function false
      listeners.contains(expected) ||
        listeners.contains("${context.packageName}/.FocusNotificationListener") ||
        listeners.contains("${context.packageName}/com.smartlearning.app.FocusNotificationListener") ||
        listeners.contains("FocusNotificationListener")
    }

    Function("openAccessibilitySettings") {
      appContext.currentActivity?.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    Function("openNotificationSettings") {
      appContext.currentActivity?.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    Function("getHeldNotifications") {
      appContext.reactContext?.let(FocusPrefs::heldNotifications) ?: emptyList<Map<String, Any>>()
    }

    Function("clearHeldNotifications") {
      appContext.reactContext?.let(FocusPrefs::clearHeldNotifications)
    }
  }
}
