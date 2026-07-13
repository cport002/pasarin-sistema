import { useEffect, useState } from 'react'
import api from '../services/api'
import type { Configuracion } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Settings } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function ConfiguracionPage() {
  const { puedeEditar } = useAuth()
  const [loading, setLoading] = useState(true)
  const [diaVencimiento, setDiaVencimiento] = useState('5')
  const [diasAviso, setDiasAviso] = useState('3')
  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [rut, setRut] = useState('')
  const [nombreCuenta, setNombreCuenta] = useState('')
  const [emailCuenta, setEmailCuenta] = useState('')

  if (!puedeEditar) return <Navigate to="/" replace />

  useEffect(() => {
    api.get<Configuracion>('/configuracion').then(r => {
      setDiaVencimiento(String(r.data.dia_vencimiento))
      setDiasAviso(String(r.data.dias_aviso_previo))
      const db = r.data.datos_bancarios || {}
      setBanco(db.banco || '')
      setTipoCuenta(db.tipo_cuenta || '')
      setNumeroCuenta(db.numero_cuenta || '')
      setRut(db.rut || '')
      setNombreCuenta(db.nombre || '')
      setEmailCuenta(db.email || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.put('/configuracion', {
        dia_vencimiento: diaVencimiento,
        dias_aviso_previo: diasAviso,
        datos_bancarios: { banco, tipo_cuenta: tipoCuenta, numero_cuenta: numeroCuenta, rut, nombre: nombreCuenta, email: emailCuenta }
      })
      toast.success('Configuración guardada')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Configuración" subtitle="Vencimientos, avisos y datos bancarios" icon={Settings} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h3>Vencimiento de mensualidades</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Día del mes en que vence</label>
              <input type="number" min={1} max={28} className="input" value={diaVencimiento}
                onChange={e => setDiaVencimiento(e.target.value)} />
            </div>
            <div>
              <label className="label">Días de anticipación para el aviso</label>
              <input type="number" min={0} max={28} className="input" value={diasAviso}
                onChange={e => setDiasAviso(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            El correo de aviso se envía {diasAviso} día(s) antes del día {diaVencimiento} de cada mes.
            Si ya venció, se marca como vencida y se envía un aviso adicional.
          </p>
        </div>

        <div className="card space-y-4">
          <h3>Datos bancarios para transferencia</h3>
          <p className="text-xs text-gray-400">Se incluyen en los correos de aviso para que los alumnos puedan transferir directamente.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Banco</label>
              <input className="input" value={banco} onChange={e => setBanco(e.target.value)} placeholder="Banco de Chile" />
            </div>
            <div>
              <label className="label">Tipo de cuenta</label>
              <input className="input" value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)} placeholder="Cuenta Corriente" />
            </div>
            <div>
              <label className="label">N° de cuenta</label>
              <input className="input" value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)} />
            </div>
            <div>
              <label className="label">RUT</label>
              <input className="input" value={rut} onChange={e => setRut(e.target.value)} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="label">Nombre titular</label>
              <input className="input" value={nombreCuenta} onChange={e => setNombreCuenta(e.target.value)} />
            </div>
            <div>
              <label className="label">Email para comprobantes</label>
              <input type="email" className="input" value={emailCuenta} onChange={e => setEmailCuenta(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary">Guardar configuración</button>
        </div>
      </form>
    </div>
  )
}
