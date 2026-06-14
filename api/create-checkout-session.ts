import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, email, plan, redirectPath } = req.body;

    if (!userId || !email || !plan || !redirectPath) {
      return res.status(400).json({ error: 'Missing required parameters: userId, email, plan, or redirectPath' });
    }

    let amount = 0;
    let planName = '';
    let planDescription = '';

    switch (plan) {
      case 'premium':
        amount = 19900;
        planName = 'Solo Lifter Pro';
        planDescription = 'Sugerencias de Smart Coach y reglas avanzadas para atletas autónomos.';
        break;
      case 'iniciacion':
        amount = 14900;
        planName = 'Plan Iniciación (Coach)';
        planDescription = 'Gestión de hasta 2 atletas vinculados.';
        break;
      case 'intermedio':
        amount = 59900;
        planName = 'Plan Intermedio (Coach)';
        planDescription = 'Gestión de hasta 10 atletas vinculados.';
        break;
      case 'profesional':
        amount = 299000;
        planName = 'Plan Profesional (Coach)';
        planDescription = 'Gestión de atletas ilimitados.';
        break;
      default:
        return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const origin = req.headers.origin || 'http://localhost:5173';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cop',
            product_data: {
              name: planName,
              description: planDescription,
            },
            unit_amount: amount * 100, // Stripe expects cents (COP is 2-decimal)
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // Single payment for 30-day access (highly recommended for high conversion in LatAm)
      metadata: {
        userId,
        email,
        plan,
      },
      customer_email: email,
      success_url: `${origin}${redirectPath}?payment_success=true&plan=${plan}`,
      cancel_url: `${origin}${redirectPath}?payment_cancel=true`,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
}
