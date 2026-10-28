package com.smartlearning.focus

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class FocusAccessibilityService : AccessibilityService() {
  private var overlay: View? = null
  private var windowManager: WindowManager? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val foregroundPackage = event.packageName?.toString() ?: return
    val active = FocusPrefs.isActive(this)
    val blocked = FocusPrefs.blockedPackages(this)
    if (active && foregroundPackage in blocked && foregroundPackage != packageName) {
      showFocusOverlay()
    } else {
      removeFocusOverlay()
    }
  }

  private fun showFocusOverlay() {
    if (overlay != null) return
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(44, 44, 44, 44)
      setBackgroundColor(Color.rgb(8, 13, 24))
      isClickable = true
      isFocusable = true
    }
    content.addView(TextView(this).apply {
      text = "Mode fokus sedang aktif"
      textSize = 24f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setTypeface(null, android.graphics.Typeface.BOLD)
    })
    content.addView(TextView(this).apply {
      text = "Aplikasi ini ditahan selama sesi belajar. Kembali ke SmartLearning untuk melanjutkan."
      textSize = 15f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(0, 18, 0, 24)
    })
    content.addView(Button(this).apply {
      text = "Kembali ke Fokus"
      setOnClickListener { performGlobalAction(GLOBAL_ACTION_HOME) }
    })

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.CENTER }

    runCatching {
      windowManager?.addView(content, params)
      overlay = content
    }
  }

  private fun removeFocusOverlay() {
    overlay?.let { view -> runCatching { windowManager?.removeView(view) } }
    overlay = null
  }

  override fun onInterrupt() = removeFocusOverlay()

  override fun onDestroy() {
    removeFocusOverlay()
    super.onDestroy()
  }
}
