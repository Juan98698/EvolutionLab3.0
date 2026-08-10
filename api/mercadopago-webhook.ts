import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';


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
    // IPN (GET / POST query parameters)
    else if (req.query && req.query.id && req.query.topic) {
      paymentId = req.query.id as string;
      topic = req.query.topic as string;
    }

    // MercadoPago sometimes sends test notifications or notifications about other topics (e.g. merchant_order, subscription)
    if (topic !== 'payment' || !paymentId) {
      console.log(`🔔 MercadoPago Webhook: Received non-payment notification (topic: ${topic}, id: ${paymentId})`);
      return res.status(200).json({ received: true, ignored: true });
    }

    // 1b. Validación HMAC SHA-256 de cabecera x-signature (Defensa en profundidad)
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const xSignature = (req.headers['x-signature'] || req.headers['X-Signature']) as string;
    const xRequestId = (req.headers['x-request-id'] || req.headers['X-Request-Id']) as string;

    if (webhookSecret && xSignature) {
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
          const manifest = `id:${paymentId};request-id:${xRequestId || ''};ts:${ts};`;
          const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
          if (hmac !== v1) {
            console.error('⚠️ Webhook MercadoPago: Firma x-signature inválida.');
            return res.status(401).json({ error: 'Invalid webhook signature' });
          }
          console.log('✅ Webhook MercadoPago: Firma x-signature verificada con éxito.');
        }
      } catch (err: any) {
        console.warn('⚠️ Webhook: Error al verificar firma x-signature:', err.message);
      }
    }

    console.log(`🔔 MercadoPago Webhook: Verifying payment ID: ${paymentId}`);

    // 2. Query payment details from MercadoPago API for absolute security
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!mpResponse.ok) {
      console.error(`⚠️ Webhook: Failed to fetch payment details from MercadoPago (status: ${mpResponse.status})`);
      return res.status(200).json({ received: true, error: 'Failed to verify payment with MercadoPago' });
    }

    const payment = await mpResponse.json();

    // 3. Check if the payment status is approved
    if (payment.status !== 'approved') {
      console.log(`🔔 MercadoPago Webhook: Payment ${paymentId} is not approved (status: ${payment.status})`);
      return res.status(200).json({ received: true, approved: false });
    }

    // 4. Retrieve metadata
    const metadata = payment.metadata;
    if (!metadata) {
      console.error(`⚠️ Webhook: Approved payment ${paymentId} has no metadata attached.`);
      return res.status(200).json({ received: true, error: 'Missing metadata' });
    }

    // MercadoPago API returns metadata keys in lower_snake_case
    const userId = metadata.user_id || metadata.userId;
    const plan   = metadata.plan;
    const email  = metadata.email || payment.payer?.email || null;

    if (!userId || !plan) {
      console.error(`⚠️ Webhook: Missing required metadata values (userId: ${userId}, plan: ${plan})`);
      return res.status(200).json({ received: true, error: 'Incomplete metadata' });
    }

    console.log(`🔔 Webhook: Payment approved! Activating plan "${plan}" for user ID ${userId}${email ? ` (${email})` : ''}`);

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

    // CÁLCULO PRECISO DE EXPIRACIÓN: Basado en la fecha real de aprobación del pago (date_approved)
    // para evitar que reintentos automáticos del webhook extiendan indebidamente la vigencia.
    const approvalDate = payment.date_approved ? new Date(payment.date_approved) : (payment.date_created ? new Date(payment.date_created) : new Date());
    const baseTime = !isNaN(approvalDate.getTime()) ? approvalDate.getTime() : Date.now();
    const expirationDate = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days of access from payment approval

    // 6. Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        suscripcion_plan: plan,
        suscripcion_estado: 'activo',
        suscripcion_expira_at: expirationDate,
        vigencia_dias: 30,
      })
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Supabase profile update failed: ${profileError.message}`);
    }

    console.log(`✅ Profiles updated for user: ${userId}`);

    // 7. If premium, update the suscripciones table
    if (plan === 'premium') {
      const { error: subError } = await supabaseAdmin
        .from('suscripciones')
        .upsert({
          cliente_id: userId,
          tipo: 'premium',
          estado: 'activa',
          fecha_inicio: approvalDate.toISOString(),
          fecha_expiracion: expirationDate,
        }, { onConflict: 'cliente_id' });

      if (subError) {
        throw new Error(`Supabase suscripciones upsert failed: ${subError.message}`);
      }

      console.log(`✅ Suscripciones table upserted for user: ${userId}`);
    }

    if (email) {
      console.log(`📧 Confirmación de pago pendiente de envío → ${email} | plan: ${plan} | expira: ${expirationDate}`);
    } else {
      console.warn(`⚠️ Webhook: No se encontró email para el usuario ${userId} — no se puede enviar confirmación.`);
    }

    return res.status(200).json({ received: true, updated: true, notified: !!email });
  } catch (error: any) {
    console.error('⚠️ Webhook: Database/Internal error processing webhook:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
