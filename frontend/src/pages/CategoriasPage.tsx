import { useEffect, useState } from 'react'
import api, { fmt } from '../services/api'
import type { Categoria } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Tags } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function CategoriasPage() {
  const { puedeEditar } = useAuth()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [form, setForm] = useState({ nombre: '', monto_mensualidad: 0, orden: 0, activa: true })

  const cargar = () => {
    api.get('/categorias').then(r => { setCategorias(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [])

  const abrirNueva = () => {
    setEditando(null)
    setForm({ nombre: '', monto_mensualidad: 0, orden: categorias.length, activa: true })
    setShowForm(true)
  }

  const abrirEditar = (c: Categoria) => {
    setEditando(c)
    setForm({ nombre: c.nombre, monto_mensualidad: c.monto_mensualidad, orden: c.orden, activa: c.activa === 1 })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/categorias/${editando.id}`, form)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/categorias', form)
        toast.success('Categoría creada')
      }
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  const handleEliminar = async (c: Categoria) => {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return
    try {
      await api.delete(`/categorias/${c.id}`)
      toast.success('Categoría eliminada')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        subtitle={`${categorias.length} categoría${categorias.length !== 1 ? 's' : ''}`}
        icon={Tags}
        actions={puedeEditar ? (
          <button onClick={abrirNueva}
            className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Categoría
          </button>
        ) : undefined}
      />

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-3">
        {categorias.map(c => (
          <div key={c.id} className={`card p-4 ${!c.activa ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{c.nombre}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.total_alumnos ?? 0} alumno(s) activo(s)</p>
              </div>
              <span className="font-semibold text-gray-800 tabular-nums text-sm">{fmt.clp(c.monto_mensualidad)}</span>
            </div>
            {puedeEditar && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => abrirEditar(c)} className="btn-secondary btn-sm flex items-center gap-1.5 flex-1 justify-center">
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                <button onClick={() => handleEliminar(c)} className="btn-secondary btn-sm flex items-center gap-1.5 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header text-right">Monto mensualidad</th>
              <th className="table-header text-center">Alumnos activos</th>
              <th className="table-header text-center">Estado</th>
              {puedeEditar && <th className="table-header text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {categorias.map(c => (
              <tr key={c.id} className={`table-row ${!c.activa ? 'opacity-50' : ''}`}>
                <td className="table-cell font-medium">{c.nombre}</td>
                <td className="table-cell text-right tabular-nums">{fmt.clp(c.monto_mensualidad)}</td>
                <td className="table-cell text-center">{c.total_alumnos ?? 0}</td>
                <td className="table-cell text-center">
                  <span className={c.activa ? 'badge-green' : 'badge-gray'}>{c.activa ? 'activa' : 'inactiva'}</span>
                </td>
                {puedeEditar && (
                  <td className="table-cell text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => abrirEditar(c)} className="text-gray-400 hover:text-primary-600 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEliminar(c)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2>{editando ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
              </div>
              <div>
                <label className="label">Monto mensualidad (CLP) *</label>
                <input type="number" min={0} className="input" value={form.monto_mensualidad}
                  onChange={e => setForm({...form, monto_mensualidad: Number(e.target.value)})} required />
              </div>
              <div>
                <label className="label">Orden de visualización</label>
                <input type="number" className="input" value={form.orden} onChange={e => setForm({...form, orden: Number(e.target.value)})} />
              </div>
              {editando && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="activa" checked={form.activa} onChange={e => setForm({...form, activa: e.target.checked})} />
                  <label htmlFor="activa" className="text-sm text-gray-700">Categoría activa</label>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">{editando ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
