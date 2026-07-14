import axios from 'axios'

const API_ORIGIN = import.meta.env.VITE_API_URL || ''
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

// Los archivos subidos (comprobantes) se sirven desde el backend, no desde el sitio estatico del frontend
export function archivoUrl(path?: string | null) {
  if (!path) return ''
  return `${API_ORIGIN}${path}`
}

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const fmt = {
  clp: (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0),
  num: (n: number, dec = 0) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: dec }).format(n || 0),
  pct: (n: any) => `${(parseFloat(n) || 0).toFixed(1)}%`,
  fecha: (s?: string) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CL') : '-'
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
