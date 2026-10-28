# SmartLearning Android (Expo)

This is a separate React Native / Expo app. The existing Vite web app remains at the repository root.

## Local frontend development

Use Node.js 22.13 or newer and install dependencies from this folder:

```bash
npm install
npm start
```

Open the app in Expo Go by scanning the Metro QR code. This mode is for React Native UI and local mock data. The app detects when its custom native module is absent and keeps Android service settings disabled. Supabase is intentionally not used by this mobile app yet.

For Android native-service development, build a custom APK with the EAS `development` profile, install it on the phone, then start Metro with `npm run start:dev-client`. Native services are included only in an Android build, not Expo Go.

To build the sideloadable APKs in EAS Cloud:

```bash
eas build -p android --profile development
eas build -p android --profile preview
```

The `development` APK includes the custom Expo development client for live Metro reloads. The `preview` APK is the standalone test build. Install either from the EAS build link and manually enable Accessibility and Notification access from the app's permission buttons.

The app uses the repository's local mock data. In a native Android build, app blocking uses a local AccessibilityService to show a focus screen over selected apps. Notification access uses a local NotificationListenerService to dismiss notifications from selected apps during a focus session and keep their title/text in private app storage for review. Android requires the user to enable each service in Settings; the app cannot grant those permissions itself.
Notifications held in the app are stored locally and are not re-posted to the Android notification shade when a session ends. Native-service behavior still needs testing on a physical phone.
