const express = require('express');
const { sql } = require('../database/db');
const { registrarAuditoria } = require('../middleware/auth');
const { enviarCorreo, plantillaComprobanteRecibido } = require('../services/email');
const { upload } = require('../services/upload');

const router = express.Router();

// GET /api/public/alumno/:token — info del alumno + sus mensualidades pendientes/vencidas + datos bancarios
router.get('/alumno/:token', async (req, res) => {
  try {
    const alumno = (await sql(
      `SELECT a.id, a.nombre, a.apellido, c.nombre AS categoria_nombre
       FROM alumnos a LEFT JOIN categorias c ON c.id = a.categoria_id
       WHERE a.token = ?`,
      [req.params.token]
    )).rows[0];
    if (!alumno) return res.status(404).json({ error: 'Link no válido' });

    const mensualidades = (await sql(
      `SELECT id, periodo_mes, periodo_anio, monto, estado, fecha_vencimiento, comprobante_url
       FROM mensualidades WHERE alumno_id = ? AND estado IN ('pendiente','vencido','en_revision')
       ORDER BY periodo_anio, periodo_mes`,
      [alumno.id]
    )).rows;

    const configRows = (await sql("SELECT valor FROM configuracion WHERE clave = 'datos_bancarios'")).rows;
    const datos_bancarios = JSON.parse(configRows[0]?.valor || '{}');

    res.json({ alumno, mensualidades, datos_bancarios });
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

module.exports = router;
