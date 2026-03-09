const axios = require('axios');
const { DateTime } = require('luxon');

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid';

function formatDate(dateString) {
  return DateTime.fromISO(dateString, { zone: TIMEZONE })
    .setLocale('es')
    .toLocaleString(DateTime.DATE_FULL);
}

/**
 * Envía notificación por email al administrador via webhook.
 * El webhook debe aceptar POST con { to, subject, html }
 */
async function sendAdminEmail(booking) {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!webhookUrl || !adminEmail) {
    console.warn('⚠️  Email webhook no configurado. No se enviará notificación al admin.');
    return;
  }

  const dateFormatted = formatDate(booking.booking_date);
  const centerPhone = process.env.CENTER_PHONE || '+34600000000';
  const centerName = process.env.CENTER_NAME || 'Centro de Estética';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #d4699b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🌸 Nueva Cita Registrada</h2>
        <p style="margin: 5px 0 0;">${centerName}</p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #666; width: 140px;">Cliente</td>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0;">${booking.name} ${booking.surname}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #666;">Teléfono</td>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0;">${booking.phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #666;">Tratamiento</td>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0;">${booking.treatment_name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #666;">Fecha</td>
            <td style="padding: 10px; border-bottom: 1px solid #f0f0f0;">${dateFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #666;">Hora</td>
            <td style="padding: 10px;">${booking.booking_time} (${booking.duration_minutes} min)</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #888; font-size: 13px;">
          Para gestionar esta cita, accede al panel de administración.
        </p>
      </div>
    </div>
  `;

  try {
    await axios.post(webhookUrl, {
      to: adminEmail,
      subject: `Nueva cita: ${booking.name} ${booking.surname} - ${dateFormatted} ${booking.booking_time}`,
      html,
      text: `Nueva cita registrada:\nCliente: ${booking.name} ${booking.surname}\nTeléfono: ${booking.phone}\nTratamiento: ${booking.treatment_name}\nFecha: ${dateFormatted}\nHora: ${booking.booking_time}`,
    });
    console.log(`✅ Email de notificación enviado al admin: ${adminEmail}`);
  } catch (err) {
    console.error('❌ Error al enviar email al admin:', err.message);
  }
}

/**
 * Envía notificación por WhatsApp al cliente.
 * INACTIVO en v1 - configurado pero no ejecutado.
 */
async function sendClientWhatsApp(booking) {
  const enabled = process.env.WHATSAPP_ENABLED === 'true';
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;

  if (!enabled || !webhookUrl) {
    console.log('ℹ️  WhatsApp inactivo (WHATSAPP_ENABLED=false). No se enviará mensaje al cliente.');
    return;
  }

  const dateFormatted = formatDate(booking.booking_date);
  const centerPhone = process.env.CENTER_PHONE || '+34600000000';
  const centerName = process.env.CENTER_NAME || 'Centro de Estética';

  const message = [
    `🌸 *${centerName}*`,
    ``,
    `¡Hola ${booking.name}! Tu cita ha sido confirmada:`,
    ``,
    `📋 *Tratamiento:* ${booking.treatment_name}`,
    `📅 *Fecha:* ${dateFormatted}`,
    `⏰ *Hora:* ${booking.booking_time}`,
    `⏱️ *Duración:* ${booking.duration_minutes} minutos`,
    ``,
    `Para modificar o cancelar tu cita, llámanos al:`,
    `📞 *${centerPhone}*`,
  ].join('\n');

  try {
    await axios.post(webhookUrl, {
      to: booking.phone,
      from: process.env.WHATSAPP_FROM,
      message,
    });
    console.log(`✅ WhatsApp enviado al cliente: ${booking.phone}`);
  } catch (err) {
    console.error('❌ Error al enviar WhatsApp al cliente:', err.message);
  }
}

module.exports = { sendAdminEmail, sendClientWhatsApp };
