CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('admin','secretaria','visor')),
  activo INTEGER NOT NULL DEFAULT 1,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  monto_mensualidad NUMERIC NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  activa INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alumnos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  fecha_nacimiento DATE,
  fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria_id INTEGER REFERENCES categorias(id),
  monto_personalizado NUMERIC,
  es_becado INTEGER NOT NULL DEFAULT 0,
  porcentaje_beca NUMERIC NOT NULL DEFAULT 0 CHECK(porcentaje_beca >= 0 AND porcentaje_beca <= 100),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','inactivo')),
  notas TEXT,
  token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracion (
  id SERIAL PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensualidades (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  periodo_mes INTEGER NOT NULL CHECK(periodo_mes BETWEEN 1 AND 12),
  periodo_anio INTEGER NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','vencido','anulado')),
  metodo_pago TEXT CHECK(metodo_pago IN ('transferencia','efectivo')),
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  comprobante_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(alumno_id, periodo_mes, periodo_anio)
);

CREATE TABLE IF NOT EXISTS alertas_enviadas (
  id SERIAL PRIMARY KEY,
  mensualidad_id INTEGER NOT NULL REFERENCES mensualidades(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('aviso_previo','vencido')),
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_destino TEXT,
  UNIQUE(mensualidad_id, tipo)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id INTEGER,
  accion TEXT NOT NULL,
  datos_anteriores TEXT,
  datos_nuevos TEXT,
  descripcion TEXT,
  usuario_id INTEGER,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alumnos_categoria ON alumnos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_token ON alumnos(token);
CREATE INDEX IF NOT EXISTS idx_mensualidades_alumno ON mensualidades(alumno_id);
CREATE INDEX IF NOT EXISTS idx_mensualidades_periodo ON mensualidades(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_mensualidades_estado ON mensualidades(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_mensualidad ON alertas_enviadas(mensualidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla, registro_id);
