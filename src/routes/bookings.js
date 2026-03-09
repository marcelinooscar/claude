const express = require('express');
const router = express.Router();
const db = require('../db');
const { getEventsForDate, createCalendarEvent } = require('../services/calendar');
const { sendAdminEmail, sendClientWhatsApp } = require('../services/notifications');

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

// POST /api/bookings - Crear una cita
router.post('/', requireAuth, async (req, res) => {
  const { name, surname, phone, treatment_id, booking_date, booking_time } = req.body;

  // Validaciones
  if (!name || !surname || !phone || !treatment_id || !booking_date || !booking_time) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido' });
  }

  if (!/^\d{2}:\d{2}$/.test(booking_time)) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }

  // No permitir fechas pasadas
  const today = new Date().toISOString().split('T')[0];
  if (booking_date < today) {
    return res.status(400).json({ error: 'No se pueden reservar fechas pasadas' });
  }

  // Obtener tratamiento
  const treatment = db.prepare('SELECT * FROM treatments WHERE id = ? AND active = 1').get(treatment_id);
  if (!treatment) {
    return res.status(404).json({ error: 'Tratamiento no encontrado' });
  }

  // Verificar horario del día
  const dayOfWeek = new Date(booking_date + 'T12:00:00').getDay();
  const schedule = db.prepare('SELECT * FROM schedules WHERE day_of_week = ?').get(dayOfWeek);
  if (!schedule || schedule.is_closed) {
    return res.status(400).json({ error: 'El centro está cerrado ese día' });
  }

  // Verificar que el hueco está dentro del horario
  const slotStart = timeToMinutes(booking_time);
  const slotEnd = slotStart + treatment.duration_minutes;

  const inMorning = schedule.morning_start && schedule.morning_end &&
    slotStart >= timeToMinutes(schedule.morning_start) &&
    slotEnd <= timeToMinutes(schedule.morning_end);

  const inAfternoon = schedule.afternoon_start && schedule.afternoon_end &&
    slotStart >= timeToMinutes(schedule.afternoon_start) &&
    slotEnd <= timeToMinutes(schedule.afternoon_end);

  if (!inMorning && !inAfternoon) {
    return res.status(400).json({ error: 'La hora seleccionada está fuera del horario de trabajo' });
  }

  // Re-verificar disponibilidad en Google Calendar (prevenir doble reserva)
  const events = await getEventsForDate(booking_date);
  const conflict = events.some(ev =>
    slotStart < ev.endMinutes && slotEnd > ev.startMinutes
  );
  if (conflict) {
    return res.status(409).json({ error: 'Lo sentimos, ese hueco ya ha sido reservado. Por favor elige otro.' });
  }

  // Guardar en base de datos
  const insertBooking = db.prepare(`
    INSERT INTO bookings (name, surname, phone, treatment_id, booking_date, booking_time, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insertBooking.run(
    name.trim(), surname.trim(), phone.trim(),
    treatment_id, booking_date, booking_time, treatment.duration_minutes
  );

  const bookingData = {
    id: result.lastInsertRowid,
    name: name.trim(),
    surname: surname.trim(),
    phone: phone.trim(),
    treatment_name: treatment.name,
    treatment_id,
    booking_date,
    booking_time,
    duration_minutes: treatment.duration_minutes,
  };

  // Crear evento en Google Calendar (async, no bloqueante para el usuario)
  createCalendarEvent(bookingData).then(eventId => {
    if (eventId) {
      db.prepare('UPDATE bookings SET google_event_id = ? WHERE id = ?').run(eventId, result.lastInsertRowid);
    }
  });

  // Enviar notificaciones
  sendAdminEmail(bookingData).catch(err => console.error('Error notificación admin:', err.message));
  sendClientWhatsApp(bookingData).catch(err => console.error('Error notificación cliente:', err.message));

  res.status(201).json({
    ok: true,
    booking: bookingData,
    message: '¡Cita registrada con éxito!',
  });
});

module.exports = router;
