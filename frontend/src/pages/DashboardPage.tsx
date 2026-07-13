import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt, MESES } from '../services/api'
import type { ResumenMensual } from '../types'
import { LayoutDashboard, Users, Star, Clock, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const hoy = new Date()

export default function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenMensual | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<ResumenMensual>('/mensualidades/resumen').then(r => { setResumen(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!resumen) return null

  const cards = [
    { label: 'Alumnos activos', value: resumen.total_activos, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Becados', value: resumen.becados, icon: Star, color: 'text-amber-600 bg-amber-50' },
    { label: 'Pendientes', value: resumen.pendientes, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Vencidas', value: resumen.vencidas, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Pagadas', value: resumen.pagadas, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Resumen de ${MESES[resumen.mes - 1]} ${resumen.anio}`} icon={LayoutDashboard} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-purple-600" />
            <h3>Por cobrar este mes</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{fmt.clp(resumen.monto_por_cobrar)}</p>
          <p className="text-xs text-gray-400 mt-1">Suma de mensualidades pendientes y vencidas</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3>Cobrado este mes</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{fmt.clp(resumen.monto_cobrado)}</p>
          <p className="text-xs text-gray-400 mt-1">Suma de mensualidades ya pagadas</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/alumnos" className="btn-secondary">Ver alumnos</Link>
        <Link to="/mensualidades" className="btn-secondary">Ver mensualidades</Link>
        <Link to="/categorias" className="btn-secondary">Ver categorías</Link>
      </div>
    </div>
  )
}
