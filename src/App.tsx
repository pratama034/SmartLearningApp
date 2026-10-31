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
