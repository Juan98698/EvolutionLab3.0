import type { VercelRequest, VercelResponse } from './_lib/types';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { BILLING_PLANS, isBillingPlan, PLAN_CURRENCY } from './_lib/billing.js';



export default async function handler(req: VercelRequest, res: VercelResponse) {
  // We only accept POST request for MercadoPago webhooks
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('⚠️ Webhook: Environment variable MERCADOPAGO_ACCESS_TOKEN is not configured.');
      return res.status(500).json({ error: 'MercadoPago integration is not configured on the server.' });
    }

    let paymentId = '';
    let topic = '';

    // 1. Parse payment id and topic from Webhook or IPN
    // Webhook (POST body)
    if (req.body && req.body.data && req.body.data.id) {
      paymentId = String(req.body.data.id);
      topic = req.body.type || '';
    }
    // Webhook con los datos solo en la URL (?data.id=...&type=payment)
    else if (req.query && req.query['data.id'] && req.query.type) {
      paymentId = String(req.query['data.id']);
      topic = String(req.query.type);
    }
    // IPN (GET / POST query parameters)
    else if (req.query && req.query.id && req.query.topic) {
      paymentId = req.query.id as string;
      topic = req.query.topic as string;
    }

    if (paymentId && !/^[a-zA-Z0-9_-]{1,160}$/.test(paymentId)) return res.status(400).json({ error: 'Invalid payment ID' });
    const queryDataId = req.query?.['data.id'] ? String(req.query['data.id']) : '';
    if (queryDataId && queryDataId.toLowerCase() !== paymentId.toLowerCase()) {
      return res.status(400).json({ error: 'Payment ID does not match signed notification' });
    }

    // MercadoPago sometimes sends test notifications or notifications about other topics (e.g. merchant_order, subscription)
    if (topic !== 'payment' || !paymentId) {
      console.log(`🔔 MercadoPago Webhook: Received non-payment notification (topic: ${topic}, id: ${paymentId})`);
      return res.status(200).json({ received: true, ignored: true });
    }

    // 1b. Validación HMAC SHA-256 de cabecera x-signature — FALLA CERRADO.
    // Antes: si MERCADOPAGO_WEBHOOK_SECRET no estaba configurado, o si el
    // parseo de la firma fallaba, el código seguía de largo sin rechazar la
    // request (fail-open). Ahora: sin secreto configurado, sin cabecera de
    // firma, o con firma inválida ⇒ se rechaza con 401 siempre (o 500 si falta el secreto).
    // trim(): un espacio o salto de línea al pegar la clave en Vercel basta
    // para que ninguna firma coincida.
    const webhookSecret = (process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
    const xSignature = (req.headers['x-signature'] || req.headers['X-Signature']) as string;
    const xRequestId = (req.headers['x-request-id'] || req.headers['X-Request-Id']) as string;

    if (!webhookSecret) {
      console.error('⚠️ Webhook: Environment variable MERCADOPAGO_WEBHOOK_SECRET is not configured.');
      return res.status(500).json({ error: 'Webhook signature validation is not configured on the server.' });
    }

    if (!xSignature) {
      console.error('⚠️ Webhook MercadoPago: Falta cabecera x-signature.');
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    // Plantilla de la firma según la documentación de MercadoPago:
    //   id:[data.id de la URL];request-id:[x-request-id];ts:[ts];
    // El id sale del query `data.id` (en minúsculas si es alfanumérico) y cada
    // parte ausente se omite de la plantilla en vez de dejarla vacía.
    const manifestId = (queryDataId || paymentId).toLowerCase();

    let signatureValid = false;
    let failureReason = '';
    try {
      const parts = xSignature.split(',');
      let ts = '';
      let v1 = '';
      for (const part of parts) {
        const [key, val] = part.split('=').map((s) => s.trim());
        if (key === 'ts') ts = val;
        if (key === 'v1') v1 = val;
      }

      if (ts && v1) {
        const manifest =
          (manifestId ? `id:${manifestId};` : '') +
          (xRequestId ? `request-id:${xRequestId};` : '') +
          `ts:${ts};`;
        const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
        const hmacBuf = Buffer.from(hmac);
        const v1Buf = Buffer.from(v1);
        signatureValid = hmacBuf.length === v1Buf.length && crypto.timingSafeEqual(hmacBuf, v1Buf);
        if (!signatureValid) failureReason = 'la firma no coincide con MERCADOPAGO_WEBHOOK_SECRET';
      } else {
        failureReason = 'la cabecera x-signature no trae ts y v1';
      }
    } catch (err: any) {
      failureReason = `error al verificar: ${err.message}`;
      signatureValid = false;
    }

    if (!signatureValid) {
      // Sin datos sensibles: solo lo necesario para saber qué revisar.
      console.error(
        `⚠️ Webhook MercadoPago: Firma x-signature inválida (${failureReason}). ` +
        `id=${manifestId || '-'} (${queryDataId ? 'query' : 'body'}), ` +
        `x-request-id=${xRequestId ? 'presente' : 'ausente'}, longitud del secreto=${webhookSecret.length}`
      );
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    console.log('✅ Webhook MercadoPago: Firma x-signature verificada con éxito.');

    console.log(`🔔 MercadoPago Webhook: Verifying payment ID: ${paymentId}`);

    // 2. Query payment details from MercadoPago API for absolute security
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!mpResponse.ok) {
      if (mpResponse.status === 404 && req.body?.live_mode === false) {
        return res.status(200).json({ received: true, ignored: true, reason: 'Test payment not found' });
      }
      console.error(`⚠️ Webhook: Failed to fetch payment details from MercadoPago (status: ${mpResponse.status})`);
      return res.status(503).json({ error: 'Payment verification temporarily unavailable' });
    }

    const payment = await mpResponse.json();

    const userId = payment.metadata?.user_id;
    const plan = payment.metadata?.plan;
    if (!userId || !isBillingPlan(plan)) return res.status(422).json({ error: 'Invalid payment metadata' });
    if (payment.status === 'approved' && (payment.currency_id !== PLAN_CURRENCY || Number(payment.transaction_amount) !== BILLING_PLANS[plan].amount)) {
      return res.status(422).json({ error: 'Payment amount or currency does not match the plan' });
    }
    const updatedAt = payment.date_last_updated || payment.date_approved || payment.date_created;
    if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return res.status(422).json({ error: 'Invalid payment timestamp' });


    // 5. Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('⚠️ Webhook: Supabase environment variables are not configured on the server.');
      return res.status(500).json({ error: 'Supabase configuration error.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin.rpc('apply_verified_payment', {
      p_payment_id: paymentId, p_user_id: userId, p_plan: plan, p_status: payment.status,
      p_approved_at: payment.date_approved || null, p_updated_at: updatedAt,
    });
    if (error) throw error;
    // An acknowledgement only means the durable transaction committed. No email
    // is claimed until a delivery provider actually confirms a send.
    return res.status(200).json({ received: true, ...data, notified: false });
  } catch (error: any) {
    console.error('⚠️ Webhook: Database/Internal error processing webhook:', error.message);
    return res.status(500).json({ error: 'Payment processing temporarily unavailable' });

  }
}
