require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDatabase } = require('./database/init');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const categoriasRoutes = require('./routes/categorias');
const alumnosRoutes = require('./routes/alumnos');
const mensualidadesRoutes = require('./routes/mensualidades');
const configuracionRoutes = require('./routes/configuracion');
const auditoriaRoutes = require('./routes/auditoria');
const publicRoutes = require('./routes/public');
const { iniciarJobAlertas } = require('./services/alertas');

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5180',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5180',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (origin.endsWith('.onrender.com')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Demasiados intentos, espere 15 minutos' });
app.use('/api/auth/login', loginLimiter);

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: 'Demasiadas solicitudes, espere unos minutos' });
app.use('/api/public', publicLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/mensualidades', mensualidadesRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/public', publicRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

async function startServer() {
  await initDatabase();
  iniciarJobAlertas();
  app.listen(PORT, () => {
    console.log(`Backend Academia de Baile corriendo en puerto ${PORT} — DB: PostgreSQL (Aiven)`);
  });
}
startServer();

module.exports = app;
