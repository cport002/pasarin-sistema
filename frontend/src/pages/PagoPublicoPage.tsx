import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api, { fmt, MESES, archivoUrl } from '../services/api'
import toast from 'react-hot-toast'
import { Upload, CheckCircle2, Clock, AlertTriangle, Building2, CreditCard, X } from 'lucide-react'

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

type EstadoMes = 'pagado' | 'en_revision' | 'activo_actual' | 'activo_vencido' | 'bloqueado'

const estiloMes: Record<EstadoMes, string> = {
  pagado: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200',
  en_revision: 'bg-blue-500/10 text-blue-600 border border-blue-200',
  activo_actual: 'bg-purple-600 text-white border border-purple-600 shadow-sm cursor-pointer hover:bg-purple-700',
  activo_vencido: 'bg-red-500/10 text-red-600 border border-red-200 cursor-pointer hover:bg-red-500/20',
  bloqueado: 'bg-gray-100 text-gray-300 border border-gray-100'
}

export default function PagoPublicoPage() {
  const { token } = useParams()
  const [alumno, setAlumno] = useState<{ nombre: string; apellido: string; categoria_nombre?: string; foto_url?: string | null } | null>(null)
  const [mensualidades, setMensualidades] = useState<Mensualidad[]>([])
  const [mesActual, setMesActual] = useState(new Date().getMonth() + 1)
  const [anioActual, setAnioActual] = useState(new Date().getFullYear())
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subiendoId, setSubiendoId] = useState<number | null>(null)
  const [mesSeleccionado, setMesSeleccionado] = useState<Mensualidad | null>(null)
  const [pagandoKhipu, setPagandoKhipu] = useState(false)
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({})

  const cargar = () => {
    api.get(`/public/alumno/${token}`).then(r => {
      setAlumno(r.data.alumno)
      setMensualidades(r.data.mensualidades)
      setMesActual(r.data.mes_actual)
      setAnioActual(r.data.anio_actual)
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

  const pagarConKhipu = async () => {
    if (!mesSeleccionado) return
    setPagandoKhipu(true)
    try {
      const r = await api.post(`/public/alumno/${token}/mensualidad/${mesSeleccionado.id}/pagar-khipu`)
      window.location.href = r.data.payment_url
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo iniciar el pago con Khipu')
      setPagandoKhipu(false)
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

  const porMes = new Map(mensualidades.map(m => [m.periodo_mes, m]))
  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const row = porMes.get(mes)
    let estado: EstadoMes = 'bloqueado'
    if (row) {
      if (row.estado === 'pagado') estado = 'pagado'
      else if (row.estado === 'en_revision') estado = 'en_revision'
      else if ((row.estado === 'pendiente' || row.estado === 'vencido') && mes <= mesActual) {
        estado = mes === mesActual ? 'activo_actual' : 'activo_vencido'
      }
    }
    return { mes, row, estado }
  })

  const activos = meses.filter(m => m.estado === 'activo_actual' || m.estado === 'activo_vencido')
  const totalAdeudado = activos.reduce((s, m) => s + (m.row?.monto || 0), 0)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 justify-center">
          {alumno.foto_url ? (
            <img src={alumno.foto_url} alt={`${alumno.nombre} ${alumno.apellido}`} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <img src="/logo-pasarin.jpg" alt="CIA PASARIN" className="w-10 h-10 rounded-xl object-cover" />
          )}
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

        {activos.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-gray-700 font-medium">Estás al día</p>
            <p className="text-gray-400 text-sm mt-1">No tienes mensualidades pendientes.</p>
          </div>
        ) : (
          <div className="card text-center py-5 bg-amber-50 border-amber-200">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-600" />
            <p className="text-gray-800 font-semibold">{activos.length} mes{activos.length > 1 ? 'es' : ''} pendiente{activos.length > 1 ? 's' : ''}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fmt.clp(totalAdeudado)}</p>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3>Año {anioActual}</h3>
            <p className="text-xs text-gray-400">Toca un mes para pagar o ver tu comprobante</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {meses.map(({ mes, row, estado }) => {
              const clickable = estado === 'activo_actual' || estado === 'activo_vencido'
              const verable = (estado === 'pagado' || estado === 'en_revision') && !!row?.comprobante_url
              const subiendo = row && subiendoId === row.id
              const claseChip = `w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${estiloMes[estado]} ${verable ? 'cursor-pointer hover:brightness-95' : ''} ${!clickable && !verable ? 'cursor-default' : ''}`
              const contenido = (
                <>
                  <span>{MESES[mes - 1].slice(0, 3)}</span>
                  {estado === 'pagado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {estado === 'en_revision' && <Clock className="w-3.5 h-3.5" />}
                  {estado === 'activo_actual' && (subiendo ? <span className="text-[10px]">...</span> : <Upload className="w-3.5 h-3.5" />)}
                  {estado === 'activo_vencido' && (subiendo ? <span className="text-[10px]">...</span> : <AlertTriangle className="w-3.5 h-3.5" />)}
                </>
              )
              return (
                <div key={mes}>
                  {verable && row ? (
                    <a href={archivoUrl(row.comprobante_url)} target="_blank" rel="noreferrer" title="Ver comprobante" className={claseChip}>
                      {contenido}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={!clickable || subiendo}
                      onClick={() => clickable && row && setMesSeleccionado(row)}
                      className={claseChip}
                    >
                      {contenido}
                    </button>
                  )}
                  {row && clickable && (
                    <input
                      ref={el => { fileInputs.current[row.id] = el }}
                      type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(row.id, f); e.target.value = '' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Pagado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> En revisión</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Mes actual</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Vencido</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Comprobante: máximo 5MB, imagen o PDF.</p>
        </div>

        {datosBancarios.numero_cuenta && activos.length > 0 && (
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

        <p className="text-center text-xs text-gray-400">Cualquier duda, contacta directamente a la academia.</p>
      </div>

      {mesSeleccionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setMesSeleccionado(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="mb-1">{MESES[mesSeleccionado.periodo_mes - 1]} {mesSeleccionado.periodo_anio}</h2>
            <p className="text-2xl font-bold text-gray-900 mb-5">{fmt.clp(mesSeleccionado.monto)}</p>

            <button
              onClick={pagarConKhipu}
              disabled={pagandoKhipu}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {pagandoKhipu ? 'Redirigiendo...' : 'Pagar con tarjeta o transferencia (Khipu)'}
            </button>

            <div className="flex items-center gap-2 my-4">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400">o</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <button
              onClick={() => { const id = mesSeleccionado.id; setMesSeleccionado(null); fileInputs.current[id]?.click() }}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Ya transferí — subir comprobante
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
