// Importa el export_sqlite.json (alumnos, categorias, configuracion) a la base Postgres
// indicada por DATABASE_URL. Debe correrse DESPUES de que el backend ya inicializo el schema
// (initDatabase) contra esa misma base, para que existan las categorias seed y la config default.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./src/database/db');

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'export_sqlite.json'), 'utf8'));

  // 1. Mapear categoria antigua (sqlite id) -> nueva (postgres id) por nombre
  const catActuales = (await pool.query('SELECT id, nombre FROM categorias')).rows;
  const nombreToNewId = {};
  catActuales.forEach(c => { nombreToNewId[c.nombre.trim().toLowerCase()] = c.id; });

  const oldIdToNombre = {};
  data.categorias.forEach(c => { oldIdToNombre[c.id] = c.nombre; });

  // 2. Actualizar precios de categoria segun lo cargado en sqlite
  for (const c of data.categorias) {
    await pool.query('UPDATE categorias SET monto_mensualidad = $1 WHERE nombre = $2', [c.monto_mensualidad, c.nombre]);
  }
  console.log(`Precios actualizados para ${data.categorias.length} categorias.`);

  // 3. Configuracion (dia_vencimiento, dias_aviso_previo, datos_bancarios)
  for (const cfg of data.configuracion) {
    await pool.query(
      'INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, updated_at = NOW()',
      [cfg.clave, cfg.valor]
    );
  }
  console.log(`Configuracion importada (${data.configuracion.length} claves).`);

  // 4. Alumnos (preservando el token para que los links de pago ya compartidos sigan funcionando)
  let creados = 0;
  for (const a of data.alumnos) {
    const categoriaNombre = oldIdToNombre[a.categoria_id];
    const categoria_id = categoriaNombre ? nombreToNewId[categoriaNombre.trim().toLowerCase()] : null;
    await pool.query(
      `INSERT INTO alumnos
       (nombre, apellido, email, telefono, fecha_nacimiento, fecha_inscripcion, categoria_id,
        monto_personalizado, es_becado, porcentaje_beca, estado, notas, token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (token) DO NOTHING`,
      [
        a.nombre, a.apellido, a.email || null, a.telefono || null,
        a.fecha_nacimiento || null, a.fecha_inscripcion || null, categoria_id,
        a.monto_personalizado, a.es_becado, a.porcentaje_beca, a.estado, a.notas, a.token
      ]
    );
    creados++;
  }
  console.log(`Alumnos importados: ${creados}`);

  await pool.end();
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
