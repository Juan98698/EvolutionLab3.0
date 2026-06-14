import { VercelRequest, VercelResponse } from '@vercel/node';

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

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('⚠️ Environment variable MERCADOPAGO_ACCESS_TOKEN is not configured.');
      return res.status(500).json({ error: 'MercadoPago integration is not configured on the server.' });
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
    const host = req.headers.host || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

    // Determine webhook notification url
    let notificationUrl = '';
    if (process.env.MERCADOPAGO_WEBHOOK_URL) {
      notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
    } else if (host && !isLocal) {
      notificationUrl = `https://${host}/api/mercadopago-webhook`;
    }

    // MercadoPago Preference body
    const preferenceBody: any = {
      items: [
        {
          id: plan,
          title: planName,
          description: planDescription,
          quantity: 1,
          currency_id: 'COP',
          unit_price: amount,
        },
      ],
      payer: {
        email: email,
      },
      back_urls: {
        success: `${origin}${redirectPath}?payment_success=true&plan=${plan}`,
        failure: `${origin}${redirectPath}?payment_cancel=true`,
        pending: `${origin}${redirectPath}?payment_success=pending&plan=${plan}`,
      },
      auto_return: 'approved',
      metadata: {
        user_id: userId,
        plan: plan,
        email: email,
      },
    };

    // Attach notification url only if it's set (must be a public HTTPS url)
    if (notificationUrl) {
      preferenceBody.notification_url = notificationUrl;
    }

    console.log(`Creating MercadoPago preference for user ${userId}, plan: ${plan}, notify: ${notificationUrl}`);

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      throw new Error(`MercadoPago API Error: ${mpResponse.status} - ${errorText}`);
    }

    const preference = await mpResponse.json();

    // Use init_point for live or fallback, sandbox_init_point for testing if token is test-token
    const isSandbox = accessToken.startsWith('TEST-');
    const redirectUrl = isSandbox ? preference.sandbox_init_point : preference.init_point;

    return res.status(200).json({ id: preference.id, url: redirectUrl });
  } catch (error: any) {
    console.error('Error creating MercadoPago preference:', error);
    return res.status(500).json({ error: error.message });
  }
}
