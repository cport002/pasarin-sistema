import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import AlumnosPage from './pages/AlumnosPage'
import AlumnoDetallePage from './pages/AlumnoDetallePage'
import MensualidadesPage from './pages/MensualidadesPage'
import CategoriasPage from './pages/CategoriasPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import UsuariosPage from './pages/UsuariosPage'
import PagoPublicoPage from './pages/PagoPublicoPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const auth = useAuth()

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/login" element={auth.token ? <Navigate to="/" replace /> : <LoginPage onLogin={auth.login} />} />
        <Route path="/pago/:token" element={<PagoPublicoPage />} />
        <Route path="/" element={<PrivateRoute><Layout auth={auth} /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="alumnos" element={<AlumnosPage />} />
          <Route path="alumnos/:id" element={<AlumnoDetallePage />} />
          <Route path="mensualidades" element={<MensualidadesPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
