export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'secretaria' | 'visor'
  activo?: number
  ultimo_acceso?: string
  created_at?: string
}

export interface Categoria {
  id: number
  nombre: string
  monto_mensualidad: number
  orden: number
  activa: number
  total_alumnos?: number
  created_at?: string
  updated_at?: string
}

export interface Alumno {
  id: number
  nombre: string
  apellido: string
  email?: string
  telefono?: string
  fecha_nacimiento?: string
  fecha_inscripcion?: string
  categoria_id?: number
  categoria_nombre?: string
  categoria_monto?: number
  monto_personalizado?: number | null
  foto_url?: string | null
  es_becado: number | boolean
  porcentaje_beca: number
  estado: 'activo' | 'inactivo'
  notas?: string
  token?: string
  created_at?: string
  updated_at?: string
}

export interface Mensualidad {
  id: number
  alumno_id: number
  alumno_nombre?: string
  alumno_apellido?: string
  alumno_email?: string
  categoria_nombre?: string
  periodo_mes: number
  periodo_anio: number
  monto: number
  estado: 'pendiente' | 'pagado' | 'vencido' | 'anulado' | 'en_revision'
  metodo_pago?: 'transferencia' | 'efectivo' | null
  fecha_vencimiento: string
  fecha_pago?: string | null
  comprobante_url?: string | null
  notas?: string
  created_at?: string
  updated_at?: string
}

export interface ResumenMensual {
  mes: number
  anio: number
  total: number
  pendientes: number
  en_revision: number
  pagadas: number
  vencidas: number
  monto_por_cobrar: number
  monto_cobrado: number
  total_activos: number
  becados: number
}

export interface DatosBancarios {
  banco?: string
  tipo_cuenta?: string
  numero_cuenta?: string
  rut?: string
  nombre?: string
  email?: string
}

export interface Configuracion {
  dia_vencimiento: string
  dias_aviso_previo: string
  datos_bancarios: DatosBancarios
}

export interface AuthState {
  usuario: Usuario | null
  token: string | null
}
