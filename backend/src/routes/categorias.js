const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// GET /api/categorias
router.get('/', autenticar, async (req, res) => {
  try {
    const r = await sql(`
      SELECT c.*, (SELECT COUNT(*) FROM alumnos a WHERE a.categoria_id = c.id AND a.estado = 'activo') AS total_alumnos
      FROM categorias c
      ORDER BY c.orden, c.nombre
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/categorias
router.post('/', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const { nombre, monto_mensualidad, orden } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const existe = await sql('SELECT id FROM categorias WHERE nombre = ?', [nombre.trim()]);
    if (existe.rows.length) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });

    const r = await sql(
      'INSERT INTO categorias (nombre, monto_mensualidad, orden) VALUES (?, ?, ?) RETURNING id',
      [nombre.trim(), monto_mensualidad || 0, orden || 0]
    );
    const id = r.rows[0].id;
    registrarAuditoria('categorias', id, 'INSERT', null, req.body, req.usuario.id, req.ip, 'Categoría creada');
    res.status(201).json({ id, nombre, monto_mensualidad, orden });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/categorias/:id
router.put('/:id', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const { nombre, monto_mensualidad, orden, activa } = req.body;
    const anterior = (await sql('SELECT * FROM categorias WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Categoría no encontrada' });

    await sql(
      `UPDATE categorias SET nombre = ?, monto_mensualidad = ?, orden = ?, activa = ?, updated_at = NOW() WHERE id = ?`,
      [
        nombre ?? anterior.nombre,
        monto_mensualidad ?? anterior.monto_mensualidad,
        orden ?? anterior.orden,
        activa !== undefined ? (activa ? 1 : 0) : anterior.activa,
        req.params.id
      ]
    );
    registrarAuditoria('categorias', req.params.id, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Categoría actualizada');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/categorias/:id
router.delete('/:id', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const enUso = await sql('SELECT COUNT(*) as total FROM alumnos WHERE categoria_id = ?', [req.params.id]);
    if (enUso.rows[0].total > 0) {
      return res.status(409).json({ error: `No se puede eliminar: hay ${enUso.rows[0].total} alumno(s) en esta categoría. Desactívala en su lugar.` });
    }
    await sql('DELETE FROM categorias WHERE id = ?', [req.params.id]);
    registrarAuditoria('categorias', req.params.id, 'DELETE', null, null, req.usuario.id, req.ip, 'Categoría eliminada');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
