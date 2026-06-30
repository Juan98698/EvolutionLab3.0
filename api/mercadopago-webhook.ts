import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
      paymentId = req.body.data.id;
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
    const plan = metadata.plan;
    // const email = metadata.email || payment.payer?.email;

    if (!userId || !plan) {
      console.error(`⚠️ Webhook: Missing required metadata values (userId: ${userId}, plan: ${plan})`);
      return res.status(200).json({ received: true, error: 'Incomplete metadata' });
    }

    console.log(`🔔 Webhook: Payment approved! Activating plan "${plan}" for user ID ${userId}`);

    // 5. Connect to Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('⚠️ Webhook: Supabase environment variables are not configured on the server.');
      return res.status(500).json({ error: 'Supabase configuration error.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days of access

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
          fecha_inicio: new Date().toISOString(),
          fecha_expiracion: expirationDate,
        }, { onConflict: 'cliente_id' });

      if (subError) {
        throw new Error(`Supabase suscripciones upsert failed: ${subError.message}`);
      }

      console.log(`✅ Suscripciones table upserted for user: ${userId}`);
    }

    return res.status(200).json({ received: true, updated: true });
  } catch (error: any) {
    console.error('⚠️ Webhook: Database/Internal error processing webhook:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
