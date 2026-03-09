const express = require('express');
const router = express.Router();
const db = require('../db');
const { getEventsForDate } = require('../services/calendar');

function requireAuth(req, res, next) {
  if (!req.session.user && !req.session.admin) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function generateSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (current + durationMinutes <= end) {
    slots.push({ time: minutesToTime(current), startMinutes: current, endMinutes: current + durationMinutes });
    current += durationMinutes;
  }
  return slots;
}

function hasConflict(slot, events) {
  return events.some(ev =>
    slot.startMinutes < ev.endMinutes && slot.endMinutes > ev.startMinutes
  );
}

// GET /api/availability?date=YYYY-MM-DD&treatment_id=X
router.get('/', requireAuth, async (req, res) => {
  const { date, treatment_id } = req.query;

  if (!date || !treatment_id) {
    return res.status(400).json({ error: 'Faltan parámetros: date y treatment_id' });
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
  }

  // No permitir fechas pasadas
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.json({ slots: [], message: 'Fecha pasada' });
  }

  // Obtener tratamiento
  const treatment = db.prepare('SELECT * FROM treatments WHERE id = ? AND active = 1').get(treatment_id);
  if (!treatment) {
    return res.status(404).json({ error: 'Tratamiento no encontrado' });
  }

  // Obtener horario del día de la semana
  const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Dom, 1=Lun, ...
  const schedule = db.prepare('SELECT * FROM schedules WHERE day_of_week = ?').get(dayOfWeek);

  if (!schedule || schedule.is_closed) {
    return res.json({ slots: [], message: 'El centro está cerrado ese día' });
  }

  // Generar todos los huecos posibles
  let allSlots = [];
  if (schedule.morning_start && schedule.morning_end) {
    allSlots = allSlots.concat(generateSlots(schedule.morning_start, schedule.morning_end, treatment.duration_minutes));
  }
  if (schedule.afternoon_start && schedule.afternoon_end) {
    allSlots = allSlots.concat(generateSlots(schedule.afternoon_start, schedule.afternoon_end, treatment.duration_minutes));
  }

  if (allSlots.length === 0) {
    return res.json({ slots: [], message: 'No hay huecos disponibles para este tratamiento en este día' });
  }

  // Filtrar huecos pasados si es hoy
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  if (date === today) {
    allSlots = allSlots.filter(s => s.startMinutes > nowMinutes + 15); // +15min de margen
  }

  // Obtener eventos de Google Calendar y filtrar conflictos
  const events = await getEventsForDate(date);
  const available = allSlots
    .filter(s => !hasConflict(s, events))
    .map(s => s.time);

  res.json({
    slots: available,
    treatment: { name: treatment.name, duration_minutes: treatment.duration_minutes },
    schedule: {
      morning: schedule.morning_start ? `${schedule.morning_start} - ${schedule.morning_end}` : null,
      afternoon: schedule.afternoon_start ? `${schedule.afternoon_start} - ${schedule.afternoon_end}` : null,
    },
  });
});

// GET /api/availability/open-days - Devuelve qué días de la semana están abiertos
router.get('/open-days', requireAuth, (req, res) => {
  const schedules = db.prepare('SELECT day_of_week, is_closed FROM schedules').all();
  const closedDays = schedules.filter(s => s.is_closed).map(s => s.day_of_week);
  res.json({ closedDays });
});

// GET /api/availability/treatments - Lista de tratamientos activos (para clientes)
router.get('/treatments', requireAuth, (req, res) => {
  const treatments = db.prepare('SELECT id, name, duration_minutes FROM treatments WHERE active = 1 ORDER BY name').all();
  res.json(treatments);
});

// GET /api/availability/info - Info pública del centro (para clientes)
router.get('/info', requireAuth, (req, res) => {
  const keys = ['center_name', 'center_phone', 'center_phone_display'];
  const config = {};
  keys.forEach(k => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(k);
    config[k] = row ? row.value : '';
  });
  res.json(config);
});

module.exports = router;
