const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

function filasAObjeto(rows) {
  const obj = {};
  for (const row of rows) {
    obj[row.clave] = row.clave === 'datos_bancarios' ? JSON.parse(row.valor || '{}') : row.valor;
  }
  return obj;
}

// GET /api/configuracion
router.get('/', autenticar, async (req, res) => {
  try {
    const r = await sql('SELECT clave, valor FROM configuracion');
    res.json(filasAObjeto(r.rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/configuracion — body: { dia_vencimiento, dias_aviso_previo, datos_bancarios }
router.put('/', autenticar, autorizar('admin', 'secretaria'), async (req, res) => {
  try {
    const { dia_vencimiento, dias_aviso_previo, datos_bancarios } = req.body;
    const anterior = filasAObjeto((await sql('SELECT clave, valor FROM configuracion')).rows);

    if (dia_vencimiento !== undefined) {
      await sql("INSERT INTO configuracion (clave, valor) VALUES ('dia_vencimiento', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = NOW()", [String(dia_vencimiento)]);
    }
    if (dias_aviso_previo !== undefined) {
      await sql("INSERT INTO configuracion (clave, valor) VALUES ('dias_aviso_previo', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = NOW()", [String(dias_aviso_previo)]);
    }
    if (datos_bancarios !== undefined) {
      await sql("INSERT INTO configuracion (clave, valor) VALUES ('datos_bancarios', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = NOW()", [JSON.stringify(datos_bancarios)]);
    }

    registrarAuditoria('configuracion', null, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Configuración actualizada');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
