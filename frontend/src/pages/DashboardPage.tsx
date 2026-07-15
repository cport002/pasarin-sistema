import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt, MESES, archivoUrl } from '../services/api'
import type { ResumenMensual, Mensualidad } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { LayoutDashboard, Users, Star, Clock, AlertTriangle, CheckCircle2, Wallet, Paperclip, XCircle, FileCheck } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const hoy = new Date()

export default function DashboardPage() {
  const { puedeEditar } = useAuth()
  const [resumen, setResumen] = useState<ResumenMensual | null>(null)
  const [porRevisar, setPorRevisar] = useState<Mensualidad[]>([])
  const [loading, setLoading] = useState(true)
  const [pagando, setPagando] = useState<Mensualidad | null>(null)
  const [metodoPago, setMetodoPago] = useState('transferencia')

  const cargarResumen = () => {
    api.get<ResumenMensual>('/mensualidades/resumen').then(r => { setResumen(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  const cargarPorRevisar = () => {
    api.get<Mensualidad[]>('/mensualidades', { params: { estado: 'en_revision' } }).then(r => setPorRevisar(r.data)).catch(() => {})
  }

  useEffect(() => {
    cargarResumen()
    cargarPorRevisar()
  }, [])

  const confirmarPago = async () => {
    if (!pagando) return
    try {
      await api.patch(`/mensualidades/${pagando.id}/pagar`, { metodo_pago: metodoPago })
      toast.success('Mensualidad marcada como pagada')
      setPagando(null)
      cargarPorRevisar()
      cargarResumen()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar el pago')
    }
  }

  const anular = async (m: Mensualidad) => {
    if (!confirm(`¿Anular la mensualidad de ${m.alumno_nombre} ${m.alumno_apellido}?`)) return
    try {
      await api.patch(`/mensualidades/${m.id}/anular`)
      toast.success('Mensualidad anulada')
      cargarPorRevisar()
      cargarResumen()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al anular')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!resumen) return null

  const cards = [
    { label: 'Alumnos activos', value: resumen.total_activos, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Becados', value: resumen.becados, icon: Star, color: 'text-amber-600 bg-amber-50' },
    { label: 'Pendientes', value: resumen.pendientes, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Por revisar', value: resumen.en_revision, icon: FileCheck, color: 'text-blue-600 bg-blue-50' },
    { label: 'Vencidas', value: resumen.vencidas, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Pagadas', value: resumen.pagadas, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Resumen de ${MESES[resumen.mes - 1]} ${resumen.anio}`} icon={LayoutDashboard} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {porRevisar.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <h3>Comprobantes por revisar ({porRevisar.length})</h3>
          </div>

          {/* Mobile: cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {porRevisar.map(m => (
              <div key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/alumnos/${m.alumno_id}`} className="font-medium text-gray-900 hover:text-purple-600">{m.alumno_nombre} {m.alumno_apellido}</Link>
                    <p className="text-xs text-gray-400 mt-0.5">{MESES[m.periodo_mes - 1]} {m.periodo_anio} · {fmt.clp(m.monto)}</p>
                  </div>
                  <a href={archivoUrl(m.comprobante_url)} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline flex items-center gap-1 text-sm shrink-0">
                    <Paperclip className="w-3.5 h-3.5" /> Ver
                  </a>
                </div>
                {puedeEditar && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => { setPagando(m); setMetodoPago('transferencia') }} className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Marcar pagado
                    </button>
                    <button onClick={() => anular(m)} className="inline-flex items-center gap-1 text-red-500 text-sm font-medium">
                      <XCircle className="w-4 h-4" /> Anular
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Alumno</th>
                  <th className="table-header">Período</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header">Comprobante</th>
                  {puedeEditar && <th className="table-header text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {porRevisar.map(m => (
                  <tr key={m.id} className="table-row">
                    <td className="table-cell font-medium">
                      <Link to={`/alumnos/${m.alumno_id}`} className="hover:text-purple-600">{m.alumno_nombre} {m.alumno_apellido}</Link>
                    </td>
                    <td className="table-cell text-gray-500">{MESES[m.periodo_mes - 1]} {m.periodo_anio}</td>
                    <td className="table-cell text-right tabular-nums">{fmt.clp(m.monto)}</td>
                    <td className="table-cell">
                      <a href={archivoUrl(m.comprobante_url)} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" /> Ver
                      </a>
                    </td>
                    {puedeEditar && (
                      <td className="table-cell">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => { setPagando(m); setMetodoPago('transferencia') }} title="Marcar pagado" className="text-gray-400 hover:text-emerald-600 transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => anular(m)} title="Anular" className="text-gray-400 hover:text-red-600 transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/alumnos" className="btn-secondary">Ver alumnos</Link>
        <Link to="/mensualidades" className="btn-secondary">Ver mensualidades</Link>
        <Link to="/categorias" className="btn-secondary">Ver categorías</Link>
      </div>

      {pagando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="mb-4">Confirmar pago — {pagando.alumno_nombre} {pagando.alumno_apellido}</h2>
            <label className="label">Método de pago</label>
            <select className="input mb-4" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setPagando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarPago}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
