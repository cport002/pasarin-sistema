const cron = require('node-cron');
const { sql } = require('../database/db');
const { obtenerConfig, generarMensualidadesPeriodo, actualizarVencidas } = require('./mensualidades');
const { enviarCorreo, plantillaAvisoPrevio, plantillaVencido } = require('./email');

function linkPago(token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5180';
  return token ? `${base}/pago/${token}` : null;
}

async function yaSeEnvioAlerta(mensualidadId, tipo) {
  const r = await sql('SELECT id FROM alertas_enviadas WHERE mensualidad_id = ? AND tipo = ?', [mensualidadId, tipo]);
  return r.rows.length > 0;
}

async function registrarAlertaEnviada(mensualidadId, tipo, email) {
  await sql(
    'INSERT INTO alertas_enviadas (mensualidad_id, tipo, email_destino) VALUES (?, ?, ?) ON CONFLICT(mensualidad_id, tipo) DO NOTHING',
    [mensualidadId, tipo, email]
  );
}

async function enviarAvisosPrevios(diasAviso, datosBancarios) {
  const objetivo = new Date();
  objetivo.setDate(objetivo.getDate() + diasAviso);
  const fechaObjetivo = objetivo.toISOString().slice(0, 10);

  const pendientes = (await sql(`
    SELECT m.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.email AS alumno_email, a.token AS alumno_token
    FROM mensualidades m JOIN alumnos a ON a.id = m.alumno_id
    WHERE m.estado = 'pendiente' AND m.fecha_vencimiento = ?
  `, [fechaObjetivo])).rows;

  let enviados = 0;
  for (const m of pendientes) {
    if (await yaSeEnvioAlerta(m.id, 'aviso_previo')) continue;
    const { subject, html } = plantillaAvisoPrevio({
      alumnoNombre: `${m.alumno_nombre} ${m.alumno_apellido}`,
      mes: m.periodo_mes, anio: m.periodo_anio, monto: m.monto,
      fechaVencimiento: m.fecha_vencimiento, datosBancarios,
      link: linkPago(m.alumno_token)
    });
    await enviarCorreo({ to: m.alumno_email, subject, html });
    await registrarAlertaEnviada(m.id, 'aviso_previo', m.alumno_email);
    enviados++;
  }
  return enviados;
}

async function enviarAvisosVencidos(datosBancarios) {
  const vencidas = (await sql(`
    SELECT m.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.email AS alumno_email, a.token AS alumno_token
    FROM mensualidades m JOIN alumnos a ON a.id = m.alumno_id
    WHERE m.estado = 'vencido'
  `)).rows;

  let enviados = 0;
  for (const m of vencidas) {
    if (await yaSeEnvioAlerta(m.id, 'vencido')) continue;
    const { subject, html } = plantillaVencido({
      alumnoNombre: `${m.alumno_nombre} ${m.alumno_apellido}`,
      mes: m.periodo_mes, anio: m.periodo_anio, monto: m.monto, datosBancarios,
      link: linkPago(m.alumno_token)
    });
    await enviarCorreo({ to: m.alumno_email, subject, html });
    await registrarAlertaEnviada(m.id, 'vencido', m.alumno_email);
    enviados++;
  }
  return enviados;
}

async function ejecutarJobDiario() {
  const config = await obtenerConfig();
  const hoy = new Date();
  const resultado = { generadas: 0, marcadas_vencidas: 0, avisos_previos: 0, avisos_vencidos: 0 };

  try {
    const gen = await generarMensualidadesPeriodo(hoy.getMonth() + 1, hoy.getFullYear());
    resultado.generadas = gen.generadas;

    const vencidas = await actualizarVencidas();
    resultado.marcadas_vencidas = vencidas.length;

    resultado.avisos_previos = await enviarAvisosPrevios(config.dias_aviso_previo, config.datos_bancarios);
    resultado.avisos_vencidos = await enviarAvisosVencidos(config.datos_bancarios);

    console.log('[alertas] Job diario ejecutado:', resultado);
  } catch (e) {
    console.error('[alertas] Error en job diario:', e.message);
  }
  return resultado;
}

function iniciarJobAlertas() {
  cron.schedule('0 8 * * *', ejecutarJobDiario, { timezone: 'America/Santiago' });
  console.log('[alertas] Job diario programado (08:00 America/Santiago)');
}

module.exports = { iniciarJobAlertas, ejecutarJobDiario };
