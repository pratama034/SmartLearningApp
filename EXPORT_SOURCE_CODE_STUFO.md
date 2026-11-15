# Source Code & Skema Database Export — Smart Focus -> StuFo (Study & Focus)

> Diekspor langsung dari workspace `c:\LIFE\SmartLearningApp` untuk kebutuhan refactoring dan revisi aplikasi menjadi **StuFo (study & focus)**.

## Catatan Penting Arsitektur & Pemetaan File

1. **Bentuk Proyek Saat Ini (React Web + Expo WebView Hybrid)**:
   - UI utama aplikasi saat ini **bukan** menggunakan Expo Router (`app/(tabs)/*.tsx` / `app/(auth)/*.tsx`), melainkan aplikasi **React + Vite + React Router** di direktori `src/`.
   - Folder `mobile/` adalah shell **React Native / Expo** (`mobile/App.tsx`) yang memuat web app melalui `WebView` serta menghubungkan modul native Android (`FocusEnforcement` untuk pemblokiran notifikasi & overlay).
2. **Pemetaan File yang Diminta vs File Aktual di Workspace**:
   - `app.json` -> tersedia di root `app.json` dan config aktif di `mobile/app.json`
   - Layar Onboarding / Sign In -> `src/components/auth/WelcomeScreen.tsx`, `src/components/WelcomeModal.tsx`, `src/pages/Auth.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`
   - `app/(tabs)/index.tsx` -> `src/pages/Dashboard.tsx` (ditambah `src/pages/StudyBlocks.tsx` sebagai halaman jadwal terpisah saat ini)
   - `app/(tabs)/fokus.tsx` -> `src/pages/FocusMode.tsx`
   - `app/(tabs)/laporan.tsx` -> `src/pages/Reports.tsx`
   - `app/(tabs)/pengaturan.tsx` -> `src/pages/Settings.tsx`
   - Group Chat & Attachment Picker -> `src/pages/CoFocus.tsx` dan `src/components/group/StudyGroupRoom.tsx` (komponen Attachment Picker belum dipisah ke file sendiri, masih terintegrasi di `StudyGroupRoom.tsx`).
3. **Kekurangan / Gap pada Skema Supabase & Tipe Data Saat Ini**:
   - File `types/supabase.ts` hasil generate Supabase CLI **tidak ada** di workspace; tipe data berada di `src/types/index.ts` serta interface lokal di dalam `src/store/*.ts` dan `StudyGroupRoom.tsx`.
   - Tabel `public.group_chat_messages` di `supabase/schema.sql` **belum memiliki kolom status `read`** (seperti `is_read` atau `read_by`); ikon centang dua pada UI chat saat ini masih statis.
   - Tabel `public.study_group_members` di `supabase/schema.sql` **belum memiliki kolom status `mute`** (seperti `is_muted` atau `muted_until`).
   - Tabel `public.focus_sessions` sudah tersedia di `supabase/schema.sql`.

---

## 1. Konfigurasi & Autentikasi

### `app.json`
*Konfigurasi Expo root*

```json
// app.json
{
  "expo": {
    "name": "SmartLearning",
    "slug": "smartlearning-android",
    "version": "1.0.0",
    "platforms": [
      "android",
      "ios"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.smartlearning.app",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "package": "com.smartlearning.app"
    },
    "extra": {
      "eas": {
        "projectId": "636ab629-e490-4ce0-bdf1-9ee810b2b0ea"
      }
    }
  }
}
```

### `mobile/app.json`
*Konfigurasi Expo aktif untuk Android (`Smart Focus`)*

```json
// mobile/app.json
{
  "expo": {
    "name": "Smart Focus",
    "slug": "smartlearning-android",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.jpg",
    "platforms": [
      "android",
      "ios"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.smartlearning.app"
    },
    "android": {
      "package": "com.smartlearning.app",
      "permissions": [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.BIND_ACCESSIBILITY_SERVICE",
        "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
        "android.permission.POST_NOTIFICATIONS"
      ]
    },
    "plugins": [
      "./plugins/withFocusServices",
      "./plugins/withNotificationService"
    ],
    "extra": {
      "eas": {
        "projectId": "636ab629-e490-4ce0-bdf1-9ee810b2b0ea"
      }
    }
  }
}
```

### `mobile/App.tsx`
*Entry point React Native / Expo (saat ini berupa WebView wrapper + bridge native)*

```tsx
// mobile/App.tsx
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
          FocusEnforcement.rebindNotificationListener();
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
        let blockedPackages = Array.isArray(payloadData?.blockedPackages)
          ? payloadData.blockedPackages.filter((pkg): pkg is string => typeof pkg === 'string')
          : [];

        if (blockedPackages.length === 0) {
          blockedPackages = [
            'com.whatsapp',
            'com.whatsapp.w4b',
            'com.instagram.android',
            'com.zhiliaoapp.musically',
            'com.twitter.android',
            'org.telegram.messenger',
            'com.google.android.youtube',
          ];
        }

        if (FocusEnforcement.isNativeAvailable()) {
          // Bersihkan memori notifikasi tertahan dari sesi sebelumnya agar sesi baru dimulai dari 0
          FocusEnforcement.clearHeldNotifications();
          FocusEnforcement.setFocusEnabled(true, blockedPackages);
          FocusEnforcement.rebindNotificationListener();
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

      if (parsed.type === 'OPEN_BATTERY_SETTINGS') {
        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.openBatteryOptimizationSettings();
          ToastAndroid.show(
            'Membuka Pengaturan Baterai / Latar Belakang Android...',
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

        if (FocusEnforcement.isNativeAvailable()) {
          FocusEnforcement.rebindNotificationListener();
        }

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

      if (parsed.type === 'TEST_NOTIFICATION_BLOCK') {
        const testNotification = {
          id: `simulasi-${Date.now()}`,
          packageName: 'com.whatsapp',
          appName: 'WhatsApp',
          title: 'Dosen Pembimbing',
          text: 'Halo, draf skripsi bab 3 kamu sudah saya review. Silakan cek catatan revisinya ya.',
          receivedAt: Date.now(),
        };

        const jsCode = `(function() {
          try {
            window.dispatchEvent(new CustomEvent('NATIVE_NOTIFICATION_BLOCKED', {
              detail: ${JSON.stringify(testNotification)}
            }));
          } catch (e) {
            console.error('Error dispatching TEST_NOTIFICATION_BLOCK:', e);
          }
        })(); true;`;
        webViewRef.current?.injectJavaScript(jsCode);

        ToastAndroid.show(
          'Simulasi Notifikasi WhatsApp berhasil dikirim ke layar Mode Fokus!',
          ToastAndroid.SHORT
        );
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

            if (FocusEnforcement.isNativeAvailable()) {
              FocusEnforcement.rebindNotificationListener();
            }

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
```

### `src/App.tsx`
*Router utama aplikasi Web (React Router)*

```tsx
// src/App.tsx
import { AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen from './components/common/SplashScreen'
import StudyGroupRoom from './components/group/StudyGroupRoom'
import Auth from './pages/Auth'
import CoFocus from './pages/CoFocus'
import Dashboard from './pages/Dashboard'
import FocusMode from './pages/FocusMode'
import Login from './pages/Login'
import Register from './pages/Register'
import Reports from './pages/Reports'
import SessionSummary from './pages/SessionSummary'
import Settings from './pages/Settings'
import StudyBlocks from './pages/StudyBlocks'
import { useAuthStore } from './store/authStore'
import { useStudyStore } from './store/studyStore'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [renderSplash, setRenderSplash] = useState(true)

  const initializeAuth = useAuthStore((state) => state.initializeAuth)
  const isLoading = useAuthStore((state) => state.isLoading)
  const user = useAuthStore((state) => state.user)
  const authError = useAuthStore((state) => state.authError)
  const clearAuthError = useAuthStore((state) => state.clearAuthError)
  const fetchBlocks = useStudyStore((state) => state.fetchBlocks)

  // Timer 1: Sembunyikan splash screen (fade-out) setelah 2000ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [])

  // Timer 2: Hapus splash screen dari DOM setelah animasi fade-out (500ms) tuntas
  useEffect(() => {
    if (!showSplash) {
      const unmountTimer = window.setTimeout(() => {
        setRenderSplash(false)
      }, 500)

      return () => window.clearTimeout(unmountTimer)
    }
  }, [showSplash])

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (user?.id) void fetchBlocks(user.id)
  }, [fetchBlocks, user?.id])

  useEffect(() => {
    if (!authError) return
    const timer = window.setTimeout(() => clearAuthError(), 5000)
    return () => window.clearTimeout(timer)
  }, [authError, clearAuthError])

  if (isLoading && !renderSplash) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4FA] px-4 font-[Montserrat] text-[#1F2C4F]"
      >
        <div className="flex flex-col items-center rounded-2xl border border-[#DFE4F1] bg-white px-8 py-7 shadow-[0_8px_24px_rgba(29,54,104,0.08)]">
          <img
            src="/logo.jpg"
            alt="Logo Smart Focus Akademik"
            className="h-14 w-14 rounded-2xl object-contain shadow-sm border border-[#1D3668]/15"
          />
          <Loader2
            size={28}
            className="mt-4 animate-spin text-[#BE2257]"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-bold text-[#1F2C4F]">Memuat sesi Smart Focus...</p>
          <p className="mt-1 text-xs text-[#56638A]">Menghubungkan ke layanan autentikasi</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Layar Loading Awal Native (Splash Screen) */}
      {renderSplash && <SplashScreen isVisible={showSplash} />}

      <BrowserRouter>
        {/* Global Auth Error Toast/Alert */}
        {authError && (
          <div
            role="alert"
            aria-live="assertive"
            className="fixed right-4 top-4 z-[100] flex max-w-md items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-lg"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-red-700">
                Peringatan Autentikasi
              </p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-red-800">{authError}</p>
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              aria-label="Tutup peringatan"
              className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute />}>
            {/* Standalone Fullscreen Route untuk Ruang Obrolan Co-Focus (Native WhatsApp/Telegram UI) */}
            <Route path="group/:groupId" element={<StudyGroupRoom />} />
            <Route path="cofocus/room" element={<StudyGroupRoom />} />

            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="study-blocks" element={<StudyBlocks />} />
              <Route path="focus" element={<FocusMode />} />
              <Route path="cofocus" element={<CoFocus />} />
              <Route path="co-focus" element={<Navigate to="/cofocus" replace />} />
              <Route path="summary" element={<SessionSummary />} />
              <Route path="reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}
```

### `src/components/Layout.tsx`
*Shell navigasi utama (padanan tab navigator)*

```tsx
// src/components/Layout.tsx
import {
  BarChart3,
  BookOpen,
  Cloud,
  CloudCheck,
  LayoutDashboard,
  LogOut,
  Settings,
  Timer,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { mockUsers } from '../lib/mockData'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'

const navigation: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Study', to: '/study-blocks', icon: BookOpen },
  { label: 'Fokus', to: '/focus', icon: Timer },
  { label: 'Co-focus', to: '/cofocus', icon: UsersRound },
  { label: 'Laporan', to: '/reports', icon: BarChart3 },
  { label: 'Pengaturan', to: '/settings', icon: Settings },
]

function NavigationItems({ mobile = false }: { mobile?: boolean }) {
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const focusStatus = useSessionStore((state) => state.status)
  const hasActiveSession = Boolean(activeBlock && focusStatus !== 'idle')

  return (
    <nav
      aria-label="Navigasi utama"
      className={mobile ? 'flex h-16 items-center justify-around px-1' : 'space-y-1.5'}
    >
      {navigation.map(({ label, to, icon: Icon }) => {
        const isFocus = to === '/focus'

        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => [
              'group relative flex items-center transition-colors duration-150',
              mobile
                ? 'min-h-12 min-w-[44px] flex-col justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold'
                : 'gap-3 rounded-xl px-3 py-3 text-sm font-semibold',
              isActive
                ? 'text-[#1D3668]'
                : 'text-[#56638A] hover:bg-[#F6F7FC] hover:text-[#1D3668]',
              isActive && mobile ? 'bg-[#E1EAF8]' : '',
              isActive && !mobile ? 'bg-[#E1EAF8]' : '',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <span className="relative grid place-items-center">
                  <Icon size={mobile ? 21 : 19} strokeWidth={isActive ? 2.2 : 1.8} />
                  {isFocus && hasActiveSession && (
                    <span className="absolute -right-1 -top-0.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#BE2257] opacity-70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-[#BE2257]" />
                    </span>
                  )}
                </span>
                <span className={mobile ? 'max-w-full truncate' : 'flex-1'}>{label}</span>
                {isFocus && hasActiveSession && !mobile && (
                  <span className="rounded-full bg-[#D6F0DE] px-2 py-0.5 text-[10px] font-bold text-[#17623A]">
                    LIVE
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.jpg"
        alt="Logo Smart Focus Akademik"
        className="h-9 w-9 rounded-xl object-contain shadow-xs border border-[#1D3668]/15"
      />
      <span className="flex flex-col">
        <span className="text-sm font-extrabold leading-4 tracking-tight text-[#1D3668]">Smart Focus</span>
        <span className="mt-0.5 text-[10px] font-bold uppercase leading-3 tracking-[0.08em] text-[#BE2257]">
          Akademik
        </span>
      </span>
    </div>
  )
}

function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return (
      <span
        role="status"
        title="Terhubung ke database Supabase Cloud"
        className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs"
      >
        <CloudCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span className={compact ? 'hidden min-[380px]:inline' : ''}>Tersimpan di Cloud</span>
        {compact && <span className="sr-only min-[380px]:hidden">Tersimpan di Cloud</span>}
      </span>
    )
  }

  return (
    <span
      role="status"
      title="Sesi lokal / offline"
      className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 shadow-2xs"
    >
      <Cloud className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
      <span className={compact ? 'hidden min-[380px]:inline' : ''}>Mode Lokal</span>
      {compact && <span className="sr-only min-[380px]:hidden">Mode Lokal</span>}
    </span>
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const storeUser = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const currentUser = storeUser ?? mockUsers[0]
  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')

  async function handleSidebarLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F3F4FA] font-[Montserrat] text-[#1F2C4F]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#DFE4F1]/70 bg-white/90 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(29,54,104,0.04)] backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <SyncIndicator compact />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label={`Profil ${currentUser.name}`}
              title={`Buka Pengaturan Profil (${currentUser.name})`}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#1D3668] text-[10px] font-bold text-white transition hover:ring-2 hover:ring-[#1D3668]/30"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#DFE4F1] bg-white px-5 py-7 lg:flex">
        <div className="mb-10 px-1"><Brand /></div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
          Menu mahasiswa
        </p>
        <NavigationItems />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          title="Buka Pengaturan Profil"
          className="mt-auto block w-full rounded-2xl border border-[#DFE4F1] bg-[#F6F7FC] p-4 text-left transition hover:border-[#1D3668]/30 hover:bg-[#EEF2FA]"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <UserRound size={18} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#757780]">Edit Profil</span>
          </div>
          <p className="truncate text-sm font-bold text-[#1F2C4F]">{currentUser.name}</p>
          <p className="mt-1 truncate text-xs text-[#56638A]">{currentUser.major || currentUser.program_studi}</p>
          <p className="mt-2.5 truncate text-[10px] font-semibold text-[#757780]">
            {currentUser.university ? `${currentUser.university} · Smart Focus` : 'Mahasiswa · Smart Focus'}
          </p>
        </button>
        <button
          type="button"
          onClick={handleSidebarLogout}
          title="Keluar dari akun aplikasi"
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/80 py-2 px-3 text-xs font-bold text-red-600 transition hover:bg-red-100 hover:text-red-700 active:scale-[0.98]"
        >
          <LogOut size={15} aria-hidden="true" />
          <span>Keluar Akun</span>
        </button>
      </aside>

      <main className="min-h-screen bg-[#F3F4FA] pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] lg:ml-[248px] lg:pb-8 lg:pt-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mb-4 hidden items-center justify-end gap-3 lg:flex">
            <SyncIndicator />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label={`Profil ${currentUser.name}`}
              title={`Buka Pengaturan Profil (${currentUser.name})`}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#1D3668] text-[10px] font-bold text-white transition hover:ring-2 hover:ring-[#1D3668]/30"
            >
              {initials}
            </button>
          </div>
          <Outlet />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DFE4F1] bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(29,54,104,0.05)] backdrop-blur-xl lg:hidden">
        <NavigationItems mobile />
      </div>
    </div>
  )
}
```

### `src/components/auth/WelcomeScreen.tsx`
*Komponen Welcome / Landing Onboarding*

```tsx
// src/components/auth/WelcomeScreen.tsx
import { ArrowRight, BookOpenCheck, Flame, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

export interface WelcomeScreenProps {
  onNavigate: (view: 'login' | 'register') => void
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#E1EAF8]/80 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#FCDDE6]/50 blur-3xl" />

      <section className="relative z-10 w-full max-w-[480px] rounded-3xl border border-[#DFE4F1] bg-white p-7 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_12px_32px_rgba(29,54,104,0.06)] sm:p-9">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <img
              src="/logo.jpg"
              alt="Logo Smart Focus Akademik"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain shadow-lg shadow-[#1D3668]/20 border border-[#1D3668]/15"
            />
            <span
              className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#BE2257] text-[10px] text-white ring-2 ring-white shadow-sm"
              aria-hidden="true"
            >
              <Sparkles size={11} />
            </span>
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#BE2257]">
            Smart Focus Akademik
          </p>

          <h1 className="mt-2 text-[26px] font-extrabold leading-8 tracking-tight text-[#1F2C4F] sm:text-[30px] sm:leading-9">
            Selamat Datang di Smart Focus
          </h1>

          <p className="mt-3 text-xs leading-relaxed text-[#56638A] sm:text-sm">
            Pendamping digital cerdas untuk menyusun jadwal belajar terstruktur, menjaga fokus bebas distraksi, dan kolaborasi ruang co-focus bersama mahasiswa.
          </p>
        </div>

        {/* Feature Highlights / Value Props */}
        <div className="mt-6 space-y-2.5 rounded-2xl border border-[#DFE4F1]/80 bg-[#F6F7FC] p-4 text-xs">
          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
              <BookOpenCheck size={15} />
            </span>
            <span className="font-semibold">Time-Blocking & Mode Fokus Pomodoro</span>
          </div>

          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#FCDDE6] text-[#BE2257]">
              <UsersRound size={15} />
            </span>
            <span className="font-semibold">Ruang Belajar Co-Focus & Realtime Diskusi</span>
          </div>

          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-600">
              <Flame size={15} className="fill-orange-500" />
            </span>
            <span className="font-semibold">Pelacakan Streak Belajar & Gamifikasi Harian</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="mt-8 space-y-3.5">
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1D3668] px-6 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition-all hover:bg-[#162B54] active:scale-[0.98]"
          >
            <span>Daftar Sekarang</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>

          <p className="text-center text-xs text-[#56638A]">
            Sudah punya akun?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="font-bold text-[#BE2257] transition hover:underline focus:outline-none focus:ring-1 focus:ring-[#BE2257]"
            >
              Masuk
            </button>
          </p>
        </div>

        {/* Trust Badge */}
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-[#DFE4F1] pt-4 text-[11px] text-[#757780]">
          <ShieldCheck size={14} className="text-[#1D3668]" />
          <span>Keamanan & Autentikasi didukung Supabase Cloud</span>
        </div>
      </section>
    </main>
  )
}
```

### `src/components/WelcomeModal.tsx`
*Modal onboarding 3 langkah di Dashboard*

```tsx
// src/components/WelcomeModal.tsx
import { ArrowRight, CalendarDays, Sparkles, Timer, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface WelcomeModalProps {
  userName?: string
  onClose: () => void
}

const features: { icon: LucideIcon; title: string; description: string; tone: string }[] = [
  {
    icon: CalendarDays,
    title: 'Atur Jadwal',
    description: 'Pecah tugas besar menjadi study block kecil yang terjadwal rapi.',
    tone: 'bg-[#E1EAF8] text-[#1D3668]',
  },
  {
    icon: Timer,
    title: 'Mode Fokus Bebas Distraksi',
    description: 'Timer fokus yang menahan notifikasi pengganggu sampai sesi selesai.',
    tone: 'bg-[#FCDDE6] text-[#BE2257]',
  },
  {
    icon: UsersRound,
    title: 'Co-Focus bersama Teman',
    description: 'Gabung ruang belajar pakai kode 6 karakter, maksimal 10 orang.',
    tone: 'bg-[#D6F0DE] text-[#17623A]',
  },
]

export default function WelcomeModal({ userName, onClose }: WelcomeModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    primaryButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const firstName = userName?.split(' ')[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        aria-describedby="welcome-modal-desc"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white shadow-[0_16px_40px_rgba(29,54,104,0.18)]"
      >
        <div className="relative overflow-hidden bg-[#1D3668] px-6 pb-6 pt-7 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#BE2257]/40 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <img
              src="/logo.jpg"
              alt="Logo Smart Focus Akademik"
              className="h-12 w-12 rounded-xl object-contain border border-white/20 shadow-md"
            />
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80">
              <Sparkles size={16} aria-hidden="true" />
            </span>
          </div>
          <h2 id="welcome-modal-title" className="relative mt-4 text-[22px] font-extrabold leading-7 tracking-tight">
            Selamat Datang di Smart Focus!
          </h2>
          <p id="welcome-modal-desc" className="relative mt-1.5 text-[13px] leading-[19px] text-white/80">
            {firstName ? `Hai ${firstName}, ` : ''}berikut tiga hal yang bisa kamu lakukan untuk belajar lebih fokus.
          </p>
        </div>

        <ol className="space-y-3 px-6 py-5">
          {features.map(({ icon: Icon, title, description, tone }, index) => (
            <li key={title} className="flex items-start gap-3 rounded-xl border border-[#DFE4F1] bg-[#F3F4FA]/60 p-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1F2C4F]">
                  {index + 1}. {title}
                </p>
                <p className="mt-0.5 text-xs leading-[18px] text-[#56638A]">{description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-[#DFE4F1] px-6 py-4">
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
          >
            Mulai Belajar
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### `src/pages/Auth.tsx`
*Layar Welcome, Login, & Register terpadu*

```tsx
// src/pages/Auth.tsx
import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import WelcomeScreen from '../components/auth/WelcomeScreen'
import { useAuthStore } from '../store/authStore'

export type AuthView = 'welcome' | 'login' | 'register'

interface AuthProps {
  initialView?: AuthView
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.'),
  password: z.string().min(1, 'Sandi wajib diisi.'),
})

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama lengkap wajib diisi.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi.')
    .email('Format email tidak valid.')
    .refine((val) => val.endsWith('@gmail.com'), {
      message: 'Harap gunakan akun @gmail.com yang aktif',
    }),
  password: z.string().min(6, 'Sandi minimal 6 karakter.'),
})

