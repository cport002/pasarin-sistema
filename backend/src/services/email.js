const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const resend = apiKey ? new Resend(apiKey) : null;

// Sin RESEND_API_KEY configurada, hace dry-run (solo loguea) para no romper el flujo local.
async function enviarCorreo({ to, subject, html }) {
  if (!to) return { ok: false, motivo: 'sin_email' };
  if (!resend) {
    console.log(`[email dry-run] Para: ${to} | Asunto: ${subject}`);
    return { ok: true, dryRun: true };
  }
  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    return { ok: true };
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return { ok: false, motivo: e.message };
  }
}

function formatoCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
}

function botonLink(link) {
  return link
    ? `<p><a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Ver y pagar mi mensualidad</a></p>`
    : '';
}

function plantillaAvisoPrevio({ alumnoNombre, mes, anio, monto, fechaVencimiento, datosBancarios, link }) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const bancario = datosBancarios?.numero_cuenta
    ? `<p>Datos para transferencia:</p>
       <ul>
         <li>Banco: ${datosBancarios.banco || '-'}</li>
         <li>Tipo de cuenta: ${datosBancarios.tipo_cuenta || '-'}</li>
         <li>N° de cuenta: ${datosBancarios.numero_cuenta || '-'}</li>
         <li>RUT: ${datosBancarios.rut || '-'}</li>
         <li>Nombre: ${datosBancarios.nombre || '-'}</li>
       </ul>`
    : '';
  return {
    subject: `Recordatorio: mensualidad de ${meses[mes - 1]} vence pronto`,
    html: `
      <p>Hola ${alumnoNombre},</p>
      <p>Te recordamos que tu mensualidad de <strong>${meses[mes - 1]} ${anio}</strong> por <strong>${formatoCLP(monto)}</strong>
      vence el <strong>${fechaVencimiento}</strong>.</p>
      ${botonLink(link)}
      ${bancario}
      <p>Si ya realizaste el pago, puedes ignorar este mensaje.</p>
    `
  };
}

function plantillaVencido({ alumnoNombre, mes, anio, monto, datosBancarios, link }) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const bancario = datosBancarios?.numero_cuenta
    ? `<p>Datos para transferencia:</p>
       <ul>
         <li>Banco: ${datosBancarios.banco || '-'}</li>
         <li>Tipo de cuenta: ${datosBancarios.tipo_cuenta || '-'}</li>
         <li>N° de cuenta: ${datosBancarios.numero_cuenta || '-'}</li>
         <li>RUT: ${datosBancarios.rut || '-'}</li>
         <li>Nombre: ${datosBancarios.nombre || '-'}</li>
       </ul>`
    : '';
  return {
    subject: `Mensualidad de ${meses[mes - 1]} vencida`,
    html: `
      <p>Hola ${alumnoNombre},</p>
      <p>Tu mensualidad de <strong>${meses[mes - 1]} ${anio}</strong> por <strong>${formatoCLP(monto)}</strong> se encuentra vencida.</p>
      ${botonLink(link)}
      ${bancario}
      <p>Por favor regulariza tu pago a la brevedad.</p>
    `
  };
}

function plantillaComprobanteRecibido({ alumnoNombre, mes, anio }) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return {
    subject: `Recibimos tu comprobante — mensualidad de ${meses[mes - 1]}`,
    html: `<p>Hola ${alumnoNombre},</p><p>Recibimos tu comprobante de pago de la mensualidad de <strong>${meses[mes - 1]} ${anio}</strong>. Está en revisión y pronto confirmaremos tu pago.</p>`
  };
}

function plantillaPagoConfirmado({ alumnoNombre, mes, anio, monto }) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return {
    subject: `Pago confirmado — mensualidad de ${meses[mes - 1]}`,
    html: `<p>Hola ${alumnoNombre},</p><p>Confirmamos que tu pago de la mensualidad de <strong>${meses[mes - 1]} ${anio}</strong> (${formatoCLP(monto)}) fue registrado correctamente. ¡Gracias!</p>`
  };
}

module.exports = { enviarCorreo, plantillaAvisoPrevio, plantillaVencido, plantillaComprobanteRecibido, plantillaPagoConfirmado };
