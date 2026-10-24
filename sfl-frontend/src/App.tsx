import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import FocusMode from './pages/FocusMode'
import CoFocus from './pages/CoFocus'
import SessionSummary from './pages/SessionSummary'
import StudyBlocks from './pages/StudyBlocks'
import Reports from './pages/Reports'
import Register from './pages/Register'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

export default function App() {
  const setSession = useAuthStore((state) => state.setSession)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      setSession(error ? null : data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

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
            <Route path="summary" element={<SessionSummary />} />
            <Route path="reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
