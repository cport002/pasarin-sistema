import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { fmt, MESES, archivoUrl } from '../services/api'
import type { Alumno, Categoria, Mensualidad } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Star, Edit2, CheckCircle2, XCircle, Upload, Paperclip, Link2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const estadoBadge: Record<string, string> = {
  pendiente: 'badge-yellow', pagado: 'badge-green', vencido: 'badge-red', anulado: 'badge-gray', en_revision: 'badge-blue'
}

export default function AlumnoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [mensualidades, setMensualidades] = useState<Mensualidad[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [pagando, setPagando] = useState<Mensualidad | null>(null)
  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [form, setForm] = useState<any>(null)
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({})

  const cargar = () => {
    Promise.all([
      api.get(`/alumnos/${id}`),
      api.get(`/mensualidades/alumno/${id}`)
    ]).then(([a, m]) => {
      setAlumno(a.data)
      setMensualidades(m.data)
      setLoading(false)
    }).catch(() => { setLoading(false); toast.error('No se pudo cargar el alumno') })
  }
  useEffect(cargar, [id])
  useEffect(() => { api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {}) }, [])

  const abrirEditar = () => {
    if (!alumno) return
    setForm({
      nombre: alumno.nombre, apellido: alumno.apellido, email: alumno.email || '', telefono: alumno.telefono || '',
      categoria_id: alumno.categoria_id || '', monto_personalizado: alumno.monto_personalizado ?? '',
      es_becado: !!alumno.es_becado, porcentaje_beca: alumno.porcentaje_beca || 0,
      estado: alumno.estado, notas: alumno.notas || ''
    })
    setShowEdit(true)
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.put(`/alumnos/${id}`, {
        ...form,
        categoria_id: form.categoria_id || null,
        monto_personalizado: form.monto_personalizado === '' ? null : Number(form.monto_personalizado),
        porcentaje_beca: form.es_becado ? Number(form.porcentaje_beca) : 0
      })
      toast.success('Alumno actualizado')
      setShowEdit(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  const abrirPagar = (m: Mensualidad) => {
    setPagando(m)
    setMetodoPago('transferencia')
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

  const copiarLinkPago = async () => {
    if (!alumno?.token) return
    const url = `${window.location.origin}/pago/${alumno.token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link de pago copiado')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const anular = async (m: Mensualidad) => {
    if (!confirm(`¿Anular la mensualidad de ${MESES[m.periodo_mes - 1]} ${m.periodo_anio}?`)) return
    try {
      await api.patch(`/mensualidades/${m.id}/anular`)
      toast.success('Mensualidad anulada')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al anular')
    }
  }

  const subirComprobante = async (m: Mensualidad, file: File) => {
    const data = new FormData()
    data.append('archivo', file)
    try {
      await api.post(`/mensualidades/${m.id}/comprobante`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Comprobante subido')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al subir comprobante')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!alumno) return <div className="text-center py-12 text-gray-400">Alumno no encontrado</div>

  const base = alumno.monto_personalizado ?? alumno.categoria_monto ?? 0
  const montoEfectivo = alumno.es_becado ? Math.round(base * (1 - alumno.porcentaje_beca / 100)) : base

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${alumno.nombre} ${alumno.apellido}`}
        subtitle={alumno.categoria_nombre || 'Sin categoría'}
        icon={ArrowLeft}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/alumnos')} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            {puedeEditar && alumno.token && (
              <button onClick={copiarLinkPago} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <Link2 className="w-4 h-4" /> Copiar link de pago
              </button>
            )}
            {puedeEditar && (
              <button onClick={abrirEditar} className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors shadow-sm">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Mensualidad</p>
          <p className="text-lg font-bold text-gray-900">{fmt.clp(montoEfectivo)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Beca</p>
          <p className="text-lg font-bold text-gray-900">
            {alumno.es_becado ? <span className="flex items-center gap-1 text-amber-600"><Star className="w-4 h-4" /> {alumno.porcentaje_beca}%</span> : 'No'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Estado</p>
          <span className={alumno.estado === 'activo' ? 'badge-green' : 'badge-gray'}>{alumno.estado}</span>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Contacto</p>
          <p className="text-sm text-gray-700 truncate">{alumno.email || '-'}</p>
          <p className="text-xs text-gray-400">{alumno.telefono || '-'}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100"><h3>Historial de mensualidades</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Período</th>
                <th className="table-header text-right">Monto</th>
                <th className="table-header">Vencimiento</th>
                <th className="table-header text-center">Estado</th>
                <th className="table-header">Comprobante</th>
                {puedeEditar && <th className="table-header text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {mensualidades.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell font-medium">{MESES[m.periodo_mes - 1]} {m.periodo_anio}</td>
                  <td className="table-cell text-right tabular-nums">{fmt.clp(m.monto)}</td>
                  <td className="table-cell text-gray-500">{fmt.fecha(m.fecha_vencimiento)}</td>
                  <td className="table-cell text-center"><span className={estadoBadge[m.estado]}>{m.estado}</span></td>
                  <td className="table-cell">
                    {m.comprobante_url ? (
                      <a href={archivoUrl(m.comprobante_url)} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" /> Ver
                      </a>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  {puedeEditar && (
                    <td className="table-cell">
                      <div className="flex gap-2 justify-center items-center">
                        {m.estado !== 'pagado' && m.estado !== 'anulado' && (
                          <>
                            <button onClick={() => abrirPagar(m)} title="Marcar pagado" className="text-gray-400 hover:text-emerald-600 transition-colors">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => anular(m)} title="Anular" className="text-gray-400 hover:text-red-600 transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => fileInputs.current[m.id]?.click()} title="Subir comprobante" className="text-gray-400 hover:text-purple-600 transition-colors">
                              <Upload className="w-4 h-4" />
                            </button>
                            <input ref={el => { fileInputs.current[m.id] = el }} type="file" accept="image/*,.pdf" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(m, f); e.target.value = '' }} />
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {mensualidades.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aún no hay mensualidades generadas para este alumno</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal confirmar pago */}
      {pagando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="mb-4">Confirmar pago — {MESES[pagando.periodo_mes - 1]} {pagando.periodo_anio}</h2>
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

      {/* Modal editar alumno */}
      {showEdit && form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><h2>Editar Alumno</h2></div>
            <form onSubmit={handleGuardar} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required /></div>
                <div><label className="label">Apellido *</label><input className="input" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})} required /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Monto personalizado</label>
                  <input type="number" min={0} className="input" value={form.monto_personalizado} onChange={e => setForm({...form, monto_personalizado: e.target.value})} placeholder="Vacío = usar el de la categoría" />
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={form.es_becado} onChange={e => setForm({...form, es_becado: e.target.checked})} />
                  <span className="text-sm font-medium text-gray-700">Alumno becado</span>
                </label>
                {form.es_becado && (
                  <div>
                    <label className="label">Porcentaje de beca (%)</label>
                    <input type="number" min={0} max={100} className="input" value={form.porcentaje_beca} onChange={e => setForm({...form, porcentaje_beca: Number(e.target.value)})} />
                  </div>
                )}
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
