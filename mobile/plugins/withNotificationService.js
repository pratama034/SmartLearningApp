const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Expo Config Plugin to:
 * 1. Register FocusNotificationListener service in AndroidManifest.xml
 * 2. Dynamically copy FocusNotificationListener.kt with package replacement matching app.json
 */
function withNotificationService(config) {
  // 1. AndroidManifest configuration
  config = withAndroidManifest(config, async (modConfig) => {
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

  // 2. Dynamic copy of FocusNotificationListener.kt with matching package name
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packageName = modConfig.android?.package || 'com.smartlearning.app'
      const packageSegments = packageName.split('.')
      const targetDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageSegments
      )
      fs.mkdirSync(targetDir, { recursive: true })

      // Read source template
      const sourcePath = path.join(__dirname, 'FocusNotificationListener.kt')
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`[withNotificationService] File sumber tidak ditemukan di: ${sourcePath}`)
      }
      let content = fs.readFileSync(sourcePath, 'utf8')

      // Replace package declaration dynamically to match app.json
      content = content.replace(/^package\s+[\w.]+/m, `package ${packageName}`)

      // Write to destination
      const destPath = path.join(targetDir, 'FocusNotificationListener.kt')
      fs.writeFileSync(destPath, content, 'utf8')

      return modConfig
    },
  ])

  return config
}

module.exports = withNotificationService
