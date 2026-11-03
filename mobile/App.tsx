import React, { useRef, useState, useEffect } from 'react';
import {
  BackHandler,
  DeviceEventEmitter,
  Linking,
  NativeModules,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ToastAndroid,
} from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import FocusEnforcement from './modules/focus-enforcement/src';

interface KotlinNotificationBlockerModule {
  setBlockedPackages?: (packages: string[]) => void;
}

const { MyKotlinModule } = NativeModules as {
  MyKotlinModule?: KotlinNotificationBlockerModule;
};

const DOWNLOADABLE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.zip'];

function isDownloadableFileUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const cleanPath = rawUrl.split('?')[0].split('#')[0].toLowerCase();
  return DOWNLOADABLE_EXTENSIONS.some((ext) => cleanPath.endsWith(ext));
}

export default function App() {
  const webViewRef = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // URL Aplikasi Web Smart Focus di Vercel
  const WEB_URL = 'https://smart-learning-app-mu.vercel.app/';

  // Logika untuk menangani tombol Back fisik di Android
  useEffect(() => {
    const handleBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Cegah aplikasi keluar
      }
      return false; // Biarkan aplikasi keluar (default)
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      backSubscription.remove();
    };
  }, [canGoBack]);

  // Dengarkan event realtime 'onNotificationBlocked' dari Kotlin dan suntikkan ke WebView
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'onNotificationBlocked',
      (data) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          const jsCode = `(function() {
            try {
              window.dispatchEvent(new CustomEvent('NATIVE_NOTIFICATION_BLOCKED', { detail: ${JSON.stringify(payload)} }));
            } catch (e) {
              console.error('Error dispatching NATIVE_NOTIFICATION_BLOCKED:', e);
            }
          })(); true;`;
          webViewRef.current?.injectJavaScript(jsCode);
        } catch (err) {
          console.warn('[WebView Bridge] Gagal menyuntikkan onNotificationBlocked ke WebView:', err);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Menangkap pesan dari WebView (contoh: SET_BLOCKED_APPS untuk Notification Blocker)
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const rawData = event.nativeEvent.data;
      if (!rawData) return;

      const parsed = JSON.parse(rawData) as {
        type?: string;
        data?: unknown;
      };

      if (parsed.type === 'SET_BLOCKED_APPS' && Array.isArray(parsed.data)) {
        const blockedPackages = parsed.data.filter(
          (pkg): pkg is string => typeof pkg === 'string'
        );

        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.setBlockedPackages(blockedPackages);
        }

        if (MyKotlinModule?.setBlockedPackages) {
          MyKotlinModule.setBlockedPackages(blockedPackages);
        }

        ToastAndroid.show(
          'Sistem HP: Aturan blokir notifikasi berhasil diterapkan!',
          ToastAndroid.SHORT
        );
      }

      if (parsed.type === 'START_FOCUS') {
        const payloadData = parsed.data as { blockedPackages?: string[] } | undefined;
        const blockedPackages = Array.isArray(payloadData?.blockedPackages)
          ? payloadData.blockedPackages.filter((pkg): pkg is string => typeof pkg === 'string')
          : [];

        if (FocusEnforcement.isNativeAvailable()) {
          // Bersihkan memori notifikasi tertahan dari sesi sebelumnya agar sesi baru dimulai dari 0
          FocusEnforcement.clearHeldNotifications();
          FocusEnforcement.setFocusEnabled(true, blockedPackages);
        }

        ToastAndroid.show(
          'Sistem HP: Mode Fokus Dimulai! Pemblokir notifikasi aktif.',
          ToastAndroid.SHORT
        );
      }

      if (parsed.type === 'CLEAR_HELD_NOTIFICATIONS') {
        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.clearHeldNotifications();
        }
      }

      if (parsed.type === 'STOP_FOCUS') {
        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.setFocusEnabled(false, []);
        }

        ToastAndroid.show(
          'Sistem HP: Sesi Fokus Berakhir. Notifikasi kembali normal.',
          ToastAndroid.SHORT
        );
      }

      if (parsed.type === 'OPEN_NOTIFICATION_SETTINGS') {
        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.openNotificationSettings();
          ToastAndroid.show(
            'Membuka Pengaturan Akses Notifikasi Android...',
            ToastAndroid.SHORT
          );
        } else {
          ToastAndroid.show(
            'Pengaturan Akses Notifikasi hanya didukung di perangkat Android.',
            ToastAndroid.SHORT
          );
        }
      }

      if (parsed.type === 'OPEN_ACCESSIBILITY_SETTINGS') {
        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.openAccessibilitySettings();
          ToastAndroid.show(
            'Membuka Pengaturan Aksesibilitas Android...',
            ToastAndroid.SHORT
          );
        } else {
          ToastAndroid.show(
            'Pengaturan Aksesibilitas hanya didukung di perangkat Android.',
            ToastAndroid.SHORT
          );
        }
      }

      if (parsed.type === 'CHECK_PERMISSIONS') {
        const notifAccess = FocusEnforcement.isNativeAvailable()
          ? FocusEnforcement.isNotificationAccessEnabled()
          : false;
        const accessibility = FocusEnforcement.isNativeAvailable()
          ? FocusEnforcement.isAccessibilityEnabled()
          : false;
        const jsCode = `(function() {
          try {
            window.dispatchEvent(new CustomEvent('NATIVE_PERMISSIONS_STATUS', {
              detail: {
                notificationAccess: ${notifAccess},
                accessibility: ${accessibility}
              }
            }));
          } catch (e) {
            console.error('Error dispatching NATIVE_PERMISSIONS_STATUS:', e);
          }
        })(); true;`;
        webViewRef.current?.injectJavaScript(jsCode);
      }

      if (parsed.type === 'SYNC_HELD_NOTIFICATIONS') {
        const held = FocusEnforcement.isNativeAvailable()
          ? FocusEnforcement.getHeldNotifications()
          : [];
        const jsCode = `(function() {
          try {
            window.dispatchEvent(new CustomEvent('NATIVE_HELD_NOTIFICATIONS_SYNC', {
              detail: ${JSON.stringify(held)}
            }));
          } catch (e) {
            console.error('Error dispatching NATIVE_HELD_NOTIFICATIONS_SYNC:', e);
          }
        })(); true;`;
        webViewRef.current?.injectJavaScript(jsCode);
      }
    } catch (err) {
      console.warn('[WebView Bridge] Gagal memproses pesan dari Web:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView<object>
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          setCanGoBack(navState.canGoBack);
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (isDownloadableFileUrl(request.url)) {
            void Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => {
          try {
            const notifAccess = FocusEnforcement.isNativeAvailable()
              ? FocusEnforcement.isNotificationAccessEnabled()
              : false;
            const accessibility = FocusEnforcement.isNativeAvailable()
              ? FocusEnforcement.isAccessibilityEnabled()
              : false;
            const heldNotifs = FocusEnforcement.isNativeAvailable()
              ? FocusEnforcement.getHeldNotifications()
              : [];
            const jsCode = `(function() {
              try {
                window.dispatchEvent(new CustomEvent('NATIVE_PERMISSIONS_STATUS', {
                  detail: {
                    notificationAccess: ${notifAccess},
                    accessibility: ${accessibility}
                  }
                }));
                ${heldNotifs.map((n) => `window.dispatchEvent(new CustomEvent('NATIVE_NOTIFICATION_BLOCKED', { detail: ${JSON.stringify(n)} }));`).join('\n')}
              } catch (e) {
                console.error('Error in initial bridge sync:', e);
              }
            })(); true;`;
            webViewRef.current?.injectJavaScript(jsCode);
          } catch (err) {
            console.warn('[WebView Bridge] Gagal sync status awal:', err);
          }
        }}
        allowsBackForwardNavigationGestures={true}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4FA', // Warna kanvas klasik Smart Focus
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  webview: {
    flex: 1,
  },
});
