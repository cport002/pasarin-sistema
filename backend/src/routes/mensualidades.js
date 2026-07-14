const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');
const { generarMensualidadesPeriodo, actualizarVencidas } = require('../services/mensualidades');
const { ejecutarJobDiario } = require('../services/alertas');
const { enviarCorreo, plantillaComprobanteRecibido } = require('../services/email');
const { upload } = require('../services/upload');

const router = express.Router();

// GET /api/mensualidades?mes=&anio=&estado=&categoria_id=
router.get('/', autenticar, async (req, res) => {
  try {
    const { mes, anio, estado, categoria_id } = req.query;
    let query = `
      SELECT m.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.email AS alumno_email,
             a.categoria_id, c.nombre AS categoria_nombre
      FROM mensualidades m
      JOIN alumnos a ON a.id = m.alumno_id
      LEFT JOIN categorias c ON c.id = a.categoria_id
      WHERE 1=1
    `;
    const params = [];
    if (mes) { query += ' AND m.periodo_mes = ?'; params.push(mes); }
    if (anio) { query += ' AND m.periodo_anio = ?'; params.push(anio); }
    if (estado) { query += ' AND m.estado = ?'; params.push(estado); }
    if (categoria_id) { query += ' AND a.categoria_id = ?'; params.push(categoria_id); }
    query += ' ORDER BY m.fecha_vencimiento, a.apellido';
    const r = await sql(query, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mensualidades/resumen?mes=&anio=
router.get('/resumen', autenticar, async (req, res) => {
  try {
    const hoy = new Date();
    const mes = parseInt(req.query.mes) || hoy.getMonth() + 1;
    const anio = parseInt(req.query.anio) || hoy.getFullYear();

    const totales = (await sql(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END) AS pagadas,
        SUM(CASE WHEN estado = 'vencido' THEN 1 ELSE 0 END) AS vencidas,
        SUM(CASE WHEN estado IN ('pendiente','vencido') THEN monto ELSE 0 END) AS monto_por_cobrar,
        SUM(CASE WHEN estado = 'pagado' THEN monto ELSE 0 END) AS monto_cobrado
      FROM mensualidades WHERE periodo_mes = ? AND periodo_anio = ?
    `, [mes, anio])).rows[0];

    const alumnos = (await sql(`
      SELECT COUNT(*) AS total_activos, SUM(CASE WHEN es_becado = 1 THEN 1 ELSE 0 END) AS becados
      FROM alumnos WHERE estado = 'activo'
    `)).rows[0];

    res.json({ mes, anio, ...totales, ...alumnos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mensualidades/alumno/:alumnoId
router.get('/alumno/:alumnoId', autenticar, async (req, res) => {
  try {
    const r = await sql(
      'SELECT * FROM mensualidades WHERE alumno_id = ? ORDER BY periodo_anio DESC, periodo_mes DESC',
      [req.params.alumnoId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mensualidades/generar-mes  { mes, anio }
router.post('/generar-mes', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const hoy = new Date();
    const mes = parseInt(req.body.mes) || hoy.getMonth() + 1;
    const anio = parseInt(req.body.anio) || hoy.getFullYear();
    const resultado = await generarMensualidadesPeriodo(mes, anio);
    await actualizarVencidas();
    registrarAuditoria('mensualidades', null, 'INSERT', null, { mes, anio, ...resultado }, req.usuario.id, req.ip, 'Generación manual de mensualidades');
    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mensualidades/enviar-alertas — dispara el job de alertas manualmente (pruebas)
router.post('/enviar-alertas', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const resultado = await ejecutarJobDiario();
    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mensualidades/test-email — envia un correo de prueba, sin tocar alumnos ni mensualidades
router.post('/test-email', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Falta el destinatario (to)' });
    const resultado = await enviarCorreo({
      to,
      subject: 'Correo de prueba — CIA PASARIN',
      html: '<p>Este es un correo de prueba del sistema de control de mensualidades de CIA PASARIN. Si lo recibiste, Resend esta funcionando correctamente.</p>'
    });
    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mensualidades/:id/pagar  { metodo_pago, fecha_pago, notas }
router.patch('/:id/pagar', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const anterior = (await sql('SELECT * FROM mensualidades WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Mensualidad no encontrada' });

    const { metodo_pago, fecha_pago, notas } = req.body;
    await sql(
      `UPDATE mensualidades SET estado = 'pagado', metodo_pago = ?, fecha_pago = COALESCE(?, CURRENT_DATE), notas = ?, updated_at = NOW() WHERE id = ?`,
      [metodo_pago || 'transferencia', fecha_pago || null, notas ?? anterior.notas, req.params.id]
    );
    registrarAuditoria('mensualidades', req.params.id, 'UPDATE', anterior, { estado: 'pagado', metodo_pago }, req.usuario.id, req.ip, 'Mensualidad marcada como pagada');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mensualidades/:id/anular
router.patch('/:id/anular', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    await sql("UPDATE mensualidades SET estado = 'anulado', updated_at = NOW() WHERE id = ?", [req.params.id]);
    registrarAuditoria('mensualidades', req.params.id, 'UPDATE', null, { estado: 'anulado' }, req.usuario.id, req.ip, 'Mensualidad anulada');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mensualidades/:id/comprobante — sube comprobante de transferencia
router.post('/:id/comprobante', autenticar, autorizar('admin', 'secretaria'), upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const m = (await sql(`
      SELECT m.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.email AS alumno_email
      FROM mensualidades m JOIN alumnos a ON a.id = m.alumno_id WHERE m.id = ?
    `, [req.params.id])).rows[0];
    if (!m) return res.status(404).json({ error: 'Mensualidad no encontrada' });

    const url = req.file.path;
    await sql(
      `UPDATE mensualidades SET comprobante_url = ?, updated_at = NOW(),
        estado = CASE WHEN estado IN ('pendiente','vencido') THEN 'en_revision' ELSE estado END
       WHERE id = ?`,
      [url, req.params.id]
    );
    registrarAuditoria('mensualidades', req.params.id, 'UPDATE', null, { comprobante_url: url, estado: 'en_revision' }, req.usuario.id, req.ip, 'Comprobante subido');

    if (m.alumno_email) {
      const { subject, html } = plantillaComprobanteRecibido({
        alumnoNombre: `${m.alumno_nombre} ${m.alumno_apellido}`, mes: m.periodo_mes, anio: m.periodo_anio
      });
      enviarCorreo({ to: m.alumno_email, subject, html }).catch(() => {});
    }
    res.json({ ok: true, comprobante_url: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
