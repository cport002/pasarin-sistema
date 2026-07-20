const KHIPU_API_URL = 'https://payment-api.khipu.com/v3';

function apiKey() {
  const key = process.env.KHIPU_API_KEY;
  if (!key) throw new Error('KHIPU_API_KEY no está configurada');
  return key;
}

// Crea un cobro en Khipu y devuelve la URL a la que hay que redirigir al pagador.
async function crearPago({ subject, amount, transactionId, returnUrl, cancelUrl, notifyUrl }) {
  const resp = await fetch(`${KHIPU_API_URL}/payments`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      currency: 'CLP',
      amount,
      transaction_id: transactionId,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      notify_api_version: '3.0'
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || 'Error creando el pago en Khipu');
  return { paymentId: data.payment_id, paymentUrl: data.payment_url };
}

// Consulta el estado real de un pago directamente en Khipu (nunca confiar solo en el webhook).
async function obtenerPago(paymentId) {
  const resp = await fetch(`${KHIPU_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { 'x-api-key': apiKey() }
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || 'Error consultando el pago en Khipu');
  return data;
}

module.exports = { crearPago, obtenerPago };
