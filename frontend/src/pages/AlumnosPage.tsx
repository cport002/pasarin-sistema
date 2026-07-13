import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt } from '../services/api'
import type { Alumno, Categoria } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Users, ChevronRight, Star } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const estadoBadge: Record<string, string> = { activo: 'badge-green', inactivo: 'badge-gray' }

const FORM_INICIAL = {
  nombre: '', apellido: '', email: '', telefono: '', fecha_nacimiento: '', fecha_inscripcion: '',
  categoria_id: '', monto_personalizado: '', es_becado: false, porcentaje_beca: 0, notas: ''
}

export default function AlumnosPage() {
  const { puedeEditar } = useAuth()
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const cargar = () => {
    const params: any = {}
    if (filtroCategoria) params.categoria_id = filtroCategoria
    if (filtroEstado) params.estado = filtroEstado
    if (busqueda) params.busqueda = busqueda
    api.get('/alumnos', { params }).then(r => { setAlumnos(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [filtroCategoria, filtroEstado, busqueda])
  useEffect(() => { api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {}) }, [])

  const abrirNuevo = () => {
    setForm(FORM_INICIAL)
    setShowForm(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/alumnos', {
        ...form,
        categoria_id: form.categoria_id || null,
        monto_personalizado: form.monto_personalizado === '' ? null : Number(form.monto_personalizado),
        porcentaje_beca: form.es_becado ? Number(form.porcentaje_beca) : 0
      })
      toast.success('Alumno registrado correctamente')
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear alumno')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumnos"
        subtitle={`${alumnos.length} alumno${alumnos.length !== 1 ? 's' : ''}`}
        icon={Users}
        actions={puedeEditar ? (
          <button onClick={abrirNuevo}
            className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Alumno
          </button>
        ) : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nombre, apellido o email..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input sm:w-56" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="input sm:w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-3">
        {alumnos.map(a => (
          <Link key={a.id} to={`/alumnos/${a.id}`} className="card block p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{a.nombre} {a.apellido}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.categoria_nombre || 'Sin categoría'}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
            </div>
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {!!a.es_becado && <span className="badge-yellow flex items-center gap-1"><Star className="w-3 h-3" /> Becado {a.porcentaje_beca}%</span>}
              </div>
              <span className={estadoBadge[a.estado] || 'badge-gray'}>{a.estado}</span>
            </div>
          </Link>
        ))}
        {alumnos.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay alumnos que coincidan con el filtro
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Categoría</th>
              <th className="table-header text-right">Mensualidad</th>
              <th className="table-header text-center">Beca</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map(a => {
              const base = a.monto_personalizado ?? a.categoria_monto ?? 0
              const efectivo = a.es_becado ? Math.round(base * (1 - a.porcentaje_beca / 100)) : base
              return (
                <tr key={a.id} className="table-row">
                  <td className="table-cell font-medium">{a.nombre} {a.apellido}</td>
                  <td className="table-cell text-gray-600">{a.categoria_nombre || '-'}</td>
                  <td className="table-cell text-right tabular-nums">{fmt.clp(efectivo)}</td>
                  <td className="table-cell text-center">
                    {!!a.es_becado ? <span className="badge-yellow">{a.porcentaje_beca}%</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="table-cell text-center"><span className={estadoBadge[a.estado] || 'badge-gray'}>{a.estado}</span></td>
                  <td className="table-cell">
                    <Link to={`/alumnos/${a.id}`} className="text-gray-400 hover:text-primary-600 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {alumnos.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay alumnos que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2>Nuevo Alumno</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input className="input" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} — {fmt.clp(c.monto_mensualidad)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Monto personalizado (opcional)</label>
                  <input type="number" min={0} className="input" value={form.monto_personalizado}
                    onChange={e => setForm({...form, monto_personalizado: e.target.value})} placeholder="Dejar vacío para usar el de la categoría" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha de nacimiento</label>
                  <input type="date" className="input" value={form.fecha_nacimiento} onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} />
                </div>
                <div>
                  <label className="label">Fecha de inscripción</label>
                  <input type="date" className="input" value={form.fecha_inscripcion} onChange={e => setForm({...form, fecha_inscripcion: e.target.value})} />
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
                    <input type="number" min={0} max={100} className="input" value={form.porcentaje_beca}
                      onChange={e => setForm({...form, porcentaje_beca: Number(e.target.value)})} />
                  </div>
                )}
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Alumno</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
