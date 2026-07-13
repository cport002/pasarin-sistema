const { sql } = require('../database/db');

async function obtenerConfig() {
  const r = await sql('SELECT clave, valor FROM configuracion');
  const obj = {};
  for (const row of r.rows) obj[row.clave] = row.valor;
  return {
    dia_vencimiento: parseInt(obj.dia_vencimiento || '5', 10),
    dias_aviso_previo: parseInt(obj.dias_aviso_previo || '3', 10),
    datos_bancarios: JSON.parse(obj.datos_bancarios || '{}')
  };
}

function calcularMontoEfectivo(alumno) {
  const base = alumno.monto_personalizado !== null && alumno.monto_personalizado !== undefined
    ? alumno.monto_personalizado
    : (alumno.categoria_monto || 0);
  const descuento = alumno.es_becado ? (alumno.porcentaje_beca || 0) : 0;
  return Math.round(base * (1 - descuento / 100));
}

function fechaVencimientoISO(anio, mes, diaVencimiento) {
  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  const dia = Math.min(diaVencimiento, ultimoDiaMes);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Genera las mensualidades faltantes de un período para todos los alumnos activos.
async function generarMensualidadesPeriodo(mes, anio) {
  const config = await obtenerConfig();
  const alumnos = (await sql(`
    SELECT a.*, c.monto_mensualidad AS categoria_monto
    FROM alumnos a LEFT JOIN categorias c ON c.id = a.categoria_id
    WHERE a.estado = 'activo'
  `)).rows;

  let generadas = 0;
  for (const alumno of alumnos) {
    const existe = await sql(
      'SELECT id FROM mensualidades WHERE alumno_id = ? AND periodo_mes = ? AND periodo_anio = ?',
      [alumno.id, mes, anio]
    );
    if (existe.rows.length) continue;

    const monto = calcularMontoEfectivo(alumno);
    const fechaVencimiento = fechaVencimientoISO(anio, mes, config.dia_vencimiento);
    await sql(
      `INSERT INTO mensualidades (alumno_id, periodo_mes, periodo_anio, monto, fecha_vencimiento)
       VALUES (?, ?, ?, ?, ?)`,
      [alumno.id, mes, anio, monto, fechaVencimiento]
    );
    generadas++;
  }
  return { generadas, total_alumnos: alumnos.length };
}

// Marca como 'vencido' las mensualidades pendientes cuya fecha ya pasó.
async function actualizarVencidas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const r = await sql(
    "UPDATE mensualidades SET estado = 'vencido', updated_at = NOW() WHERE estado = 'pendiente' AND fecha_vencimiento < ? RETURNING id",
    [hoy]
  );
  return r.rows.map(row => row.id);
}

module.exports = { obtenerConfig, calcularMontoEfectivo, fechaVencimientoISO, generarMensualidadesPeriodo, actualizarVencidas };
