const fs = require('fs')
const path = require('path')

/**
 * Expo Config Plugin to safely inject:
 * 1. FocusAccessibilityService with BIND_ACCESSIBILITY_SERVICE permission & meta-data
 * 2. FocusNotificationListener with BIND_NOTIFICATION_LISTENER_SERVICE permission
 * 3. Required permissions and XML resource files
 */
function withFocusServices(config) {
  let withAndroidManifest
  let withDangerousMod

  try {
    const configPlugins = require('@expo/config-plugins')
    withAndroidManifest = configPlugins.withAndroidManifest
    withDangerousMod = configPlugins.configPlugins?.withDangerousMod || configPlugins.withDangerousMod
  } catch {
    // Fallback if @expo/config-plugins is resolved via expo
    try {
      const configPlugins = require('expo/config-plugins')
      withAndroidManifest = configPlugins.withAndroidManifest
      withDangerousMod = configPlugins.withDangerousMod
    } catch {
      // If neither is present, return config unchanged
      return config
    }
  }

  // 1. Modify AndroidManifest.xml
  if (typeof withAndroidManifest === 'function') {
    config = withAndroidManifest(config, async (modConfig) => {
      const androidManifest = modConfig.modResults

      if (!androidManifest.manifest) {
        androidManifest.manifest = {}
      }

      // Ensure <application> array exists
      if (!androidManifest.manifest.application || !Array.isArray(androidManifest.manifest.application)) {
        androidManifest.manifest.application = [{}]
      }
      const app = androidManifest.manifest.application[0]

      // Ensure <service> array exists
      if (!app.service || !Array.isArray(app.service)) {
        app.service = []
      }

      // 1. Accessibility Service
      const accessibilityServiceName = 'com.smartlearning.focus.FocusAccessibilityService'
      const hasAccessibilityService = app.service.some(
        (s) => s && s.$ && s.$['android:name'] === accessibilityServiceName
      )

      if (!hasAccessibilityService) {
        app.service.push({
          $: {
            'android:name': accessibilityServiceName,
            'android:label': 'SmartLearning Focus Lock',
            'android:description': '@string/focus_accessibility_description',
            'android:exported': 'false',
            'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.accessibilityservice.AccessibilityService',
                  },
                },
              ],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.accessibilityservice',
                'android:resource': '@xml/focus_accessibility_config',
              },
            },
          ],
        })
      }

      // 2. Notification Listener Service
      const notificationServiceName = 'com.smartlearning.focus.FocusNotificationListener'
      const hasNotificationService = app.service.some(
        (s) => s && s.$ && s.$['android:name'] === notificationServiceName
      )

      if (!hasNotificationService) {
        app.service.push({
          $: {
            'android:name': notificationServiceName,
            'android:label': 'SmartLearning Notification Hold',
            'android:exported': 'false',
            'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.service.notification.NotificationListenerService',
                  },
                },
              ],
            },
          ],
        })
      }

      // Ensure <uses-permission> array exists
      if (!androidManifest.manifest['uses-permission'] || !Array.isArray(androidManifest.manifest['uses-permission'])) {
        androidManifest.manifest['uses-permission'] = []
      }
      const permissions = androidManifest.manifest['uses-permission']

      const requiredPermissions = [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.BIND_ACCESSIBILITY_SERVICE',
        'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
      ]

      for (const perm of requiredPermissions) {
        const exists = permissions.some((p) => p && p.$ && p.$['android:name'] === perm)
        if (!exists) {
          permissions.push({
            $: {
              'android:name': perm,
            },
          })
        }
      }

      return modConfig
    })
  }

  // 2. Ensure XML and strings resources exist in android/app/src/main/res
  if (typeof withDangerousMod === 'function') {
    config = withDangerousMod(config, [
      'android',
      async (modConfig) => {
        try {
          const resDir = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')
          const xmlDir = path.join(resDir, 'xml')
          const valuesDir = path.join(resDir, 'values')

          // Ensure directories exist
          fs.mkdirSync(xmlDir, { recursive: true })
          fs.mkdirSync(valuesDir, { recursive: true })

          // Copy or write focus_accessibility_config.xml
          const xmlFilePath = path.join(xmlDir, 'focus_accessibility_config.xml')
          const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="false"
    android:description="@string/focus_accessibility_description"
    android:notificationTimeout="100" />
`
          fs.writeFileSync(xmlFilePath, xmlContent, 'utf8')

          // Ensure strings.xml has focus_accessibility_description
          const stringsFilePath = path.join(valuesDir, 'strings.xml')
          let stringsContent = ''
          if (fs.existsSync(stringsFilePath)) {
            stringsContent = fs.readFileSync(stringsFilePath, 'utf8')
          } else {
            stringsContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>`
          }

          if (!stringsContent.includes('focus_accessibility_description')) {
            stringsContent = stringsContent.replace(
              '</resources>',
              '    <string name="focus_accessibility_description">Digunakan untuk memblokir aplikasi pengganggu saat sesi fokus aktif.</string>\n</resources>'
            )
            fs.writeFileSync(stringsFilePath, stringsContent, 'utf8')
          }
        } catch (err) {
          console.warn('[withFocusServices] Gagal menyalin XML resource:', err)
        }

        return modConfig
      },
    ])
  }

  return config
}

module.exports = withFocusServices

