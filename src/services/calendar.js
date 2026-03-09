const { google } = require('googleapis');
const { DateTime } = require('luxon');

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid';

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!email || !key || !calendarId) {
    return null;
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return { calendar: google.calendar({ version: 'v3', auth }), calendarId };
}

/**
 * Obtiene eventos de Google Calendar para una fecha específica.
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {Array} Lista de eventos con start y end en minutos locales
 */
async function getEventsForDate(dateString) {
  const client = getCalendarClient();
  if (!client) {
    console.warn('⚠️  Google Calendar no configurado. No se verificarán conflictos.');
    return [];
  }

  try {
    const dayStart = DateTime.fromISO(dateString, { zone: TIMEZONE }).startOf('day');
    const dayEnd = dayStart.endOf('day');

    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin: dayStart.toISO(),
      timeMax: dayEnd.toISO(),
      timeZone: TIMEZONE,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Convertir eventos a minutos desde medianoche en hora local
    return events
      .filter(e => e.status !== 'cancelled' && e.start && e.end)
      .map(e => {
        const start = DateTime.fromISO(e.start.dateTime || e.start.date, { zone: TIMEZONE });
        const end = DateTime.fromISO(e.end.dateTime || e.end.date, { zone: TIMEZONE });
        return {
          startMinutes: start.hour * 60 + start.minute,
          endMinutes: end.hour * 60 + end.minute,
          summary: e.summary || 'Ocupado',
        };
      });
  } catch (err) {
    console.error('❌ Error al obtener eventos de Google Calendar:', err.message);
    return [];
  }
}

/**
 * Crea un evento en Google Calendar para una cita.
 * @param {Object} booking - Datos de la cita
 * @returns {string|null} ID del evento creado
 */
async function createCalendarEvent(booking) {
  const client = getCalendarClient();
  if (!client) {
    console.warn('⚠️  Google Calendar no configurado. No se creará evento.');
    return null;
  }

  try {
    const start = DateTime.fromISO(`${booking.booking_date}T${booking.booking_time}`, { zone: TIMEZONE });
    const end = start.plus({ minutes: booking.duration_minutes });

    const event = {
      summary: `${booking.treatment_name} - ${booking.name} ${booking.surname}`,
      description: [
        `Tratamiento: ${booking.treatment_name}`,
        `Cliente: ${booking.name} ${booking.surname}`,
        `Teléfono: ${booking.phone}`,
        `Duración: ${booking.duration_minutes} minutos`,
      ].join('\n'),
      start: {
        dateTime: start.toISO(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: end.toISO(),
        timeZone: TIMEZONE,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      resource: event,
    });

    console.log(`✅ Evento creado en Google Calendar: ${response.data.id}`);
    return response.data.id;
  } catch (err) {
    console.error('❌ Error al crear evento en Google Calendar:', err.message);
    return null;
  }
}

module.exports = { getEventsForDate, createCalendarEvent };
