const express = require('express');
const { sql } = require('../database/db');
const { registrarAuditoria } = require('../middleware/auth');
const { enviarCorreo, plantillaComprobanteRecibido } = require('../services/email');
const { upload } = require('../services/upload');
const { confirmarPago } = require('../services/mensualidades');
const khipu = require('../services/khipu');

const router = express.Router();

function esPagable(m) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const noEsFuturo = m.periodo_anio < anioActual || (m.periodo_anio === anioActual && m.periodo_mes <= mesActual);
  return noEsFuturo && (m.estado === 'pendiente' || m.estado === 'vencido');
}

// GET /api/public/alumno/:token — info del alumno + mensualidades del año en curso + datos bancarios
router.get('/alumno/:token', async (req, res) => {
  try {
    const alumno = (await sql(
      `SELECT a.id, a.nombre, a.apellido, a.foto_url, c.nombre AS categoria_nombre
       FROM alumnos a LEFT JOIN categorias c ON c.id = a.categoria_id
       WHERE a.token = ?`,
      [req.params.token]
    )).rows[0];
    if (!alumno) return res.status(404).json({ error: 'Link no válido' });

    const hoy = new Date();
    const anio_actual = hoy.getFullYear();
    const mes_actual = hoy.getMonth() + 1;

    const mensualidades = (await sql(
      `SELECT id, periodo_mes, periodo_anio, monto, estado, fecha_vencimiento, comprobante_url
       FROM mensualidades WHERE alumno_id = ? AND periodo_anio = ?
       ORDER BY periodo_mes`,
      [alumno.id, anio_actual]
    )).rows;

    const configRows = (await sql("SELECT valor FROM configuracion WHERE clave = 'datos_bancarios'")).rows;
    const datos_bancarios = JSON.parse(configRows[0]?.valor || '{}');

    res.json({ alumno, mensualidades, anio_actual, mes_actual, datos_bancarios });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/public/alumno/:token/mensualidad/:mensualidadId/comprobante
router.post('/alumno/:token/mensualidad/:mensualidadId/comprobante', upload.single('archivo'), async (req, res) => {
  try {
    const alumno = (await sql('SELECT id, nombre, apellido, email FROM alumnos WHERE token = ?', [req.params.token])).rows[0];
    if (!alumno) return res.status(404).json({ error: 'Link no válido' });

    const m = (await sql('SELECT * FROM mensualidades WHERE id = ? AND alumno_id = ?', [req.params.mensualidadId, alumno.id])).rows[0];
    if (!m) return res.status(404).json({ error: 'Mensualidad no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const url = req.file.path;
    await sql(
      `UPDATE mensualidades SET comprobante_url = ?, updated_at = NOW(),
        estado = CASE WHEN estado IN ('pendiente','vencido') THEN 'en_revision' ELSE estado END
       WHERE id = ?`,
      [url, m.id]
    );
    registrarAuditoria('mensualidades', m.id, 'UPDATE', null, { comprobante_url: url, estado: 'en_revision' }, null, req.ip, `Comprobante subido por el propio alumno/apoderado (${alumno.nombre} ${alumno.apellido})`);

    if (alumno.email) {
      const { subject, html } = plantillaComprobanteRecibido({
        alumnoNombre: `${alumno.nombre} ${alumno.apellido}`, mes: m.periodo_mes, anio: m.periodo_anio
      });
      enviarCorreo({ to: alumno.email, subject, html }).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/public/alumno/:token/mensualidad/:mensualidadId/pagar-khipu — crea el cobro y devuelve la URL de pago
router.post('/alumno/:token/mensualidad/:mensualidadId/pagar-khipu', async (req, res) => {
  try {
    const alumno = (await sql('SELECT id, nombre, apellido FROM alumnos WHERE token = ?', [req.params.token])).rows[0];
    if (!alumno) return res.status(404).json({ error: 'Link no válido' });

    const m = (await sql('SELECT * FROM mensualidades WHERE id = ? AND alumno_id = ?', [req.params.mensualidadId, alumno.id])).rows[0];
    if (!m) return res.status(404).json({ error: 'Mensualidad no encontrada' });
    if (!esPagable(m)) return res.status(400).json({ error: 'Esta mensualidad no está disponible para pago' });

    const backendUrl = process.env.BACKEND_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    if (!backendUrl || !frontendUrl) return res.status(500).json({ error: 'Pago con Khipu no está configurado' });

    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const { paymentId, paymentUrl } = await khipu.crearPago({
      subject: `Mensualidad ${meses[m.periodo_mes - 1]} ${m.periodo_anio} — ${alumno.nombre} ${alumno.apellido}`,
      amount: Number(m.monto),
      transactionId: `mensualidad-${m.id}`,
      returnUrl: `${frontendUrl}/pago/${req.params.token}`,
      cancelUrl: `${frontendUrl}/pago/${req.params.token}`,
      notifyUrl: `${backendUrl}/api/public/khipu/notificacion`
    });

    await sql('UPDATE mensualidades SET khipu_payment_id = ?, updated_at = NOW() WHERE id = ?', [paymentId, m.id]);
    res.json({ payment_url: paymentUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/public/khipu/notificacion — webhook de Khipu. Nunca confiamos en el body directamente:
// se vuelve a consultar el pago con nuestra api-key antes de marcar como pagado.
router.post('/khipu/notificacion', async (req, res) => {
  try {
    const paymentId = req.body?.payment_id || req.query?.payment_id;
    if (!paymentId) return res.status(200).send('ok');

    const pago = await khipu.obtenerPago(paymentId);
    if (pago.status !== 'done') return res.status(200).send('ok');

    const m = (await sql('SELECT id, estado FROM mensualidades WHERE khipu_payment_id = ?', [paymentId])).rows[0];
    if (!m) return res.status(200).send('ok');
    if (m.estado === 'pagado') return res.status(200).send('ok'); // ya procesado, evita duplicar

    await confirmarPago(m.id, { metodoPago: 'khipu', descripcion: 'Pago confirmado automáticamente vía Khipu' });
    res.status(200).send('ok');
  } catch (e) {
    console.error('Error procesando notificación de Khipu:', e.message);
    res.status(200).send('ok'); // igual respondemos 200 para que Khipu no reintente indefinidamente
  }
});

module.exports = router;
