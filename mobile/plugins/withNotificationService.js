const { withAndroidManifest } = require('@expo/config-plugins')

/**
 * Expo Config Plugin to register NotificationListenerService in AndroidManifest.xml
 */
function withNotificationService(config) {
  return withAndroidManifest(config, async (modConfig) => {
    const androidManifest = modConfig.modResults.manifest

    // Pastikan <uses-permission> POST_NOTIFICATIONS & BIND_NOTIFICATION_LISTENER_SERVICE ada
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = []
    }
    const permissions = androidManifest['uses-permission']
    const requiredPermissions = [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
    ]
    for (const perm of requiredPermissions) {
      if (!permissions.some((p) => p && p.$ && p.$['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } })
      }
    }

    // Pastikan <application> array ada
    if (!androidManifest.application) {
      androidManifest.application = [{}]
    }
    const app = androidManifest.application[0]
    if (!app.service) {
      app.service = []
    }

    // Hapus service lama jika ada agar tidak duplikat
    app.service = app.service.filter(
      (s) =>
        !(
          s &&
          s.$ &&
          (s.$['android:name'] === '.FocusNotificationListener' ||
            s.$['android:name'] === 'com.smartlearning.focus.FocusNotificationListener' ||
            s.$['android:name'] === 'com.smartlearning.app.FocusNotificationListener')
        )
    )

    // Penambahan service terstruktur JSON objek murni sesuai spesifikasi
    app.service.push({
      $: {
        'android:name': '.FocusNotificationListener',
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
    })

    return modConfig
  })
}

module.exports = withNotificationService
