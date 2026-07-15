const express = require('express');
const crypto = require('crypto');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');
const { uploadFoto } = require('../services/upload');

const router = express.Router();

// GET /api/alumnos?categoria_id=&estado=&busqueda=
router.get('/', autenticar, async (req, res) => {
  try {
    const { categoria_id, estado, busqueda } = req.query;
    let query = `
      SELECT a.*, c.nombre AS categoria_nombre, c.monto_mensualidad AS categoria_monto
      FROM alumnos a
      LEFT JOIN categorias c ON c.id = a.categoria_id
      WHERE 1=1
    `;
    const params = [];
    if (categoria_id) { query += ' AND a.categoria_id = ?'; params.push(categoria_id); }
    if (estado) { query += ' AND a.estado = ?'; params.push(estado); }
    if (busqueda) {
      query += ' AND (a.nombre ILIKE ? OR a.apellido ILIKE ? OR a.email ILIKE ?)';
      const like = `%${busqueda}%`;
      params.push(like, like, like);
    }
    query += ' ORDER BY a.apellido, a.nombre';
    const r = await sql(query, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alumnos/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const r = await sql(`
      SELECT a.*, c.nombre AS categoria_nombre, c.monto_mensualidad AS categoria_monto
      FROM alumnos a
      LEFT JOIN categorias c ON c.id = a.categoria_id
      WHERE a.id = ?
    `, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alumnos
router.post('/', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const {
      nombre, apellido, email, telefono, fecha_nacimiento, fecha_inscripcion,
      categoria_id, monto_personalizado, es_becado, porcentaje_beca, notas
    } = req.body;
    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son requeridos' });

    const token = crypto.randomBytes(24).toString('hex');
    const r = await sql(
      `INSERT INTO alumnos
       (nombre, apellido, email, telefono, fecha_nacimiento, fecha_inscripcion, categoria_id, monto_personalizado, es_becado, porcentaje_beca, notas, token)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_DATE), ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        nombre.trim(), apellido.trim(), email || null, telefono || null,
        fecha_nacimiento || null, fecha_inscripcion || null,
        categoria_id || null, monto_personalizado || null,
        es_becado ? 1 : 0, porcentaje_beca || 0, notas || null, token
      ]
    );
    const id = r.rows[0].id;
    registrarAuditoria('alumnos', id, 'INSERT', null, req.body, req.usuario.id, req.ip, 'Alumno registrado');
    res.status(201).json({ id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/alumnos/:id
router.put('/:id', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const anterior = (await sql('SELECT * FROM alumnos WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Alumno no encontrado' });

    const {
      nombre, apellido, email, telefono, fecha_nacimiento, fecha_inscripcion,
      categoria_id, monto_personalizado, es_becado, porcentaje_beca, estado, notas
    } = req.body;

    await sql(
      `UPDATE alumnos SET
        nombre = ?, apellido = ?, email = ?, telefono = ?, fecha_nacimiento = ?, fecha_inscripcion = ?,
        categoria_id = ?, monto_personalizado = ?, es_becado = ?, porcentaje_beca = ?, estado = ?, notas = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        nombre ?? anterior.nombre, apellido ?? anterior.apellido, email ?? anterior.email,
        telefono ?? anterior.telefono, fecha_nacimiento ?? anterior.fecha_nacimiento,
        fecha_inscripcion ?? anterior.fecha_inscripcion,
        categoria_id ?? anterior.categoria_id,
        monto_personalizado !== undefined ? monto_personalizado : anterior.monto_personalizado,
        es_becado !== undefined ? (es_becado ? 1 : 0) : anterior.es_becado,
        porcentaje_beca !== undefined ? porcentaje_beca : anterior.porcentaje_beca,
        estado ?? anterior.estado, notas ?? anterior.notas,
        req.params.id
      ]
    );
    registrarAuditoria('alumnos', req.params.id, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Alumno actualizado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alumnos/:id/foto — sube/reemplaza la foto de perfil
router.post('/:id/foto', autenticar, autorizar('admin', 'secretaria'), uploadFoto.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const anterior = (await sql('SELECT id FROM alumnos WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Alumno no encontrado' });

    const url = req.file.path;
    await sql('UPDATE alumnos SET foto_url = ?, updated_at = NOW() WHERE id = ?', [url, req.params.id]);
    registrarAuditoria('alumnos', req.params.id, 'UPDATE', null, { foto_url: url }, req.usuario.id, req.ip, 'Foto de perfil actualizada');
    res.json({ ok: true, foto_url: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/alumnos/:id (desactivar, conserva historial de mensualidades)
router.delete('/:id', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    await sql("UPDATE alumnos SET estado = 'inactivo', updated_at = NOW() WHERE id = ?", [req.params.id]);
    registrarAuditoria('alumnos', req.params.id, 'UPDATE', null, { estado: 'inactivo' }, req.usuario.id, req.ip, 'Alumno desactivado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
