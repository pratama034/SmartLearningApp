package com.smartlearning.focus

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusEnforcementModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FocusEnforcement")

    Function("setFocusEnabled") { enabled: Boolean, blockedPackages: List<String> ->
      appContext.reactContext?.let { FocusPrefs.setFocus(it, enabled, blockedPackages) }
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
      !listeners.isNullOrBlank() && listeners.contains(expected)
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
