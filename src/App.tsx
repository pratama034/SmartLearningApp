import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import FocusMode from './pages/FocusMode'
import CoFocus from './pages/CoFocus'
import Reports from './pages/Reports'
import StudyGroupRoom from './components/group/StudyGroupRoom'
import SessionSummary from './pages/SessionSummary'
import StudyBlocks from './pages/StudyBlocks'
import Register from './pages/Register'
import Settings from './pages/Settings'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { useStudyStore } from './store/studyStore'

export default function App() {
  const setSession = useAuthStore((state) => state.setSession)
  const user = useAuthStore((state) => state.user)
  const fetchBlocks = useStudyStore((state) => state.fetchBlocks)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      setSession(error ? null : data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    if (user?.id) void fetchBlocks(user.id)
  }, [fetchBlocks, user?.id])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="study-blocks" element={<StudyBlocks />} />
            <Route path="focus" element={<FocusMode />} />
          <Route path="cofocus" element={<CoFocus />} />
          <Route path="cofocus/room" element={<StudyGroupRoom />} />
            <Route path="summary" element={<SessionSummary />} />
          <Route path="reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
