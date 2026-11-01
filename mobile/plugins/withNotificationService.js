const { withAndroidManifest } = require('@expo/config-plugins')

/**
 * Expo Config Plugin to register NotificationListenerService:
 * 1. Adds POST_NOTIFICATIONS permission (Android 13+).
 * 2. Adds BIND_NOTIFICATION_LISTENER_SERVICE permission.
 * 3. Registers FocusNotificationListener service inside <application> with:
 *    - android:name="com.smartlearning.focus.FocusNotificationListener"
 *    - android:label="Smart Focus Blocker"
 *    - android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
 *    - android:exported="true"
 *    - intent-filter with action android.service.notification.NotificationListenerService
 */
function withNotificationService(config) {
  return withAndroidManifest(config, async (modConfig) => {
    const androidManifest = modConfig.modResults

    if (!androidManifest.manifest) {
      androidManifest.manifest = {}
    }

    // 1. Ensure <uses-permission> array exists and contains required permissions
    if (!androidManifest.manifest['uses-permission'] || !Array.isArray(androidManifest.manifest['uses-permission'])) {
      androidManifest.manifest['uses-permission'] = []
    }
    const permissions = androidManifest.manifest['uses-permission']

    const requiredPermissions = [
      'android.permission.POST_NOTIFICATIONS',
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

    // 2. Ensure <application> array exists
    if (!androidManifest.manifest.application || !Array.isArray(androidManifest.manifest.application)) {
      androidManifest.manifest.application = [{}]
    }
    const app = androidManifest.manifest.application[0]

    // Ensure <service> array exists
    if (!app.service || !Array.isArray(app.service)) {
      app.service = []
    }

    const targetServiceName = 'com.smartlearning.focus.FocusNotificationListener'

    // Find any existing service registered for FocusNotificationListener
    let service = app.service.find(
      (s) =>
        s &&
        s.$ &&
        (s.$['android:name'] === targetServiceName ||
          s.$['android:name'] === '.FocusNotificationListener' ||
          s.$['android:name'] === 'com.smartlearning.app.FocusNotificationListener')
    )

    if (!service) {
      service = {
        $: {
          'android:name': targetServiceName,
          'android:label': 'Smart Focus Blocker',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
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
      }
      app.service.push(service)
    } else {
      // Update existing service definition to guarantee proper permissions & exported state
      service.$['android:name'] = targetServiceName
      service.$['android:label'] = 'Smart Focus Blocker'
      service.$['android:permission'] = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
      service.$['android:exported'] = 'true'

      if (!service['intent-filter'] || !Array.isArray(service['intent-filter'])) {
        service['intent-filter'] = []
      }

      const hasAction = service['intent-filter'].some(
        (filter) =>
          filter &&
          filter.action &&
          Array.isArray(filter.action) &&
          filter.action.some(
            (act) => act && act.$ && act.$['android:name'] === 'android.service.notification.NotificationListenerService'
          )
      )

      if (!hasAction) {
        service['intent-filter'].push({
          action: [
            {
              $: {
                'android:name': 'android.service.notification.NotificationListenerService',
              },
            },
          ],
        })
      }
    }

    return modConfig
  })
}

module.exports = withNotificationService

