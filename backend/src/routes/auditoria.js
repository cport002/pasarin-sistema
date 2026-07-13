const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();

// GET /api/auditoria
router.get('/', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const r = await sql(`
      SELECT au.*, u.nombre AS usuario_nombre
      FROM auditoria au
      LEFT JOIN usuarios u ON u.id = au.usuario_id
      ORDER BY au.id DESC
      LIMIT 500
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
