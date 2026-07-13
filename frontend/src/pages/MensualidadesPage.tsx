import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt, MESES } from '../services/api'
import type { Mensualidad, Categoria } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Wallet, RefreshCw, Mail, CheckCircle2, XCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const estadoBadge: Record<string, string> = {
  pendiente: 'badge-yellow', pagado: 'badge-green', vencido: 'badge-red', anulado: 'badge-gray'
}

const hoy = new Date()

export default function MensualidadesPage() {
  const { puedeEditar, esAdmin } = useAuth()
  const [mensualidades, setMensualidades] = useState<Mensualidad[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [estado, setEstado] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [generando, setGenerando] = useState(false)
  const [enviandoAlertas, setEnviandoAlertas] = useState(false)
  const [pagando, setPagando] = useState<Mensualidad | null>(null)
  const [metodoPago, setMetodoPago] = useState('transferencia')

  const cargar = () => {
    const params: any = { mes, anio }
    if (estado) params.estado = estado
    if (categoriaId) params.categoria_id = categoriaId
    api.get('/mensualidades', { params }).then(r => { setMensualidades(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [mes, anio, estado, categoriaId])
  useEffect(() => { api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {}) }, [])

  const generarMes = async () => {
    setGenerando(true)
    try {
      const r = await api.post('/mensualidades/generar-mes', { mes, anio })
      toast.success(`${r.data.generadas} mensualidad(es) generada(s)`)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al generar')
    } finally {
      setGenerando(false)
    }
  }

  const enviarAlertas = async () => {
    setEnviandoAlertas(true)
    try {
      const r = await api.post('/mensualidades/enviar-alertas')
      toast.success(`Avisos previos: ${r.data.avisos_previos} · Avisos vencidos: ${r.data.avisos_vencidos}`)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al enviar alertas')
    } finally {
      setEnviandoAlertas(false)
    }
  }

  const confirmarPago = async () => {
    if (!pagando) return
    try {
      await api.patch(`/mensualidades/${pagando.id}/pagar`, { metodo_pago: metodoPago })
      toast.success('Mensualidad marcada como pagada')
      setPagando(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar el pago')
    }
  }

  const anular = async (m: Mensualidad) => {
    if (!confirm(`¿Anular la mensualidad de ${m.alumno_nombre} ${m.alumno_apellido}?`)) return
    try {
      await api.patch(`/mensualidades/${m.id}/anular`)
      toast.success('Mensualidad anulada')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al anular')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensualidades"
        subtitle={`${MESES[mes - 1]} ${anio} · ${mensualidades.length} registro(s)`}
        icon={Wallet}
        actions={puedeEditar ? (
          <div className="flex gap-2 flex-wrap">
            <button onClick={generarMes} disabled={generando}
              className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors shadow-sm disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${generando ? 'animate-spin' : ''}`} /> Generar mes
            </button>
            {esAdmin && (
              <button onClick={enviarAlertas} disabled={enviandoAlertas}
                className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50">
                <Mail className="w-4 h-4" /> Enviar alertas ahora
              </button>
            )}
          </div>
        ) : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <select className="input sm:w-40" value={mes} onChange={e => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input sm:w-32" value={anio} onChange={e => setAnio(Number(e.target.value))}>
          {[anio - 1, anio, anio + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input sm:w-48" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="input sm:w-40" value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="vencido">Vencido</option>
          <option value="anulado">Anulado</option>
        </select>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-3">
        {mensualidades.map(m => (
          <div key={m.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link to={`/alumnos/${m.alumno_id}`} className="font-medium text-gray-900 hover:text-purple-600">{m.alumno_nombre} {m.alumno_apellido}</Link>
                <p className="text-xs text-gray-400 mt-0.5">{m.categoria_nombre || 'Sin categoría'} · vence {fmt.fecha(m.fecha_vencimiento)}</p>
              </div>
              <span className={estadoBadge[m.estado]}>{m.estado}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="font-semibold text-gray-800 tabular-nums text-sm">{fmt.clp(m.monto)}</span>
              {puedeEditar && m.estado !== 'pagado' && m.estado !== 'anulado' && (
                <div className="flex gap-2">
                  <button onClick={() => { setPagando(m); setMetodoPago('transferencia') }} className="text-gray-400 hover:text-emerald-600"><CheckCircle2 className="w-4 h-4" /></button>
                  <button onClick={() => anular(m)} className="text-gray-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {mensualidades.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay mensualidades para este período/filtro
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Alumno</th>
              <th className="table-header">Categoría</th>
              <th className="table-header text-right">Monto</th>
              <th className="table-header">Vencimiento</th>
              <th className="table-header text-center">Estado</th>
              {puedeEditar && <th className="table-header text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {mensualidades.map(m => (
              <tr key={m.id} className="table-row">
                <td className="table-cell font-medium">
                  <Link to={`/alumnos/${m.alumno_id}`} className="hover:text-purple-600">{m.alumno_nombre} {m.alumno_apellido}</Link>
                </td>
                <td className="table-cell text-gray-600">{m.categoria_nombre || '-'}</td>
                <td className="table-cell text-right tabular-nums">{fmt.clp(m.monto)}</td>
                <td className="table-cell text-gray-500">{fmt.fecha(m.fecha_vencimiento)}</td>
                <td className="table-cell text-center"><span className={estadoBadge[m.estado]}>{m.estado}</span></td>
                {puedeEditar && (
                  <td className="table-cell text-center">
                    {m.estado !== 'pagado' && m.estado !== 'anulado' && (
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setPagando(m); setMetodoPago('transferencia') }} title="Marcar pagado" className="text-gray-400 hover:text-emerald-600 transition-colors">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => anular(m)} title="Anular" className="text-gray-400 hover:text-red-600 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {mensualidades.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay mensualidades para este período/filtro</td></tr>
            )}
          </tbody>
        </table>
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
