const { sql } = require('../database/db');
const { registrarAuditoria } = require('../middleware/auth');
const { enviarCorreo, plantillaPagoConfirmado } = require('./email');

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

// Marca una mensualidad como pagada, registra auditoria y envia el correo de confirmacion.
// Usado tanto por el endpoint manual (admin/secretaria) como por la confirmacion automatica de Khipu.
async function confirmarPago(id, { metodoPago = 'transferencia', fechaPago = null, notas, usuarioId = null, ip = null, descripcion = 'Mensualidad marcada como pagada' } = {}) {
  const anterior = (await sql(`
    SELECT m.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.email AS alumno_email
    FROM mensualidades m JOIN alumnos a ON a.id = m.alumno_id WHERE m.id = ?
  `, [id])).rows[0];
  if (!anterior) throw new Error('Mensualidad no encontrada');

  await sql(
    `UPDATE mensualidades SET estado = 'pagado', metodo_pago = ?, fecha_pago = COALESCE(?, CURRENT_DATE), notas = ?, updated_at = NOW() WHERE id = ?`,
    [metodoPago, fechaPago, notas ?? anterior.notas, id]
  );
  registrarAuditoria('mensualidades', id, 'UPDATE', anterior, { estado: 'pagado', metodo_pago: metodoPago }, usuarioId, ip, descripcion);

  if (anterior.alumno_email) {
    const { subject, html } = plantillaPagoConfirmado({
      alumnoNombre: `${anterior.alumno_nombre} ${anterior.alumno_apellido}`, mes: anterior.periodo_mes, anio: anterior.periodo_anio, monto: anterior.monto
    });
    enviarCorreo({ to: anterior.alumno_email, subject, html }).catch(() => {});
  }
  return anterior;
}

module.exports = { obtenerConfig, calcularMontoEfectivo, fechaVencimientoISO, generarMensualidadesPeriodo, actualizarVencidas, confirmarPago };
