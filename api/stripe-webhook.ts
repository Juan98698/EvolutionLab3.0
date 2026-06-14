import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';

// Disable bodyParser to receive raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Helper to buffer the raw request stream
async function buffer(readable: Readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata || !metadata.userId || !metadata.plan) {
      console.error('⚠️ Webhook missing required metadata (userId or plan)');
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const { userId, plan } = metadata;
    const email = metadata.email || session.customer_details?.email;
    const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days of access

    console.log(`🔔 Stripe Webhook: Processing successful payment for user ${userId}, plan: ${plan}`);

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('⚠️ Supabase environment variables are not configured in Vercel');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    try {
      // 1. Update profiles table
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          suscripcion_plan: plan,
          suscripcion_estado: 'activo',
          suscripcion_expira_at: expirationDate,
          vigencia_dias: 30, // Sync with 30-day billing cycle
        })
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Supabase profile update failed: ${profileError.message}`);
      }

      console.log(`✅ Profiles updated for user: ${userId}`);

      // 2. If it is a Solo Lifter (plan === 'premium'), update/upsert the suscripciones table
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
    } catch (dbErr: any) {
      console.error('⚠️ Database update error inside Webhook:', dbErr.message);
      return res.status(500).json({ error: dbErr.message });
    }
  }

  // Return 200 for other event types to acknowledge receipt
  return res.status(200).json({ received: true });
}
