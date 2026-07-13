// Script temporal: exporta datos de la base SQLite local a JSON, para importarlos luego a Postgres.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data', 'academia.db'));

const categorias = db.prepare('SELECT * FROM categorias ORDER BY orden').all();
const alumnos = db.prepare('SELECT * FROM alumnos ORDER BY id').all();
const configuracion = db.prepare('SELECT * FROM configuracion').all();
const mensualidades = db.prepare('SELECT * FROM mensualidades').all();

const data = { categorias, alumnos, configuracion, mensualidades };
fs.writeFileSync(path.join(__dirname, 'export_sqlite.json'), JSON.stringify(data, null, 2));
console.log(`Exportado: ${categorias.length} categorias, ${alumnos.length} alumnos, ${configuracion.length} config, ${mensualidades.length} mensualidades`);
