package com.smartlearning.focus

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object FocusPrefs {
  private const val PREFS = "smartlearning_focus"
  private const val KEY_ACTIVE = "focus_active"
  private const val KEY_PACKAGES = "blocked_packages"
  private const val KEY_NOTIFICATIONS = "held_notifications"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isActive(context: Context) = prefs(context).getBoolean(KEY_ACTIVE, false)
  fun blockedPackages(context: Context) = prefs(context).getStringSet(KEY_PACKAGES, emptySet())?.toSet() ?: emptySet()

  fun setFocus(context: Context, active: Boolean, packages: List<String>) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, active)
      .putStringSet(KEY_PACKAGES, packages.filter { it.isNotBlank() }.toSet())
      .apply()
  }

  fun addHeldNotification(context: Context, item: JSONObject) {
    val old = runCatching { JSONArray(prefs(context).getString(KEY_NOTIFICATIONS, "[]")) }.getOrDefault(JSONArray())
    val next = JSONArray()
    val start = (old.length() - 99).coerceAtLeast(0)
    for (index in start until old.length()) next.put(old.getJSONObject(index))
    next.put(item)
    prefs(context).edit().putString(KEY_NOTIFICATIONS, next.toString()).apply()
  }

  fun heldNotifications(context: Context): List<Map<String, Any>> {
    val array = runCatching { JSONArray(prefs(context).getString(KEY_NOTIFICATIONS, "[]")) }.getOrDefault(JSONArray())
    return (0 until array.length()).mapNotNull { index ->
      runCatching {
        val item = array.getJSONObject(index)
        mapOf(
          "id" to item.optString("id"),
          "packageName" to item.optString("packageName"),
          "appName" to item.optString("appName"),
          "title" to item.optString("title"),
          "text" to item.optString("text"),
          "receivedAt" to item.optLong("receivedAt"),
        )
      }.getOrNull()
    }
  }

  fun clearHeldNotifications(context: Context) {
    prefs(context).edit().remove(KEY_NOTIFICATIONS).apply()
  }
}
