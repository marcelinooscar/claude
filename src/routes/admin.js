const express = require('express');
const router = express.Router();
const db = require('../db');

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Acceso denegado' });
  next();
}

// =============================================
// TRATAMIENTOS
// =============================================

// GET /api/admin/treatments
router.get('/treatments', requireAdmin, (req, res) => {
  const treatments = db.prepare('SELECT * FROM treatments ORDER BY name').all();
  res.json(treatments);
});

// POST /api/admin/treatments
router.post('/treatments', requireAdmin, (req, res) => {
  const { name, duration_minutes } = req.body;
  if (!name || !duration_minutes) {
    return res.status(400).json({ error: 'Nombre y duración son obligatorios' });
  }
  const dur = parseInt(duration_minutes);
  if (isNaN(dur) || dur < 5 || dur > 180 || dur % 5 !== 0) {
    return res.status(400).json({ error: 'La duración debe ser múltiplo de 5, entre 5 y 180 minutos' });
  }
  const result = db.prepare(
    'INSERT INTO treatments (name, duration_minutes) VALUES (?, ?)'
  ).run(name.trim(), dur);
  const treatment = db.prepare('SELECT * FROM treatments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(treatment);
});

// PUT /api/admin/treatments/:id
router.put('/treatments/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, duration_minutes, active } = req.body;

  const treatment = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
  if (!treatment) return res.status(404).json({ error: 'Tratamiento no encontrado' });

  const dur = duration_minutes !== undefined ? parseInt(duration_minutes) : treatment.duration_minutes;
  if (isNaN(dur) || dur < 5 || dur > 180 || dur % 5 !== 0) {
    return res.status(400).json({ error: 'La duración debe ser múltiplo de 5, entre 5 y 180 minutos' });
  }

  db.prepare(`
    UPDATE treatments SET name = ?, duration_minutes = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : treatment.name,
    dur,
    active !== undefined ? (active ? 1 : 0) : treatment.active,
    id
  );

  const updated = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/admin/treatments/:id
router.delete('/treatments/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const treatment = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
  if (!treatment) return res.status(404).json({ error: 'Tratamiento no encontrado' });

  // Comprobar si tiene citas futuras
  const today = new Date().toISOString().split('T')[0];
  const futureCitas = db.prepare(
    'SELECT COUNT(*) as c FROM bookings WHERE treatment_id = ? AND booking_date >= ?'
  ).get(id, today);

  if (futureCitas.c > 0) {
    return res.status(409).json({
      error: `No se puede eliminar: tiene ${futureCitas.c} cita(s) futura(s). Desactívalo en su lugar.`
    });
  }

  db.prepare('DELETE FROM treatments WHERE id = ?').run(id);
  res.json({ ok: true, message: 'Tratamiento eliminado' });
});

// =============================================
// HORARIOS
// =============================================

// GET /api/admin/schedules
router.get('/schedules', requireAdmin, (req, res) => {
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY day_of_week').all();
  res.json(schedules);
});

// PUT /api/admin/schedules/:day_of_week
router.put('/schedules/:day', requireAdmin, (req, res) => {
  const day = parseInt(req.params.day);
  if (isNaN(day) || day < 0 || day > 6) {
    return res.status(400).json({ error: 'Día inválido (0=Domingo, 6=Sábado)' });
  }

  const { morning_start, morning_end, afternoon_start, afternoon_end, is_closed } = req.body;

  // Validar formato de horas
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const timesToValidate = [morning_start, morning_end, afternoon_start, afternoon_end].filter(Boolean);
  for (const t of timesToValidate) {
    if (!timeRegex.test(t)) {
      return res.status(400).json({ error: `Formato de hora inválido: ${t} (usa HH:MM)` });
    }
  }

  // Validar que start < end
  if (morning_start && morning_end && morning_start >= morning_end) {
    return res.status(400).json({ error: 'La hora de inicio de mañana debe ser anterior al fin' });
  }
  if (afternoon_start && afternoon_end && afternoon_start >= afternoon_end) {
    return res.status(400).json({ error: 'La hora de inicio de tarde debe ser anterior al fin' });
  }

  const closed = is_closed ? 1 : 0;

  db.prepare(`
    UPDATE schedules SET
      morning_start = ?, morning_end = ?,
      afternoon_start = ?, afternoon_end = ?,
      is_closed = ?
    WHERE day_of_week = ?
  `).run(
    closed ? null : (morning_start || null),
    closed ? null : (morning_end || null),
    closed ? null : (afternoon_start || null),
    closed ? null : (afternoon_end || null),
    closed,
    day
  );

  const updated = db.prepare('SELECT * FROM schedules WHERE day_of_week = ?').get(day);
  res.json(updated);
});

// =============================================
// CITAS
// =============================================

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, (req, res) => {
  const { date, upcoming } = req.query;
  let query = `
    SELECT b.*, t.name as treatment_name
    FROM bookings b
    JOIN treatments t ON b.treatment_id = t.id
  `;
  const params = [];

  if (date) {
    query += ' WHERE b.booking_date = ?';
    params.push(date);
  } else if (upcoming !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    query += ' WHERE b.booking_date >= ?';
    params.push(today);
  }

  query += ' ORDER BY b.booking_date ASC, b.booking_time ASC';

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

// =============================================
// CONFIGURACIÓN
// =============================================

// GET /api/admin/config
router.get('/config', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });
  // No exponer contraseñas
  delete config.admin_password;
  delete config.client_password;
  res.json(config);
});

// PUT /api/admin/config
router.put('/config', requireAdmin, (req, res) => {
  const allowed = ['center_name', 'center_phone', 'admin_email'];
  const updates = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, req.body[key]);
      updates.push(key);
    }
  }

  // Cambio de contraseña admin
  if (req.body.admin_password_new) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('admin_password', req.body.admin_password_new);
    req.session.admin = null; // Forzar re-login
    updates.push('admin_password');
  }

  // Cambio de contraseña cliente
  if (req.body.client_password_new) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('client_password', req.body.client_password_new);
    updates.push('client_password');
  }

  // Cambio de usuario cliente
  if (req.body.client_username) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('client_username', req.body.client_username);
    updates.push('client_username');
  }

  res.json({ ok: true, updated: updates });
});

module.exports = router;
