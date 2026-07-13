import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api, { fmt, MESES } from '../services/api'
import toast from 'react-hot-toast'
import { Upload, CheckCircle2, Building2 } from 'lucide-react'

interface Mensualidad {
  id: number
  periodo_mes: number
  periodo_anio: number
  monto: number
  estado: string
  fecha_vencimiento: string
  comprobante_url: string | null
}

interface DatosBancarios {
  banco?: string
  tipo_cuenta?: string
  numero_cuenta?: string
  rut?: string
  nombre?: string
}

export default function PagoPublicoPage() {
  const { token } = useParams()
  const [alumno, setAlumno] = useState<{ nombre: string; apellido: string; categoria_nombre?: string } | null>(null)
  const [mensualidades, setMensualidades] = useState<Mensualidad[]>([])
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subiendoId, setSubiendoId] = useState<number | null>(null)
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({})

  const cargar = () => {
    api.get(`/public/alumno/${token}`).then(r => {
      setAlumno(r.data.alumno)
      setMensualidades(r.data.mensualidades)
      setDatosBancarios(r.data.datos_bancarios || {})
      setLoading(false)
    }).catch(err => {
      setError(err.response?.data?.error || 'No se pudo cargar la información')
      setLoading(false)
    })
  }
  useEffect(cargar, [token])

  const subirComprobante = async (mensualidadId: number, file: File) => {
    setSubiendoId(mensualidadId)
    const data = new FormData()
    data.append('archivo', file)
    try {
      await api.post(`/public/alumno/${token}/mensualidad/${mensualidadId}/comprobante`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success('Comprobante enviado, gracias')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al subir el comprobante')
    } finally {
      setSubiendoId(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>

  if (error || !alumno) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="card max-w-sm text-center">
          <p className="text-gray-700 font-medium">Este link no es válido.</p>
          <p className="text-gray-400 text-sm mt-1">Contacta a la academia para obtener tu link correcto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <img src="/logo-pasarin.jpg" alt="CIA PASARIN" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <p className="font-bold text-gray-900">CIA PASARIN</p>
            <p className="text-xs text-gray-400">Pago de mensualidad</p>
          </div>
        </div>

        <div className="card text-center">
          <p className="text-sm text-gray-400">Hola,</p>
          <h1 className="text-xl font-bold text-gray-900">{alumno.nombre} {alumno.apellido}</h1>
          {alumno.categoria_nombre && <p className="text-sm text-gray-500 mt-0.5">{alumno.categoria_nombre}</p>}
        </div>

        {mensualidades.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-gray-700 font-medium">Estás al día</p>
            <p className="text-gray-400 text-sm mt-1">No tienes mensualidades pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mensualidades.map(m => (
              <div key={m.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{MESES[m.periodo_mes - 1]} {m.periodo_anio}</p>
                    <p className="text-xs text-gray-400">Vence {fmt.fecha(m.fecha_vencimiento)}</p>
                  </div>
                  <span className={m.estado === 'vencido' ? 'badge-red' : 'badge-yellow'}>{m.estado}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-3">{fmt.clp(m.monto)}</p>

                {m.comprobante_url ? (
                  <p className="text-sm text-emerald-600 mt-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Comprobante enviado, en revisión
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputs.current[m.id]?.click()}
                      disabled={subiendoId === m.id}
                      className="btn-primary w-full mt-3 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {subiendoId === m.id ? 'Subiendo...' : 'Ya transferí — subir comprobante'}
                    </button>
                    <input
                      ref={el => { fileInputs.current[m.id] = el }}
                      type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(m.id, f); e.target.value = '' }}
                    />
                  </>
                )}
              </div>
            ))}

            {datosBancarios.numero_cuenta && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <h3>Datos para transferencia</h3>
                </div>
                <dl className="text-sm space-y-1.5 text-gray-700">
                  <div className="flex justify-between"><dt className="text-gray-400">Banco</dt><dd>{datosBancarios.banco}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-400">Tipo de cuenta</dt><dd>{datosBancarios.tipo_cuenta}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-400">N° de cuenta</dt><dd>{datosBancarios.numero_cuenta}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-400">RUT</dt><dd>{datosBancarios.rut}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-400">Nombre</dt><dd>{datosBancarios.nombre}</dd></div>
                </dl>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Cualquier duda, contacta directamente a la academia.</p>
      </div>
    </div>
  )
}