export default function Auth({ initialView = 'welcome' }: AuthProps) {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const authError = useAuthStore((state) => state.authError)
  const clearAuthError = useAuthStore((state) => state.clearAuthError)

  const [currentView, setCurrentView] = useState<AuthView>(initialView)

  // Google OAuth state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function handleGoogleAuth() {
    clearAuthError()
    setRegisterFormError('')
    setLoginFormError('')
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.'
      if (currentView === 'register') {
        setRegisterFormError(msg)
      } else {
        setLoginFormError(msg)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginFormError, setLoginFormError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Register form state
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [registerFormError, setRegisterFormError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  // Email verification sent state
  const [isEmailSentSuccess, setIsEmailSentSuccess] = useState(false)
  const [sentToEmail, setSentToEmail] = useState('')

  function handleNavigate(view: AuthView) {
    clearAuthError()
    setLoginFormError('')
    setRegisterFormError('')
    setCurrentView(view)
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginFormError('')
    clearAuthError()

    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    })

    if (!validation.success) {
      setLoginFormError(validation.error.issues[0]?.message ?? 'Lengkapi email dan sandi.')
      return
    }

    setIsLoggingIn(true)
    try {
      await login(validation.data.email, validation.data.password)
      navigate('/', { replace: true })
    } catch (error) {
      setLoginFormError(error instanceof Error ? error.message : 'Login gagal. Silakan coba lagi.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRegisterFormError('')
    clearAuthError()

    const cleanEmail = registerEmail.trim()
    const cleanName = registerName.trim()

    // 1. Validasi frontend alamat Gmail
    if (!cleanEmail.endsWith('@gmail.com')) {
      setRegisterFormError('Harap gunakan akun @gmail.com yang aktif')
      return
    }

    const validation = registerSchema.safeParse({
      name: cleanName,
      email: cleanEmail,
      password: registerPassword,
    })

    if (!validation.success) {
      setRegisterFormError(validation.error.issues[0]?.message ?? 'Lengkapi data pendaftaran.')
      return
    }

    setIsRegistering(true)
    try {
      const result = await register(cleanEmail, registerPassword, cleanName)

      // 2. Tangkap respon registrasi sukses
      if (result === 'check_email') {
        setSentToEmail(cleanEmail)
        setIsEmailSentSuccess(true)
      }
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.'
      const rawLower = rawMsg.toLowerCase()
      const isRateLimit =
        rawLower.includes('rate limit') ||
        rawLower.includes('rate_limit') ||
        rawLower.includes('429') ||
        rawLower.includes('too many') ||
        rawLower.includes('security purposes') ||
        rawLower.includes('over_email_send_rate_limit') ||
        rawLower.includes('over_request_rate_limit') ||
        rawLower.includes('sedang padat')

      const friendlyMsg = isRateLimit
        ? "Sistem pendaftaran sedang padat. Silakan gunakan tombol 'Login dengan Google' atau coba beberapa saat lagi."
        : rawMsg

      setRegisterFormError(friendlyMsg)
    } finally {
      setIsRegistering(false)
    }
  }

  // View A: Halaman Selamat Datang (Welcome Screen)
  if (currentView === 'welcome') {
    return <WelcomeScreen onNavigate={(view) => handleNavigate(view)} />
  }

  // View B & C: Tampilan Formulir Login atau Register
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#E1EAF8]/80 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#FCDDE6]/50 blur-3xl" />

      <section className="relative z-10 w-full max-w-[460px] rounded-3xl border border-[#DFE4F1] bg-white p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_12px_32px_rgba(29,54,104,0.06)] sm:p-8">
        {/* Tombol Navigasi Kembali ke Welcome Screen */}
        <button
          type="button"
          onClick={() => handleNavigate('welcome')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
          aria-label="Kembali ke halaman utama"
        >
          <ArrowLeft size={15} />
          <span>Kembali</span>
        </button>

        {/* ========================================================================= */}
        {/* SUB-VIEW 1: TAMPILAN EMAIL VERIFIKASI TERKIRIM                           */}
        {/* ========================================================================= */}
        {currentView === 'register' && isEmailSentSuccess ? (
          <div className="mt-4 flex flex-col items-center text-center">
            {/* Ikon Amplop / Email */}
            <div className="relative">
              <span className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
                <MailCheck size={32} />
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#1D3668] text-white ring-2 ring-white">
                <Sparkles size={13} />
              </span>
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
              Konfirmasi Akun Baru
            </p>
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-7 text-[#1F2C4F] sm:text-[24px]">
              Verifikasi Email Terkirim
            </h1>

            {/* Kotak Informasi & Peringatan Gmail */}
            <div className="mt-4 w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left text-xs leading-relaxed text-amber-950">
              <p className="font-semibold text-[#1D3668]">
                Kami telah mengirimkan tautan aktivasi ke:
              </p>
              <p className="mt-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-bold text-[#BE2257] border border-amber-200/80 shadow-2xs">
                {sentToEmail}
              </p>
              <p className="mt-2 text-[#56638A]">
                Silakan cek kotak masuk <strong>Gmail</strong> Anda (atau periksa folder <em>Spam / Promosi</em> jika belum muncul) dan klik tautan konfirmasi untuk mengaktifkan akun.
              </p>
            </div>

            {/* Panduan Langkah Ringkas */}
            <ul className="mt-4 w-full space-y-2 text-left text-xs text-[#56638A]">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Buka aplikasi Gmail atau kunjungi <strong>mail.google.com</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Klik tautan <strong>Confirm your email</strong> di pesan dari Smart Focus.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Kembali ke halaman ini dan masuk dengan akun Anda.</span>
              </li>
            </ul>

            {/* Tombol Tindakan */}
            <div className="mt-6 w-full space-y-2.5">
              <button
                type="button"
                onClick={() => window.open('https://mail.google.com', '_blank', 'noopener,noreferrer')}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1D3668] px-4 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] active:scale-[0.98]"
              >
                <span>Buka Gmail Sekarang</span>
                <ExternalLink size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEmailSentSuccess(false)
                  handleNavigate('login')
                }}
                className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
              >
                Sudah Verifikasi? Masuk ke Akun
              </button>
            </div>

            <p className="mt-4 text-[11px] text-[#757780]">
              Salah mengetik email?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsEmailSentSuccess(false)
                  setRegisterFormError('')
                }}
                className="font-bold text-[#BE2257] underline hover:text-[#A11B48]"
              >
                Daftar ulang dengan email lain
              </button>
            </p>
          </div>
        ) : currentView === 'register' ? (
          /* ========================================================================= */
          /* SUB-VIEW 2: FORM PENDAFTARAN (REGISTER)                                  */
          /* ========================================================================= */
          <div>
            <div className="mt-2 flex flex-col items-center text-center">
              <img
                src="/logo.jpg"
                alt="Logo Smart Focus Akademik"
                className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-[#1D3668]/20 border border-[#1D3668]/15"
              />
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
                Smart Focus Akademik
              </p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-8 text-[#1F2C4F]">
                Buat Akun Baru
              </h1>
              <p className="mt-1.5 text-xs text-[#56638A]">
                Wajib gunakan akun <strong>@gmail.com</strong> yang aktif untuk menerima tautan verifikasi.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleRegisterSubmit} noValidate>
              {/* Field: Nama Lengkap */}
              <div>
                <label htmlFor="reg-name" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <UserRound
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Field: Email (@gmail.com) */}
              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Alamat Email (Wajib Gmail)
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="contoh: nama.mahasiswa@gmail.com"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#56638A]">
                  * Pastikan domain berakhiran <strong>@gmail.com</strong>
                </p>
              </div>

              {/* Field: Sandi */}
              <div>
                <label htmlFor="reg-pass" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Kata Sandi
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-pass"
                    type={showRegisterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-11 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                    aria-label={showRegisterPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showRegisterPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {(registerFormError || authError) && (() => {
                const currentError = registerFormError || authError || ''
                const isRateLimitAlert =
                  currentError.toLowerCase().includes('rate limit') ||
                  currentError.includes('Login dengan Google') ||
                  currentError.includes('padat')

                return (
                  <div
                    role="alert"
                    className={`rounded-xl border p-3.5 text-xs transition-all ${
                      isRateLimitAlert
                        ? 'border-amber-300 bg-amber-50 text-amber-950 shadow-sm'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle
                        size={18}
                        className={`mt-0.5 shrink-0 ${
                          isRateLimitAlert ? 'text-amber-600' : 'text-red-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1 leading-relaxed">
                        <p className="font-semibold">{currentError}</p>
                        {isRateLimitAlert && (
                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={() => void handleGoogleAuth()}
                              disabled={isGoogleLoading}
                              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#1F2C4F] border border-amber-300 shadow-xs hover:bg-amber-100/50 transition active:scale-95 disabled:opacity-60"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>{isGoogleLoading ? 'Menghubungkan...' : 'Login dengan Google'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Tombol Submit Daftar */}
              <button
                type="submit"
                disabled={isRegistering}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRegistering ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Mendaftarkan akun...</span>
                  </>
                ) : (
                  <span>Daftar Sekarang</span>
                )}
              </button>

              {/* Opsi Login Alternatif dengan Google */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-[#DFE4F1]" />
                <span className="absolute bg-white px-2 text-[11px] font-semibold text-[#56638A]">
                  atau
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isGoogleLoading || isRegistering}
                className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] shadow-2xs transition hover:bg-[#F6F7FC] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isGoogleLoading ? 'Menghubungkan ke Google...' : 'Login dengan Google'}</span>
              </button>

              <p className="text-center text-xs text-[#56638A]">
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => handleNavigate('login')}
                  className="font-bold text-[#BE2257] hover:underline"
                >
                  Masuk di sini
                </button>
              </p>
            </form>
          </div>
        ) : (
          /* ========================================================================= */
          /* SUB-VIEW 3: FORM LOGIN                                                   */
          /* ========================================================================= */
          <div>
            <div className="mt-2 flex flex-col items-center text-center">
              <img
                src="/logo.jpg"
                alt="Logo Smart Focus Akademik"
                className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-[#1D3668]/20 border border-[#1D3668]/15"
              />
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
                Smart Focus Akademik
              </p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-8 text-[#1F2C4F]">
                Masuk ke Akun Anda
              </h1>
              <p className="mt-1.5 text-xs text-[#56638A]">
                Kelola jadwal belajar dan lanjutkan sesi fokusmu.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit} noValidate>
              {/* Field: Email */}
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Alamat Email Gmail
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama.mahasiswa@gmail.com"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Field: Sandi */}
              <div>
                <label htmlFor="login-pass" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Kata Sandi
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-pass"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan sandi Anda"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-11 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                    aria-label={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {(loginFormError || authError) && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-medium text-red-700"
                >
                  {loginFormError || authError}
                </div>
              )}

              {/* Tombol Masuk */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Memverifikasi akun...</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </button>

              {/* Opsi Login Alternatif dengan Google */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-[#DFE4F1]" />
                <span className="absolute bg-white px-2 text-[11px] font-semibold text-[#56638A]">
                  atau
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isGoogleLoading || isLoggingIn}
                className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] shadow-2xs transition hover:bg-[#F6F7FC] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isGoogleLoading ? 'Menghubungkan ke Google...' : 'Login dengan Google'}</span>
              </button>

              <p className="text-center text-xs text-[#56638A]">
                Belum memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => handleNavigate('register')}
                  className="font-bold text-[#1D3668] hover:text-[#BE2257]"
                >
                  Daftar sekarang
                </button>
              </p>
            </form>
          </div>
        )}

        {/* Micro-trust footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-[#DFE4F1] pt-4 text-[11px] text-[#757780]">
          <ShieldCheck size={14} className="text-[#1D3668]" />
          <span>Keamanan akun dienkripsi dengan standar Supabase Auth</span>
        </div>
      </section>
    </main>
  )
}
```

### `src/pages/Login.tsx`
*Wrapper rute /login*

```tsx
// src/pages/Login.tsx
import { useSearchParams } from 'react-router-dom'
import Auth, { type AuthView } from './Auth'

interface LoginProps {
  initialView?: AuthView
}

export default function Login({ initialView }: LoginProps) {
  const [searchParams] = useSearchParams()
  const viewFromQuery = searchParams.get('view') as AuthView | null

  const resolvedView: AuthView =
    initialView ||
    (viewFromQuery && ['welcome', 'login', 'register'].includes(viewFromQuery)
      ? viewFromQuery
      : 'welcome')

  return <Auth initialView={resolvedView} />
}
```

### `src/pages/Register.tsx`
*Wrapper rute /register*

```tsx
// src/pages/Register.tsx
import Auth from './Auth'

export default function Register() {
  return <Auth initialView="register" />
}
```

---

## 2. Layar Utama (Padanan app/(tabs)/*)

### `src/pages/Dashboard.tsx`
*Padanan `app/(tabs)/index.tsx` — Dashboard utama saat ini*

```tsx
// src/pages/Dashboard.tsx
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Lightbulb,
  Loader2,
  Medal,
  Play,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  mockGroupMembers,
  mockSessions,
  mockUsers,
} from '../lib/mockData'
import { supabase } from '../lib/supabase'
import { evaluateStreak, formatLastStudyDateLabel } from '../lib/streak'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import WelcomeModal from '../components/WelcomeModal'
import { useSessionStore, type FocusStatus } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'
import type { StudyBlock } from '../types'

const defaultTimeZone = 'Asia/Jakarta'

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: defaultTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat('id-ID', {
      timeZone: defaultTimeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  )

  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function getDisplayDate() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: defaultTimeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function formatTime(time: string) {
  return time.replace(':', '.')
}

type BlockStatus = 'active' | 'paused' | 'scheduled' | 'completed'

function getBlockStatus(block: StudyBlock, activeBlock: StudyBlock | null, focusStatus: FocusStatus): BlockStatus {
  if (activeBlock?.id === block.id) return focusStatus === 'paused' ? 'paused' : 'active'
  if (block.status === 'completed') return 'completed'
  return 'scheduled'
}

function StatTile({
  icon: Icon,
  tone,
  eyebrow,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  tone: 'blue' | 'rose' | 'green' | 'navy'
  eyebrow: string
  label: string
  value: number
  detail: string
}) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
    green: 'bg-[#D6F0DE] text-[#17623A]',
    navy: 'bg-[#E2E7FF] text-[#1D3668]',
  }
  const eyebrowTone = {
    blue: 'text-[#757780]',
    rose: 'text-[#8E1744]',
    green: 'text-[#17623A]',
    navy: 'text-[#1D3668]',
  }

  return (
    <article className="flex min-h-[124px] flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <div className="mb-2 flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${eyebrowTone[tone]}`}>
          {eyebrow}
        </span>
      </div>
      <div>
        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#757780]">{label}</span>
        <div className="mt-0.5 text-2xl font-extrabold leading-[30px] tabular-nums tracking-tight text-[#1F2C4F]">
          {value}
        </div>
        <span className="mt-0.5 block truncate text-[12px] leading-[18px] text-[#56638A]">{detail}</span>
      </div>
    </article>
  )
}

function StudyBlockCard({
  block,
  status,
  anotherSessionActive,
  onStart,
  onOpen,
}: {
  block: StudyBlock
  status: BlockStatus
  anotherSessionActive: boolean
  onStart: (block: StudyBlock) => void
  onOpen: () => void
}) {
  const isActive = status === 'active'
  const isPaused = status === 'paused'
  const isCompleted = status === 'completed'
  const statusText = isActive
    ? 'Aktif Sekarang'
    : isPaused
      ? 'Dijeda'
      : isCompleted
        ? 'Selesai'
        : 'Terjadwal'
  const statusStyle = isActive
    ? 'bg-[#D6F0DE] text-[#17623A]'
    : isPaused
      ? 'bg-[#FDEBC8] text-[#7A4B00]'
      : isCompleted
        ? 'bg-[#F6F7FC] text-[#56638A]'
        : 'bg-[#E1EAF8] text-[#1D3668]'

  return (
    <article className="relative flex flex-col space-y-2.5 overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      {isActive && <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-[#1D3668]" />}
      <div className={`flex items-center justify-between gap-3 ${isActive ? 'pl-1' : ''}`}>
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${isActive ? 'text-[#1D3668]' : 'text-[#757780]'}`}>
          {block.type}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>
          {(isActive || isPaused) && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'animate-pulse bg-[#17623A]' : 'bg-[#7A4B00]'}`} />}
          {statusText}
        </span>
      </div>

      <div className={isActive ? 'pl-1' : ''}>
        <h3 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">{block.title}</h3>
        <div className="mt-1 flex items-start gap-1.5 text-[13px] leading-[18px] text-[#56638A]">
          <Clock3 size={15} className="mt-0.5 shrink-0 text-[#757780]" />
          <span className="min-w-0">{formatTime(block.start_time)} – {formatTime(block.end_time)} · {block.description}</span>
        </div>
        {block.co_focus_enabled && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
            <UsersRound size={14} /> Co-focus aktif
          </span>
        )}
      </div>

      <div className={isActive ? 'pl-1 pt-1' : 'pt-1'}>
        {isActive || isPaused ? (
          <button
            type="button"
            onClick={onOpen}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          >
            {isPaused ? 'Lanjutkan Sesi Fokus' : 'Buka Sesi Fokus Aktif'}
            <ArrowRight size={17} />
          </button>
        ) : isCompleted ? (
          <button
            type="button"
            disabled
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#F6F7FC] px-4 text-sm font-semibold text-[#56638A] disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={16} /> Sesi selesai
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStart(block)}
            disabled={anotherSessionActive}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition-transform hover:bg-[#A11B48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mulai Mode Fokus <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>
    </article>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding)
  const setHasSeenOnboarding = useAuthStore((state) => state.setHasSeenOnboarding)
  const currentUser = authUser ?? mockUsers[0]
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false)
  const streakEvaluation = evaluateStreak(currentUser.streak ?? 0, currentUser.lastStudyDate)
  const blocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const isLoadingBlocks = useStudyStore((state) => state.isLoading)
  const studyError = useStudyStore((state) => state.error)
  const clearStudyError = useStudyStore((state) => state.clearError)
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const focusStatus = useSessionStore((state) => state.status)
  const startSession = useSessionStore((state) => state.startSession)
  const heldNotifications = useSessionStore((state) => state.heldNotifications)
  const lastSessionSummary = useSessionStore((state) => state.lastSessionSummary)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const today = getTodayDate()

  // State Realtime untuk angka Dashboard ("Ditunda" & "Rekan Sedang Fokus")
  const [livePeerTotalCount, setLivePeerTotalCount] = useState(0)
  const [liveFocusedPeers, setLiveFocusedPeers] = useState<
    Array<{ id: string; name: string; course: string }>
  >([])
  const [rekanSedangFokus, setRekanSedangFokus] = useState(0)
  const [pendingTasksCount, setPendingTasksCount] = useState(0)

  useEffect(() => {
    const uid = authUser?.id
    if (!uid) return

    let isMounted = true

    async function syncDashboardRealtimeStats() {
      try {
        // 1. Hitung jumlah sub-tugas yang belum selesai ("Ditunda")
        const { count: taskCount } = await supabase
          .from('study_block_sub_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_completed', false)

        if (isMounted && typeof taskCount === 'number') {
          setPendingTasksCount(taskCount)
        }

        // 2. Ambil daftar rekan satu grup dan siapa yang berstatus 'fokus'
        const { data: myMemberships } = await supabase
          .from('study_group_members')
          .select('group_id')
          .eq('user_id', uid)

        const myGroupIds = (myMemberships || []).map((m: { group_id: string }) => m.group_id)
        if (myGroupIds.length === 0) {
          if (isMounted) {
            setLivePeerTotalCount(0)
            setLiveFocusedPeers([])
            setRekanSedangFokus(0)
          }
          return
        }

        const { data: peerRows } = await supabase
          .from('study_group_members')
          .select('user_id, status, course')
          .in('group_id', myGroupIds)
          .neq('user_id', uid)

        const uniquePeersMap = new Map<string, { status: string; course: string }>()
        for (const row of (peerRows as Array<{ user_id: string; status: string; course: string | null }>) || []) {
          const prev = uniquePeersMap.get(row.user_id)
          if (!prev || row.status === 'fokus') {
            uniquePeersMap.set(row.user_id, {
              status: row.status,
              course: row.course || 'Mahasiswa',
            })
          }
        }

        if (isMounted) {
          setLivePeerTotalCount(uniquePeersMap.size)
        }

        const focusedUserIds = Array.from(uniquePeersMap.entries())
          .filter(([, info]) => info.status === 'fokus')
          .map(([peerId]) => peerId)

        if (isMounted) {
          setRekanSedangFokus(focusedUserIds.length)
        }

        if (focusedUserIds.length === 0) {
          if (isMounted) {
            setLiveFocusedPeers([])
            setRekanSedangFokus(0)
          }
          return
        }

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, major')
          .in('id', focusedUserIds)

        const profileMap = new Map(
          ((profilesData as Array<{ id: string; name: string | null; major: string | null }>) || []).map(
            (p) => [p.id, p]
          )
        )

        const focusedList = focusedUserIds.map((peerId) => {
          const prof = profileMap.get(peerId)
          const memberInfo = uniquePeersMap.get(peerId)
          return {
            id: peerId,
            name: prof?.name || 'Rekan Kelompok',
            course: prof?.major || memberInfo?.course || 'Mahasiswa',
          }
        })

        if (isMounted) {
          setLiveFocusedPeers(focusedList)
          setRekanSedangFokus(focusedList.length)
        }
      } catch (err) {
        console.warn('[Dashboard Realtime] Gagal menyinkronkan statistik live:', err)
      }
    }

    void fetchStudyBlocks(uid)
    void fetchMyGroups(uid)
    void syncDashboardRealtimeStats()

    // Subscribe ke channel Supabase Realtime untuk update angka Dashboard otomatis
    const dashboardChannel = supabase
      .channel(`dashboard-live-stats:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_group_members' },
        (payload) => {
          // Tangani event UPDATE secara instan
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedRow = payload.new as {
              id?: string
              user_id?: string
              group_id?: string
              status?: string
              course?: string | null
            }
            const peerUserId = updatedRow.user_id
            if (peerUserId && peerUserId !== uid) {
              setLiveFocusedPeers((prev) => {
                let next = [...prev]
                if (updatedRow.status === 'fokus') {
                  if (!next.some((p) => p.id === peerUserId)) {
                    next.push({
                      id: peerUserId,
                      name: 'Rekan Kelompok',
                      course: updatedRow.course || 'Mahasiswa',
                    })
                  }
                } else {
                  next = next.filter((p) => p.id !== peerUserId)
                }
                setRekanSedangFokus(next.length)
                return next
              })
            }
          }
          // Re-calculate menyeluruh dari database Supabase
          void syncDashboardRealtimeStats()
          void fetchMyGroups(uid)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_block_sub_tasks' },
        () => {
          void syncDashboardRealtimeStats()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_blocks', filter: `user_id=eq.${uid}` },
        () => {
          void fetchStudyBlocks(uid)
          void syncDashboardRealtimeStats()
        }
      )
      .on('broadcast', { event: 'dashboard_update' }, () => {
        void syncDashboardRealtimeStats()
      })
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(dashboardChannel)
    }
  }, [authUser?.id, fetchStudyBlocks, fetchMyGroups])

  // Dengarkan event notifikasi yang dicegat secara realtime dari Native Android WebView
  useEffect(() => {
    function handleNewBlockedNotif(event: Event) {
      const customEvent = event as CustomEvent<{
        id?: string
        packageName?: string
        appName?: string
        title?: string
        text?: string
        receivedAt?: number | string
      }>
      const detail = customEvent.detail
      if (!detail) return

      const title = detail.title || 'Tidak Diketahui'
      const text = detail.text || ''
      const appName =
        detail.appName ||
        (detail.packageName ? detail.packageName.substring(detail.packageName.lastIndexOf('.') + 1) : 'Aplikasi')
      const formattedReceivedAt =
        typeof detail.receivedAt === 'number'
          ? new Date(detail.receivedAt).toISOString()
          : detail.receivedAt || new Date().toISOString()

      useSessionStore.getState().addHeldNotification({
        id: detail.id || globalThis.crypto?.randomUUID?.() || `notif-${Date.now()}`,
        title,
        text,
        appName,
        packageName: detail.packageName,
        receivedAt: formattedReceivedAt,
      })
    }

    window.addEventListener('NATIVE_NOTIFICATION_BLOCKED', handleNewBlockedNotif)

    function handleSyncNotifs(event: Event) {
      const customEvent = event as CustomEvent<Array<{
        id?: string
        packageName?: string
        appName?: string
        title?: string
        text?: string
        receivedAt?: number | string
      }>>
      const list = customEvent.detail
      if (!Array.isArray(list)) return

      const currentHeld = useSessionStore.getState().heldNotifications
      const existingIds = new Set(currentHeld.map((n) => n.id))

      list.forEach((item) => {
        const id = item.id || `notif-${item.receivedAt}-${item.packageName}`
        if (!existingIds.has(id)) {
          existingIds.add(id)
          const title = item.title || 'Tidak Diketahui'
          const text = item.text || ''
          const appName =
            item.appName ||
            (item.packageName ? item.packageName.substring(item.packageName.lastIndexOf('.') + 1) : 'Aplikasi')
          const formattedReceivedAt =
            typeof item.receivedAt === 'number'
              ? new Date(item.receivedAt).toISOString()
              : item.receivedAt || new Date().toISOString()

          useSessionStore.getState().addHeldNotification({
            id,
            title,
            text,
            appName,
            packageName: item.packageName,
            receivedAt: formattedReceivedAt,
          })
        }
      })
    }

    window.addEventListener('NATIVE_HELD_NOTIFICATIONS_SYNC', handleSyncNotifs)

    // Trigger sync awal saat Dashboard dimuat
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'SYNC_HELD_NOTIFICATIONS' })
      )
    }

    return () => {
      window.removeEventListener('NATIVE_NOTIFICATION_BLOCKED', handleNewBlockedNotif)
      window.removeEventListener('NATIVE_HELD_NOTIFICATIONS_SYNC', handleSyncNotifs)
    }
  }, [])

  const todayBlocks = blocks
    .filter((block) => block.date === today)
    .sort((a, b) => (a.startTime ?? a.start_time).localeCompare(b.startTime ?? b.start_time))
  const userGroupIds = new Set(
    mockGroupMembers.filter((member) => member.user_id === currentUser.id).map((member) => member.group_id),
  )
  const mockCoFocusFriendIds = new Set(
    mockGroupMembers
      .filter((member) => userGroupIds.has(member.group_id) && member.user_id !== currentUser.id)
      .map((member) => member.user_id),
  )
  const mockFocusedFriends = mockSessions
    .filter((session) => session.status === 'active' && mockCoFocusFriendIds.has(session.user_id))
    .map((session) => mockUsers.find((user) => user.id === session.user_id))
    .filter((user): user is (typeof mockUsers)[number] => Boolean(user))

  const totalCoFocusPeers = authUser?.id ? livePeerTotalCount : mockCoFocusFriendIds.size
  const focusedFriends = authUser?.id
    ? liveFocusedPeers
    : mockFocusedFriends.map((u) => ({ id: u.id, name: u.name, course: u.program_studi || 'Mahasiswa' }))
  const effectiveFocusedCount = authUser?.id ? rekanSedangFokus : focusedFriends.length

  const heldNotificationCount =
    heldNotifications.length > 0
      ? heldNotifications.length
      : (lastSessionSummary?.heldNotifications?.length ?? 0)
  const activeCount = todayBlocks.filter((block) => {
    const status = getBlockStatus(block, activeBlock, focusStatus)
    return status === 'active' || status === 'paused'
  }).length
  const scheduledCount = todayBlocks.filter((block) => getBlockStatus(block, activeBlock, focusStatus) === 'scheduled').length
  const focusTarget = activeBlock
    ? todayBlocks.find((block) => block.id === activeBlock.id)
    : todayBlocks.find((block) => getBlockStatus(block, activeBlock, focusStatus) === 'scheduled')

  function openFocus() {
    navigate('/focus')
  }

  function beginFocus(block: StudyBlock) {
    if (activeBlock) {
      if (activeBlock.id === block.id) openFocus()
      return
    }
    startSession(block)
    openFocus()
  }

  function handleMainAction() {
    if (activeBlock) {
      openFocus()
      return
    }
    if (focusTarget) {
      beginFocus(focusTarget)
      return
    }
    navigate('/study-blocks')
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {!hasSeenOnboarding && (
        <WelcomeModal userName={currentUser.name} onClose={setHasSeenOnboarding} />
      )}
      {studyError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={19} className="shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-xs font-bold sm:text-sm">{studyError}</p>
          </div>
          <button
            type="button"
            onClick={clearStudyError}
            aria-label="Tutup peringatan jadwal"
            className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Notifikasi Status Streak Belajar */}
      {!isStreakBannerDismissed && streakEvaluation.status === 'pending_today' && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
              <Flame size={20} className="fill-amber-500 text-amber-500" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="mt-0.5 text-xs text-amber-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-amber-700 transition hover:bg-amber-200/60 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {!isStreakBannerDismissed && streakEvaluation.status === 'broken' && (streakEvaluation.diffDays ?? 0) > 1 && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/90 p-4 text-blue-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
              <AlertCircle size={20} className="text-blue-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="mt-0.5 text-xs text-blue-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-blue-700 transition hover:bg-blue-100 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {!isStreakBannerDismissed && streakEvaluation.status === 'active_today' && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-emerald-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="text-xs text-emerald-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-emerald-700 transition hover:bg-emerald-100 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-[#E1EAF8]/70 blur-xl" />
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
              {getDisplayDate()}
            </span>
            {/* Widget Streak Api Realtime */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold shadow-2xs transition-all ${
                streakEvaluation.status === 'active_today'
                  ? 'border border-orange-300 bg-orange-50 text-orange-700'
                  : streakEvaluation.status === 'pending_today'
                    ? 'border border-amber-300 bg-amber-50 text-amber-800 animate-pulse'
                    : 'border border-slate-200 bg-slate-100 text-slate-600'
              }`}
              title={`Terakhir belajar: ${formatLastStudyDateLabel(currentUser.lastStudyDate)}`}
            >
              <Flame
                size={15}
                className={
                  streakEvaluation.status === 'active_today'
                    ? 'fill-orange-500 text-orange-500'
                    : streakEvaluation.status === 'pending_today'
                      ? 'fill-amber-500 text-amber-500'
                      : 'text-slate-400'
                }
                aria-hidden="true"
              />
              <span>
                {streakEvaluation.status === 'active_today'
                  ? `${streakEvaluation.currentStreak} Hari Beruntun! (Selesai)`
                  : streakEvaluation.status === 'pending_today'
                    ? `${streakEvaluation.currentStreak} Hari (Perlu Sesi)`
                    : '0 Hari (Mulai Hari Ini)'}
              </span>
            </div>
          </div>
          <h1 className="text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
            {getGreeting()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-[13px] leading-[19px] text-[#44464F]">
            Pantau fokus belajarmu dan kelola study block hari ini.
          </p>

          {/* Baris Badge Medali */}
          {(currentUser.badges?.length ?? 0) > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {currentUser.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-xs font-bold text-amber-800"
                >
                  <Medal size={14} className="text-amber-500" aria-hidden="true" />
                  <span>{badge}</span>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleMainAction}
            className="mt-2 flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition-transform hover:bg-[#A11B48] active:scale-[0.98]"
          >
            <span>{activeBlock ? 'Buka Sesi Fokus Aktif' : 'Mulai Mode Fokus Sekarang'}</span>
            {activeBlock ? <ArrowRight size={17} /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>
      </section>

      <section aria-label="Ringkasan hari ini" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile
          icon={CalendarDays}
          tone="blue"
          eyebrow="Blok"
          label="Study Block"
          value={todayBlocks.length}
          detail={`${activeCount} aktif, ${scheduledCount} terjadwal`}
        />
        <StatTile
          icon={Bell}
          tone="rose"
          eyebrow="Notif"
          label="Ditunda"
          value={heldNotificationCount}
          detail={activeBlock ? 'Sesi yang berjalan' : pendingTasksCount > 0 ? `${pendingTasksCount} tugas aktif` : 'Sesi terakhir'}
        />
        <StatTile
          icon={ShieldCheck}
          tone="green"
          eyebrow="Lolos"
          label="Penting"
          value={0}
          detail="Tetap masuk"
        />
        <StatTile
          icon={UsersRound}
          tone="navy"
          eyebrow="Live"
          label="Co-focus"
          value={totalCoFocusPeers}
          detail={`${effectiveFocusedCount} sedang fokus`}
        />
      </section>

      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Study Block Hari Ini</h2>
            <button
              type="button"
              onClick={() => navigate('/study-blocks')}
              className="text-xs font-semibold text-[#1D3668] transition-colors hover:text-[#BE2257]"
            >
              Lihat semua
            </button>
          </div>

          {isLoadingBlocks ? (
            <div role="status" aria-live="polite" className="space-y-3.5">
              <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#DFE4F1] bg-white px-5 py-5 text-xs font-semibold text-[#1D3668] shadow-[0_2px_4px_rgba(29,54,104,0.03)] sm:text-sm">
                <Loader2 size={18} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span>Mengambil jadwal hari ini dari Supabase Cloud...</span>
              </div>
              {[1, 2].map((skeletonId) => (
                <div
                  key={skeletonId}
                  className="animate-pulse space-y-3 rounded-2xl border border-[#DFE4F1] bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-[#E1EAF8]" />
                    <div className="h-5 w-20 rounded-full bg-[#EEF1F8]" />
                  </div>
                  <div className="h-6 w-3/4 rounded-lg bg-[#EEF1F8]" />
                  <div className="h-4 w-1/2 rounded-lg bg-[#F6F7FC]" />
                  <div className="h-11 w-full rounded-[10px] bg-[#EEF1F8]" />
                </div>
              ))}
            </div>
          ) : todayBlocks.length ? (
            <div className="space-y-3.5">
              {todayBlocks.map((block) => (
                <StudyBlockCard
                  key={block.id}
                  block={block}
                  status={getBlockStatus(block, activeBlock, focusStatus)}
                  anotherSessionActive={Boolean(activeBlock && activeBlock.id !== block.id)}
                  onStart={beginFocus}
                  onOpen={openFocus}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white px-5 py-8 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                <CalendarDays size={19} />
              </span>
              <h3 className="mt-3 text-sm font-bold text-[#1F2C4F]">Belum ada study block hari ini</h3>
              <p className="mt-1 text-xs leading-[18px] text-[#56638A]">Jadwal belajar untuk {getDisplayDate()} akan muncul di sini.</p>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {effectiveFocusedCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#17623A] opacity-70" />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${effectiveFocusedCount ? 'bg-[#17623A]' : 'bg-[#C4C6D0]'}`} />
                </span>
                <h2 className="text-base font-bold leading-[22px] text-[#1F2C4F]">Rekan Sedang Fokus</h2>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#757780]">
                {effectiveFocusedCount} aktif
              </span>
            </div>

            {focusedFriends.length ? (
              focusedFriends.map((friend, index) => {
                const initials =
                  friend.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'RK'
                const session = mockSessions.find((item) => item.user_id === friend.id && item.status === 'active')
                const block = session ? blocks.find((item) => item.id === session.block_id) : undefined

                return (
                  <div key={friend.id} className="flex items-start gap-3 rounded-xl bg-[#F6F7FC] p-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${index % 2 ? 'bg-[#BE2257]' : 'bg-[#1D3668]'}`}>
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-[18px] text-[#1F2C4F]">
                        <strong className="font-semibold">{friend.name}</strong> sedang fokus{block ? ` pada ${block.title}` : ''}.
                      </p>
                      <span className="mt-1 block text-xs font-semibold text-[#BE2257]">
                        Mode Fokus aktif · {friend.course || 'Mahasiswa'}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl bg-[#F6F7FC] p-3 text-[13px] leading-[19px] text-[#56638A]">
                Belum ada rekan di kelompokmu yang sedang fokus.
              </div>
            )}

            <button
              type="button"
              disabled={effectiveFocusedCount === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#E1EAF8] text-sm font-bold text-[#1D3668] transition-colors hover:bg-[#D7E4F6] active:bg-[#1D3668] active:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UsersRound size={17} />
              {effectiveFocusedCount ? 'Kirim Sapaan Hening' : 'Belum ada rekan aktif'}
            </button>
          </section>

          <section className="space-y-2.5 rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.06)]">
            <div className="flex items-center gap-2">
              <Lightbulb size={19} />
              <h2 className="text-base font-bold leading-[22px]">Prinsip Smart Focus</h2>
            </div>
            <ul className="space-y-2 pt-1 text-[13px] leading-[18px] text-[#5E3F0C]/95">
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Notifikasi disaring otomatis saat jadwal belajar tiba</span></li>
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Teman tahu kamu sedang fokus tanpa merasa diabaikan</span></li>
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Kontak darurat dan akademik selalu bisa menghubungimu</span></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
```

### `src/pages/StudyBlocks.tsx`
*Halaman Jadwal Belajar saat ini (untuk referensi pemindahan ke Dashboard)*

```tsx
// src/pages/StudyBlocks.tsx
import {
  AlertCircle,
  CalendarX,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { getStudyDate } from '../data/mockData'
import { useAuthStore } from '../store/authStore'
import { useStudyStore } from '../store/studyStore'
import type { StudyBlockType } from '../types'

const blockTypes = ['Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian'] as const

const studyBlockSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi.'),
  type: z.enum(blockTypes),
  startTime: z.string().min(1, 'Waktu mulai wajib diisi.'),
  endTime: z.string().min(1, 'Waktu selesai wajib diisi.'),
})

const typeStyles: Record<StudyBlockType, string> = {
  'Jadwal kuliah': 'bg-[#E1EAF8] text-[#1D3668]',
  'Belajar mandiri': 'bg-[#D6F0DE] text-[#17623A]',
  'Kerja kelompok': 'bg-[#FCDDE6] text-[#8E1744]',
  'Persiapan ujian': 'bg-[#FDEBC8] text-[#7A4B00]',
}

function displayTime(value: string) {
  return value.replace(':', '.')
}

export default function StudyBlocks() {
  const user = useAuthStore((state) => state.user)
  const studyBlocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const addStudyBlock = useStudyStore((state) => state.addStudyBlock)
  const deleteStudyBlock = useStudyStore((state) => state.deleteStudyBlock)
  const isLoading = useStudyStore((state) => state.isLoading)
  const storeError = useStudyStore((state) => state.error)
  const clearError = useStudyStore((state) => state.clearError)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<StudyBlockType>('Belajar mandiri')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>([])
  const [newSubTaskText, setNewSubTaskText] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (user?.id) {
      void fetchStudyBlocks(user.id)
    }
  }, [fetchStudyBlocks, user?.id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function closeModal() {
    setIsModalOpen(false)
    setFormError('')
    setNewSubTaskText('')
  }

  function handleAddSubTaskInput() {
    const trimmed = newSubTaskText.trim()
    if (!trimmed) return
    setSubTaskInputs((prev) => [...prev, trimmed])
    setNewSubTaskText('')
  }

  function handleRemoveSubTaskInput(index: number) {
    setSubTaskInputs((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const validation = studyBlockSchema.safeParse({ title, type, startTime, endTime })

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Lengkapi data jadwal.')
      return
    }

    setIsSubmitting(true)
    try {
      const pendingSubTasks = [
        ...subTaskInputs,
        ...(newSubTaskText.trim() ? [newSubTaskText.trim()] : []),
      ].map((taskTitle) => ({ title: taskTitle, isCompleted: false }))

      await addStudyBlock({
        userId: user?.id,
        title: validation.data.title,
        type: validation.data.type,
        startTime: validation.data.startTime,
        endTime: validation.data.endTime,
        start_time: validation.data.startTime,
        end_time: validation.data.endTime,
        description: description.trim(),
        recurrenceRule: null,
        recurrence_rule: null,
        date: getStudyDate(),
        autoFocus: false,
        auto_focus: false,
        coFocusEnabled: false,
        co_focus_enabled: false,
        subTasks: pendingSubTasks,
      })

      setTitle('')
      setDescription('')
      setType('Belajar mandiri')
      setStartTime('')
      setEndTime('')
      setSubTaskInputs([])
      setNewSubTaskText('')
      closeModal()
      setToast({ type: 'success', message: 'Jadwal belajar berhasil disimpan ke Supabase.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan jadwal belajar.'
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string, blockTitle: string) {
    try {
      await deleteStudyBlock(id)
      setToast({ type: 'success', message: `Jadwal "${blockTitle}" berhasil dihapus.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus jadwal belajar.'
      setToast({ type: 'error', message: msg })
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toast Alert */}
      {(toast || storeError) && (
        <div
          role="alert"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 shadow-md transition-all ${
            toast?.type === 'success' && !storeError
              ? 'border-[#17623A]/20 bg-[#D6F0DE] text-[#17623A]'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast?.type === 'success' && !storeError ? (
              <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            )}
            <p className="text-sm font-bold">{storeError || toast?.message}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setToast(null)
              clearError()
            }}
            aria-label="Tutup notifikasi"
            className="rounded-lg p-1 text-xs font-semibold hover:bg-black/5"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
            Perencanaan belajar
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
            Study Block
          </h1>
          <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
            Susun waktu belajar agar sesi fokusmu lebih terarah dan tersinkronisasi di cloud.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={18} strokeWidth={2.4} />
          Tambah Jadwal
        </button>
      </section>

      <section aria-labelledby="study-block-list-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 id="study-block-list-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
            Jadwal tersimpan
          </h2>
          <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
            {studyBlocks.length} jadwal
          </span>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#DFE4F1] bg-white px-5 py-6 text-sm font-semibold text-[#1D3668] shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
              <Loader2 size={20} className="animate-spin text-[#BE2257]" aria-hidden="true" />
              <span>Mengambil jadwal belajar dari Supabase Cloud...</span>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex min-h-[196px] animate-pulse flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5"
                >
                  <div className="h-6 w-28 rounded-full bg-[#E1EAF8]" />
                  <div className="mt-4 h-6 w-3/4 rounded-lg bg-[#EEF1F8]" />
                  <div className="mt-2 h-4 w-full rounded-lg bg-[#F6F7FC]" />
                  <div className="mt-auto h-5 w-36 rounded-lg bg-[#EEF1F8]" />
                </div>
              ))}
            </div>
          </div>
        ) : studyBlocks.length ? (
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {studyBlocks.map((block) => {
              const startVal = block.startTime ?? block.start_time
              const endVal = block.endTime ?? block.end_time
              const subTaskCount = block.subTasks?.length ?? 0
              const completedCount = block.subTasks?.filter((t) => t.isCompleted).length ?? 0

              return (
                <article
                  key={block.id}
                  className="flex min-h-[196px] flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeStyles[block.type]}`}
                    >
                      {block.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(block.id, block.title)}
                      aria-label={`Hapus jadwal ${block.title}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#FCDDE6] text-[#8E1744] transition hover:bg-[#FCDDE6] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <h3 className="mt-4 text-[18px] font-bold leading-6 text-[#1F2C4F]">
                    {block.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-[#56638A]">
                    {block.description || 'Tidak ada catatan tambahan.'}
                  </p>
                  {subTaskCount > 0 && (
                    <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#F6F7FC] px-2.5 py-1 text-xs font-semibold text-[#56638A]">
                      <CheckSquare size={14} className="text-[#1D3668]" aria-hidden="true" />
                      <span>
                        {completedCount}/{subTaskCount} sub-tugas selesai
                      </span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-2 border-t border-[#DFE4F1] pt-4 text-[13px] font-semibold text-[#1D3668]">
                    <Clock3 size={16} aria-hidden="true" />
                    <span className="tabular-nums">
                      {displayTime(startVal)} - {displayTime(endVal)}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:py-14">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-[#F3F4FA]">
              <CalendarX
                className="h-16 w-16 text-[#1D3668]/30"
                strokeWidth={1.4}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#1F2C4F]">
              Belum ada jadwal hari ini
            </h3>
            <p className="mt-1.5 max-w-sm text-[13px] leading-[19px] text-[#56638A]">
              Pecah tugas besarmu menjadi blok-blok waktu kecil agar lebih fokus.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              Buat Jadwal Pertama
            </button>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-study-block-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_16px_32px_rgba(29,54,104,0.12)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
                  Jadwal baru
                </p>
                <h2
                  id="add-study-block-title"
                  className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F]"
                >
                  Tambah Study Block
                </h2>
                <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
                  Tentukan kegiatan dan waktu fokus belajarmu.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
                aria-label="Tutup formulir tambah jadwal"
              >
                ×
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="block-title"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Judul
                </label>
                <input
                  id="block-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Belajar untuk UTS"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div>
                <label
                  htmlFor="block-description"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Deskripsi singkat (opsional)
                </label>
                <input
                  id="block-description"
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contoh: Rangkum bab 1-3 dan latihan soal"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div>
                <label
                  htmlFor="block-type"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Jenis kegiatan
                </label>
                <select
                  id="block-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as StudyBlockType)}
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                >
                  {blockTypes.map((blockType) => (
                    <option key={blockType} value={blockType}>
                      {blockType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="block-start-time"
                    className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                  >
                    Waktu mulai
                  </label>
                  <input
                    id="block-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="block-end-time"
                    className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                  >
                    Waktu selesai
                  </label>
                  <input
                    id="block-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Sub-tasks / Checklist opsional */}
              <div>
                <label
                  htmlFor="block-subtask-input"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Target Sub-Tugas / Checklist (opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="block-subtask-input"
                    type="text"
                    value={newSubTaskText}
                    onChange={(e) => setNewSubTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSubTaskInput()
                      }
                    }}
                    placeholder="Tambah langkah kecil lalu klik +"
                    className="h-10 flex-1 rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubTaskInput}
                    className="flex h-10 items-center justify-center rounded-[10px] bg-[#E1EAF8] px-3.5 text-xs font-bold text-[#1D3668] transition hover:bg-[#D2E0F5]"
                  >
                    + Tambah
                  </button>
                </div>

                {subTaskInputs.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {subTaskInputs.map((item, idx) => (
                      <li
                        key={`${item}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1.5 text-xs font-medium text-[#1F2C4F]"
                      >
                        <span className="truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubTaskInput(idx)}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Hapus sub-tugas ${item}`}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-sm font-medium text-[#BA1A1A]">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="h-11 rounded-[10px] border border-[#DFE4F1] px-4 text-sm font-semibold text-[#1D3668] transition hover:bg-[#F6F7FC] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition hover:bg-[#152A55] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

### `src/pages/FocusMode.tsx`
*Padanan `app/(tabs)/fokus.tsx` — Halaman Mode Fokus*

```tsx
// src/pages/FocusMode.tsx
import { AlertCircle, CheckCircle2, CheckSquare, Clock3, Pause, Play, Square, X } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudyDate } from '../data/mockData'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'

function todayDate() {
  return getStudyDate()
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function FocusMode() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const blocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const toggleSubTask = useStudyStore((state) => state.toggleSubTask)
  const studyError = useStudyStore((state) => state.error)
  const clearStudyError = useStudyStore((state) => state.clearError)
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const status = useSessionStore((state) => state.status)
  const remainingTime = useSessionStore((state) => state.remainingTime)
  const startSession = useSessionStore((state) => state.startSession)
  const pauseSession = useSessionStore((state) => state.pauseSession)
  const resumeSession = useSessionStore((state) => state.resumeSession)
  const stopFocus = useSessionStore((state) => state.stopFocus)
  const heldNotifications = useSessionStore((state) => state.heldNotifications)
  const addHeldNotification = useSessionStore((state) => state.addHeldNotification)
  const tick = useSessionStore((state) => state.tick)

  useEffect(() => {
    if (user?.id) {
      void fetchStudyBlocks(user.id)
    }
  }, [fetchStudyBlocks, user?.id])

  useEffect(() => {
    if (status !== 'running') return

    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [status, tick])

  useEffect(() => {
    if (status === 'running' && remainingTime === 0) {
      void stopFocus()
      navigate('/summary', { replace: true })
    }
  }, [stopFocus, navigate, remainingTime, status])

  function finishSession() {
    void stopFocus()
    navigate('/summary')
  }

  // Tangkap event notifikasi native yang diblokir secara realtime
  useEffect(() => {
    function handleNewBlockedNotif(event: Event) {
      const customEvent = event as CustomEvent<{
        id?: string
        packageName?: string
        appName?: string
        title?: string
        text?: string
        receivedAt?: number | string
      }>
      const detail = customEvent.detail
      if (!detail) return

      const title = detail.title || 'Tidak Diketahui'
      const text = detail.text || ''
      const appName =
        detail.appName ||
        (detail.packageName ? detail.packageName.substring(detail.packageName.lastIndexOf('.') + 1) : 'Aplikasi')
      const formattedReceivedAt =
        typeof detail.receivedAt === 'number'
          ? new Date(detail.receivedAt).toISOString()
          : detail.receivedAt || new Date().toISOString()

      addHeldNotification({
        id: detail.id || globalThis.crypto?.randomUUID?.() || `notif-${Date.now()}`,
        title,
        text,
        appName,
        packageName: detail.packageName,
        receivedAt: formattedReceivedAt,
      })
    }

    window.addEventListener('NATIVE_NOTIFICATION_BLOCKED', handleNewBlockedNotif)
    return () => {
      window.removeEventListener('NATIVE_NOTIFICATION_BLOCKED', handleNewBlockedNotif)
    }
  }, [addHeldNotification])

  // Sinkronisasi berkala dari memori HP Android (SharedPreferences) selama sesi berjalan
  useEffect(() => {
    if (status !== 'running') return

    const triggerSync = () => {
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'SYNC_HELD_NOTIFICATIONS' })
        )
      }
    }

    triggerSync()
    const interval = setInterval(triggerSync, 1200)

    function handleSyncNotifs(event: Event) {
      const customEvent = event as CustomEvent<Array<{
        id?: string
        packageName?: string
        appName?: string
        title?: string
        text?: string
        receivedAt?: number | string
      }>>
      const list = customEvent.detail
      if (!Array.isArray(list)) return

      const currentHeld = useSessionStore.getState().heldNotifications
      const existingIds = new Set(currentHeld.map((n) => n.id))

      list.forEach((item) => {
        const id = item.id || `notif-${item.receivedAt}-${item.packageName}`
        if (!existingIds.has(id)) {
          existingIds.add(id)
          const title = item.title || 'Tidak Diketahui'
          const text = item.text || ''
          const appName =
            item.appName ||
            (item.packageName ? item.packageName.substring(item.packageName.lastIndexOf('.') + 1) : 'Aplikasi')
          const formattedReceivedAt =
            typeof item.receivedAt === 'number'
              ? new Date(item.receivedAt).toISOString()
              : item.receivedAt || new Date().toISOString()

          addHeldNotification({
            id,
            title,
            text,
            appName,
            packageName: item.packageName,
            receivedAt: formattedReceivedAt,
          })
        }
      })
    }

    window.addEventListener('NATIVE_HELD_NOTIFICATIONS_SYNC', handleSyncNotifs)
    return () => {
      clearInterval(interval)
      window.removeEventListener('NATIVE_HELD_NOTIFICATIONS_SYNC', handleSyncNotifs)
    }
  }, [status, addHeldNotification])

  const todayBlocks = blocks
    .filter((block) => block.date === todayDate())
    .sort((first, second) => first.start_time.localeCompare(second.start_time))

  if (status === 'idle') {
    return (
      <div className="space-y-5 sm:space-y-6">
        <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Mode Fokus</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Tidak ada sesi fokus yang aktif.</h1>
          <p className="mt-2 text-[13px] leading-[19px] text-[#56638A]">Pilih salah satu jadwal hari ini untuk memulai sesi fokus.</p>
        </section>

        <section aria-labelledby="available-blocks-title">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 id="available-blocks-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Jadwal hari ini</h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">{todayBlocks.length} jadwal</span>
          </div>

          {todayBlocks.length ? (
            <div className="grid gap-3.5 md:grid-cols-2">
              {todayBlocks.map((block) => {
                const isCompleted = block.status === 'completed'
                return (
                  <article key={block.id} className="flex flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1D3668]">{block.type}</span>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D6F0DE] px-2.5 py-0.5 text-[11px] font-semibold text-[#17623A]">
                          <CheckCircle2 size={12} /> Selesai
                        </span>
                      )}
                    </div>
                    <h3 className={`mt-2 text-[18px] font-bold leading-6 ${isCompleted ? 'text-gray-400 line-through' : 'text-[#1F2C4F]'}`}>{block.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#56638A]"><Clock3 size={15} aria-hidden="true" /> {block.start_time.replace(':', '.')} - {block.end_time.replace(':', '.')}</p>
                    {isCompleted ? (
                      <button
                        type="button"
                        disabled
                        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#F6F7FC] px-4 text-sm font-semibold text-[#56638A] cursor-not-allowed border border-[#DFE4F1]"
                      >
                        <CheckCircle2 size={16} /> Sesi Telah Selesai
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startSession(block)}
                        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2"
                      >
                        <Play size={17} fill="currentColor" aria-hidden="true" /> Mulai Fokus
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white p-8 text-center text-sm leading-5 text-[#56638A]">
              Belum ada Study Block untuk hari ini. Tambahkan jadwal dari menu Study terlebih dahulu.
            </div>
          )}
        </section>
      </div>
    )
  }

  const isPaused = status === 'paused'
  const currentBlock = blocks.find((b) => b.id === activeBlock?.id) ?? activeBlock
  const subTasks = currentBlock?.subTasks ?? []
  const completedSubTasksCount = subTasks.filter((t) => t.isCompleted).length

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.75fr)] xl:items-start">
      <div className="space-y-5">
        {studyError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={19} className="shrink-0 text-red-600" aria-hidden="true" />
              <p className="text-xs font-bold sm:text-sm">{studyError}</p>
            </div>
            <button
              type="button"
              onClick={clearStudyError}
              aria-label="Tutup peringatan"
              className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-[18px] bg-[#1D3668] p-6 text-white shadow-[0_8px_16px_rgba(29,54,104,0.14)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CC3FF]">{isPaused ? 'Sesi dijeda' : 'Sesi fokus berjalan'}</p>
          <h1 className="mt-2 text-[24px] font-extrabold leading-8 tracking-tight sm:text-[30px]">{currentBlock?.title ?? 'Sesi fokus'}</h1>
          <p className="mt-2 text-sm leading-5 text-[#D9E2FF]">{currentBlock?.type}</p>
          <div className="my-8 flex justify-center">
            <div className="flex h-52 w-52 items-center justify-center rounded-full border-4 border-white/20 bg-white/5 shadow-inner sm:h-60 sm:w-60">
              <div
                className="text-center font-mono text-[48px] font-extrabold leading-none tracking-[-0.05em] tabular-nums sm:text-[64px]"
                aria-label={`Sisa waktu ${formatRemainingTime(remainingTime)}`}
              >
                {formatRemainingTime(remainingTime)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={isPaused ? resumeSession : pauseSession}
              className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-white px-4 text-sm font-bold text-[#1D3668] transition hover:bg-[#E1EAF8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1D3668]"
            >
              {isPaused ? <Play size={18} fill="currentColor" aria-hidden="true" /> : <Pause size={18} fill="currentColor" aria-hidden="true" />}
              {isPaused ? 'Lanjutkan' : 'Jeda'}
            </button>
            <button
              type="button"
              onClick={finishSession}
              className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#FFB1C0] px-4 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1D3668]"
            >
              <Square size={17} fill="currentColor" aria-hidden="true" /> Akhiri Sesi
            </button>
          </div>
        </section>

        {/* Sub-Tasks Checklist */}
        {currentBlock && subTasks.length > 0 && (
          <section
            aria-labelledby="focus-subtasks-title"
            className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                  <CheckSquare size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="focus-subtasks-title" className="text-[16px] font-bold leading-5 text-[#1F2C4F]">
                    Checklist Target Sesi
                  </h2>
                  <p className="mt-0.5 text-xs text-[#56638A]">
                    Centang sub-tugas yang sudah kamu selesaikan selama sesi ini.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-xs font-bold text-[#1D3668]">
                {completedSubTasksCount}/{subTasks.length} Selesai
              </span>
            </div>

            <ul className="space-y-2.5">
              {subTasks.map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-3.5 transition hover:border-[#1D3668]/30 hover:bg-[#EEF2FA]">
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      onChange={() =>
                        void toggleSubTask(currentBlock.id, task.id, !task.isCompleted).catch(
                          () => undefined
                        )
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#C4C6D0] text-[#1D3668] accent-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                    />
                    <span
                      className={`text-sm font-semibold transition ${
                        task.isCompleted ? 'line-through text-gray-400' : 'text-[#1F2C4F]'
                      }`}
                    >
                      {task.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Notifikasi yang Ditunda</h2>
          <span className="rounded-full bg-[#FCDDE6] px-2.5 py-1 text-[11px] font-semibold text-[#8E1744]">{heldNotifications.length} held</span>
        </div>
        <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Notifikasi non-penting akan muncul di sini selama sesi fokus berjalan.</p>
        <div className="mt-5 space-y-2.5">
          {heldNotifications.length ? heldNotifications.map((notification) => {
            const displayTitle = notification.title || notification.appName || 'Notifikasi Masuk'
            const displayText = notification.text.startsWith(displayTitle + ': ')
              ? notification.text.slice(displayTitle.length + 2)
              : notification.text

            return (
              <article key={notification.id} className="rounded-xl border border-[#FCDDE6] bg-[#FFF7F8] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold leading-[18px] text-[#1F2C4F]">
                    {displayTitle}
                  </span>
                  {notification.appName && (
                    <span className="rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                      {notification.appName}
                    </span>
                  )}
                </div>
                {displayText && (
                  <p className="mt-1 text-[12px] font-medium leading-[17px] text-[#56638A]">
                    {displayText}
                  </p>
                )}
                <time className="mt-1.5 block text-[11px] text-[#8E1744]" dateTime={notification.receivedAt}>
                  Ditunda pada {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(notification.receivedAt))}
                </time>
              </article>
            )
          }) : (
            <div className="rounded-xl bg-[#F6F7FC] p-4 text-sm leading-5 text-[#56638A]">Belum ada notifikasi yang ditunda.</div>
          )}
        </div>
      </aside>
    </div>
  )
}
```

### `src/pages/Reports.tsx`
*Padanan `app/(tabs)/laporan.tsx` — Halaman Laporan / Analitik*

```tsx
// src/pages/Reports.tsx
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  Building2,
  Clock3,
  Loader2,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

type ReportTab = 'personal' | 'campus'

interface FocusSessionRow {
  id: string
  user_id: string
  actual_duration?: number | null
  duration_seconds?: number | null
  target_duration?: number | null
  completion_status?: string | null
  status?: string | null
  started_at?: string | null
  created_at?: string | null
}

interface CampusProfileRow {
  id: string
  name: string | null
  university: string | null
  major: string | null
  is_private_profile: boolean | null
}

interface CampusRpcRow {
  campus_name: string
  total_focus_seconds: number
  total_sessions: number
  student_count: number
}

interface DailyFocusPoint {
  day: string
  focusMinutes: number
}

interface CampusComparisonPoint {
  campus: string
  shortName: string
  totalMinutes: number
  avgMinutesPerStudent: number
  studentCount: number
  sessionCount: number
}

const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function shortenCampusName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 18) return trimmed
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    const acronym = words.map((w) => w[0]?.toUpperCase() || '').join('')
    return `${acronym} (${words[words.length - 1].slice(0, 10)})`
  }
  return `${trimmed.slice(0, 15)}...`
}

function FocusChart({ data, color }: { data: DailyFocusPoint[]; color: string }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik batang durasi fokus per hari">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#56638A', fontSize: 12, fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#757780', fontSize: 12 }}
            unit="m"
          />
          <Tooltip
            cursor={{ fill: '#F6F7FC' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #DFE4F1',
              boxShadow: '0 8px 16px rgba(29,54,104,0.08)',
            }}
            formatter={(value) => [`${value} menit`, 'Waktu fokus']}
          />
          <Bar dataKey="focusMinutes" fill={color} radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CampusComparisonChart({ data }: { data: CampusComparisonPoint[] }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik komparasi total fokus per entitas kampus">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="shortName"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#56638A', fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#757780', fontSize: 12 }}
            unit="m"
          />
          <Tooltip
            cursor={{ fill: '#F6F7FC' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #DFE4F1',
              boxShadow: '0 8px 16px rgba(29,54,104,0.08)',
            }}
            formatter={(value, _name, item) => {
              const payload = item?.payload as CampusComparisonPoint | undefined
              const label = payload ? `${payload.campus} (${payload.studentCount} mhs)` : 'Total fokus kampus'
              return [`${value} menit`, label]
            }}
          />
          <Bar dataKey="totalMinutes" fill="#BE2257" radius={[8, 8, 0, 0]} maxBarSize={52} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Clock3
  label: string
  value: string
  detail: string
  tone: 'blue' | 'green' | 'rose'
}) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    green: 'bg-[#D6F0DE] text-[#17623A]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
  }

  return (
    <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F2C4F]">{value}</p>
      <p className="mt-1 text-[12px] leading-[18px] text-[#56638A]">{detail}</p>
    </article>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const [activeTab, setActiveTab] = useState<ReportTab>('personal')
  const [sessions, setSessions] = useState<FocusSessionRow[]>([])
  const [campusData, setCampusData] = useState<CampusComparisonPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCampus, setIsLoadingCampus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserSessions() {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (fetchError) {
          throw fetchError
        }

        setSessions((data as FocusSessionRow[] | null) ?? [])
      } catch (err) {
        console.error('SUPABASE ERROR (fetch focus_sessions):', err)
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat fokus.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadUserSessions()
  }, [user?.id])

  // Agregasi Komparasi Kampus (SUM durasi_fokus di-group berdasarkan entitas kampus)
  useEffect(() => {
    async function loadCampusComparison() {
      setIsLoadingCampus(true)
      try {
        // 1. Coba panggil Supabase RPC agregasi kampus terlebih dahulu
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_campus_focus_stats')

        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const mappedRpc: CampusComparisonPoint[] = (rpcData as CampusRpcRow[]).map((row) => {
            const totalMins = Math.max(1, Math.round(Number(row.total_focus_seconds || 0) / 60))
            const students = Math.max(1, Number(row.student_count || 1))
            const campusName = row.campus_name || 'Kampus Umum'
            return {
              campus: campusName,
              shortName: shortenCampusName(campusName),
              totalMinutes: totalMins,
              avgMinutesPerStudent: Math.round(totalMins / students),
              studentCount: students,
              sessionCount: Number(row.total_sessions || 1),
            }
          })
          setCampusData(mappedRpc.sort((a, b) => b.totalMinutes - a.totalMinutes))
          return
        }

        // 2. Fallback Query Agregasi langsung: SUM(actual_duration) di-group berdasarkan university dari profiles
        const [{ data: profilesRows }, { data: allSessionRows }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, name, university, major, is_private_profile'),
          supabase
            .from('focus_sessions')
            .select('id, user_id, actual_duration, duration_seconds, started_at, created_at'),
        ])

        const profileList = (profilesRows as CampusProfileRow[] | null) ?? []
        const sessionList = (allSessionRows as FocusSessionRow[] | null) ?? []

        // Petakan user_id -> university (hanya profil publik atau user sendiri)
        const userCampusMap = new Map<string, string>()
        const campusStudentSet = new Map<string, Set<string>>()

        for (const p of profileList) {
          if (p.is_private_profile && p.id !== user?.id) continue
          const uni = (p.university || 'Universitas Indonesia').trim()
          userCampusMap.set(p.id, uni)
          if (!campusStudentSet.has(uni)) {
            campusStudentSet.set(uni, new Set())
          }
          campusStudentSet.get(uni)?.add(p.id)
        }

        // Pastikan kampus user saat ini terdaftar
        const currentUserUni = (user?.university || 'Universitas Indonesia').trim()
        if (user?.id) {
          userCampusMap.set(user.id, currentUserUni)
          if (!campusStudentSet.has(currentUserUni)) {
            campusStudentSet.set(currentUserUni, new Set())
          }
          campusStudentSet.get(currentUserUni)?.add(user.id)
        }

        // Gabungkan sesi yang terambil dengan sesi pribadi jika RLS membatasi pembacaan sesi user lain
        const combinedSessions =
          sessionList.length > 0
            ? sessionList
            : sessions

        const campusTotals = new Map<
          string,
          { totalSeconds: number; sessionCount: number; activeUsers: Set<string> }
        >()

        for (const s of combinedSessions) {
          const campusName = userCampusMap.get(s.user_id) || currentUserUni
          const durationSec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
          const existing = campusTotals.get(campusName) ?? {
            totalSeconds: 0,
            sessionCount: 0,
            activeUsers: new Set<string>(),
          }
          existing.totalSeconds += durationSec
          existing.sessionCount += 1
          existing.activeUsers.add(s.user_id)
          campusTotals.set(campusName, existing)
        }

        // Masukkan semua kampus yang ada di profiles meskipun belum ada sesi (atau baseline agregat)
        for (const [uni, studentIds] of campusStudentSet.entries()) {
          if (!campusTotals.has(uni)) {
            campusTotals.set(uni, {
              totalSeconds: 0,
              sessionCount: 0,
              activeUsers: studentIds,
            })
          }
        }

        const aggregated: CampusComparisonPoint[] = Array.from(campusTotals.entries()).map(
          ([campusName, stats]) => {
            const totalMins = Math.round(stats.totalSeconds / 60)
            const registeredCount = campusStudentSet.get(campusName)?.size ?? 0
            const studentCount = Math.max(registeredCount, stats.activeUsers.size, 1)
            return {
              campus: campusName,
              shortName: shortenCampusName(campusName),
              totalMinutes: totalMins,
              avgMinutesPerStudent: Math.round(totalMins / studentCount),
              studentCount,
              sessionCount: stats.sessionCount,
            }
          }
        )

        aggregated.sort((a, b) => b.totalMinutes - a.totalMinutes)
        setCampusData(aggregated)
      } catch (err) {
        console.error('SUPABASE ERROR (loadCampusComparison):', err)
      } finally {
        setIsLoadingCampus(false)
      }
    }

    void loadCampusComparison()
  }, [user?.id, user?.university, sessions])

  // Logika Agregasi Data Pribadi
  const { totalMinutes, totalSessions, averageMinutes, dailyChartData } = useMemo(() => {
    let totalSecs = 0
    const dayTotals: Record<string, number> = {
      Senin: 0,
      Selasa: 0,
      Rabu: 0,
      Kamis: 0,
      Jumat: 0,
      Sabtu: 0,
      Minggu: 0,
    }

    for (const session of sessions) {
      const durationSeconds = Number(session.actual_duration ?? session.duration_seconds ?? 0)
      totalSecs += durationSeconds

      const dateStr = session.started_at || session.created_at
      if (!dateStr) continue

      const sessionDate = new Date(dateStr)
      if (Number.isNaN(sessionDate.getTime())) continue
      // Dapatkan nama hari dalam format bahasa Indonesia
      const dayName = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
      }).format(sessionDate)

      if (Object.prototype.hasOwnProperty.call(dayTotals, dayName)) {
        dayTotals[dayName] += Math.round(durationSeconds / 60)
      }
    }

    const calculatedTotalMinutes = Math.round(totalSecs / 60)
    const activeDaysCount = Object.values(dayTotals).filter((m) => m > 0).length
    const calculatedAvgMinutes =
      activeDaysCount > 0 ? Math.round(calculatedTotalMinutes / activeDaysCount) : 0

    const chartPoints: DailyFocusPoint[] = DAYS_ORDER.map((day) => ({
      day,
      focusMinutes: dayTotals[day] || 0,
    }))

    return {
      totalMinutes: calculatedTotalMinutes,
      totalSessions: sessions.length,
      averageMinutes: calculatedAvgMinutes,
      dailyChartData: chartPoints,
    }
  }, [sessions])

  const campusSummaryStats = useMemo(() => {
    const totalCampusMinutes = campusData.reduce((acc, item) => acc + item.totalMinutes, 0)
    const totalStudents = campusData.reduce((acc, item) => acc + item.studentCount, 0)
    const topCampus = campusData[0]?.campus || user?.university || 'Universitas Indonesia'
    return {
      totalCampusMinutes,
      totalCampuses: campusData.length,
      totalStudents,
      topCampus,
    }
  }, [campusData, user?.university])

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Halaman */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
          Analitik belajar
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
          Laporan Pola Fokus
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
          Kenali kebiasaan belajarmu dan evaluasi perkembangan fokus terstruktur yang tersimpan di
          cloud.
        </p>

        {/* Tab Switcher */}
        <div
          className="mt-6 inline-flex rounded-xl bg-[#EAEDFF] p-1"
          role="tablist"
          aria-label="Jenis laporan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personal'}
            onClick={() => setActiveTab('personal')}
            className={`h-10 rounded-lg px-4 text-sm font-bold transition ${
              activeTab === 'personal'
                ? 'bg-[#1D3668] text-white shadow-sm'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            Tab Pribadi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'campus'}
            onClick={() => setActiveTab('campus')}
            className={`h-10 rounded-lg px-4 text-sm font-bold transition ${
              activeTab === 'campus'
                ? 'bg-[#1D3668] text-white shadow-sm'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            Tab Kampus
          </button>
        </div>
      </section>

      {/* Kartu Statistik */}
      {activeTab === 'personal' ? (
        <section
          aria-label="Statistik fokus pribadi"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <StatCard
            icon={Trophy}
            label="Total selesai"
            value={`${totalSessions} blok`}
            detail={totalSessions > 0 ? 'Akumulasi sesi selesai' : 'Belum ada sesi selesai'}
            tone="green"
          />
          <StatCard
            icon={Clock3}
            label="Total fokus"
            value={`${totalMinutes} menit`}
            detail="Akumulasi waktu fokus riil"
            tone="blue"
          />
          <StatCard
            icon={BarChart3}
            label="Rata rata fokus"
            value={`${averageMinutes} menit`}
            detail="Per hari aktif belajar"
            tone="rose"
          />
        </section>
      ) : (
        <div className="space-y-4">
          <section className="flex items-start gap-3 rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.06)]">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Data bersifat agregat dan menghormati privasi</h2>
              <p className="mt-1 text-[13px] leading-[19px]">
                Data komparasi ini menghimpun total waktu fokus berdasarkan entitas kampus dari
                profil mahasiswa yang bersifat publik.
              </p>
            </div>
          </section>

          <section
            aria-label="Statistik komparasi kampus"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <StatCard
              icon={Building2}
              label="Entitas Kampus"
              value={`${campusSummaryStats.totalCampuses} Kampus`}
              detail={`Teratas: ${campusSummaryStats.topCampus}`}
              tone="blue"
            />
            <StatCard
              icon={Clock3}
              label="Total Fokus Kampus"
              value={`${campusSummaryStats.totalCampusMinutes} menit`}
              detail="Akumulasi SUM durasi fokus"
              tone="rose"
            />
            <StatCard
              icon={Users}
              label="Partisipan Publik"
              value={`${campusSummaryStats.totalStudents} Mahasiswa`}
              detail="Kontributor fokus terdata"
              tone="green"
            />
          </section>
        </div>
      )}

      {/* Bagian Grafik atau Empty State */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
              {activeTab === 'personal'
                ? 'Durasi Fokus per Hari'
                : 'Komparasi Durasi Fokus Berdasarkan Entitas Kampus'}
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
              {activeTab === 'personal'
                ? 'Capaian waktu fokusmu dalam sepekan terakhir.'
                : 'Agregasi total menit fokus (SUM durasi_fokus) yang dikelompokkan berdasarkan universitas/kampus.'}
            </p>
          </div>
          {activeTab === 'personal' && sessions.length > 0 && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
              <span className="h-2 w-2 rounded-sm bg-[#1D3668]" /> Menit fokus
            </span>
          )}
          {activeTab === 'campus' && campusData.length > 0 && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FCDDE6] px-2.5 py-1 text-[11px] font-semibold text-[#8E1744]">
              <span className="h-2 w-2 rounded-sm bg-[#BE2257]" /> Total menit kampus
            </span>
          )}
        </div>

        {/* Konten Tab Pribadi */}
        {activeTab === 'personal' && (
          <div className="mt-5 min-w-0">
            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A]"
              >
                <Loader2 size={24} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span className="text-sm font-medium">Memuat data analitik dari Supabase...</span>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-900"
              >
                <p className="text-sm font-bold">Gagal memuat analitik</p>
                <p className="mt-1 text-xs text-red-700">{error}</p>
              </div>
            ) : sessions.length === 0 ? (
              /* Empty State Tab Pribadi */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F8F9FD] px-6 py-12 text-center sm:py-16">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-xs">
                  <BarChart2 size={40} className="text-[#1D3668]/30" strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold text-[#1F2C4F]">
                  Belum ada riwayat belajar
                </h3>
                <p className="mt-1.5 max-w-md text-[13px] leading-[20px] text-[#56638A]">
                  Selesaikan sesi fokus pertamamu minggu ini untuk mulai melihat analitik dan progres
                  belajarmu di sini!
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/focus')}
                  className="mt-6 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#152A55] active:scale-[0.98]"
                >
                  <span>Mulai Mode Fokus</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <FocusChart data={dailyChartData} color="#1D3668" />
            )}
          </div>
        )}

        {/* Konten Tab Kampus */}
        {activeTab === 'campus' && (
          <div className="mt-5 min-w-0 space-y-6">
            {isLoadingCampus ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A]"
              >
                <Loader2 size={24} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span className="text-sm font-medium">Mengagregasi data komparasi kampus...</span>
              </div>
            ) : campusData.length > 0 ? (
              <>
                <CampusComparisonChart data={campusData} />

                {/* Rincian Peringkat Kampus */}
                <div className="border-t border-[#DFE4F1] pt-5">
                  <h3 className="text-sm font-bold text-[#1F2C4F]">
                    Peringkat Agregasi Fokus Entitas Kampus
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    {campusData.map((item, idx) => (
                      <div
                        key={item.campus}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${
                              idx === 0
                                ? 'bg-[#BE2257]'
                                : idx === 1
                                  ? 'bg-[#1D3668]'
                                  : 'bg-[#56638A]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#1F2C4F]">
                              {item.campus}
                            </p>
                            <p className="text-xs text-[#56638A]">
                              {item.studentCount} mahasiswa · {item.sessionCount} sesi tercatat
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-[#1D3668]">
                            {item.totalMinutes} menit
                          </p>
                          <p className="text-[11px] text-[#757780]">
                            Rata-rata {item.avgMinutesPerStudent} mnt/mhs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F8F9FD] px-6 py-12 text-center sm:py-16">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-xs">
                  <BarChart2 size={36} className="text-[#BE2257]/40" strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold text-[#1F2C4F]">
                  Belum ada data sesi fokus kampus
                </h3>
                <p className="mt-1.5 max-w-md text-[13px] leading-[20px] text-[#56638A]">
                  Mulai sesi fokus pertamamu untuk menyumbangkan menit fokus bagi almamater kampusmu!
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
```

### `src/pages/Settings.tsx`
*Padanan `app/(tabs)/pengaturan.tsx` — Halaman Pengaturan*

```tsx
// src/pages/Settings.tsx
import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BellOff,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  GraduationCap,
  Hash,
  Info,
  LogOut,
  Mail,
  Medal,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import { formatLastStudyDateLabel } from '../lib/streak'

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}

interface BlockableAppItem {
  packageName: string
  label: string
  description: string
  category: string
}

const BLOCKABLE_APPS: BlockableAppItem[] = [
  {
    packageName: 'com.whatsapp',
    label: 'Blokir WhatsApp',
    description: 'Tahan notifikasi obrolan pribadi dan grup non-darurat saat fokus',
    category: 'Pesan Instan',
  },
  {
    packageName: 'com.instagram.android',
    label: 'Blokir Instagram',
    description: 'Tahan notifikasi DM, komentar, live, dan rekomendasi Reels',
    category: 'Media Sosial',
  },
  {
    packageName: 'com.zhiliaoapp.musically',
    label: 'Blokir TikTok',
    description: 'Tahan notifikasi video baru, mention, dan siaran langsung',
    category: 'Hiburan',
  },
  {
    packageName: 'com.twitter.android',
    label: 'Blokir X (Twitter)',
    description: 'Tahan notifikasi topik hangat, balasan, dan mention linimasa',
    category: 'Media Sosial',
  },
  {
    packageName: 'org.telegram.messenger',
    label: 'Blokir Telegram',
    description: 'Tahan notifikasi channel publik dan grup diskusi umum',
    category: 'Pesan Instan',
  },
  {
    packageName: 'com.google.android.youtube',
    label: 'Blokir YouTube',
    description: 'Tahan notifikasi unggahan kreator dan rekomendasi Shorts',
    category: 'Video',
  },
]

const BLOCKED_APPS_STORAGE_KEY = 'smartlearning-blocked-apps'

function getInitialBlockedApps(): string[] {
  if (typeof window === 'undefined') {
    return ['com.whatsapp', 'com.instagram.android']
  }
  try {
    const raw = window.localStorage.getItem(BLOCKED_APPS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    }
  } catch {
    // Abaikan error parse localStorage
  }
  return ['com.whatsapp', 'com.instagram.android']
}

export default function Settings() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const togglePrivacy = useAuthStore((state) => state.togglePrivacy)
  const logout = useAuthStore((state) => state.logout)
  const isPrivateProfile = user?.isPrivateProfile ?? false

  const [prevUserId, setPrevUserId] = useState(user?.id)
  const [name, setName] = useState(user?.name || '')
  const [nim, setNim] = useState(user?.nim || '')
  const [major, setMajor] = useState(user?.major || '')
  const [university, setUniversity] = useState(user?.university || '')
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successToastMessage, setSuccessToastMessage] = useState('Profil berhasil diperbarui di Supabase')
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedApps, setSelectedApps] = useState<string[]>(getInitialBlockedApps)
  const [permissionStatus, setPermissionStatus] = useState<{
    notificationAccess: boolean | null
    accessibility: boolean | null
  }>({
    notificationAccess: null,
    accessibility: null,
  })

  // Sinkronisasi status izin dari native Android via event 'NATIVE_PERMISSIONS_STATUS'
  useEffect(() => {
    function handlePermissionStatus(event: Event) {
      const customEvent = event as CustomEvent<{
        notificationAccess?: boolean
        accessibility?: boolean
      }>
      if (customEvent.detail) {
        setPermissionStatus({
          notificationAccess: customEvent.detail.notificationAccess ?? null,
          accessibility: customEvent.detail.accessibility ?? null,
        })
      }
    }

    window.addEventListener('NATIVE_PERMISSIONS_STATUS', handlePermissionStatus)

    // Minta native Android untuk memeriksa izin saat ini
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'CHECK_PERMISSIONS' })
      )
    }

    return () => {
      window.removeEventListener('NATIVE_PERMISSIONS_STATUS', handlePermissionStatus)
    }
  }, [])

  function handleOpenNotificationSettings() {
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'OPEN_NOTIFICATION_SETTINGS' })
      )
    } else {
      setErrorToast('Fitur ini memerlukan aplikasi Android Smart Focus.')
    }
  }

  function handleOpenAccessibilitySettings() {
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'OPEN_ACCESSIBILITY_SETTINGS' })
      )
    } else {
      setErrorToast('Fitur ini memerlukan aplikasi Android Smart Focus.')
    }
  }

  function handleOpenBatterySettings() {
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'OPEN_BATTERY_SETTINGS' })
      )
    } else {
      setErrorToast('Fitur ini memerlukan aplikasi Android Smart Focus.')
    }
  }

  function handleTestNotification() {
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'TEST_NOTIFICATION_BLOCK' })
      )
      setSuccessToastMessage('Sinyal uji coba simulasi notifikasi dikirim ke HP!')
      setShowSuccessToast(true)
    } else {
      setErrorToast('Fitur ini memerlukan aplikasi Android Smart Focus.')
    }
  }

  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id)
    setName(user?.name || '')
    setNim(user?.nim || '')
    setMajor(user?.major || '')
    setUniversity(user?.university || '')
  }

  // Auto-hide success toast after 3.5 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = window.setTimeout(() => setShowSuccessToast(false), 3500)
      return () => window.clearTimeout(timer)
    }
  }, [showSuccessToast])

  // Auto-hide error toast after 5 seconds
  useEffect(() => {
    if (errorToast) {
      const timer = window.setTimeout(() => setErrorToast(null), 5000)
      return () => window.clearTimeout(timer)
    }
  }, [errorToast])

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorToast(null)

    try {
      await updateProfile({
        name: name.trim(),
        nim: nim.trim(),
        major: major.trim(),
        university: university.trim(),
      })
      if (user?.id) {
        useGroupStore.getState().syncUserCourse(user.id, major.trim(), name.trim())
      }
      setSuccessToastMessage('Profil berhasil diperbarui di Supabase')
      setShowSuccessToast(true)
    } catch (error) {
      setErrorToast(
        error instanceof Error ? error.message : 'Gagal menyimpan perubahan profil ke Supabase.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTogglePrivacy() {
    setErrorToast(null)
    try {
      await togglePrivacy(!isPrivateProfile)
      setSuccessToastMessage('Pengaturan privasi berhasil diperbarui')
      setShowSuccessToast(true)
    } catch (error) {
      setErrorToast(
        error instanceof Error ? error.message : 'Gagal memperbarui pengaturan privasi.'
      )
    }
  }

  function handleToggleBlockedApp(packageName: string) {
    setSelectedApps((prev) =>
      prev.includes(packageName)
        ? prev.filter((pkg) => pkg !== packageName)
        : [...prev, packageName]
    )
  }

  function handleSaveBlockedApps() {
    setErrorToast(null)
    try {
      window.localStorage.setItem(BLOCKED_APPS_STORAGE_KEY, JSON.stringify(selectedApps))
    } catch {
      // Abaikan error penyimpanan lokal
    }

    // Kirim daftar package aplikasi yang diblokir ke React Native WebView Bridge
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'SET_BLOCKED_APPS',
          data: selectedApps,
        })
      )
    }

    setSuccessToastMessage(
      `Pengaturan Notification Blocker (${selectedApps.length} aplikasi) berhasil disimpan!`
    )
    setShowSuccessToast(true)
  }

  async function handleLogout() {
    setErrorToast(null)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : 'Gagal keluar dari sesi akun.')
      navigate('/login', { replace: true })
    }
  }

  const initials = (name || user?.name || 'M')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {showSuccessToast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-[#17623A]/20 bg-[#D6F0DE] p-4 text-[#17623A] shadow-md transition-all animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            <p className="text-sm font-bold">{successToastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSuccessToast(false)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {errorToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-md transition-all animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-bold">{errorToast}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Profile Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar Dummy */}
          <div className="relative shrink-0">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#1D3668] text-2xl font-extrabold text-white shadow-md sm:h-24 sm:w-24 sm:text-3xl">
              {initials}
            </div>
            <span
              className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-[#17623A]"
              title="Status Mahasiswa Aktif"
              aria-label="Status Mahasiswa Aktif"
            />
          </div>

          {/* User Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                <SettingsIcon size={16} aria-hidden="true" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
                Pengaturan Akun & Profil
              </p>
            </div>
            <h1 className="mt-1 truncate text-[22px] font-extrabold leading-tight text-[#1F2C4F] sm:text-[28px]">
              {name || user?.name || 'Mahasiswa Smart Focus'}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#56638A]">
              <Mail size={16} className="shrink-0 text-[#757780]" aria-hidden="true" />
              <span className="truncate">{user?.email || 'email@mahasiswa.ac.id'}</span>
            </p>

            {/* Micro Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E1EAF8] px-3 py-1 text-xs font-semibold text-[#1D3668]">
                {nim || 'NIM belum disetel'}
              </span>
              <span className="rounded-full bg-[#F6F7FC] border border-[#DFE4F1] px-3 py-1 text-xs font-semibold text-[#56638A]">
                {major || 'Program Studi'}
              </span>
              <span className="rounded-full bg-[#D6F0DE] px-3 py-1 text-xs font-semibold text-[#17623A]">
                Mahasiswa Aktif
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Edit Profile Form Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-[#DFE4F1] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UserRound size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Edit Data Mahasiswa</h2>
            <p className="text-xs text-[#56638A]">
              Perbarui identitas akademik Anda untuk penyesuaian jadwal dan kolaborasi kelompok.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Nama Lengkap */}
            <div className="sm:col-span-2">
              <label htmlFor="student-name" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Nama Lengkap
              </label>
              <div className="relative">
                <UserIcon
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* NIM */}
            <div>
              <label htmlFor="student-nim" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Nomor Induk Mahasiswa (NIM)
              </label>
              <div className="relative">
                <Hash
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-nim"
                  type="text"
                  required
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  placeholder="Contoh: 2201082001"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* Email (Readonly) */}
            <div>
              <label htmlFor="student-email" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Email Kampus <span className="text-xs font-normal text-[#757780]">(Akun Utama)</span>
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-email"
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="h-11 w-full cursor-not-allowed rounded-[10px] border border-[#DFE4F1] bg-[#EEF1F8] py-2 pl-11 pr-4 text-sm text-[#56638A] opacity-90 outline-none"
                />
              </div>
            </div>

            {/* Program Studi / Jurusan */}
            <div>
              <label htmlFor="student-major" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Program Studi / Jurusan
              </label>
              <div className="relative">
                <GraduationCap
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-major"
                  type="text"
                  required
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Contoh: Teknik Informatika"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* Universitas / Kampus */}
            <div>
              <label htmlFor="student-university" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Universitas / Kampus
              </label>
              <div className="relative">
                <Building2
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-university"
                  type="text"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Contoh: Universitas Indonesia"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} aria-hidden="true" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Pengaturan Privasi & Gamifikasi */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-[#DFE4F1] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Pengaturan Privasi & Gamifikasi</h2>
            <p className="text-xs text-[#56638A]">
              Kelola visibilitas profil Anda di papan peringkat kampus dan pantau pencapaian belajar.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Toggle Switch Privasi Leaderboard */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
            <div>
              <label htmlFor="privacy-leaderboard-switch" className="cursor-pointer text-sm font-bold text-[#1F2C4F]">
                Sembunyikan profil dari Leaderboard Kampus
              </label>
              <p className="mt-1 text-xs leading-[18px] text-[#56638A]">
                {isPrivateProfile
                  ? 'Profil Anda saat ini bersifat privat dan tidak ditampilkan di peringkat publik kampus.'
                  : 'Nama dan capaian jam fokus Anda dapat dilihat oleh rekan satu kampus.'}
              </p>
            </div>
            <button
              id="privacy-leaderboard-switch"
              type="button"
              role="switch"
              aria-checked={isPrivateProfile}
              onClick={() => void handleTogglePrivacy()}
              className={`relative inline-flex h-[26px] w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 ${
                isPrivateProfile ? 'bg-[#1D3668]' : 'bg-[#DFE4F1]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  isPrivateProfile ? 'translate-x-[25px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {/* Info Streak & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFE4F1] bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-orange-500">
                <Flame size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#757780]">Streak Belajar</p>
                <p className="text-sm font-extrabold text-[#1F2C4F]">{user?.streak ?? 0} Hari Beruntun!</p>
                <p className="text-[11px] text-[#56638A]">Terakhir: {formatLastStudyDateLabel(user?.lastStudyDate)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(user?.badges?.length ? user.badges : ['Pemula Fokus']).map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
                >
                  <Medal size={14} className="text-amber-500" aria-hidden="true" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pengaturan Notification Blocker (Jembatan WebView Mobile) */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#DFE4F1] pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FCDDE6] text-[#BE2257]">
              <BellOff size={20} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
                  Pemblokir Notifikasi Saat Mode Fokus
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E1EAF8] px-2.5 py-0.5 text-[10px] font-bold text-[#1D3668]">
                  <Smartphone size={11} />
                  Android Bridge
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#56638A]">
                Pilih aplikasi yang notifikasinya ingin ditahan otomatis selama sesi fokus berlangsung.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#F6F7FC] border border-[#DFE4F1] px-3 py-1 text-xs font-extrabold text-[#1D3668]">
            {selectedApps.length} Dipilih
          </span>
        </div>

        {/* Panel Izin Sistem Android (Notification Access & Accessibility) */}
        <div className="mb-6 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                <ShieldCheck size={20} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1F2C4F]">Izin Akses Notifikasi Android</h3>
                  {permissionStatus.notificationAccess === true && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={11} /> Aktif
                    </span>
                  )}
                  {permissionStatus.notificationAccess === false && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                      <AlertCircle size={11} /> Belum Diizinkan
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#56638A]">
                  Android mewajibkan izin &quot;Akses Notifikasi&quot; agar aplikasi dapat menahan dan membatalkan notifikasi saat sesi fokus.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenNotificationSettings}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D3668] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#15274d] active:scale-[0.98]"
              >
                <ShieldCheck size={14} />
                <span>Buka Izin Akses Notifikasi</span>
                <ExternalLink size={12} className="opacity-80" />
              </button>
              <button
                type="button"
                onClick={handleOpenAccessibilitySettings}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE4F1] bg-white px-3 py-2 text-xs font-semibold text-[#1F2C4F] shadow-xs transition hover:bg-[#F3F4FA] active:scale-[0.98]"
              >
                <span>Izin Aksesibilitas</span>
                <ExternalLink size={12} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={handleOpenBatterySettings}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE4F1] bg-white px-3 py-2 text-xs font-semibold text-[#1F2C4F] shadow-xs transition hover:bg-[#F3F4FA] active:scale-[0.98]"
                title="Khusus Samsung: Nonaktifkan optimasi baterai agar Android tidak mematikan pemblokir di latar belakang"
              >
                <span>Baterai Tanpa Batas</span>
                <ExternalLink size={12} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={handleTestNotification}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCDDE6] bg-[#FFF7F8] px-3 py-2 text-xs font-bold text-[#8E1744] shadow-xs transition hover:bg-[#FDEBF0] active:scale-[0.98]"
              >
                <span>Uji Simulasi Notifikasi</span>
              </button>
            </div>
          </div>

          {/* Tips Android 13/14+ Restricted Settings */}
          <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900">
            <Info size={16} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold text-amber-950">
                Catatan Khusus Android 13/14+ (Jika tombol izin abu-abu / tidak bisa diklik):
              </p>
              <p className="text-[11px] text-amber-800">
                Buka <strong>Pengaturan HP &gt; Aplikasi &gt; Smart Focus &gt; Titik Tiga (⋮) di pojok kanan atas &gt; Izinkan pengaturan terbatas</strong> (Allow restricted settings), lalu aktifkan kembali Akses Notifikasi.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {BLOCKABLE_APPS.map((app) => {
            const isChecked = selectedApps.includes(app.packageName)
            return (
              <label
                key={app.packageName}
                htmlFor={`block-app-${app.packageName}`}
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-3.5 transition-all select-none ${
                  isChecked
                    ? 'border-[#1D3668] bg-[#E1EAF8]/35 shadow-2xs'
                    : 'border-[#DFE4F1] bg-[#F6F7FC]/70 hover:border-[#B7C7E8] hover:bg-white'
                }`}
              >
                <input
                  id={`block-app-${app.packageName}`}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleBlockedApp(app.packageName)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                    isChecked
                      ? 'border-[#1D3668] bg-[#1D3668] text-white'
                      : 'border-[#C4C6D0] bg-white text-transparent'
                  }`}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#1F2C4F]">{app.label}</span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#56638A] border border-[#DFE4F1]">
                      {app.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#56638A]">{app.description}</p>
                  <span className="mt-1 block font-mono text-[10px] text-[#757780]">
                    {app.packageName}
                  </span>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#DFE4F1] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#56638A]">
            Pengaturan ini dikirim ke aplikasi Android melalui jembatan{' '}
            <code className="rounded bg-[#F6F7FC] px-1.5 py-0.5 font-mono text-[11px] text-[#1D3668]">
              ReactNativeWebView.postMessage
            </code>
          </p>
          <button
            type="button"
            onClick={handleSaveBlockedApps}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#A11B48] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
          >
            <Save size={16} aria-hidden="true" />
            <span>Simpan Daftar Blokir</span>
          </button>
        </div>
      </section>

      {/* Bagian Akun (Danger Zone) */}
      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-[0_2px_4px_rgba(220,38,38,0.03),0_8px_16px_rgba(220,38,38,0.04)] sm:p-7">
        <div className="flex items-start gap-3 border-b border-red-100 pb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-red-900">Manajemen Sesi Akun</h2>
            <p className="mt-1 text-xs text-red-700">
              Keluar dari sesi aktif aplikasi SmartLearning pada perangkat ini.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-[13px] leading-relaxed text-[#56638A]">
            Dengan keluar, data sesi lokal akan dibersihkan dan Anda perlu masuk kembali menggunakan email dan kata sandi Anda untuk mengakses jadwal belajar dan ruang Co-Focus.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-red-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
          >
            <LogOut size={19} aria-hidden="true" />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </section>
    </div>
  )
}
```

---

## 3. Komponen Co-Focus (Chat & Attachment Picker)

### `src/pages/CoFocus.tsx`
*Halaman lobby Co-Focus (buat/gabung grup & status berbagi)*

```tsx
// src/pages/CoFocus.tsx
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareText,
  PlusCircle,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useGroupStore, type GroupMemberItem } from '../store/groupStore'
import { useSessionStore } from '../store/sessionStore'

const statusStyles: Record<'Sedang Fokus' | 'Istirahat', string> = {
  'Sedang Fokus': 'bg-[#FCDDE6] text-[#8E1744]',
  Istirahat: 'bg-[#FDEBC8] text-[#7A4B00]',
}

export default function CoFocus() {
  const navigate = useNavigate()

  // Session & Local settings
  const [isSharing, setIsSharing] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('smartlearning-cofocus-sharing') !== 'false'
    } catch {
      return true
    }
  })
  const [autoReply, setAutoReply] = useState(() => {
    try {
      return (
        (typeof window !== 'undefined' && window.localStorage.getItem('smartlearning-cofocus-auto-reply')) ||
        'Sedang fokus belajar modul Manajemen Inovasi. Balasan menyusul setelah sesi tuntas.'
      )
    } catch {
      return 'Sedang fokus belajar modul Manajemen Inovasi. Balasan menyusul setelah sesi tuntas.'
    }
  })
  const sessionStatus = useSessionStore((state) => state.status)
  const ownStatus = sessionStatus === 'running' || sessionStatus === 'paused' ? 'Sedang Fokus' : 'Tersedia'

  // Auth & User
  const user = useAuthStore((state) => state.user)

  // Group Store state & actions
  const groups = useGroupStore((state) => state.groups)
  const activeGroupId = useGroupStore((state) => state.activeGroupId)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const isLoadingGroups = useGroupStore((state) => state.isLoading)
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup)
  const createGroup = useGroupStore((state) => state.createGroup)
  const joinGroup = useGroupStore((state) => state.joinGroup)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const deleteGroup = useGroupStore((state) => state.deleteGroup)
  const leaveGroup = useGroupStore((state) => state.leaveGroup)
  const kickMember = useGroupStore((state) => state.kickMember)

  useEffect(() => {
    if (!user?.id) return
    void fetchMyGroups(user.id)

    const channel = supabase
      .channel(`cofocus-live:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_group_members' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            useGroupStore
              .getState()
              .handleMemberUpdate(
                payload.new as { id?: string; user_id?: string; group_id?: string; status?: string; course?: string | null }
              )
          }
          void fetchMyGroups(user.id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => {
          void fetchMyGroups(user.id)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, fetchMyGroups])

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [memberToKick, setMemberToKick] = useState<GroupMemberItem | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Toast / Alert state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem('smartlearning-cofocus-sharing', String(isSharing))
    } catch {
      // Ignore storage errors
    }
  }, [isSharing])

  useEffect(() => {
    try {
      window.localStorage.setItem('smartlearning-cofocus-auto-reply', autoReply)
    } catch {
      // Ignore storage errors
    }
  }, [autoReply])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(null), 4000)
      return () => window.clearTimeout(timer)
    }
  }, [toast])

  // Close modals when Escape key is pressed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false)
        if (showJoinModal) setShowJoinModal(false)
        if (showDeleteModal) setShowDeleteModal(false)
        if (showLeaveModal) setShowLeaveModal(false)
        if (memberToKick) setMemberToKick(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal, showJoinModal, showDeleteModal, showLeaveModal, memberToKick])

  // Safe clipboard copy with fallback
  const handleCopy = async (code?: string | null) => {
    if (!code) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code)
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea')
        textArea.value = code
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      console.warn('Gagal menyalin teks ke clipboard:', err)
    }
  }

  // Handle Create Room
  async function handleCreateRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) return

    try {
      setIsSubmitting(true)
      const result = await createGroup(trimmed)
      if (result.success && result.group) {
        setCreatedRoomCode(result.group.joinCode)
        setCreatedGroupId(result.group.id)
        setToast({
          type: 'success',
          message: `Ruang belajar "${result.group.name}" berhasil dibuat dengan kode: ${result.group.joinCode}!`,
        })
      } else {
        setToast({
          type: 'error',
          message: 'Gagal membuat ruang belajar. Silakan coba kembali.',
        })
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat ruang belajar.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Join Room by 6-char Code
  async function handleJoinRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cleanCode = joinCodeInput.trim().toUpperCase()
    if (!cleanCode) {
      setToast({ type: 'error', message: 'Silakan masukkan 6 karakter kode ruangan.' })
      return
    }

    try {
      setIsSubmitting(true)
      const result = await joinGroup(cleanCode)
      if (!result.success) {
        setToast({
          type: 'error',
          message: result.error || 'Gagal bergabung ke ruang belajar.',
        })
      } else {
        setShowJoinModal(false)
        setJoinCodeInput('')
        setToast({
          type: 'success',
          message: `Berhasil bergabung ke "${result.group?.name || 'Ruang Belajar'}"! Membuka obrolan...`,
        })
        if (result.group?.id) {
          const joinedGroupId = result.group.id
          setTimeout(() => {
            navigate('/group/' + joinedGroupId)
          }, 600)
        }
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat bergabung.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentMembers: GroupMemberItem[] = activeGroup?.members || []
  const maxMembers = activeGroup?.maxMembers && activeGroup.maxMembers >= 10 ? activeGroup.maxMembers : 10
  const remainingSlots = Math.max(0, maxMembers - currentMembers.length)
  const roomJoinCode = activeGroup?.joinCode || ''

  const isHost = Boolean(
    (user?.id && activeGroup?.hostId === user.id) ||
    currentMembers.some((m) => m.userId === user?.id && m.isHost)
  )

  async function handleDeleteRoom() {
    if (!activeGroup?.id) return
    setIsSubmitting(true)
    try {
      const res = await deleteGroup(activeGroup.id)
      if (res.success) {
        setShowDeleteModal(false)
        setToast({ type: 'success', message: 'Ruang belajar berhasil dihapus.' })
      } else {
        setToast({ type: 'error', message: res.error || 'Gagal menghapus ruang belajar.' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'Terjadi kesalahan saat menghapus ruang belajar.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLeaveRoom() {
    if (!activeGroup?.id) return
    setIsSubmitting(true)
    try {
      const res = await leaveGroup(activeGroup.id)
      if (res.success) {
        setShowLeaveModal(false)
        setToast({ type: 'success', message: 'Berhasil keluar dari ruang belajar.' })
      } else {
        setToast({ type: 'error', message: res.error || 'Gagal keluar dari ruang belajar.' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'Terjadi kesalahan saat keluar dari ruang belajar.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmKick() {
    if (!activeGroup?.id || !memberToKick?.userId) return
    setIsSubmitting(true)
    try {
      const res = await kickMember(activeGroup.id, memberToKick.userId)
      if (res.success) {
        setToast({ type: 'success', message: `${memberToKick.name} berhasil dikeluarkan dari grup.` })
        setMemberToKick(null)
      } else {
        setToast({ type: 'error', message: res.error || 'Gagal mengeluarkan anggota.' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'Terjadi kesalahan saat mengeluarkan anggota.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toast Alert Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between rounded-xl border p-4 shadow-md transition-all duration-200 ${
            toast.type === 'success'
              ? 'border-[#17623A]/20 bg-[#D6F0DE] text-[#17623A]'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            )}
            <p className="text-sm font-bold">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header & Status Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Kolaborasi belajar</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Co-Focus</h1>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Bagikan status fokusmu dan berkolaborasi dalam ruang belajar bersama (maksimal 10 orang).</p>
          </div>
        </div>

        <div className="mt-6 space-y-5 border-t border-[#DFE4F1] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="share-focus-status" className="text-sm font-bold text-[#1F2C4F]">Bagikan status saya</label>
              <p className="mt-1 text-[13px] leading-[18px] text-[#56638A]">
                Status dibagikan: <strong className="font-semibold text-[#1F2C4F]">{isSharing ? ownStatus : 'Tersembunyi'}</strong>.
              </p>
            </div>
            <button
              id="share-focus-status"
              type="button"
              role="switch"
              aria-checked={isSharing}
              onClick={() => setIsSharing((current) => !current)}
              className={`relative inline-flex h-[26px] w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 ${
                isSharing ? 'bg-[#1D3668]' : 'bg-[#DFE4F1]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  isSharing ? 'translate-x-[25px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="cofocus-auto-reply" className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1F2C4F]">
              <MessageSquareText size={17} aria-hidden="true" /> Pesan Balasan Otomatis
            </label>
            <input
              id="cofocus-auto-reply"
              type="text"
              value={autoReply}
              onChange={(event) => setAutoReply(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#56638A] focus:bg-white focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]/20"
            />
          </div>
        </div>
      </section>

      {/* Action Buttons: Buat Ruang Belajar & Gabung pakai Kode */}
      <section className="grid gap-3.5 sm:grid-cols-2">
        {/* Tombol Buat Ruang Belajar */}
        <button
          type="button"
          onClick={() => {
            setNewRoomName('')
            setCreatedRoomCode(null)
            setShowCreateModal(true)
          }}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border-2 border-[#1D3668] bg-[#1D3668] p-5 text-left text-white shadow-md shadow-[#1D3668]/15 transition-all hover:bg-[#162B54] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition-transform group-hover:scale-105">
              <PlusCircle size={24} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CC3FF]">Mulai Kelompok Baru</span>
              <h2 className="text-lg font-extrabold leading-6">Buat Ruang Belajar</h2>
              <p className="mt-0.5 text-xs text-white/80">Dapatkan kode unik 6 karakter (Maks 10 orang)</p>
            </div>
          </div>
          <ArrowRight size={20} className="shrink-0 text-white/80 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Tombol Gabung pakai Kode */}
        <button
          type="button"
          onClick={() => {
            setJoinCodeInput('')
            setShowJoinModal(true)
          }}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border-2 border-[#BE2257] bg-white p-5 text-left shadow-sm transition-all hover:bg-[#FFF5F8] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FCDDE6] text-[#BE2257] transition-transform group-hover:scale-105">
              <KeyRound size={24} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#BE2257]">Punya Kode Unik?</span>
              <h2 className="text-lg font-extrabold leading-6 text-[#1F2C4F]">Gabung pakai Kode</h2>
              <p className="mt-0.5 text-xs text-[#56638A]">Masukkan 6 karakter kode ruang belajar teman</p>
            </div>
          </div>
          <ArrowRight size={20} className="shrink-0 text-[#BE2257] transition-transform group-hover:translate-x-1" />
        </button>
      </section>

      {/* Switcher Ruangan (Jika pengguna tergabung di lebih dari 1 ruangan) */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-bold text-[#56638A]">Daftar Ruangan Anda:</span>
          {groups.map((group) => {
            const isActive = group.id === activeGroupId
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#1D3668] text-white shadow-sm'
                    : 'border border-[#DFE4F1] bg-white text-[#56638A] hover:bg-[#F6F7FC] hover:text-[#1D3668]'
                }`}
              >
                {group.name} ({group.members.length}/{group.maxMembers && group.maxMembers >= 10 ? group.maxMembers : 10})
              </button>
            )
          })}
        </div>
      )}

      {/* Ruang Belajar Bersama Card (Active Group) */}
      {isLoadingGroups && groups.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-[#DFE4F1] bg-white p-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
          <Loader2 size={32} className="animate-spin text-[#BE2257]" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[#1F2C4F]">Memuat ruang belajar dari Cloud...</p>
        </section>
      ) : activeGroup ? (
        <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 sm:p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                <MessageSquareText size={22} aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Ruang Belajar Aktif</p>
                  <span className="rounded-full bg-[#D6F0DE] px-2 py-0.5 text-[10px] font-bold text-[#17623A]">
                    {currentMembers.length >= maxMembers ? `Penuh (Maks ${maxMembers})` : `${currentMembers.length} / ${maxMembers} Anggota`}
                  </span>
                  {isHost && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                      <ShieldCheck size={12} className="text-[#1D3668]" />
                      Anda Admin Host
                    </span>
                  )}
                  {roomJoinCode && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#1D3668]">
                      <span>Kode: {roomJoinCode}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(roomJoinCode)}
                        title="Salin Kode Ruangan"
                        className="text-[#56638A] hover:text-[#1D3668]"
                      >
                        {copiedCode ? <Check size={12} className="text-[#17623A]" /> : <Copy size={12} />}
                      </button>
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-[18px] font-bold leading-6 text-[#1F2C4F]">
                  Forum Grup Belajar: {activeGroup.name}
                </h2>
                <p className="mt-1 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
                  {activeGroup.description || 'Ruang kolaborasi terpadu untuk berdiskusi materi kuliah dan berbagi tugas.'}
                  {remainingSlots > 0
                    ? ` Masih tersedia ${remainingSlots} slot anggota lagi.`
                    : ` Ruangan telah mencapai batas kapasitas maksimum (${maxMembers} orang).`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {roomJoinCode && (
                <button
                  type="button"
                  onClick={() => handleCopy(roomJoinCode)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-xs font-bold text-[#1D3668] transition hover:bg-[#E1EAF8]"
                >
                  {copiedCode ? <Check size={15} className="text-[#17623A]" /> : <Copy size={15} />}
                  <span>{copiedCode ? 'Kode Disalin!' : 'Salin Kode'}</span>
                </button>
              )}
              {isHost ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-red-200 bg-red-50/70 px-4 text-xs font-bold text-red-700 transition hover:bg-red-100 hover:border-red-300"
                  title="Hapus Ruangan (Admin)"
                >
                  <Trash2 size={15} className="text-red-600" />
                  <span>Hapus Ruang</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#BE2257]"
                  title="Keluar dari Ruangan"
                >
                  <LogOut size={15} />
                  <span>Keluar</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/group/' + activeGroup.id)}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
              >
                <MessageSquareText size={17} aria-hidden="true" />
                <span>Masuk ke Ruang Belajar</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:py-14">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[#F3F4FA]">
            <Users className="h-16 w-16 text-[#1D3668]/30" strokeWidth={1.4} aria-hidden="true" />
          </span>
          <h2 className="mt-5 max-w-md text-lg font-extrabold text-[#1F2C4F]">
            Kamu belum bergabung di ruang belajar mana pun
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-[19px] text-[#56638A]">
            Buat ruang baru lalu bagikan kodenya, atau masukkan kode 6 karakter dari temanmu untuk fokus bersama.
          </p>
          <div className="mt-6 flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setNewRoomName('')
                setCreatedRoomCode(null)
                setShowCreateModal(true)
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <PlusCircle size={17} aria-hidden="true" />
              Buat Ruang
            </button>
            <button
              type="button"
              onClick={() => {
                setJoinCodeInput('')
                setShowJoinModal(true)
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#BE2257] bg-white px-5 text-sm font-bold text-[#BE2257] transition hover:bg-[#FFF5F8] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <KeyRound size={17} aria-hidden="true" />
              Gabung Ruang
            </button>
          </div>
        </section>
      )}

      {/* Anggota Kelompok Section (Max 10) — hanya tampil jika ada ruang aktif */}
      {activeGroup && (
      <section aria-labelledby="cofocus-members-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 id="cofocus-members-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
              Anggota Ruang Belajar
            </h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
              {currentMembers.length} / {maxMembers} Anggota
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#56638A]">
            {activeGroup?.name || 'Kelompok Belajar'}
          </span>
        </div>

        {/* Grid slots showing member status and room limit */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {currentMembers.map((member, index) => {
            const isCurrentUser = member.userId === user?.id
            // Membaca status murni dari database (Source of Truth), tanpa ditimpa state lokal
            const isFocusing = member.status === 'fokus'
            const statusLabel: 'Sedang Fokus' | 'Istirahat' =
              isFocusing ? 'Sedang Fokus' : 'Istirahat'
            const badgeStyle = statusStyles[statusLabel]
            const canKick = isHost && !member.isHost && !isCurrentUser
            const displayedCourse =
              (isCurrentUser && user?.major) || member.course || 'Mahasiswa'

            return (
              <article
                key={member.id || `member-${index}`}
                className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] transition hover:border-[#B7C7E8]"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full text-xs font-extrabold text-white ${
                      index % 2 ? 'bg-[#BE2257]' : 'bg-[#1D3668]'
                    }`}
                  >
                    {member.avatar || 'M'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {member.isHost && (
                      <span className="rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                        Host Admin
                      </span>
                    )}
                    {canKick && (
                      <button
                        type="button"
                        onClick={() => setMemberToKick(member)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/70 px-2 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-100 transition"
                        title="Keluarkan dari grup"
                      >
                        <UserMinus size={11} />
                        <span>Kick</span>
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="mt-4 text-[16px] font-bold leading-[22px] text-[#1F2C4F]">{member.name}</h3>
                <p className="mt-1 text-xs text-[#56638A]">{displayedCourse}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeStyle}`}>
                  {statusLabel}
                </span>
              </article>
            )
          })}

          {/* Placeholder cards for empty slots up to maxMembers */}
          {Array.from({ length: remainingSlots }).map((_, slotIndex) => (
            <div
              key={`empty-slot-${slotIndex}`}
              className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F6F7FC]/60 p-5 text-center"
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E1EAF8] text-[#56638A]">
                <PlusCircle size={18} />
              </div>
              <p className="mt-2 text-xs font-bold text-[#56638A]">
                Slot {currentMembers.length + slotIndex + 1} Tersedia
              </p>
              {roomJoinCode ? (
                <p className="mt-0.5 text-[11px] text-[#757780]">
                  Ajak teman pakai kode: <strong className="font-mono text-[#1D3668]">{roomJoinCode}</strong>
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-[#757780]">
                  Siap digunakan untuk anggota baru
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Modal 1: Buat Ruang Belajar */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                  <PlusCircle size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Buat Ruang Belajar Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={16} />
              </button>
            </div>

            {createdRoomCode ? (
              // Success Screen after creation
              <div className="mt-5 space-y-4 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#D6F0DE] text-[#17623A]">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-[#1F2C4F]">Ruang Belajar Siap!</h4>
                  <p className="mt-1 text-xs text-[#56638A]">
                    Bagikan 6 digit kode unik ini kepada rekan kelompokmu (Maksimal 10 anggota).
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#C5D5F0] bg-[#E1EAF8] p-4 text-left">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#757780]">
                      Kode Unik Ruangan
                    </span>
                    <span className="font-mono text-3xl font-extrabold tracking-[0.2em] text-[#1D3668]">
                      {createdRoomCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdRoomCode)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1D3668] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#162B54]"
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Tersalin!' : 'Copy Kode'}</span>
                  </button>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      navigate('/group/' + (createdGroupId || activeGroup?.id || ''))
                    }}
                    className="flex-1 rounded-[10px] bg-[#1D3668] py-2.5 text-xs font-bold text-white hover:bg-[#162B54]"
                  >
                    Masuk ke Ruangan
                  </button>
                </div>
              </div>
            ) : (
              // Form Input Screen
              <form onSubmit={handleCreateRoom} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="create-room-name" className="mb-1.5 block text-xs font-bold text-[#1F2C4F]">
                    Nama Ruang Belajar
                  </label>
                  <input
                    id="create-room-name"
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Contoh: Kelompok Proyek Aplikasi Web"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                  />
                  <p className="mt-1.5 text-[11px] text-[#56638A]">
                    Sistem otomatis menghasilkan 6 digit kode unik & membatasi kapasitas maksimal 10 orang.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-[10px] border border-[#DFE4F1] px-4 py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newRoomName.trim()}
                    className="flex items-center gap-1.5 rounded-[10px] bg-[#1D3668] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54] disabled:opacity-50"
                  >
                    <PlusCircle size={15} />
                    <span>{isSubmitting ? 'Membuat...' : 'Buat Ruang Belajar'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Gabung pakai Kode */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FCDDE6] text-[#BE2257]">
                  <KeyRound size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Gabung ke Ruang Belajar</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleJoinRoom} className="mt-5 space-y-4">
              <div>
                <label htmlFor="join-room-code" className="mb-1.5 block text-center text-xs font-bold text-[#1F2C4F]">
                  Masukkan 6 Karakter Kode Ruangan
                </label>
                <input
                  id="join-room-code"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="KODE6X"
                  className="h-14 w-full text-center font-mono text-3xl font-extrabold uppercase tracking-[0.25em] rounded-xl border-2 border-[#DFE4F1] bg-[#F6F7FC] text-[#1D3668] outline-none transition placeholder:text-[#C4C6D0] focus:border-[#BE2257] focus:bg-white focus:ring-4 focus:ring-[#BE2257]/15"
                />
                <p className="mt-2 text-center text-[11px] text-[#56638A]">
                  Format: 6 huruf kapital/angka acak. Setiap ruang berkapasitas maksimal 10 orang.
                </p>
                <div className="mt-2 flex justify-center gap-1.5 text-[10px] text-[#757780]">
                  <span>Contoh kode aktif:</span>
                  <button
                    type="button"
                    onClick={() => setJoinCodeInput('INOV26')}
                    className="font-mono font-bold text-[#1D3668] underline hover:text-[#BE2257]"
                  >
                    INOV26
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setJoinCodeInput('PENU10')}
                    title="Uji coba validasi ruangan penuh"
                    className="font-mono font-bold text-red-600 underline hover:text-red-700"
                  >
                    PENU10 (Penuh)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-[10px] border border-[#DFE4F1] px-4 py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || joinCodeInput.trim().length !== 6}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#BE2257] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#A11B48] disabled:opacity-50 shadow-sm"
                >
                  <KeyRound size={15} />
                  <span>{isSubmitting ? 'Memeriksa...' : 'Gabung Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Kick Member */}
      {memberToKick && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => !isSubmitting && setMemberToKick(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <UserMinus size={24} />
            </div>
            <h4 className="mt-4 text-center text-base font-bold text-[#1F2C4F]">Keluarkan Anggota?</h4>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin mengeluarkan <strong className="text-[#1F2C4F]">{memberToKick.name}</strong> dari ruang belajar ini?
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMemberToKick(null)}
                className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmKick}
                className="flex-1 rounded-[10px] bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Mengeluarkan...' : 'Ya, Keluarkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Hapus Ruangan (Admin) */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => !isSubmitting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={24} />
            </div>
            <h4 className="mt-4 text-center text-base font-bold text-[#1F2C4F]">Hapus Ruang Belajar?</h4>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Sebagai host, tindakan ini akan menghapus ruangan <strong className="text-[#1F2C4F]">"{activeGroup?.name}"</strong> beserta seluruh pesan obrolan secara permanen untuk semua anggota.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteRoom}
                className="flex-1 rounded-[10px] bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Keluar Ruangan (Member) */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => !isSubmitting && setShowLeaveModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
              <LogOut size={24} />
            </div>
            <h4 className="mt-4 text-center text-base font-bold text-[#1F2C4F]">Keluar dari Ruang Belajar?</h4>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin keluar dari ruangan <strong className="text-[#1F2C4F]">"{activeGroup?.name}"</strong>? Anda dapat bergabung kembali sewaktu-waktu dengan kode ruangan jika masih ada slot.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleLeaveRoom}
                className="flex-1 rounded-[10px] bg-[#BE2257] py-2.5 text-xs font-bold text-white transition hover:bg-[#9B1B46] disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : 'Ya, Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### `src/components/group/StudyGroupRoom.tsx`
*UI Group Chat + Attachment Picker popover (terintegrasi dalam satu file)*

```tsx
// src/components/group/StudyGroupRoom.tsx
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  LogOut,
  MessageSquareText,
  Paperclip,
  PlusCircle,
  Reply,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  useGroupStore,
  type GroupMemberItem,
  type StudyGroupItem,
} from '../../store/groupStore'

export interface Message {
  id: string
  senderId: string
  senderName: string
  senderAvatar?: string
  time: string
  kind: 'text' | 'image' | 'document'
  text?: string
  fileUrl?: string
  fileName?: string
  fileType?: 'PDF' | 'Word' | 'JPG'
  fileSize?: string
  imageUrl?: string
  imageLabel?: string
  replyTo?: string
  isDeleted?: boolean
}

interface SupabaseChatMessageRow {
  id: string
  group_id: string
  sender_id: string
  reply_to_id: string | null
  kind: 'text' | 'image' | 'document'
  text: string | null
  file_url: string | null
  file_name: string | null
  file_type: 'PDF' | 'Word' | 'JPG' | null
  file_size: string | null
  image_url: string | null
  image_label: string | null
  is_deleted: boolean
  created_at: string
}

function getMemberColor(_name: string, index: number) {
  const colors = [
    'bg-[#1D3668]',
    'bg-[#BE2257]',
    'bg-[#003964]',
    'bg-[#8E1744]',
  ]
  return colors[index % colors.length]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mapSupabaseRowToMessage(
  row: SupabaseChatMessageRow,
  currentUserId: string | undefined,
  members: GroupMemberItem[],
  profileCache?: Map<string, { name: string; avatar: string }>
): Message {
  const isOwn = Boolean(currentUserId && row.sender_id === currentUserId)
  const member = members.find((m) => m.userId === row.sender_id)
  const cachedProfile = profileCache?.get(row.sender_id)

  let senderName = 'Rekan Belajar'
  let senderAvatar = 'RB'

  if (isOwn) {
    senderName = 'Anda'
    senderAvatar = cachedProfile?.avatar || 'Anda'.slice(0, 2).toUpperCase()
  } else if (member?.name) {
    senderName = member.name.replace(' (Anda)', '').replace(' (Host)', '')
    senderAvatar = member.avatar
  } else if (cachedProfile?.name) {
    senderName = cachedProfile.name
    senderAvatar = cachedProfile.avatar
  }

  const time = row.created_at
    ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at))
    : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())

  return {
    id: row.id,
    senderId: isOwn ? 'current-user' : row.sender_id,
    senderName,
    senderAvatar,
    time,
    kind: row.kind,
    text: row.is_deleted ? 'Pesan ini telah dihapus' : (row.text || undefined),
    fileUrl: row.file_url || undefined,
    fileName: row.file_name || undefined,
    fileType: (row.file_type as 'PDF' | 'Word' | 'JPG') || undefined,
    fileSize: row.file_size || undefined,
    imageUrl: row.image_url || undefined,
    imageLabel: row.image_label || undefined,
    replyTo: row.reply_to_id || undefined,
    isDeleted: Boolean(row.is_deleted),
  }
}

function MessageAttachment({
  message,
  isOwn,
}: {
  message: Message
  isOwn: boolean
}) {
  if (message.kind === 'image') {
    return (
      <div
        className={`mt-2 overflow-hidden rounded-xl border p-2.5 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <ImageIcon
              size={16}
              className={isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}
              aria-hidden="true"
            />
            <span className="truncate text-xs font-bold">
              {message.imageLabel || 'Gambar materi (JPG)'}
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
              isOwn
                ? 'bg-white/20 text-white'
                : 'bg-[#D6F0DE] text-[#17623A]'
            }`}
          >
            JPG
          </span>
        </div>

        {message.imageUrl ? (
          <div className="mt-2 overflow-hidden rounded-lg bg-black/10">
            <img
              src={message.imageUrl}
              alt={message.imageLabel || 'Pratinjau lampiran gambar'}
              className="max-h-60 w-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div
            className={`mt-2 flex h-24 sm:h-28 items-center justify-center rounded-lg text-xs font-semibold ${
              isOwn ? 'bg-black/20 text-white/90' : 'bg-[#E1EAF8]/60 text-[#1D3668]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon size={15} /> Pratinjau Alur & Diagram Materi (JPG)
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className={isOwn ? 'text-white/75' : 'text-[#56638A]'}>
            JPG · {message.fileSize || '1.8 MB'}
          </span>
          <a
            href={
              message.imageUrl ||
              message.fileUrl ||
              `https://smart-learning-app-mu.vercel.app/downloads/${encodeURIComponent(message.imageLabel || 'gambar_materi.jpg')}`
            }
            download={message.imageLabel || 'gambar_materi.jpg'}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 font-semibold hover:underline ${
              isOwn ? 'text-white' : 'text-[#1D3668]'
            }`}
          >
            <Download size={13} /> Unduh
          </a>
        </div>
      </div>
    )
  }

  if (message.kind === 'document') {
    const fileName = message.fileName || 'Tugas_Kelompok.pdf'
    const fileType = message.fileType || 'PDF'
    const isPdf = fileType === 'PDF'
    const downloadHref =
      message.fileUrl ||
      `https://smart-learning-app-mu.vercel.app/downloads/${encodeURIComponent(fileName)}`

    return (
      <div
        className={`mt-2 flex items-center gap-3 rounded-xl border p-2.5 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-2xs'
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            isPdf ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#E1EAF8] text-[#1D3668]'
          }`}
        >
          <FileText size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`block truncate text-xs font-bold ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
              {fileName}
            </span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-extrabold ${
                isPdf
                  ? isOwn
                    ? 'bg-rose-400/20 text-rose-200'
                    : 'bg-[#FCDDE6] text-[#8E1744]'
                  : isOwn
                    ? 'bg-blue-400/20 text-blue-200'
                    : 'bg-[#E1EAF8] text-[#1D3668]'
              }`}
            >
              {fileType}
            </span>
          </div>
          <span className={`mt-0.5 block text-[11px] ${isOwn ? 'text-white/75' : 'text-[#56638A]'}`}>
            {fileType} · {message.fileSize || (isPdf ? '2.4 MB' : '1.5 MB')}
          </span>
        </div>
        <a
          href={downloadHref}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Unduh ${fileName}`}
          title={`Unduh ${fileName}`}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
            isOwn
              ? 'text-white/80 hover:bg-white/20 hover:text-white'
              : 'text-[#56638A] hover:bg-[#E1EAF8] hover:text-[#1D3668]'
          }`}
        >
          <Download size={15} aria-hidden="true" />
        </a>
      </div>
    )
  }

  return null
}

const EMPTY_MEMBERS: GroupMemberItem[] = []

type AttachmentType = 'pdf' | 'word' | 'jpg'

export default function StudyGroupRoom() {
  const navigate = useNavigate()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()

  const currentUser = useAuthStore((state) => state.user)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const activeGroupId = useGroupStore((state) => state.activeGroupId)
  const groups = useGroupStore((state) => state.groups)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup)
  const kickMember = useGroupStore((state) => state.kickMember)
  const deleteGroup = useGroupStore((state) => state.deleteGroup)
  const leaveGroup = useGroupStore((state) => state.leaveGroup)
  const isGroupsLoading = useGroupStore((state) => state.isLoading)

  // Target group ID from route or store
  const targetGroupId = routeGroupId || activeGroupId || activeGroup?.id || ''

  // Standalone group data fallback (for direct URL access or refresh)
  const [standaloneGroup, setStandaloneGroup] = useState<StudyGroupItem | null>(null)
  const [showMembersDrawer, setShowMembersDrawer] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [chatError, setChatError] = useState<string | null>(null)

  // Confirmation Modals State
  const [confirmKickTarget, setConfirmKickTarget] = useState<GroupMemberItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeUploadType, setActiveUploadType] = useState<AttachmentType>('pdf')
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const profilesCacheRef = useRef<Map<string, { name: string; avatar: string }>>(new Map())

  // Resolve current group item
  const currentGroup =
    (activeGroup?.id === targetGroupId ? activeGroup : null) ||
    standaloneGroup ||
    groups.find((g) => g.id === targetGroupId) ||
    activeGroup

  const groupName = currentGroup?.name || 'Ruang Belajar Co-Focus'
  const groupMembers = currentGroup?.members ?? EMPTY_MEMBERS
  const groupMembersRef = useRef<GroupMemberItem[]>(EMPTY_MEMBERS)
  useEffect(() => {
    groupMembersRef.current = groupMembers
  }, [groupMembers])
  const joinCode = currentGroup?.joinCode || ''
  const maxMembers = currentGroup?.maxMembers && currentGroup.maxMembers >= 10 ? currentGroup.maxMembers : 10
  const remainingSlots = Math.max(0, maxMembers - groupMembers.length)

  // Check if current user is the host/creator of this room
  const isHost = Boolean(
    (currentUser?.id && currentGroup?.hostId === currentUser.id) ||
    groupMembers.some((m) => m.userId === currentUser?.id && m.isHost)
  )

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Synchronize active group with targetGroupId
  useEffect(() => {
    if (!targetGroupId) return

    // If active group already matches, nothing to do
    if (activeGroup?.id === targetGroupId) return

    // Try finding in loaded groups
    const found = groups.find((g) => g.id === targetGroupId)
    if (found) {
      setActiveGroup(targetGroupId)
      return
    }

    // Otherwise, fetch groups from Supabase
    if (currentUser?.id) {
      void fetchMyGroups(currentUser.id)
    }

    // Direct query fallback for instant header rendering
    let isMounted = true
    async function loadGroupDirectly() {
      try {
        const { data: gData } = await supabase
          .from('study_groups')
          .select('*')
          .eq('id', targetGroupId)
          .maybeSingle()

        if (!gData || !isMounted) return

        const { data: mData } = await supabase
          .from('study_group_members')
          .select('*')
          .eq('group_id', targetGroupId)

        const memberUserIds = (mData || []).map((m: { user_id: string }) => m.user_id)
        let profileMap = new Map<string, { name: string; major?: string }>()

        if (memberUserIds.length > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, name, major')
            .in('id', memberUserIds)
          if (pData) {
            profileMap = new Map(pData.map((p) => [p.id, p]))
          }
        }

        const mappedMembers: GroupMemberItem[] = (mData || []).map((m: {
          id: string
          user_id: string
          role: string
          status: string
          course: string | null
        }) => {
          const prof = profileMap.get(m.user_id)
          const isCurrentUser = m.user_id === currentUser?.id
          const name = prof?.name || (isCurrentUser ? currentUser?.name || 'Anda' : 'Mahasiswa')
          const initials =
            name
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'M'

          return {
            id: m.id,
            userId: m.user_id,
            name: isCurrentUser ? `${name} (Anda)` : name,
            avatar: initials,
            status: m.status === 'fokus' ? 'fokus' : 'istirahat',
            course: m.course || prof?.major || 'Mahasiswa',
            isHost: m.role === 'owner',
          }
        })

        if (isMounted) {
          const effectiveMax = gData.max_members && gData.max_members >= 10 ? gData.max_members : 10
          if (gData.max_members && gData.max_members < 10) {
            void supabase.from('study_groups').update({ max_members: 10 }).eq('id', gData.id)
          }

          setStandaloneGroup({
            id: gData.id,
            name: gData.name,
            description: gData.description || '',
            joinCode: gData.join_code,
            maxMembers: effectiveMax,
            hostId: gData.host_id,
            members: mappedMembers,
            createdAt: gData.created_at,
          })
        }
      } catch (err) {
        console.warn('Gagal memuat grup langsung:', err)
      }
    }

    void loadGroupDirectly()
    return () => {
      isMounted = false
    }
  }, [targetGroupId, activeGroup?.id, groups, currentUser?.id, currentUser?.name, fetchMyGroups, setActiveGroup])

  // Realtime Supabase Channel Subscription & History Fetch
  useEffect(() => {
    if (!targetGroupId) return

    let isMounted = true

    // 1. Fetch Chat History
    async function loadChatHistory() {
      setIsLoadingMessages(true)
      setChatError(null)
      try {
        const { data, error } = await supabase
          .from('group_chat_messages')
          .select('*')
          .eq('group_id', targetGroupId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('SUPABASE ERROR (loadChatHistory):', error)
          if (isMounted) setChatError(error.message)
          return
        }

        if (isMounted && data) {
          const rawRows = data as SupabaseChatMessageRow[]

          // Cache current user profile
          if (currentUser?.id) {
            const myInitials = currentUser.name
              ? currentUser.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : 'A'
            profilesCacheRef.current.set(currentUser.id, {
              name: currentUser.name || 'Anda',
              avatar: myInitials,
            })
          }

          // Cache known group members
          for (const m of groupMembersRef.current) {
            if (m.userId && !profilesCacheRef.current.has(m.userId)) {
              profilesCacheRef.current.set(m.userId, {
                name: m.name.replace(' (Anda)', '').replace(' (Host)', ''),
                avatar: m.avatar,
              })
            }
          }

          // Fetch any remaining sender profiles
          const uncachedIds = Array.from(new Set(rawRows.map((r) => r.sender_id))).filter(
            (id) => id && !profilesCacheRef.current.has(id)
          )

          if (uncachedIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', uncachedIds)

            if (profilesData) {
              for (const p of profilesData) {
                const initials = p.name
                  ? p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  : 'RB'
                profilesCacheRef.current.set(p.id, {
                  name: p.name || 'Rekan Belajar',
                  avatar: initials,
                })
              }
            }
          }

          const mapped = rawRows.map((row) =>
            mapSupabaseRowToMessage(row, currentUser?.id, groupMembersRef.current, profilesCacheRef.current)
          )
          setMessages(mapped)
        }
      } catch (err) {
        console.error('SUPABASE ERROR (loadChatHistory catch):', err)
        if (isMounted) {
          setChatError(err instanceof Error ? err.message : 'Gagal memuat pesan chat.')
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false)
      }
    }

    void loadChatHistory()

    // 2. Setup Supabase Realtime Subscription for group chat messages
    const chatChannelName = `room-chat:${targetGroupId}`
    const chatChannel = supabase
      .channel(chatChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${targetGroupId}`,
        },
        async (payload) => {
          const incomingRow = payload.new as SupabaseChatMessageRow
          if (!incomingRow || !incomingRow.id) return

          let senderName = 'Rekan Belajar'
          let senderAvatar = 'RB'

          // Immediately query sender profile if missing
          if (currentUser?.id && incomingRow.sender_id === currentUser.id) {
            senderName = 'Anda'
            senderAvatar = currentUser.name
              ? currentUser.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : 'A'
          } else if (profilesCacheRef.current.has(incomingRow.sender_id)) {
            const cached = profilesCacheRef.current.get(incomingRow.sender_id)!
            senderName = cached.name
            senderAvatar = cached.avatar
          } else if (incomingRow.sender_id) {
            try {
              const { data: p } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('id', incomingRow.sender_id)
                .maybeSingle()

              if (p?.name) {
                senderName = p.name
                senderAvatar =
                  p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'RB'
                profilesCacheRef.current.set(p.id, { name: senderName, avatar: senderAvatar })
              }
            } catch (err) {
              console.warn('Gagal memuat profil pengirim realtime:', err)
            }
          }

          const isOwn = Boolean(currentUser?.id && incomingRow.sender_id === currentUser.id)
          const time = incomingRow.created_at
            ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(incomingRow.created_at))
            : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())

          const newMessageWithProfile: Message = {
            id: incomingRow.id,
            senderId: isOwn ? 'current-user' : incomingRow.sender_id,
            senderName,
            senderAvatar,
            time,
            kind: incomingRow.kind,
            text: incomingRow.is_deleted ? 'Pesan ini telah dihapus' : (incomingRow.text || undefined),
            fileName: incomingRow.file_name || undefined,
            fileType: (incomingRow.file_type as 'PDF' | 'Word' | 'JPG') || undefined,
            fileSize: incomingRow.file_size || undefined,
            imageUrl: incomingRow.image_url || undefined,
            imageLabel: incomingRow.image_label || undefined,
            replyTo: incomingRow.reply_to_id || undefined,
            isDeleted: Boolean(incomingRow.is_deleted),
          }

          // Immutable functional update
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessageWithProfile.id)) {
              return prev.map((m) => (m.id === newMessageWithProfile.id ? newMessageWithProfile : m))
            }
            return [...prev, newMessageWithProfile]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${targetGroupId}`,
        },
        (payload) => {
          const updatedRow = payload.new as SupabaseChatMessageRow
          if (!updatedRow?.id) return

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === updatedRow.id) {
                return {
                  ...msg,
                  isDeleted: Boolean(updatedRow.is_deleted),
                  text: updatedRow.is_deleted ? 'Pesan ini telah dihapus' : (updatedRow.text || msg.text),
                }
              }
              return msg
            })
          )
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error pada room-chat:', targetGroupId)
        }
      })

    // 3. Realtime Subscription for member changes & kick
    const membersChannelName = `room-members:${targetGroupId}`
    const membersChannel = supabase
      .channel(membersChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_group_members',
          filter: `group_id=eq.${targetGroupId}`,
        },
        (payload) => {
          // If current user was removed/kicked, redirect to cofocus
          if (
            payload.eventType === 'DELETE' &&
            payload.old &&
            (payload.old as { user_id?: string }).user_id === currentUser?.id
          ) {
            navigate('/cofocus')
            return
          }

          // Sinkronisasi status/anggota realtime saat ada UPDATE
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedRow = payload.new as {
              id?: string
              user_id?: string
              group_id?: string
              status?: string
              course?: string | null
            }
            useGroupStore.getState().handleMemberUpdate(updatedRow)

            // Perbarui state standaloneGroup agar kartu anggota di ruang ini langsung ter-render realtime
            setStandaloneGroup((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                members: prev.members.map((m) => {
                  const isMatch =
                    (updatedRow.id && m.id === updatedRow.id) ||
                    (updatedRow.user_id && m.userId === updatedRow.user_id)
                  if (!isMatch) return m
                  return {
                    ...m,
                    status: updatedRow.status === 'fokus' ? 'fokus' : 'istirahat',
                    course: updatedRow.course || m.course,
                  }
                }),
              }
            })
          }

          if (currentUser?.id) {
            void fetchMyGroups(currentUser.id)
          }
        }
      )
      .subscribe()

    // 4. Realtime Subscription for room deletion by host
    const groupChannelName = `room-group:${targetGroupId}`
    const groupChannel = supabase
      .channel(groupChannelName)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'study_groups',
          filter: `id=eq.${targetGroupId}`,
        },
        () => {
          navigate('/cofocus')
        }
      )
      .subscribe()

    // Cleanup: remove channels to prevent memory leaks and duplicate connections
    return () => {
      isMounted = false
      void supabase.removeChannel(chatChannel)
      void supabase.removeChannel(membersChannel)
      void supabase.removeChannel(groupChannel)
    }
  }, [targetGroupId, currentUser?.id, currentUser?.name, fetchMyGroups, navigate])

  // Copy join code helper
  async function handleCopyCode() {
    if (!joinCode) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(joinCode)
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea')
        textArea.value = joinCode
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      console.warn('Gagal menyalin kode ke clipboard:', err)
    }
  }

  // Admin Kick Member
  async function handleConfirmKick() {
    if (!confirmKickTarget?.userId || !targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await kickMember(targetGroupId, confirmKickTarget.userId)
      if (!res.success) {
        setChatError(res.error || 'Gagal mengeluarkan anggota.')
      } else {
        setConfirmKickTarget(null)
        if (currentUser?.id) {
          void fetchMyGroups(currentUser.id)
        }
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat mengeluarkan anggota.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Admin Delete Room
  async function handleConfirmDelete() {
    if (!targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await deleteGroup(targetGroupId)
      if (!res.success) {
        setChatError(res.error || 'Gagal menghapus ruang belajar.')
      } else {
        setShowDeleteConfirm(false)
        navigate('/cofocus')
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat menghapus ruang belajar.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Member Leave Room
  async function handleConfirmLeave() {
    if (!targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await leaveGroup(targetGroupId)
      if (!res.success) {
        setChatError(res.error || 'Gagal keluar dari ruang belajar.')
      } else {
        setShowLeaveConfirm(false)
        navigate('/cofocus')
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat keluar dari ruang belajar.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Close attachment dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false)
      }
    }

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAttachmentMenu])

  function triggerNativeUpload(type: AttachmentType) {
    setActiveUploadType(type)
    setShowAttachmentMenu(false)
    if (fileInputRef.current) {
      if (type === 'pdf') {
        fileInputRef.current.accept = '.pdf,application/pdf'
      } else if (type === 'word') {
        fileInputRef.current.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      } else if (type === 'jpg') {
        fileInputRef.current.accept = '.jpg,.jpeg,.png,image/jpeg,image/png'
      }
      fileInputRef.current.click()
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !targetGroupId || !currentUser?.id) return

    const fileName = file.name
    const lowerName = fileName.toLowerCase()
    const sizeStr = formatFileSize(file.size)
    const replyId = replyingTo?.id || null
    const customText = draft.trim()

    let kind: 'text' | 'image' | 'document' = 'document'
    let fileType: 'PDF' | 'Word' | 'JPG' | null = null
    let imageLabel: string | null = null
    let text = customText

    if (lowerName.endsWith('.pdf')) {
      kind = 'document'
      fileType = 'PDF'
      if (!text) text = `Melampirkan dokumen PDF: ${fileName}`
    } else if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) {
      kind = 'document'
      fileType = 'Word'
      if (!text) text = `Melampirkan dokumen Word: ${fileName}`
    } else if (
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      file.type.startsWith('image/')
    ) {
      kind = 'image'
      fileType = 'JPG'
      imageLabel = fileName
      if (!text) text = `Melampirkan gambar/foto: ${fileName}`
    } else {
      if (activeUploadType === 'word') {
        kind = 'document'
        fileType = 'Word'
        if (!text) text = `Melampirkan dokumen Word: ${fileName}`
      } else {
        kind = 'document'
        fileType = 'PDF'
        if (!text) text = `Melampirkan dokumen: ${fileName}`
      }
    }

    setDraft('')
    setReplyingTo(null)
    event.target.value = ''

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind,
          file_name: fileName,
          file_type: fileType,
          file_size: sizeStr,
          image_label: imageLabel,
          text,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (handleFileSelected):', error)
        setChatError(error.message)
      } else if (data) {
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (handleFileSelected):', err)
    }
  }

  // Sample attachment generators for instant test
  async function sendSamplePdf() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Ini draf revisi tugas Bab 3 dalam format PDF. Silakan ditinjau bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'document',
          file_name: 'Laporan_Bab_3_Metodologi.pdf',
          file_type: 'PDF',
          file_size: '2.8 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSamplePdf):', error)
        setChatError(error.message)
      } else if (data) {
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSamplePdf):', err)
    }
  }

  async function sendSampleWord() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Draf makalah format Word (.docx) untuk kita edit dan lengkapi bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'document',
          file_name: 'Draf_Makalah_Inovasi_Kelompok.docx',
          file_type: 'Word',
          file_size: '1.4 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSampleWord):', error)
        setChatError(error.message)
      } else if (data) {
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleWord):', err)
    }
  }

  async function sendSampleJpg() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Bagan alur rancangan antarmuka dan sistem format JPG.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'image',
          image_label: 'Diagram_Alur_Sistem_SmartFocus.jpg',
          file_size: '1.9 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSampleJpg):', error)
        setChatError(error.message)
      } else if (data) {
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleJpg):', err)
    }
  }

  // Send normal text message
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'text',
          text,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendMessage):', error)
        setChatError(error.message)
      } else if (data) {
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => {
          if (prev.some((m) => m.id === formatted.id)) return prev
          return [...prev, formatted]
        })
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendMessage):', err)
    }
  }

  // Soft delete message
  async function handleDeleteMessage(messageId: string) {
    if (!currentUser?.id) return

    // Optimistic local update
    setMessages((current) =>
      current.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              isDeleted: true,
              text: 'Pesan ini telah dihapus',
            }
          : msg
      )
    )
    if (replyingTo?.id === messageId) {
      setReplyingTo(null)
    }

    try {
      const { error } = await supabase
        .from('group_chat_messages')
        .update({ is_deleted: true })
        .eq('id', messageId)
        .eq('sender_id', currentUser.id)

      if (error) {
        console.error('SUPABASE ERROR (handleDeleteMessage):', error)
        setChatError(error.message)
      }
    } catch (err) {
      console.error('SUPABASE ERROR (handleDeleteMessage):', err)
    }
  }

  if (isGroupsLoading && !currentGroup) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F3F4FA] p-6 text-center font-[Montserrat]">
        <Loader2 size={36} className="animate-spin text-[#BE2257]" />
        <p className="mt-4 text-sm font-bold text-[#1F2C4F]">Memuat ruang obrolan...</p>
        <p className="mt-1 text-xs text-[#56638A]">Menghubungkan ke server realtime</p>
      </div>
    )
  }

  if (!targetGroupId) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F3F4FA] p-6 text-center font-[Montserrat]">
        <div className="flex flex-col items-center max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-7 shadow-sm">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={28} />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-[#1F2C4F]">Tidak Ada Ruangan Aktif</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#56638A]">
            Silakan pilih atau buat ruang belajar terlebih dahulu dari menu Co-Focus.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cofocus')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1D3668] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54]"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Co-Focus</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-full bg-[#F3F4FA] overflow-hidden font-[Montserrat] select-text">
      {/* Hidden Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      {/* 1. Header Atas (Aman dari Notch / Camera Cutout via safe-area-inset & min-height) */}
      <header className="shrink-0 bg-white border-b border-[#DFE4F1] px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2.5 min-h-[calc(4rem+env(safe-area-inset-top,0px))] flex items-center justify-between z-20 shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Tombol Kembali ke Co-Focus */}
          <button
            type="button"
            onClick={() => navigate('/cofocus')}
            aria-label="Kembali ke Co-Focus"
            title="Kembali ke Co-Focus"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#1D3668] transition hover:bg-[#E1EAF8] active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar Monogram & Detail Ruangan */}
          <button
            type="button"
            onClick={() => setShowMembersDrawer(true)}
            className="flex items-center gap-2.5 text-left group min-w-0 focus:outline-none"
            title="Klik untuk melihat anggota & pengaturan ruangan"
          >
            <div className="relative">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1D3668] text-xs font-extrabold text-white shadow-xs group-hover:bg-[#162B54] transition">
                {groupName.slice(0, 2).toUpperCase()}
              </span>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm sm:text-base font-bold text-[#1F2C4F] group-hover:text-[#1D3668] transition">
                  {groupName}
                </h1>
                {isHost && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#E1EAF8] px-2 py-0.2 text-[10px] font-extrabold text-[#1D3668]">
                    <ShieldCheck size={11} /> Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#56638A] leading-tight flex items-center gap-1.5 truncate">
                <span>{groupMembers.length} / {maxMembers} Anggota</span>
                <span>·</span>
                <span className="text-[#17623A] font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#17623A] animate-pulse inline-block" />
                  Realtime
                </span>
              </p>
            </div>
          </button>
        </div>

        {/* Action Header: Salin Kode & Buka Info Anggota */}
        <div className="flex items-center gap-2 shrink-0">
          {joinCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              title="Salin Kode Ruang Belajar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] px-2.5 py-1.5 text-xs font-bold text-[#1D3668] transition hover:border-[#1D3668]/30 hover:bg-[#E1EAF8] active:scale-95"
            >
              <span className="hidden sm:inline font-mono">Kode:</span>
              <span className="font-mono">{joinCode}</span>
              {copiedCode ? <Check size={14} className="text-[#17623A]" /> : <Copy size={14} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMembersDrawer((prev) => !prev)}
            aria-label="Info & Anggota Kelompok"
            title="Lihat Anggota & Pengaturan Ruangan"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition active:scale-95 ${
              showMembersDrawer
                ? 'border-[#1D3668] bg-[#E1EAF8] text-[#1D3668]'
                : 'border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] hover:text-[#1D3668]'
            }`}
          >
            <UsersRound size={18} />
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {chatError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1 truncate">{chatError}</span>
          <button
            type="button"
            onClick={() => setChatError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Chat Feed Area (Native WhatsApp / Telegram Style) */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-[88px] space-y-3 relative bg-[#F8F9FD]">
        {/* System Date Pill */}
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFE4F1] bg-white/90 backdrop-blur-xs px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#757780] shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#17623A]" />
            Ruang Diskusi Realtime · Maks {maxMembers} Anggota
          </span>
        </div>

        {/* Loading Spinner */}
        {isLoadingMessages && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#BE2257]" />
            <p className="mt-2.5 text-xs font-semibold text-[#56638A]">Memuat pesan percakapan...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#E1EAF8] text-[#1D3668]">
              <MessageSquareText size={30} aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-bold text-[#1F2C4F]">Belum ada pesan di ruang obrolan</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#56638A]">
              Sapa rekan belajarmu atau bagikan berkas tugas (PDF, Word, JPG) untuk memulai kolaborasi.
            </p>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((message) => {
          const isOwn = message.senderId === 'current-user'
          const repliedMessage = message.replyTo
            ? messages.find((m) => m.id === message.replyTo)
            : undefined

          return (
            <article
              key={message.id}
              className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {/* Other Sender Avatar */}
              {!isOwn && (
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white shadow-2xs ${getMemberColor(message.senderName, 1)}`}
                  title={message.senderName}
                >
                  {message.senderAvatar || message.senderName.slice(0, 2).toUpperCase()}
                </span>
              )}

              {/* Chat Bubble Container */}
              <div
                className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 sm:p-3.5 shadow-2xs ${
                  isOwn
                    ? 'rounded-tr-none bg-[#1D3668] text-white'
                    : 'rounded-tl-none border border-[#DFE4F1] bg-white text-[#1F2C4F]'
                }`}
              >
                {/* Sender Name for Received Messages */}
                {!isOwn && (
                  <span className="mb-1 block text-xs font-bold text-[#BE2257]">
                    {message.senderName}
                  </span>
                )}

                {/* Reply Quote Banner */}
                {repliedMessage && !message.isDeleted && (
                  <div
                    className={`mb-2 rounded-lg border-l-4 px-2.5 py-1.5 text-xs ${
                      isOwn
                        ? 'border-[#BE2257] bg-white/10 text-white/90'
                        : 'border-[#1D3668] bg-[#F6F7FC] text-[#56638A]'
                    }`}
                  >
                    <p className={`font-bold ${isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}`}>
                      {repliedMessage.senderName}
                    </p>
                    <p className={`mt-0.5 line-clamp-2 ${repliedMessage.isDeleted ? 'italic opacity-75' : ''}`}>
                      {repliedMessage.isDeleted
                        ? 'Pesan ini telah dihapus'
                        : repliedMessage.text || repliedMessage.fileName || repliedMessage.imageLabel || 'Lampiran berkas'}
                    </p>
                  </div>
                )}

                {/* Message Body */}
                {message.isDeleted ? (
                  <p className={`text-xs italic leading-relaxed ${isOwn ? 'text-white/70' : 'text-[#757780]'}`}>
                    Pesan ini telah dihapus
                  </p>
                ) : (
                  <>
                    {message.text && (
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
                        {message.text}
                      </p>
                    )}
                    <MessageAttachment message={message} isOwn={isOwn} />
                  </>
                )}

                {/* Message Timestamp & Checkmarks */}
                <div
                  className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                    isOwn ? 'text-white/70' : 'text-[#757780]'
                  }`}
                >
                  <time>{message.time}</time>
                  {isOwn && <CheckCheck size={13} className="text-[#9CC3FF]" aria-hidden="true" />}
                </div>

                {/* Hover / Long-press Actions (Reply & Delete) */}
                {!message.isDeleted && (
                  <div
                    className={`absolute -top-3 ${
                      isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                    } hidden group-hover:flex items-center gap-1 z-10`}
                  >
                    <button
                      type="button"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Balas pesan"
                      title="Balas pesan"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-[#DFE4F1] bg-white text-[#56638A] shadow-xs transition hover:bg-[#E1EAF8] hover:text-[#1D3668]"
                    >
                      <Reply size={13} />
                    </button>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(message.id)}
                        aria-label="Hapus pesan"
                        title="Hapus pesan"
                        className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-white text-red-600 shadow-xs transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* 3. Attachment Menu Popover */}
      {showAttachmentMenu && (
        <div
          ref={attachmentMenuRef}
          className="fixed bottom-[76px] left-3 sm:left-6 z-30 w-80 sm:w-96 rounded-2xl border border-[#DFE4F1] bg-white p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#DFE4F1] pb-2">
            <span className="text-xs font-bold text-[#1F2C4F] flex items-center gap-1.5">
              <Paperclip size={14} className="text-[#1D3668]" />
              Pilih Berkas Lampiran
            </span>
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(false)}
              className="grid h-6 w-6 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {/* Opsi 1: PDF */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#FFF5F8] hover:border-[#FCDDE6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FCDDE6] text-[#8E1744]">
                    <FileText size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Dokumen PDF (.pdf)</p>
                    <p className="text-[10px] text-[#56638A]">Laporan final & modul kuliah</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('pdf')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah PDF
                </button>
                <button
                  type="button"
                  onClick={sendSamplePdf}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel PDF
                </button>
              </div>
            </div>

            {/* Opsi 2: Word */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#F3F6FD] hover:border-[#C5D5F0]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                    <FileText size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Dokumen Word (.docx)</p>
                    <p className="text-[10px] text-[#56638A]">Draf makalah & catatan tugas</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('word')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah Word
                </button>
                <button
                  type="button"
                  onClick={sendSampleWord}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel Word
                </button>
              </div>
            </div>

            {/* Opsi 3: JPG */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#F5FBF7] hover:border-[#D6F0DE]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D6F0DE] text-[#17623A]">
                    <ImageIcon size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Gambar / Foto JPG (.jpg)</p>
                    <p className="text-[10px] text-[#56638A]">Bagan alur & diagram antarmuka</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('jpg')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah JPG
                </button>
                <button
                  type="button"
                  onClick={sendSampleJpg}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel JPG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Input Bar Paling Bawah (Aman dari Keyboard HP & Nav Bar / Home Indicator) */}
      <footer className="fixed bottom-0 left-0 right-0 w-full bg-white pb-safe border-t border-[#DFE4F1] p-2.5 sm:p-3 pb-[max(calc(0.65rem+env(safe-area-inset-bottom,0px)),0.65rem)] z-20 shadow-[0_-2px_10px_rgba(29,54,104,0.03)]">
        {/* Banner Membalas Pesan */}
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[#DFE4F1] bg-[#E1EAF8]/70 px-3 py-1.5 text-xs text-[#1D3668]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Reply size={13} className="shrink-0 text-[#1D3668]" />
              <span className="truncate font-semibold text-[#1D3668]">
                Membalas {replyingTo.senderName}:{' '}
                <span className="font-normal text-[#1F2C4F]">
                  {replyingTo.text || replyingTo.fileName || replyingTo.imageLabel || 'Lampiran'}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Batal membalas"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-white text-[#56638A] hover:text-[#BE2257]"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          {/* Tombol Lampiran Berkas */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu((prev) => !prev)}
            aria-label="Pilih berkas lampiran (PDF, Word, JPG)"
            title="Lampirkan berkas (PDF, Word, JPG)"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
              showAttachmentMenu
                ? 'border-[#1D3668] bg-[#E1EAF8] text-[#1D3668]'
                : 'border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] hover:bg-[#E1EAF8] hover:text-[#1D3668]'
            }`}
          >
            <Paperclip size={18} />
          </button>

          {/* Quick JPG Upload Button */}
          <button
            type="button"
            onClick={() => triggerNativeUpload('jpg')}
            aria-label="Kirim gambar JPG"
            title="Kirim gambar JPG"
            className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] transition hover:bg-[#E1EAF8] hover:text-[#1D3668] active:scale-95"
          >
            <ImageIcon size={18} />
          </button>

          {/* Input Text Field */}
          <label className="sr-only" htmlFor="group-chat-input">
            Tulis pesan obrolan
          </label>
          <input
            id="group-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              }, 250)
            }}
            placeholder="Ketik pesan diskusi..."
            className="h-11 min-w-0 flex-1 rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] placeholder:text-[#757780] outline-none transition focus:bg-white focus:border-[#1D3668] focus:ring-1 focus:ring-[#1D3668]"
          />

          {/* Tombol Kirim */}
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Kirim pesan"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#BE2257] text-white shadow-sm transition hover:bg-[#A11B48] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>

      {/* 5. Slide-Over Drawer: Informasi & Anggota Kelompok (Aman dari Notch Atas & Bawah) */}
      {showMembersDrawer && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-[#0B1A3D]/40 backdrop-blur-xs transition-opacity"
          onClick={() => setShowMembersDrawer(false)}
        >
          <div
            className="w-full max-w-sm sm:w-96 bg-white h-full shadow-2xl flex flex-col p-5 pt-[max(calc(1.25rem+env(safe-area-inset-top,0px)),1.5rem)] pb-[max(calc(1.25rem+env(safe-area-inset-bottom,0px)),1.5rem)] overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                  <UsersRound size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Info Ruang Belajar</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMembersDrawer(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Room Summary Card */}
            <div className="mt-4 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-extrabold text-[#1F2C4F]">{groupName}</h4>
                {isHost && (
                  <span className="rounded-full bg-[#1D3668] px-2 py-0.5 text-[9px] font-extrabold text-white shrink-0">
                    Host / Admin
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#56638A]">
                {currentGroup?.description || 'Ruang kolaborasi terpadu untuk berdiskusi materi kuliah dan berbagi tugas.'}
              </p>
              {joinCode && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-2.5 border border-[#DFE4F1]">
                  <div>
                    <span className="block text-[10px] font-bold text-[#757780] uppercase">Kode Undangan</span>
                    <span className="font-mono text-base font-extrabold text-[#1D3668]">{joinCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 rounded-md bg-[#1D3668] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#162B54]"
                  >
                    {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Members List */}
            <div className="mt-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#757780]">
                  Daftar Anggota ({groupMembers.length} / {maxMembers})
                </h4>
                <span className="text-[11px] font-bold text-[#17623A]">
                  {remainingSlots > 0 ? `${remainingSlots} slot tersisa` : 'Penuh'}
                </span>
              </div>

              <ul className="space-y-2">
                {groupMembers.map((member, index) => {
                  const isFocus = member.status === 'fokus'
                  const isSelf = member.userId === currentUser?.id
                  const canKick = isHost && !isSelf && !member.isHost

                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-2.5 rounded-xl border border-[#DFE4F1] bg-white p-2.5 shadow-2xs"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${getMemberColor(member.name, index)}`}
                      >
                        {member.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#1F2C4F]">
                          {member.name}
                          {member.isHost && (
                            <span className="ml-1.5 rounded-full bg-[#E1EAF8] px-1.5 py-0.2 text-[9px] font-bold text-[#1D3668]">
                              Host
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-[#56638A]">
                          {(isSelf && currentUser?.major) || member.course || 'Mahasiswa'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isFocus ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#FDEBC8] text-[#7A4B00]'
                          }`}
                        >
                          {isFocus ? 'Fokus' : 'Istirahat'}
                        </span>

                        {/* Tombol Kick Khusus Admin Ruangan */}
                        {canKick && (
                          <button
                            type="button"
                            onClick={() => setConfirmKickTarget(member)}
                            title={`Keluarkan ${member.name} dari ruangan`}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 active:scale-95"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}

                {/* Empty slot placeholders up to maxMembers (10) */}
                {Array.from({ length: remainingSlots }).map((_, i) => (
                  <li
                    key={`slot-${i}`}
                    className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-[#DFE4F1] bg-[#F6F7FC]/70 p-2.5 text-xs text-[#757780]"
                  >
                    <PlusCircle size={16} className="text-[#56638A]" />
                    <span>Slot {groupMembers.length + i + 1} Tersedia</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Supported Files Info */}
            <div className="mt-5 rounded-xl border border-[#5E3F0C]/15 bg-[#FBEFD9] p-3 text-xs text-[#5E3F0C]">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Lightbulb size={15} />
                <span>Format Lampiran Berkas</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Gunakan menu lampiran untuk mengirim berkas <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, dan gambar <strong>JPG (.jpg)</strong> langsung ke forum belajar.
              </p>
            </div>

            {/* Tindakan Manajemen Ruangan (Admin: Hapus Ruangan | Anggota: Keluar Ruangan) */}
            <div className="mt-5 pt-3 border-t border-[#DFE4F1]">
              {isHost ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 active:scale-98"
                  >
                    <Trash2 size={15} />
                    <span>Hapus Ruang Belajar (Admin)</span>
                  </button>
                  <p className="mt-1.5 text-center text-[10px] text-[#757780]">
                    Sebagai pembuat grup, Anda dapat membubarkan ruang ini agar tidak membebani database.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#DFE4F1] bg-white py-2.5 px-3 text-xs font-bold text-[#56638A] transition hover:bg-red-50 hover:text-red-700 hover:border-red-200 active:scale-98"
                >
                  <LogOut size={15} />
                  <span>Keluar dari Ruang Belajar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 1: Kick Anggota (Admin) */}
      {confirmKickTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setConfirmKickTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <UserMinus size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Keluarkan Anggota?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin mengeluarkan <strong>{confirmKickTarget.name}</strong> dari ruang belajar ini? Mereka dapat bergabung kembali jika memasukkan kode ruangan.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmKickTarget(null)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmKick}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessingAction ? 'Mengeluarkan...' : 'Ya, Keluarkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 2: Hapus Ruangan (Admin) */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Hapus Ruang Belajar?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Tindakan ini akan <strong>menghapus permanen</strong> ruang belajar "{groupName}" beserta seluruh riwayat obrolan dan dokumen di dalamnya. Semua anggota akan dikeluarkan.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessingAction ? 'Menghapus...' : 'Ya, Hapus Ruang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 3: Keluar Ruangan (Anggota Biasa) */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setShowLeaveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
              <LogOut size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Keluar dari Ruangan?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin keluar dari "{groupName}"? Anda bisa bergabung kembali nanti menggunakan kode ruangan jika slot masih tersedia.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmLeave}
                className="flex-1 rounded-xl bg-[#1D3668] py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54] disabled:opacity-50"
              >
                {isProcessingAction ? 'Memproses...' : 'Ya, Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 4. Skema Supabase, Tipe Data, & Store

### `src/types/index.ts`
*Definisi tipe TypeScript utama aplikasi (pengganti `types/supabase.ts` yang belum di-generate)*

```typescript
// src/types/index.ts
/** Main application user and scheduling contract types. */
export type UserRole = 'mahasiswa' | 'dosen' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  nim: string
  major: string
  university: string
  streak: number
  lastStudyDate?: string | null
  badges: string[]
  isPrivateProfile: boolean
  role?: UserRole
  program_studi?: string
  timezone?: string
  tenant_id?: string
}

export type StudyBlockType =
  | 'Jadwal kuliah'
  | 'Belajar mandiri'
  | 'Kerja kelompok'
  | 'Persiapan ujian'

export interface StudyBlockSubTask {
  id: string
  title: string
  isCompleted: boolean
}

export interface StudyBlock {
  id: string
  user_id?: string
  userId?: string
  type: StudyBlockType
  title: string
  description: string
  start_time: string
  startTime?: string
  end_time: string
  endTime?: string
  recurrence_rule: string | null
  recurrenceRule?: string | null
  date: string
  auto_focus: boolean
  autoFocus?: boolean
  co_focus_enabled: boolean
  coFocusEnabled?: boolean
  status?: 'scheduled' | 'active' | 'completed'
  subTasks?: { id: string; title: string; isCompleted: boolean }[]
}

export type FocusSessionStatus = 'active' | 'paused' | 'completed'
export type FocusSessionEndedBy = 'user' | 'system' | null

export interface FocusSession {
  id: string
  block_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  status: FocusSessionStatus
  ended_by: FocusSessionEndedBy
}

export interface NotificationEvent {
  id: string
  session_id: string
  source_id: string
  text: string
  received_at: string
  passed: boolean
  handled: boolean
}

export interface StudyGroup {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
}

export type GroupMemberRole = 'owner' | 'member'

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: GroupMemberRole
  joined_at: string
}
```

### `src/lib/supabase.ts`
*Inisialisasi Supabase client*

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum dikonfigurasi di file .env.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
```

### `supabase/schema.sql`
*Skema SQL/DDL Supabase lengkap (profiles, study_blocks, focus_sessions, study_groups, study_group_members, group_chat_messages)*

```sql
-- supabase/schema.sql
-- ====================================================================
-- SKRIP RESET & BANGUN ULANG DATABASE SMART FOCUS AKADEMIK (SUPABASE)
-- Salin seluruh isi file ini ke Supabase SQL Editor lalu klik RUN.
-- ====================================================================

-- 0. BERSIHKAN TABEL LAMA (JIKA INGIN MENGULANG DARI AWAL)
drop table if exists public.group_chat_messages cascade;
drop table if exists public.study_group_members cascade;
drop table if exists public.study_groups cascade;
drop table if exists public.session_held_notifications cascade;
drop table if exists public.focus_sessions cascade;
drop table if exists public.study_block_sub_tasks cascade;
drop table if exists public.study_blocks cascade;
drop table if exists public.focus_app_rules cascade;
drop table if exists public.profiles cascade;

-- ====================================================================
-- 1. TABEL PROFILES (Profil Akademik, Gamifikasi & Privasi)
-- Relasi 1-to-1 dengan auth.users bawaan Supabase
-- ====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  nim text not null default '',
  major text not null default 'Teknik Informatika',
  university text not null default 'Universitas Indonesia',
  streak integer not null default 0,
  last_study_date date,
  badges text[] not null default array['Pemula Fokus']::text[],
  is_private_profile boolean not null default false,
  has_seen_onboarding boolean not null default false,
  role text not null default 'mahasiswa' check (role in ('mahasiswa', 'dosen', 'admin')),
  timezone text not null default 'Asia/Jakarta',
  tenant_id text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pastikan kolom last_study_date tersedia untuk database yang sudah running
alter table public.profiles add column if not exists last_study_date date;

-- Trigger otomatis membuat baris di profiles saat user baru Register (signUp)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, email, name, nim, major, university, streak, badges, is_private_profile, has_seen_onboarding
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Mahasiswa'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'nim', ''),
    coalesce(new.raw_user_meta_data->>'major', 'Teknik Informatika'),
    coalesce(new.raw_user_meta_data->>'university', 'Universitas Indonesia'),
    0,
    array['Pemula Fokus'],
    false,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill otomatis untuk akun yang sudah terlanjur terdaftar di auth.users
insert into public.profiles (
  id, email, name, nim, major, university, streak, badges, is_private_profile, has_seen_onboarding
)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data->>'name', split_part(coalesce(email, 'Mahasiswa'), '@', 1)),
  coalesce(raw_user_meta_data->>'nim', ''),
  coalesce(raw_user_meta_data->>'major', 'Teknik Informatika'),
  coalesce(raw_user_meta_data->>'university', 'Universitas Indonesia'),
  0,
  array['Pemula Fokus'],
  false,
  false
from auth.users
on conflict (id) do nothing;


-- ====================================================================
-- 2. TABEL STUDY_BLOCKS (Jadwal & Blok Belajar Harian)
-- Relasi Many-to-1 ke auth.users(id)
-- ====================================================================
create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian')),
  description text not null default '',
  date date not null default current_date,
  start_time time not null,
  end_time time not null,
  recurrence_rule text,
  auto_focus boolean not null default false,
  co_focus_enabled boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_study_blocks_user_date on public.study_blocks (user_id, date);


-- ====================================================================
-- 3. TABEL STUDY_BLOCK_SUB_TASKS (Checklist di Dalam Blok Belajar)
-- Relasi Many-to-1 ke study_blocks(id) dengan ON DELETE CASCADE
-- ====================================================================
create table public.study_block_sub_tasks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.study_blocks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_sub_tasks_block_id on public.study_block_sub_tasks (block_id);


-- ====================================================================
-- 4. TABEL FOCUS_SESSIONS (Riwayat Timer Fokus & Jurnal Refleksi)
-- Relasi ke auth.users(id) dan opsional ke study_blocks(id)
-- ====================================================================
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_block_id uuid references public.study_blocks(id) on delete set null,
  target_duration integer not null default 0,
  actual_duration integer not null default 0,
  completion_status text not null default 'completed',
  reflection_note text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_focus_sessions_user on public.focus_sessions (user_id, created_at desc);


-- ====================================================================
-- 5. TABEL STUDY_GROUPS (Ruang Belajar Co-Focus dengan Kode 6 Karakter, Maks 10 Orang)
-- ====================================================================
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  join_code varchar(6) not null unique,
  max_members integer not null default 10 check (max_members <= 10),
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_study_groups_join_code on public.study_groups (upper(join_code));


-- ====================================================================
-- 6. TABEL STUDY_GROUP_MEMBERS (Anggota Ruang Belajar, Maks 10 Orang)
-- ====================================================================
create table public.study_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'fokus' check (status in ('fokus', 'istirahat', 'tersedia')),
  course text not null default '',
  joined_at timestamptz not null default now(),
  constraint uq_group_user unique (group_id, user_id)
);

create index idx_group_members_group on public.study_group_members (group_id);

-- Trigger pembatas maksimal 10 orang per grup (atau sesuai sg.max_members)
create or replace function public.check_max_group_members()
returns trigger as $$
declare
  member_count integer;
  max_allowed integer;
begin
  select count(*), coalesce(max(sg.max_members), 10)
  into member_count, max_allowed
  from public.study_group_members sgm
  join public.study_groups sg on sg.id = new.group_id
  where sgm.group_id = new.group_id;

  if member_count >= max_allowed then
    raise exception 'Maaf, ruang belajar sudah penuh (Maks % orang)', max_allowed;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_max_members
  before insert on public.study_group_members
  for each row execute function public.check_max_group_members();


-- ====================================================================
-- 7. TABEL GROUP_CHAT_MESSAGES (Pesan Chat, Balas Pesan & Soft Delete)
-- ====================================================================
create table public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  reply_to_id uuid references public.group_chat_messages(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'image', 'document')),
  text text,
  file_url text,
  file_name text,
  file_type text check (file_type in ('PDF', 'Word', 'JPG', null)),
  file_size text,
  image_url text,
  image_label text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_group_chat_group_time on public.group_chat_messages (group_id, created_at asc);


-- ====================================================================
-- 8. KEBIJAKAN KEAMANAN: ROW LEVEL SECURITY (RLS)
-- ====================================================================
alter table public.profiles enable row level security;
alter table public.study_blocks enable row level security;
alter table public.study_block_sub_tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.group_chat_messages enable row level security;

-- Kebijakan Profiles
create policy "Profil dapat dibaca oleh pemilik atau publik"
  on public.profiles for select
  using (auth.uid() = id or is_private_profile = false);

create policy "Profil dapat dibuat oleh pemilik"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profil dapat diubah oleh pemilik"
  on public.profiles for update
  using (auth.uid() = id);

-- Kebijakan Study Blocks
create policy "Pengguna mengelola study_blocks miliknya sendiri"
  on public.study_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Kebijakan Sub-Tasks
create policy "Pengguna mengelola sub_tasks dari jadwal miliknya"
  on public.study_block_sub_tasks for all
  using (
    exists (
      select 1 from public.study_blocks sb
      where sb.id = study_block_sub_tasks.block_id and sb.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.study_blocks sb
      where sb.id = study_block_sub_tasks.block_id and sb.user_id = auth.uid()
    )
  );

-- Kebijakan Focus Sessions
create policy "Pengguna mengelola focus_sessions miliknya sendiri"
  on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Sesi fokus profil publik dapat dibaca untuk agregasi kampus"
  on public.focus_sessions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = focus_sessions.user_id and p.is_private_profile = false
    )
  );

-- Fungsi RPC Agregasi Komparasi Kampus (SUM durasi_fokus di-group berdasarkan entitas kampus)
create or replace function public.get_campus_focus_stats()
returns table (
  campus_name text,
  total_focus_seconds bigint,
  total_sessions bigint,
  student_count bigint
)
language sql
security definer
as $$
  select
    coalesce(nullif(trim(p.university), ''), 'Universitas Indonesia') as campus_name,
    coalesce(sum(fs.actual_duration), 0)::bigint as total_focus_seconds,
    count(fs.id)::bigint as total_sessions,
    count(distinct p.id)::bigint as student_count
  from public.profiles p
  left join public.focus_sessions fs on fs.user_id = p.id
  where p.is_private_profile = false or p.id = auth.uid()
  group by coalesce(nullif(trim(p.university), ''), 'Universitas Indonesia')
  order by total_focus_seconds desc;
$$;

-- Kebijakan Study Groups & Members
create policy "Semua pengguna login dapat melihat study_groups"
  on public.study_groups for select
  using (auth.role() = 'authenticated');

create policy "Pengguna login dapat membuat study_groups"
  on public.study_groups for insert
  with check (auth.uid() = host_id);

create policy "Host dapat menghapus study_groups miliknya"
  on public.study_groups for delete
  using (auth.uid() = host_id);

create policy "Host dapat mengubah study_groups miliknya"
  on public.study_groups for update
  using (auth.uid() = host_id);

create policy "Semua pengguna login dapat melihat anggota grup"
  on public.study_group_members for select
  using (auth.role() = 'authenticated');

create policy "Pengguna dapat bergabung ke grup"
  on public.study_group_members for insert
  with check (auth.uid() = user_id);

create policy "Pengguna dapat mengubah status atau keluar grup"
  on public.study_group_members for update
  using (auth.uid() = user_id);

create policy "Pengguna dapat keluar atau dikeluarkan oleh host"
  on public.study_group_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.study_groups sg
      where sg.id = study_group_members.group_id and sg.host_id = auth.uid()
    )
  );

-- Kebijakan Group Chat Messages
create policy "Anggota grup dapat membaca pesan chat"
  on public.group_chat_messages for select
  using (
    exists (
      select 1 from public.study_group_members sgm
      where sgm.group_id = group_chat_messages.group_id and sgm.user_id = auth.uid()
    )
  );

create policy "Anggota grup dapat mengirim pesan chat"
  on public.group_chat_messages for insert
  with check (auth.uid() = sender_id);

create policy "Pengirim dapat menghapus (soft delete) pesannya sendiri"
  on public.group_chat_messages for update
  using (auth.uid() = sender_id);

-- ====================================================================
-- 9. AKTIFKAN REPLIKASI REALTIME (SUPABASE REALTIME WEBSOCKET)
-- ====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'group_chat_messages'
  ) then
    alter publication supabase_realtime add table public.group_chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'study_group_members'
  ) then
    alter publication supabase_realtime add table public.study_group_members;
  end if;
end $$;

-- Segarkan Schema Cache PostgREST Supabase secara instan
notify pgrst, 'reload schema';
```

### `src/store/authStore.ts`
*Store autentikasi & tipe `ProfileRow`*

```typescript
// src/store/authStore.ts
import { create } from 'zustand'
import type { Session, Subscription, User as SupabaseAuthUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  evaluateStreak,
  calculateNewStreakOnSessionComplete,
  calculateAchievementBadges,
} from '../lib/streak'

export interface User {
  id: string
  name: string
  email: string
  nim: string
  major: string
  university: string
  streak: number
  lastStudyDate?: string | null
  badges: string[]
  isPrivateProfile: boolean
  role?: 'mahasiswa' | 'dosen' | 'admin'
  program_studi?: string
  timezone?: string
  tenant_id?: string
}

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  nim: string | null
  major: string | null
  university: string | null
  streak: number | null
  last_study_date?: string | null
  badges: string[] | null
  is_private_profile: boolean | null
  has_seen_onboarding?: boolean | null
  role?: 'mahasiswa' | 'dosen' | 'admin' | null
  timezone?: string | null
  tenant_id?: string | null
}

const STORAGE_KEY = 'smartlearning-user'
const ONBOARDING_KEY = 'smartlearning-onboarding-seen'

function getStoredOnboardingFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === 'true'
  } catch {
    return false
  }
}

function getStoredStreakBackup(userId: string): { streak: number; lastDate: string | null } {
  if (typeof window === 'undefined') return { streak: 0, lastDate: null }
  try {
    const streakVal = Number(window.localStorage.getItem(`smartlearning-streak_${userId}`)) || 0
    const lastDateVal = window.localStorage.getItem(`smartlearning-last-study-date_${userId}`) || null
    return { streak: streakVal, lastDate: lastDateVal }
  } catch {
    return { streak: 0, lastDate: null }
  }
}

function saveStoredStreakBackup(userId: string, streak: number, lastDate: string | null) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`smartlearning-streak_${userId}`, String(streak))
    if (lastDate) {
      window.localStorage.setItem(`smartlearning-last-study-date_${userId}`, lastDate)
    }
  } catch {
    // Abaikan error localStorage
  }
}

function mapProfileToUser(
  authUser: SupabaseAuthUser,
  profile?: ProfileRow | null,
  totalSessions = 0
): User {
  const userId = profile?.id || authUser.id
  const fallbackName =
    (authUser.user_metadata?.name as string | undefined) ||
    authUser.email?.split('@')[0] ||
    'Mahasiswa'
  const major = profile?.major ?? (authUser.user_metadata?.major as string | undefined) ?? ''

  const backup = getStoredStreakBackup(userId)
  const dbStreak = typeof profile?.streak === 'number' ? profile.streak : 0
  const rawLastDate = profile?.last_study_date ?? backup.lastDate ?? null

  // PENTING: Jika pengguna baru / belum pernah menyelesaikan sesi fokus (totalSessions === 0),
  // streak HARUS 0 dan badges wajib ['Pemula Fokus'], tidak boleh mewarisi default tiruan.
  const isNewAccountWithoutSessions = totalSessions === 0
  const effectiveStreak = isNewAccountWithoutSessions ? 0 : (dbStreak > 0 ? dbStreak : backup.streak)
  const effectiveLastDate = isNewAccountWithoutSessions ? null : rawLastDate

  const evaluation = evaluateStreak(effectiveStreak, effectiveLastDate)
  const computedBadges = calculateAchievementBadges(evaluation.currentStreak, totalSessions)

  // Simpan backup ke localStorage agar tidak pernah hilang saat refresh
  saveStoredStreakBackup(userId, evaluation.currentStreak, evaluation.lastStudyDate)

  // Self-healing: jika akun baru di database Supabase sempat ter-insert streak > 0 oleh trigger lama,
  // otomatis koreksi kembali menjadi 0 di Supabase.
  if (
    isNewAccountWithoutSessions &&
    profile?.id &&
    (dbStreak > 0 || (profile.badges && profile.badges.includes('Fokus Master')))
  ) {
    void supabase
      .from('profiles')
      .update({
        streak: 0,
        last_study_date: null,
        badges: ['Pemula Fokus'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
  } else if (evaluation.needsReset && profile?.id) {
    // Jika streak bolong lebih dari 1 hari (needsReset), sinkronkan reset streak ke 0 di database
    void supabase
      .from('profiles')
      .update({
        streak: 0,
        badges: computedBadges,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .then(({ error }) => {
        if (error) {
          console.warn('[Streak Sync] Gagal reset streak ke Supabase:', error.message)
        }
      })
  } else if (profile?.id && dbStreak === 0 && evaluation.currentStreak > 0) {
    // Pulihkan streak ke DB jika sempat ter-reset sebelumnya
    void supabase
      .from('profiles')
      .update({
        streak: evaluation.currentStreak,
        badges: computedBadges,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
  }

  return {
    id: userId,
    name: profile?.name || fallbackName,
    email: profile?.email || authUser.email || '',
    nim: profile?.nim ?? (authUser.user_metadata?.nim as string | undefined) ?? '',
    major,
    university:
      profile?.university ??
      (authUser.user_metadata?.university as string | undefined) ??
      'Universitas Indonesia',
    streak: evaluation.currentStreak,
    lastStudyDate: evaluation.lastStudyDate ?? rawLastDate,
    badges: computedBadges,
    isPrivateProfile: Boolean(profile?.is_private_profile),
    program_studi: major,
    role: profile?.role ?? 'mahasiswa',
    timezone: profile?.timezone ?? 'Asia/Jakarta',
    tenant_id: profile?.tenant_id ?? 'default',
  }
}

async function fetchProfileByUser(
  authUser: SupabaseAuthUser
): Promise<{ user: User; hasSeenOnboarding?: boolean }> {
  try {
    const [{ data, error }, { count: sessionCount }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle<ProfileRow>(),
      supabase
        .from('focus_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id),
    ])

    const totalSessions = sessionCount ?? 0

    if (error) {
      console.warn(
        '[Supabase Profiles] Tabel profiles belum ada atau terjadi kendala query (404/Not Found). Menggunakan metadata sesi auth:',
        error.message
      )
      return {
        user: mapProfileToUser(authUser, null, totalSessions),
        hasSeenOnboarding: false,
      }
    }

    // Jika tabel profiles ada tetapi baris data user belum ada
    // (misalnya akun dibuat sebelum trigger database diaktifkan)
    if (!data) {
      try {
        const fallbackName =
          (authUser.user_metadata?.name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Mahasiswa'

        const initialBadges = calculateAchievementBadges(0, totalSessions)
        const newProfilePayload = {
          id: authUser.id,
          email: authUser.email || '',
          name: fallbackName,
          nim: (authUser.user_metadata?.nim as string | undefined) || '',
          major: (authUser.user_metadata?.major as string | undefined) || 'Teknik Informatika',
          university:
            (authUser.user_metadata?.university as string | undefined) || 'Universitas Indonesia',
          streak: 0,
          badges: initialBadges,
          is_private_profile: false,
          has_seen_onboarding: false,
          role: 'mahasiswa',
          timezone: 'Asia/Jakarta',
          tenant_id: 'default',
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfilePayload)
          .select('*')
          .single<ProfileRow>()

        if (!insertError && insertedData) {
          return {
            user: mapProfileToUser(authUser, insertedData, totalSessions),
            hasSeenOnboarding: false,
          }
        }
      } catch {
        // Abaikan error pembuatan baris otomatis
      }

      return {
        user: mapProfileToUser(authUser, null, totalSessions),
        hasSeenOnboarding: false,
      }
    }

    return {
      user: mapProfileToUser(authUser, data, totalSessions),
      hasSeenOnboarding:
        typeof data.has_seen_onboarding === 'boolean' ? data.has_seen_onboarding : undefined,
    }
  } catch (err) {
    console.warn('[Supabase Profiles] Terjadi error tak terduga, menggunakan fallback auth:', err)
    return {
      user: mapProfileToUser(authUser, null, 0),
      hasSeenOnboarding: false,
    }
  }
}

let authSubscription: Subscription | null = null

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  hasSeenOnboarding: boolean
  authError: string | null
  clearAuthError: () => void
  initializeAuth: () => Promise<void>
  setHasSeenOnboarding: () => void
  login: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<string>
  updateProfile: (updatedData: Partial<User>) => Promise<void>
  recordSessionCompletionForStreak: () => Promise<{ newStreak: number; isFirstToday: boolean; todayStr: string }>
  togglePrivacy: (isPrivate: boolean) => Promise<void>
  logout: () => Promise<void>
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  hasSeenOnboarding: getStoredOnboardingFlag(),
  authError: null,

  clearAuthError: () => set({ authError: null }),

  initializeAuth: async () => {
    set({ isLoading: true, authError: null })

    try {
      // a. Cek sesi aktif saat web dimuat
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      // c. Jika ada sesi, ambil data profil dari tabel profiles
      if (session?.user) {
        const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(session.user)
        set((state) => ({
          user: profileUser,
          isAuthenticated: true,
          hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
        }))
      } else {
        set({ user: null, isAuthenticated: false })
      }

      // b. Daftarkan listener onAuthStateChange
      if (authSubscription) {
        authSubscription.unsubscribe()
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) {
          try {
            const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(
              nextSession.user
            )
            set((state) => ({
              user: profileUser,
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
              hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
            }))
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Gagal memuat profil pengguna dari Supabase.'
            set({
              user: mapProfileToUser(nextSession.user, null),
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
              authError: message,
            })
          }
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          })
        }
      })

      authSubscription = subscription
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menginisialisasi sesi autentikasi.'
      set({
        user: null,
        isAuthenticated: false,
        authError: message,
      })
    } finally {
      // d. Set isLoading: false di akhir proses
      set({ isLoading: false, isInitialized: true })
    }
  },

  setHasSeenOnboarding: () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {
      // Abaikan error localStorage
    }
    set({ hasSeenOnboarding: true })

    const currentUser = get().user
    if (currentUser) {
      void supabase
        .from('profiles')
        .update({ has_seen_onboarding: true, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)
    }
  },

  login: async (email, password) => {
    set({ authError: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          (error as { code?: string }).code === 'email_not_confirmed'
        ) {
          throw new Error('Email belum diverifikasi. Silakan periksa kotak masuk atau spam di Gmail Anda untuk klik tautan konfirmasi.')
        }
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Email atau sandi salah. Silakan periksa kembali.')
        }
        throw new Error(error.message)
      }

      if (data.user) {
        const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(data.user)
        set((state) => ({
          user: profileUser,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
        }))
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Login gagal. Periksa kembali email dan sandi.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  signInWithGoogle: async () => {
    set({ authError: null, isLoading: true })
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      })
      if (error) {
        throw new Error(error.message)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gagal terhubung dengan layanan Google Auth.'
      set({ authError: message, isLoading: false })
      throw new Error(message)
    }
  },

  register: async (email, password, name) => {
    set({ authError: null })

    const cleanEmail = email.trim()
    if (!cleanEmail.endsWith('@gmail.com')) {
      const errorMsg = 'Harap gunakan akun @gmail.com yang aktif'
      set({ authError: errorMsg })
      throw new Error(errorMsg)
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name },
        },
      })

      if (error) {
        const errorText = `${error.message || ''} ${(error as { code?: string }).code || ''}`.toLowerCase()
        const isRateLimit =
          error.status === 429 ||
          errorText.includes('rate limit') ||
          errorText.includes('rate_limit') ||
          errorText.includes('too many') ||
          errorText.includes('security purposes') ||
          errorText.includes('over_email_send_rate_limit') ||
          errorText.includes('over_request_rate_limit')

        if (isRateLimit) {
          const friendlyMessage =
            "Sistem pendaftaran sedang padat. Silakan gunakan tombol 'Login dengan Google' atau coba beberapa saat lagi."
          set({ authError: friendlyMessage, isLoading: false })
          throw new Error(friendlyMessage)
        }

        throw new Error(error.message)
      }

      // Supabase sekarang mewajibkan konfirmasi email: JANGAN set isAuthenticated: true
      set({ isAuthenticated: false, isLoading: false })

      // Kembalikan status sukses agar UI dapat menampilkan instruksi verifikasi email
      return 'check_email'
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.'
      const rawLower = rawMessage.toLowerCase()
      const isRateLimit =
        rawLower.includes('rate limit') ||
        rawLower.includes('rate_limit') ||
        rawLower.includes('429') ||
        rawLower.includes('too many') ||
        rawLower.includes('security purposes') ||
        rawLower.includes('over_email_send_rate_limit') ||
        rawLower.includes('over_request_rate_limit')

      const message = isRateLimit
        ? "Sistem pendaftaran sedang padat. Silakan gunakan tombol 'Login dengan Google' atau coba beberapa saat lagi."
        : rawMessage

      set({ authError: message, isLoading: false })
      throw new Error(message)
    }
  },

  updateProfile: async (updatedData: Partial<User>) => {
    set({ authError: null })
    const currentUser = get().user
    if (!currentUser) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk kembali.'
      set({ authError: msg })
      throw new Error(msg)
    }

    try {
      const dbUpdatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (updatedData.name !== undefined) dbUpdatePayload.name = updatedData.name
      if (updatedData.nim !== undefined) dbUpdatePayload.nim = updatedData.nim
      if (updatedData.major !== undefined) dbUpdatePayload.major = updatedData.major
      if (updatedData.university !== undefined) dbUpdatePayload.university = updatedData.university
      if (updatedData.streak !== undefined) dbUpdatePayload.streak = updatedData.streak
      if (updatedData.lastStudyDate !== undefined) dbUpdatePayload.last_study_date = updatedData.lastStudyDate
      if (updatedData.badges !== undefined) dbUpdatePayload.badges = updatedData.badges
      if (updatedData.isPrivateProfile !== undefined) {
        dbUpdatePayload.is_private_profile = updatedData.isPrivateProfile
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdatePayload)
        .eq('id', currentUser.id)
        .select('*')
        .single<ProfileRow>()

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.message?.includes('not found') ||
          error.message?.includes('relation')
        ) {
          throw new Error(
            'Tabel public.profiles belum dibuat di Supabase. Silakan jalankan script supabase/schema.sql di SQL Editor Supabase.'
          )
        }
        throw new Error(error.message)
      }

      const nextMajor = data?.major ?? updatedData.major ?? currentUser.major
      const nextStreak = typeof data?.streak === 'number' ? data.streak : currentUser.streak
      const computedBadges = calculateAchievementBadges(nextStreak)

      // Sinkronisasi Program Studi ke tabel study_group_members (Ruang Co-Focus)
      if (updatedData.major !== undefined && nextMajor) {
        void supabase
          .from('study_group_members')
          .update({ course: nextMajor })
          .eq('user_id', currentUser.id)
      }

      const updatedUser: User = {
        ...currentUser,
        ...updatedData,
        name: data?.name ?? updatedData.name ?? currentUser.name,
        nim: data?.nim ?? updatedData.nim ?? currentUser.nim,
        major: nextMajor,
        program_studi: nextMajor,
        university: data?.university ?? updatedData.university ?? currentUser.university,
        streak: nextStreak,
        lastStudyDate: data?.last_study_date ?? updatedData.lastStudyDate ?? currentUser.lastStudyDate ?? null,
        badges: computedBadges,
        isPrivateProfile:
          typeof data?.is_private_profile === 'boolean'
            ? data.is_private_profile
            : (updatedData.isPrivateProfile ?? currentUser.isPrivateProfile),
      }

      set({ user: updatedUser })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui profil di Supabase.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  recordSessionCompletionForStreak: async () => {
    const currentUser = get().user
    if (!currentUser?.id) {
      return {
        newStreak: 1,
        isFirstToday: true,
        todayStr: new Date().toISOString().split('T')[0],
      }
    }

    const { newStreak, isFirstToday, todayStr } = calculateNewStreakOnSessionComplete(
      currentUser.streak || 0,
      currentUser.lastStudyDate
    )

    // Hitung jumlah sesi untuk kalkulasi tier badge
    const { count: sessionCount } = await supabase
      .from('focus_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)

    const updatedBadges = calculateAchievementBadges(newStreak, sessionCount ?? 1)

    // Simpan ke localStorage agar persisten saat refresh
    saveStoredStreakBackup(currentUser.id, newStreak, todayStr)

    // Update state user lokal secara instan
    const updatedUser: User = {
      ...currentUser,
      streak: newStreak,
      lastStudyDate: todayStr,
      badges: updatedBadges,
    }
    set({ user: updatedUser })

    // Sinkronkan ke Supabase
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          streak: newStreak,
          last_study_date: todayStr,
          badges: updatedBadges,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) {
        console.warn(
          '[Streak Sync] Mencoba fallback update streak jika kolom last_study_date belum tersedia di remote DB:',
          error.message
        )
        await supabase
          .from('profiles')
          .update({
            streak: newStreak,
            badges: updatedBadges,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id)
      }
    } catch (err) {
      console.warn('[Streak Sync] Kendala saat menyimpan streak ke database:', err)
    }

    return { newStreak, isFirstToday, todayStr }
  },

  togglePrivacy: async (isPrivate: boolean) => {
    set({ authError: null })
    const currentUser = get().user
    if (!currentUser) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk kembali.'
      set({ authError: msg })
      throw new Error(msg)
    }

    const previousValue = currentUser.isPrivateProfile
    // Optimistic UI update
    set({ user: { ...currentUser, isPrivateProfile: isPrivate } })

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_private_profile: isPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.message?.includes('not found') ||
          error.message?.includes('relation')
        ) {
          throw new Error(
            'Tabel public.profiles belum dibuat di Supabase. Silakan jalankan script supabase/schema.sql di SQL Editor Supabase.'
          )
        }
        throw new Error(error.message)
      }
    } catch (error) {
      // Revert optimistic state if update fails
      set({ user: { ...currentUser, isPrivateProfile: previousValue } })
      const message =
        error instanceof Error ? error.message : 'Gagal mengubah pengaturan privasi di Supabase.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  logout: async () => {
    set({ authError: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal keluar dari sesi Supabase.'
      set({ authError: message })
      throw new Error(message)
    } finally {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
        window.localStorage.removeItem('smartlearning-session')
        window.localStorage.removeItem('smartlearning-cofocus-sharing')
        window.localStorage.removeItem('smartlearning-cofocus-auto-reply')
        window.localStorage.removeItem(ONBOARDING_KEY)
      } catch {
        // Abaikan error penghapusan localStorage
      }
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
    }
  },

  setSession: (session) => {
    if (session?.user) {
      void fetchProfileByUser(session.user)
        .then(({ user: profileUser, hasSeenOnboarding }) => {
          set((state) => ({
            user: profileUser,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
            hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
          }))
        })
        .catch(() => {
          set({
            user: mapProfileToUser(session.user, null),
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          })
        })
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
    }
  },
}))
```

### `src/store/studyStore.ts`
*Store jadwal belajar & query `study_blocks` / `study_block_sub_tasks`*

```typescript
// src/store/studyStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import type { StudyBlock, StudyBlockSubTask, StudyBlockType } from '../types'

export type { StudyBlock, StudyBlockSubTask, StudyBlockType }

export interface NewStudyBlockInput {
  user_id?: string
  userId?: string
  title: string
  type: StudyBlockType
  description?: string
  date: string
  start_time?: string
  startTime?: string
  end_time?: string
  endTime?: string
  recurrence_rule?: string | null
  recurrenceRule?: string | null
  auto_focus?: boolean
  autoFocus?: boolean
  co_focus_enabled?: boolean
  coFocusEnabled?: boolean
  status?: 'scheduled' | 'active' | 'completed'
  subTasks?: { id?: string; title: string; isCompleted?: boolean }[]
}

export type NewStudyBlock = NewStudyBlockInput

interface SupabaseSubTaskRow {
  id: string
  block_id: string
  title: string
  is_completed?: boolean | null
  isCompleted?: boolean | null
  sort_order?: number | null
  created_at?: string
}

interface SupabaseStudyBlockRow {
  id: string
  user_id: string
  type: StudyBlockType
  title: string
  description?: string | null
  date?: string | null
  start_time?: string | null
  startTime?: string | null
  end_time?: string | null
  endTime?: string | null
  recurrence_rule?: string | null
  recurrenceRule?: string | null
  auto_focus?: boolean | null
  autoFocus?: boolean | null
  co_focus_enabled?: boolean | null
  coFocusEnabled?: boolean | null
  status?: 'scheduled' | 'active' | 'completed' | null
  subTasks?: SupabaseSubTaskRow[] | null
  study_block_sub_tasks?: SupabaseSubTaskRow[] | null
}

function normalizeTimeString(value: string | null | undefined): string {
  if (!value) return '00:00'
  // PostgreSQL TIME mengembalikan 'HH:MM:SS', kita ambil 'HH:MM' untuk UI
  return value.slice(0, 5)
}

function getTodayFallbackDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function mapSupabaseBlockToStudyBlock(row: SupabaseStudyBlockRow): StudyBlock {
  const startTime = normalizeTimeString(row.start_time ?? row.startTime)
  const endTime = normalizeTimeString(row.end_time ?? row.endTime)
  const autoFocus = Boolean(row.auto_focus ?? row.autoFocus)
  const coFocusEnabled = Boolean(row.co_focus_enabled ?? row.coFocusEnabled)
  const recurrenceRule = row.recurrence_rule ?? row.recurrenceRule ?? null
  const dateValue = row.date || getTodayFallbackDate()

  const rawTasks = row.subTasks ?? row.study_block_sub_tasks ?? []
  const sortedSubTasks = [...rawTasks].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )

  const subTasks: StudyBlockSubTask[] = sortedSubTasks.map((task) => ({
    id: task.id,
    title: task.title,
    isCompleted: Boolean(task.isCompleted ?? task.is_completed),
  }))

  return {
    id: row.id,
    user_id: row.user_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description ?? '',
    date: dateValue,
    start_time: startTime,
    startTime,
    end_time: endTime,
    endTime,
    recurrence_rule: recurrenceRule,
    recurrenceRule,
    auto_focus: autoFocus,
    autoFocus,
    co_focus_enabled: coFocusEnabled,
    coFocusEnabled,
    status: row.status ?? 'scheduled',
    subTasks,
  }
}

function sortStudyBlocks(blocks: StudyBlock[]): StudyBlock[] {
  return [...blocks].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '')
    if (dateCompare !== 0) return dateCompare
    const timeA = a.startTime ?? a.start_time ?? ''
    const timeB = b.startTime ?? b.start_time ?? ''
    return timeA.localeCompare(timeB)
  })
}

export interface StudyStore {
  studyBlocks: StudyBlock[]
  blocks: StudyBlock[]
  isLoading: boolean
  error: string | null
  clearError: () => void
  fetchStudyBlocks: (userId: string) => Promise<void>
  fetchBlocks: (userId?: string) => Promise<void>
  addStudyBlock: (data: NewStudyBlockInput) => Promise<StudyBlock>
  addBlock: (data: NewStudyBlockInput) => Promise<StudyBlock>
  updateStudyBlock: (id: string, data: Partial<StudyBlock>) => Promise<void>
  updateBlock: (id: string, data: Partial<StudyBlock>) => Promise<void>
  deleteStudyBlock: (id: string) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  toggleSubTask: (blockId: string, taskId: string, isCompleted?: boolean) => Promise<void>
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  studyBlocks: [],
  blocks: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchStudyBlocks: async (userId: string) => {
    if (!userId) return
    set({ isLoading: true, error: null })
    try {
      // 1. Ambil data Study Blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('study_blocks')
        .select('*')
        .eq('user_id', userId)

      if (blocksError) throw blocksError

      // 2. Ambil data Sub-Tasks yang terkait dengan user ini
      // (Ambil semua sub-tasks, nanti kita filter di frontend)
      const { data: tasksData, error: tasksError } = await supabase
        .from('study_block_sub_tasks')
        .select('*')

      if (tasksError) throw tasksError

      // 3. Gabungkan Data (Mapping snake_case ke camelCase)
      const formattedBlocks: StudyBlock[] = ((blocksData as SupabaseStudyBlockRow[] | null) || []).map(
        (block) => {
          // Cari sub-tasks milik block ini
          const blockTasks = ((tasksData as SupabaseSubTaskRow[] | null) || [])
            .filter((task) => task.block_id === block.id)
            .map((task) => ({
              id: task.id,
              title: task.title,
              isCompleted: Boolean(task.is_completed ?? task.isCompleted),
            }))

          const startTime = normalizeTimeString(block.start_time ?? block.startTime)
          const endTime = normalizeTimeString(block.end_time ?? block.endTime)
          const autoFocus = Boolean(block.auto_focus ?? block.autoFocus)
          const coFocusEnabled = Boolean(block.co_focus_enabled ?? block.coFocusEnabled)
          const recurrenceRule = block.recurrence_rule ?? block.recurrenceRule ?? null

          return {
            id: block.id,
            user_id: block.user_id,
            userId: block.user_id,
            title: block.title,
            type: block.type,
            description: block.description ?? '',
            startTime, // Konversi snake_case ke camelCase
            endTime,
            start_time: startTime,
            end_time: endTime,
            date: block.date || getTodayFallbackDate(),
            recurrenceRule,
            recurrence_rule: recurrenceRule,
            autoFocus,
            auto_focus: autoFocus,
            coFocusEnabled,
            co_focus_enabled: coFocusEnabled,
            status: block.status ?? 'scheduled',
            subTasks: blockTasks,
          }
        }
      )

      const sortedBlocks = sortStudyBlocks(formattedBlocks)
      set({ studyBlocks: sortedBlocks, blocks: sortedBlocks, isLoading: false, error: null })
    } catch (error) {
      console.error('SUPABASE ERROR (Two-Step Fetch):', error)
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Gagal mengambil jadwal belajar dari Supabase.'
      set({ error: message, isLoading: false })
    }
  },

  fetchBlocks: async (userId?: string) => {
    const resolvedUserId = userId || useAuthStore.getState().user?.id
    if (!resolvedUserId) return
    await get().fetchStudyBlocks(resolvedUserId)
  },

  addStudyBlock: async (data: NewStudyBlockInput) => {
    set({ error: null })
    const resolvedUserId = data.userId || data.user_id || useAuthStore.getState().user?.id

    if (!resolvedUserId) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk terlebih dahulu.'
      set({ error: msg })
      throw new Error(msg)
    }

    const startTime = data.startTime || data.start_time || '09:00'
    const endTime = data.endTime || data.end_time || '10:00'

    try {
      const insertPayload = {
        user_id: resolvedUserId,
        title: data.title.trim(),
        type: data.type,
        description: data.description?.trim() ?? '',
        date: data.date,
        start_time: startTime,
        end_time: endTime,
        recurrence_rule: data.recurrenceRule ?? data.recurrence_rule ?? null,
        auto_focus: data.autoFocus ?? data.auto_focus ?? false,
        co_focus_enabled: data.coFocusEnabled ?? data.co_focus_enabled ?? false,
      }

      const { data: createdRow, error: blockError } = await supabase
        .from('study_blocks')
        .insert(insertPayload)
        .select('*')
        .single<SupabaseStudyBlockRow>()

      if (blockError || !createdRow) {
        console.error('SUPABASE ERROR (insert study_blocks):', blockError)
        throw new Error(blockError?.message || 'Gagal menambahkan jadwal ke database.')
      }

      let insertedSubTasks: SupabaseSubTaskRow[] = []
      const inputSubTasks = (data.subTasks ?? []).filter((t) => t.title.trim().length > 0)

      if (inputSubTasks.length > 0) {
        const subTaskRows = inputSubTasks.map((task, index) => ({
          block_id: createdRow.id,
          title: task.title.trim(),
          is_completed: Boolean(task.isCompleted),
          sort_order: index,
        }))

        const { data: createdTasks, error: subTaskError } = await supabase
          .from('study_block_sub_tasks')
          .insert(subTaskRows)
          .select('*')

        if (subTaskError) {
          console.error('SUPABASE ERROR (insert study_block_sub_tasks):', subTaskError)
        } else {
          insertedSubTasks = (createdTasks as SupabaseSubTaskRow[] | null) ?? []
        }
      }

      const mappedBlock = mapSupabaseBlockToStudyBlock({
        ...createdRow,
        subTasks: insertedSubTasks,
      })

      set((state) => {
        const nextList = sortStudyBlocks([...state.studyBlocks, mappedBlock])
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })

      return mappedBlock
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menyimpan jadwal belajar ke Supabase.'
      set({ error: message })
      throw new Error(message)
    }
  },

  addBlock: async (data: NewStudyBlockInput) => {
    return get().addStudyBlock(data)
  },

  updateStudyBlock: async (id: string, changes: Partial<StudyBlock>) => {
    set({ error: null })
    // Update lokal terlebih dahulu agar UI merespons seketika
    set((state) => {
      const nextList = state.studyBlocks.map((block) =>
        block.id === id ? { ...block, ...changes } : block
      )
      return { studyBlocks: nextList, blocks: nextList }
    })

    try {
      const updatePayload: Record<string, unknown> = {}
      if (changes.title !== undefined) updatePayload.title = changes.title
      if (changes.type !== undefined) updatePayload.type = changes.type
      if (changes.description !== undefined) updatePayload.description = changes.description
      if (changes.date !== undefined) updatePayload.date = changes.date
      if (changes.startTime !== undefined || changes.start_time !== undefined) {
        updatePayload.start_time = changes.startTime ?? changes.start_time
      }
      if (changes.endTime !== undefined || changes.end_time !== undefined) {
        updatePayload.end_time = changes.endTime ?? changes.end_time
      }
      if (changes.recurrenceRule !== undefined || changes.recurrence_rule !== undefined) {
        updatePayload.recurrence_rule = changes.recurrenceRule ?? changes.recurrence_rule
      }
      if (changes.autoFocus !== undefined || changes.auto_focus !== undefined) {
        updatePayload.auto_focus = changes.autoFocus ?? changes.auto_focus
      }
      if (changes.coFocusEnabled !== undefined || changes.co_focus_enabled !== undefined) {
        updatePayload.co_focus_enabled = changes.coFocusEnabled ?? changes.co_focus_enabled
      }
      if (changes.status !== undefined) updatePayload.status = changes.status

      const { data: updatedRow, error } = await supabase
        .from('study_blocks')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single<SupabaseStudyBlockRow>()

      if (error || !updatedRow) {
        // Fallback jika database Supabase belum memiliki kolom status
        if (error && error.message.toLowerCase().includes('status')) {
          const { status: _omittedStatus, ...payloadWithoutStatus } = updatePayload
          if (Object.keys(payloadWithoutStatus).length > 0) {
            await supabase.from('study_blocks').update(payloadWithoutStatus).eq('id', id)
          }
          return
        }
        console.warn('SUPABASE WARNING (update study_blocks):', error?.message)
        return
      }

      const existingBlock = get().studyBlocks.find((b) => b.id === id)
      const mapped = {
        ...mapSupabaseBlockToStudyBlock(updatedRow),
        subTasks: changes.subTasks ?? existingBlock?.subTasks ?? [],
        status: changes.status ?? existingBlock?.status ?? 'scheduled',
      }

      set((state) => {
        const nextList = sortStudyBlocks(
          state.studyBlocks.map((block) => (block.id === id ? mapped : block))
        )
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })
    } catch (error) {
      console.warn('Update study block caught:', error)
    }
  },

  updateBlock: async (id: string, changes: Partial<StudyBlock>) => {
    return get().updateStudyBlock(id, changes)
  },

  deleteStudyBlock: async (id: string) => {
    set({ error: null })
    try {
      const { error } = await supabase.from('study_blocks').delete().eq('id', id)
      if (error) {
        console.error('SUPABASE ERROR (delete study_blocks):', error)
        throw new Error(error.message)
      }

      set((state) => {
        const nextList = state.studyBlocks.filter((block) => block.id !== id)
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus jadwal belajar dari Supabase.'
      set({ error: message })
      throw new Error(message)
    }
  },

  deleteBlock: async (id: string) => {
    return get().deleteStudyBlock(id)
  },

  toggleSubTask: async (blockId: string, taskId: string, isCompleted?: boolean) => {
    set({ error: null })
    const previousBlocks = get().studyBlocks
    const targetBlock = previousBlocks.find((b) => b.id === blockId)
    const targetTask = targetBlock?.subTasks?.find((t) => t.id === taskId)
    const nextCompleted =
      typeof isCompleted === 'boolean' ? isCompleted : !targetTask?.isCompleted

    // Optimistic update di state lokal
    set((state) => {
      const nextList = state.studyBlocks.map((block) => {
        if (block.id !== blockId || !block.subTasks) return block
        return {
          ...block,
          subTasks: block.subTasks.map((task) =>
            task.id === taskId ? { ...task, isCompleted: nextCompleted } : task
          ),
        }
      })
      return { studyBlocks: nextList, blocks: nextList }
    })

    try {
      const { error } = await supabase
        .from('study_block_sub_tasks')
        .update({ is_completed: nextCompleted })
        .eq('id', taskId)
        .eq('block_id', blockId)

      if (error) {
        console.error('SUPABASE ERROR (toggleSubTask):', error)
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      // Rollback jika gagal
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui status sub-tugas di Supabase.'
      set({ studyBlocks: previousBlocks, blocks: previousBlocks, error: message })
      throw new Error(message)
    }
  },
}))
```

### `src/store/sessionStore.ts`
*Store sesi fokus & query `focus_sessions`*

```typescript
// src/store/sessionStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { useGroupStore } from './groupStore'
import { useStudyStore } from './studyStore'
import type { StudyBlock } from '../types'

export type FocusStatus = 'idle' | 'running' | 'paused'
export type SessionCompletionStatus = 'completed' | 'ended_early'

export interface HeldNotification {
  id: string
  title?: string
  text: string
  appName?: string
  packageName?: string
  receivedAt: string
}

export interface SessionSummary {
  sessionId?: string | null
  block: StudyBlock
  targetDurationSeconds: number
  durationSeconds: number
  completionStatus: SessionCompletionStatus
  startedAt: string
  endedAt: string
  heldNotifications: HeldNotification[]
}

export interface SaveSessionPayload {
  sessionId?: string | null
  userId?: string
  studyBlockId?: string | null
  targetDuration: number
  actualDuration: number
  completionStatus: SessionCompletionStatus | string
  reflectionNote: string
  startedAt?: string
  endedAt?: string
}

interface SessionState {
  activeBlock: StudyBlock | null
  status: FocusStatus
  remainingTime: number
  startedAt: string | null
  heldNotifications: HeldNotification[]
  lastSessionSummary: SessionSummary | null
  lastSavedSessionId: string | null
  isSaving: boolean
  error: string | null
  clearError: () => void
  startSession: (block: StudyBlock) => void
  startFocus: (block: StudyBlock) => void
  pauseSession: () => void
  resumeSession: () => void
  stopFocus: () => Promise<string | null>
  endSession: () => void
  resetSession: () => void
  addHeldNotification: (notification: HeldNotification) => void
  tick: () => void
  saveSessionToDatabase: (sessionData: SaveSessionPayload) => Promise<void>
}

function timeToSeconds(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return (hours * 60 + minutes) * 60
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeBlock: null,
  status: 'idle',
  remainingTime: 0,
  startedAt: null,
  heldNotifications: [],
  lastSessionSummary: null,
  lastSavedSessionId: null,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  startSession: (block) => {
    const startVal = block.startTime ?? block.start_time
    const endVal = block.endTime ?? block.end_time
    const duration = Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))

    set({
      activeBlock: block,
      status: 'running',
      remainingTime: duration,
      startedAt: new Date().toISOString(),
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    // Sinyal ke Android Native Bridge bahwa mode fokus dimulai & bersihkan notifikasi lama
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      const defaultBlockList = [
        'com.whatsapp',
        'com.whatsapp.w4b',
        'com.instagram.android',
        'com.zhiliaoapp.musically',
        'com.twitter.android',
        'org.telegram.messenger',
        'com.google.android.youtube',
      ]
      let blockedApps: string[] = defaultBlockList
      try {
        const stored =
          window.localStorage.getItem('smartlearning-blocked-apps') ||
          window.localStorage.getItem('smartlearning_blocked_apps')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            blockedApps = parsed.filter((item): item is string => typeof item === 'string')
          }
        }
      } catch {
        // Abaikan error localStorage, gunakan defaultBlockList
      }

      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'CLEAR_HELD_NOTIFICATIONS',
        })
      )
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'START_FOCUS',
          data: { blockedPackages: blockedApps, clearNotifications: true },
        })
      )
    }

    // TAHAP 1: Update status anggota di ruang Co-Focus menjadi 'fokus'
    const updateMemberToFocus = async () => {
      try {
        let currentUserId = useAuthStore.getState().user?.id
        if (!currentUserId) {
          const { data } = await supabase.auth.getUser()
          currentUserId = data.user?.id
        }
        if (currentUserId) {
          useGroupStore.getState().syncUserStatus(currentUserId, 'fokus')
          const { error } = await supabase
            .from('study_group_members')
            .update({ status: 'fokus' })
            .eq('user_id', currentUserId)
          if (error) {
            console.warn('[startFocus] Gagal update status fokus di study_group_members:', error.message)
          }
        }
      } catch (err) {
        console.warn('[startFocus] Error update study_group_members:', err)
      }
    }
    void updateMemberToFocus()
  },

  startFocus: (block) => {
    get().startSession(block)
  },

  pauseSession: () =>
    set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  resumeSession: () =>
    set((state) => (state.status === 'paused' ? { status: 'running' } : state)),

  stopFocus: async () => {
    const state = get()

    // TAHAP 1: Kembalikan status user di study_group_members ke 'istirahat' agar tidak pernah nyangkut
    let currentUserId = useAuthStore.getState().user?.id
    if (!currentUserId) {
      try {
        const { data } = await supabase.auth.getUser()
        currentUserId = data.user?.id
      } catch {
        // ignore
      }
    }

    if (currentUserId) {
      useGroupStore.getState().syncUserStatus(currentUserId, 'istirahat')
      try {
        const { error } = await supabase
          .from('study_group_members')
          .update({ status: 'istirahat' })
          .eq('user_id', currentUserId)
        if (error) {
          console.warn('[stopFocus] Gagal update status istirahat di study_group_members:', error.message)
        }
      } catch (err) {
        console.warn('[stopFocus] Error update study_group_members:', err)
      }
    }

    if (!state.activeBlock) {
      return state.lastSavedSessionId
    }

    const startVal = state.activeBlock.startTime ?? state.activeBlock.start_time ?? '00:00'
    const endVal = state.activeBlock.endTime ?? state.activeBlock.end_time ?? '00:00'
    const plannedDuration = Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))
    const actualDuration = Math.max(1, plannedDuration - state.remainingTime)
    const completionStatus: SessionCompletionStatus =
      state.remainingTime <= 0 ? 'completed' : 'ended_early'
    const startedAtIso = state.startedAt ?? new Date().toISOString()
    const endedAtIso = new Date().toISOString()

    const summarySnapshot: SessionSummary = {
      sessionId: null,
      block: state.activeBlock,
      targetDurationSeconds: plannedDuration,
      durationSeconds: actualDuration,
      completionStatus,
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      heldNotifications: state.heldNotifications,
    }

    // 1. Hentikan timer secara instan di state lokal
    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: summarySnapshot,
      lastSavedSessionId: null,
    })

    // Sinyal ke Android Native Bridge bahwa mode fokus telah berakhir
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'STOP_FOCUS',
        })
      )
    }

    if (!currentUserId) {
      return null
    }

    // 2. Tambahkan poin streak langsung saat stopFocus (tanpa menunggu form refleksi)
    try {
      await useAuthStore.getState().recordSessionCompletionForStreak()
    } catch (streakErr) {
      console.warn('[stopFocus] Gagal memperbarui streak:', streakErr)
    }

    // 3. Tandai jadwal (Study Block) menjadi 'completed' agar tidak dapat dimulai ulang
    if (summarySnapshot.block?.id) {
      try {
        void useStudyStore.getState().updateStudyBlock(summarySnapshot.block.id, {
          status: 'completed',
        })
      } catch (blockErr) {
        console.warn('[stopFocus] Gagal memperbarui status study_block:', blockErr)
      }
    }

    // 4. Langsung INSERT laporan sesi ke tabel focus_sessions
    try {
      const dbPayload = {
        user_id: currentUserId,
        study_block_id: summarySnapshot.block.id ?? null,
        target_duration: summarySnapshot.targetDurationSeconds,
        actual_duration: summarySnapshot.durationSeconds,
        completion_status: summarySnapshot.completionStatus,
        reflection_note: '',
        started_at: startedAtIso,
        ended_at: endedAtIso,
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from('focus_sessions')
        .insert(dbPayload)
        .select('id')
        .single<{ id: string }>()

      if (!insertError && insertedRow?.id) {
        set((prev) => ({
          lastSavedSessionId: insertedRow.id,
          lastSessionSummary: prev.lastSessionSummary
            ? { ...prev.lastSessionSummary, sessionId: insertedRow.id }
            : null,
        }))
        return insertedRow.id
      }

      if (insertError) {
        console.warn('[stopFocus] Mencoba fallback insert focus_sessions:', insertError.message)
        const fallbackPayload = {
          user_id: currentUserId,
          block_id: summarySnapshot.block.id ?? null,
          started_at: startedAtIso,
          ended_at: endedAtIso,
          duration_seconds: summarySnapshot.durationSeconds,
          status: 'completed',
          ended_by: summarySnapshot.completionStatus === 'completed' ? 'system' : 'user',
          reflection_notes: '',
        }

        const { data: fallbackRow, error: fallbackError } = await supabase
          .from('focus_sessions')
          .insert(fallbackPayload)
          .select('id')
          .single<{ id: string }>()

        if (!fallbackError && fallbackRow?.id) {
          set((prev) => ({
            lastSavedSessionId: fallbackRow.id,
            lastSessionSummary: prev.lastSessionSummary
              ? { ...prev.lastSessionSummary, sessionId: fallbackRow.id }
              : null,
          }))
          return fallbackRow.id
        }
      }
    } catch (err) {
      console.error('[stopFocus] Gagal menyimpan laporan sesi awal:', err)
    }

    return null
  },

  endSession: () => {
    void get().stopFocus()
  },

  resetSession: () => {
    const currentUserId = useAuthStore.getState().user?.id
    if (currentUserId) {
      useGroupStore.getState().syncUserStatus(currentUserId, 'istirahat')
      void supabase
        .from('study_group_members')
        .update({ status: 'istirahat' })
        .eq('user_id', currentUserId)
    }
    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: null,
      lastSavedSessionId: null,
      isSaving: false,
      error: null,
    })
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'STOP_FOCUS',
        })
      )
    }
  },

  addHeldNotification: (notification) =>
    set((state) => {
      if (state.heldNotifications.some((n) => n.id === notification.id)) {
        return state
      }
      return {
        heldNotifications: [...state.heldNotifications, notification],
      }
    }),

  tick: () =>
    set((state) => {
      if (state.status !== 'running' || state.remainingTime <= 0) return state
      return { remainingTime: state.remainingTime - 1 }
    }),

  saveSessionToDatabase: async (sessionData: SaveSessionPayload) => {
    set({ isSaving: true, error: null })

    const resolvedUserId = sessionData.userId || useAuthStore.getState().user?.id
    if (!resolvedUserId) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk terlebih dahulu.'
      set({ isSaving: false, error: msg })
      throw new Error(msg)
    }

    const existingSessionId =
      sessionData.sessionId ||
      get().lastSavedSessionId ||
      get().lastSessionSummary?.sessionId ||
      null

    try {
      // Jika sesi sudah di-INSERT saat stopFocus, cukup lakukan UPDATE pada reflection_note
      if (existingSessionId) {
        const { error: updateError } = await supabase
          .from('focus_sessions')
          .update({
            reflection_note: sessionData.reflectionNote.trim(),
          })
          .eq('id', existingSessionId)
          .eq('user_id', resolvedUserId)

        if (updateError) {
          // Fallback nama kolom alternatif
          const { error: fallbackUpdateErr } = await supabase
            .from('focus_sessions')
            .update({
              reflection_notes: sessionData.reflectionNote.trim(),
            })
            .eq('id', existingSessionId)
            .eq('user_id', resolvedUserId)

          if (fallbackUpdateErr) {
            throw new Error(updateError.message)
          }
        }

        get().resetSession()
        return
      }

      // Fallback INSERT jika karena kendala jaringan belum tersimpan saat stopFocus
      const dbPayload = {
        user_id: resolvedUserId,
        study_block_id: sessionData.studyBlockId ?? null,
        target_duration: sessionData.targetDuration,
        actual_duration: sessionData.actualDuration,
        completion_status: sessionData.completionStatus,
        reflection_note: sessionData.reflectionNote.trim(),
      }

      const { error: insertError } = await supabase.from('focus_sessions').insert(dbPayload)

      if (insertError) {
        console.error('SUPABASE ERROR (focus_sessions insert):', insertError)

        const fallbackPayload = {
          user_id: resolvedUserId,
          block_id: sessionData.studyBlockId ?? null,
          started_at: sessionData.startedAt ?? new Date().toISOString(),
          ended_at: sessionData.endedAt ?? new Date().toISOString(),
          duration_seconds: sessionData.actualDuration,
          status: 'completed',
          ended_by: sessionData.completionStatus === 'completed' ? 'system' : 'user',
          reflection_notes: sessionData.reflectionNote.trim(),
        }

        const { error: fallbackError } = await supabase
          .from('focus_sessions')
          .insert(fallbackPayload)

        if (fallbackError) {
          console.error('SUPABASE ERROR (focus_sessions fallback insert):', fallbackError)
          throw new Error(insertError.message)
        }
      }

      // Pastikan status timer di-reset ke idle
      get().resetSession()
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan jurnal refleksi ke Supabase.'
      set({ isSaving: false, error: message })
      throw new Error(message)
    } finally {
      set({ isSaving: false })
    }
  },
}))
```

### `src/store/groupStore.ts`
*Store grup Co-Focus & tipe `SupabaseGroupRow` / `SupabaseGroupMemberRow`*

```typescript
// src/store/groupStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

export interface GroupMemberItem {
  id: string
  name: string
  avatar: string
  status: 'fokus' | 'istirahat'
  course: string
  isHost?: boolean
  userId?: string
}

export interface StudyGroupItem {
  id: string
  name: string
  description?: string
  joinCode: string
  maxMembers: number
  hostId: string
  members: GroupMemberItem[]
  createdAt: string
}

interface SupabaseGroupRow {
  id: string
  name: string
  description: string | null
  join_code: string
  max_members: number | null
  host_id: string
  created_at: string
}

interface SupabaseGroupMemberRow {
  id: string
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  status: 'fokus' | 'istirahat' | 'tersedia'
  course: string | null
  joined_at: string
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

interface GroupState {
  groups: StudyGroupItem[]
  activeGroupId: string
  activeGroup: StudyGroupItem | null
  isLoading: boolean
  error: string | null
  clearError: () => void
  fetchMyGroups: (userId?: string) => Promise<void>
  createGroup: (name: string) => Promise<{ success: boolean; group?: StudyGroupItem; error?: string }>
  joinGroup: (code: string) => Promise<{ success: boolean; group?: StudyGroupItem; error?: string }>
  setActiveGroup: (groupId: string) => void
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>
  kickMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>
  deleteGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>
  syncUserStatus: (userId: string, status: 'fokus' | 'istirahat') => void
  syncUserCourse: (userId: string, course: string, name?: string) => void
  handleMemberUpdate: (payload: {
    id?: string
    user_id?: string
    group_id?: string
    status?: string
    course?: string | null
  }) => void
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroupId: '',
  activeGroup: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchMyGroups: async (userId?: string) => {
    const currentUserId = userId || useAuthStore.getState().user?.id
    if (!currentUserId) {
      set({ groups: [], activeGroup: null, activeGroupId: '', isLoading: false })
      return
    }

    set({ isLoading: true, error: null })

    try {
      // 1. Ambil membership user saat ini
      const { data: memberRows, error: memberErr } = await supabase
        .from('study_group_members')
        .select('group_id')
        .eq('user_id', currentUserId)

      if (memberErr) throw memberErr

      if (!memberRows || memberRows.length === 0) {
        set({ groups: [], activeGroup: null, activeGroupId: '', isLoading: false, error: null })
        return
      }

      const groupIds = memberRows.map((m) => m.group_id)

      // 2. Ambil data study_groups
      const { data: groupsData, error: groupsErr } = await supabase
        .from('study_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false })

      if (groupsErr) throw groupsErr

      // 3. Ambil data seluruh anggota di grup-grup tersebut
      const { data: allMembers, error: allMembersErr } = await supabase
        .from('study_group_members')
        .select('*')
        .in('group_id', groupIds)

      if (allMembersErr) throw allMembersErr

      // 4. Ambil profil para anggota untuk nama & jurusan
      const memberUserIds = Array.from(new Set((allMembers || []).map((m: SupabaseGroupMemberRow) => m.user_id)))
      let profileMap = new Map<string, { name: string; major?: string }>()

      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, major')
          .in('id', memberUserIds)

        if (profilesData) {
          profileMap = new Map(profilesData.map((p) => [p.id, p]))
        }
      }

      const currentUser = useAuthStore.getState().user

      // 5. Susun StudyGroupItem[]
      const formattedGroups: StudyGroupItem[] = ((groupsData as SupabaseGroupRow[] | null) || []).map((g) => {
        const groupMemberList: GroupMemberItem[] = ((allMembers as SupabaseGroupMemberRow[] | null) || [])
          .filter((m) => m.group_id === g.id)
          .map((m) => {
            const profile = profileMap.get(m.user_id)
            const isCurrentUser = m.user_id === currentUserId
            const name = profile?.name || (isCurrentUser ? currentUser?.name || 'Anda' : 'Mahasiswa')
            const initials =
              name
                .split(' ')
                .map((p: string) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'M'

            const resolvedCourse =
              (isCurrentUser && currentUser?.major) ||
              profile?.major ||
              m.course ||
              'Mahasiswa'

            return {
              id: m.id,
              userId: m.user_id,
              name: isCurrentUser ? `${name} (Anda)` : name,
              avatar: initials,
              status: m.status === 'fokus' ? 'fokus' : 'istirahat',
              course: resolvedCourse,
              isHost: m.role === 'owner',
            }
          })

        const effectiveMaxMembers = g.max_members && g.max_members >= 10 ? g.max_members : 10
        if (g.max_members && g.max_members < 10) {
          void supabase.from('study_groups').update({ max_members: 10 }).eq('id', g.id)
        }

        return {
          id: g.id,
          name: g.name,
          description: g.description || '',
          joinCode: g.join_code,
          maxMembers: effectiveMaxMembers,
          hostId: g.host_id,
          members: groupMemberList,
          createdAt: g.created_at,
        }
      })

      const prevActiveId = get().activeGroupId
      const resolvedActive =
        formattedGroups.find((g) => g.id === prevActiveId) || formattedGroups[0] || null

      set({
        groups: formattedGroups,
        activeGroup: resolvedActive,
        activeGroupId: resolvedActive?.id || '',
        isLoading: false,
        error: null,
      })
    } catch (err) {
      console.error('SUPABASE ERROR (fetchMyGroups):', err)
      const message = err instanceof Error ? err.message : 'Gagal memuat ruang belajar dari Supabase.'
      set({ isLoading: false, error: message })
    }
  },

  createGroup: async (name: string) => {
    set({ error: null })
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      const errorMsg = 'Silakan masuk terlebih dahulu untuk membuat ruang belajar.'
      set({ error: errorMsg })
      return { success: false, error: errorMsg }
    }

    const trimmedName = name.trim() || 'Ruang Belajar Bersama'
    const newJoinCode = generateUniqueCode()

    try {
      // 1. Insert ke study_groups (kapasitas 10 anggota)
      const { data: newGroupRow, error: groupErr } = await supabase
        .from('study_groups')
        .insert({
          name: trimmedName,
          description: `Dibuat oleh ${currentUser.name || 'Anda'}`,
          join_code: newJoinCode,
          max_members: 10,
          host_id: currentUser.id,
        })
        .select('*')
        .single<SupabaseGroupRow>()

      if (groupErr || !newGroupRow) {
        console.error('SUPABASE ERROR (createGroup):', groupErr)
        throw new Error(groupErr?.message || 'Gagal membuat ruang belajar di Supabase.')
      }

      // 2. Insert host ke study_group_members dengan role 'owner'
      const { data: hostMemberRow, error: memberErr } = await supabase
        .from('study_group_members')
        .insert({
          group_id: newGroupRow.id,
          user_id: currentUser.id,
          role: 'owner',
          status: 'istirahat',
          course: currentUser.major || 'Mahasiswa',
        })
        .select('*')
        .single<SupabaseGroupMemberRow>()

      if (memberErr) {
        console.error('SUPABASE ERROR (insert host member):', memberErr)
      }

      const userInitials =
        (currentUser.name || 'Anda')
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'M'

      const hostItem: GroupMemberItem = {
        id: hostMemberRow?.id || `member-${Date.now()}`,
        userId: currentUser.id,
        name: `${currentUser.name || 'Anda'} (Host)`,
        avatar: userInitials,
        status: 'istirahat',
        course: currentUser.major || 'Mahasiswa',
        isHost: true,
      }

      const createdItem: StudyGroupItem = {
        id: newGroupRow.id,
        name: newGroupRow.name,
        description: newGroupRow.description || '',
        joinCode: newGroupRow.join_code,
        maxMembers: newGroupRow.max_members || 10,
        hostId: currentUser.id,
        members: [hostItem],
        createdAt: newGroupRow.created_at,
      }

      set((state) => ({
        groups: [createdItem, ...state.groups],
        activeGroup: createdItem,
        activeGroupId: createdItem.id,
        error: null,
      }))

      return { success: true, group: createdItem }
    } catch (err) {
      console.error('SUPABASE ERROR (createGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal membuat ruang belajar.'
      set({ error: message })
      return { success: false, error: message }
    }
  },

  joinGroup: async (code: string) => {
    set({ error: null })
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu untuk bergabung.' }
    }

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      return { success: false, error: 'Silakan masukkan kode ruangan.' }
    }

    try {
      // a. Cari grup berdasarkan join_code
      const { data: targetGroupRow, error: groupErr } = await supabase
        .from('study_groups')
        .select('*')
        .eq('join_code', cleanCode)
        .maybeSingle<SupabaseGroupRow>()

      if (groupErr) throw groupErr

      if (!targetGroupRow) {
        return { success: false, error: 'Kode ruangan tidak valid' }
      }

      // b. Lakukan insert ke study_group_members.
      // Database trigger check_max_group_members akan menangani jika grup sudah penuh (>= 6)
      const { error: insertMemberErr } = await supabase
        .from('study_group_members')
        .insert({
          group_id: targetGroupRow.id,
          user_id: currentUser.id,
          role: 'member',
          status: 'istirahat',
          course: currentUser.major || 'Mahasiswa',
        })

      if (insertMemberErr) {
        const errLower = insertMemberErr.message.toLowerCase()
        if (errLower.includes('penuh') || errLower.includes('maks') || insertMemberErr.code === 'P0001') {
          return { success: false, error: 'Maaf, ruang belajar sudah penuh (Maks 10 orang)' }
        }
        // Jika user sudah terdaftar di grup ini (unique constraint uq_group_user)
        if (
          insertMemberErr.code === '23505' ||
          errLower.includes('duplicate') ||
          errLower.includes('unique')
        ) {
          await get().fetchMyGroups(currentUser.id)
          get().setActiveGroup(targetGroupRow.id)
          const currentGroup = get().groups.find((g) => g.id === targetGroupRow.id)
          return { success: true, group: currentGroup }
        }
        throw insertMemberErr
      }

      // Berhasil gabung, refresh groups
      await get().fetchMyGroups(currentUser.id)
      get().setActiveGroup(targetGroupRow.id)
      const joinedGroup = get().groups.find((g) => g.id === targetGroupRow.id)

      return { success: true, group: joinedGroup }
    } catch (err) {
      console.error('SUPABASE ERROR (joinGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal bergabung ke ruang belajar.'
      set({ error: message })
      return { success: false, error: message }
    }
  },

  setActiveGroup: (groupId: string) => {
    const target = get().groups.find((g) => g.id === groupId)
    if (target) {
      set({ activeGroupId: target.id, activeGroup: target })
    }
  },

  leaveGroup: async (groupId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (leaveGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal keluar dari ruang belajar.'
      return { success: false, error: message }
    }
  },

  kickMember: async (groupId: string, targetUserId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (kickMember):', err)
      const message = err instanceof Error ? err.message : 'Gagal mengeluarkan anggota dari ruang belajar.'
      return { success: false, error: message }
    }
  },

  deleteGroup: async (groupId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_groups')
        .delete()
        .eq('id', groupId)
        .eq('host_id', currentUser.id)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (deleteGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal menghapus ruang belajar.'
      return { success: false, error: message }
    }
  },

  syncUserStatus: (userId: string, status: 'fokus' | 'istirahat') => {
    get().handleMemberUpdate({ user_id: userId, status })
  },

  handleMemberUpdate: (payload: {
    id?: string
    user_id?: string
    group_id?: string
    status?: string
    course?: string | null
  }) => {
    const targetUserId = payload.user_id
    const targetMemberId = payload.id
    const newStatus: 'fokus' | 'istirahat' = payload.status === 'fokus' ? 'fokus' : 'istirahat'
    const newCourse = payload.course

    set((state) => {
      const updatedGroups = state.groups.map((g) => {
        if (payload.group_id && g.id !== payload.group_id) {
          return g
        }
        return {
          ...g,
          members: g.members.map((m) => {
            const isMatch = (targetMemberId && m.id === targetMemberId) || (targetUserId && m.userId === targetUserId)
            if (!isMatch) return m
            return {
              ...m,
              status: newStatus,
              ...(newCourse ? { course: newCourse } : {}),
            }
          }),
        }
      })

      const updatedActive = state.activeGroup && (!payload.group_id || state.activeGroup.id === payload.group_id)
        ? {
            ...state.activeGroup,
            members: state.activeGroup.members.map((m) => {
              const isMatch = (targetMemberId && m.id === targetMemberId) || (targetUserId && m.userId === targetUserId)
              if (!isMatch) return m
              return {
                ...m,
                status: newStatus,
                ...(newCourse ? { course: newCourse } : {}),
              }
            }),
          }
        : state.activeGroup

      return { groups: updatedGroups, activeGroup: updatedActive }
    })
  },

  syncUserCourse: (userId: string, course: string, name?: string) => {
    set((state) => {
      const updateMember = (m: GroupMemberItem): GroupMemberItem => {
        if (m.userId !== userId) return m
        const cleanCourse = course.trim() || m.course
        let nextName = m.name
        if (name && name.trim()) {
          const suffix = m.name.includes('(Host)')
            ? ' (Host)'
            : m.name.includes('(Anda)')
              ? ' (Anda)'
              : ''
          nextName = `${name.trim()}${suffix}`
        }
        return { ...m, course: cleanCourse, name: nextName }
      }

      const updatedGroups = state.groups.map((g) => ({
        ...g,
        members: g.members.map(updateMember),
      }))
      const updatedActive = state.activeGroup
        ? {
            ...state.activeGroup,
            members: state.activeGroup.members.map(updateMember),
          }
        : null
      return { groups: updatedGroups, activeGroup: updatedActive }
    })
  },
}))
```
