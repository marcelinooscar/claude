require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

// Asegurar que existe el directorio de datos
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Inicializar base de datos (debe ir antes de las rutas)
require('./src/db');

const authRoutes = require('./src/routes/auth');
const bookingRoutes = require('./src/routes/bookings');
const adminRoutes = require('./src/routes/admin');
const availabilityRoutes = require('./src/routes/availability');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({
    dir: dataDir,
    db: 'sessions.sqlite',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'estetica-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/availability', availabilityRoutes);

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de páginas
app.get('/', (req, res) => {
  if (!req.session.user && !req.session.admin) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login.html');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Redirigir rutas .html a las protegidas
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/admin.html', (req, res) => res.redirect('/admin'));

app.listen(PORT, () => {
  console.log(`\n🌸 Centro de Estética - Sistema de Citas`);
  console.log(`📍 Servidor: http://localhost:${PORT}`);
  console.log(`👤 Clientes: http://localhost:${PORT}/login.html`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin-login.html`);
  console.log(`\n📋 Credenciales por defecto:`);
  console.log(`   Cliente: ${process.env.CLIENT_USERNAME || 'cliente'} / ${process.env.CLIENT_PASSWORD || 'reserva2024'}`);
  console.log(`   Admin: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'admin2024'}\n`);
});
