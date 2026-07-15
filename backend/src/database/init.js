require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const CATEGORIAS_INICIALES = [
  'Infantil 1', 'Infantil 2', 'Teens', 'Junior Intermedio', 'Junior Avanzado',
  'Juvenil 1', 'Juvenil 2', 'Adultos', 'Ladies', 'Ladies Performance'
];

async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 3);

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.warn('Schema warning:', e.message.slice(0, 120));
        }
      }
    }

    const adminExiste = await client.query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
    if (adminExiste.rows.length === 0) {
      const hash = bcrypt.hashSync('Academia2026!', 12);
      await client.query(
        "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, 'admin')",
        ['Paulina Rojas Pasarin', 'admin@academiabaile.local', hash]
      );
      console.log('Usuario admin creado: admin@academiabaile.local / Academia2026!');
    }

    for (let i = 0; i < CATEGORIAS_INICIALES.length; i++) {
      await client.query(
        'INSERT INTO categorias (nombre, orden) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING',
        [CATEGORIAS_INICIALES[i], i]
      );
    }

    await client.query("INSERT INTO configuracion (clave, valor) VALUES ('dia_vencimiento', '5') ON CONFLICT (clave) DO NOTHING");
    await client.query("INSERT INTO configuracion (clave, valor) VALUES ('dias_aviso_previo', '3') ON CONFLICT (clave) DO NOTHING");
    await client.query(
      "INSERT INTO configuracion (clave, valor) VALUES ('datos_bancarios', $1) ON CONFLICT (clave) DO NOTHING",
      [JSON.stringify({ banco: '', tipo_cuenta: '', numero_cuenta: '', rut: '', nombre: '', email: '' })]
    );

    const sinToken = await client.query('SELECT id FROM alumnos WHERE token IS NULL');
    for (const a of sinToken.rows) {
      await client.query('UPDATE alumnos SET token = $1 WHERE id = $2', [crypto.randomBytes(24).toString('hex'), a.id]);
    }
    if (sinToken.rows.length) console.log(`Tokens generados para ${sinToken.rows.length} alumno(s) existentes.`);

    // Migracion: agregar 'en_revision' al CHECK de mensualidades.estado si no estaba
    await client.query(`
      ALTER TABLE mensualidades DROP CONSTRAINT IF EXISTS mensualidades_estado_check;
      ALTER TABLE mensualidades ADD CONSTRAINT mensualidades_estado_check
        CHECK (estado IN ('pendiente','pagado','vencido','anulado','en_revision'));
    `);

    // Migracion: foto de perfil del alumno
    await client.query(`ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS foto_url TEXT;`);

    console.log('Base de datos PostgreSQL lista');
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
