const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'estetica.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =============================================
// TABLAS
// =============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL
      CHECK(duration_minutes >= 5 AND duration_minutes <= 180 AND duration_minutes % 5 = 0),
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL UNIQUE,
    day_name TEXT NOT NULL,
    morning_start TEXT,
    morning_end TEXT,
    afternoon_start TEXT,
    afternoon_end TEXT,
    is_closed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    phone TEXT NOT NULL,
    treatment_id INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    google_event_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (treatment_id) REFERENCES treatments(id)
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// =============================================
// DATOS POR DEFECTO: TRATAMIENTOS
// =============================================
const treatmentCount = db.prepare('SELECT COUNT(*) as c FROM treatments').get();
if (treatmentCount.c === 0) {
  const insert = db.prepare('INSERT INTO treatments (name, duration_minutes) VALUES (?, ?)');
  [
    ['Masaje pies',       20],
    ['Masaje manos',      10],
    ['Masaje piernas',    30],
    ['Masaje espalda',    45],
    ['Masaje completo',   60],
    ['Masaje relajante',  90],
    ['Masaje express',     5],
  ].forEach(([name, dur]) => insert.run(name, dur));
  console.log('✅ Tratamientos por defecto creados');
}

// =============================================
// DATOS POR DEFECTO: HORARIOS
// Lunes(1) y Miércoles(3): 10:30-13:30 / 16:30-20:30
// Martes(2): 10:30-14:00 / cerrado tarde
// Jueves(4) y Viernes(5): 10:30-17:00 / cerrado tarde
// Sábado(6) y Domingo(0): cerrado
// =============================================
const scheduleCount = db.prepare('SELECT COUNT(*) as c FROM schedules').get();
if (scheduleCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO schedules (day_of_week, day_name, morning_start, morning_end, afternoon_start, afternoon_end, is_closed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [0, 'Domingo',    null,    null,    null,    null,    1],
    [1, 'Lunes',      '10:30', '13:30', '16:30', '20:30', 0],
    [2, 'Martes',     '10:30', '14:00', null,    null,    0],
    [3, 'Miércoles',  '10:30', '13:30', '16:30', '20:30', 0],
    [4, 'Jueves',     '10:30', '17:00', null,    null,    0],
    [5, 'Viernes',    '10:30', '17:00', null,    null,    0],
    [6, 'Sábado',     null,    null,    null,    null,    1],
  ].forEach(row => insert.run(...row));
  console.log('✅ Horarios por defecto creados');
}

// =============================================
// DATOS POR DEFECTO: CONFIGURACIÓN
// =============================================
const upsert = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
[
  ['admin_username',  process.env.ADMIN_USERNAME  || 'admin'],
  ['admin_password',  process.env.ADMIN_PASSWORD  || 'admin2024'],
  ['client_username', process.env.CLIENT_USERNAME || 'cliente'],
  ['client_password', process.env.CLIENT_PASSWORD || 'reserva2024'],
  ['center_name',     process.env.CENTER_NAME     || 'Centro de Estética'],
  ['center_phone',    process.env.CENTER_PHONE    || '+34600000000'],
  ['admin_email',     process.env.ADMIN_EMAIL     || 'admin@example.com'],
].forEach(([k, v]) => upsert.run(k, v));

module.exports = db;
