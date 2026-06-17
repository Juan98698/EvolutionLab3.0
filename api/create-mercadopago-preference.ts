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
        amount = 1000;
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

    const host = req.headers.host || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    
    // Determine sandbox mode based on token prefix, environment variable, or local execution
    const isSandbox =
      accessToken.startsWith('TEST-') ||
      process.env.MERCADOPAGO_SANDBOX === 'true' ||
      isLocal ||
      !process.env.VERCEL_ENV ||
      process.env.VERCEL_ENV === 'development';

    // Determine client origin robustly
    let origin = req.headers.origin;
    if (!origin || origin === 'null') {
      origin = host ? `${protocol}://${host}` : '';
    }
    if (!origin) {
      origin = isLocal ? 'http://localhost:3000' : 'https://evolution-lab.vercel.app';
    }

    // Standardize URL to avoid double slashes or missing slashes
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const cleanPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    let baseRedirectUrl = `${cleanOrigin}${cleanPath}`;

    // MercadoPago strictly requires HTTPS for all back_urls.
    // If it starts with http:// (e.g. during local testing on localhost), we force it to https://
    // so that MercadoPago accepts preference creation.
    if (baseRedirectUrl.startsWith('http://')) {
      baseRedirectUrl = baseRedirectUrl.replace('http://', 'https://');
    }

    // Determine webhook notification url
    let notificationUrl = '';
    if (process.env.MERCADOPAGO_WEBHOOK_URL) {
      notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
    } else if (host && !isLocal) {
      notificationUrl = `https://${host}/api/mercadopago-webhook`;
    }

    // In sandbox mode, we override the payer email with the official test buyer email configured
    // in environment variables to allow payments to be processed successfully in Sandbox.
    // In production, we use the user's real email.
    const testBuyerEmail = process.env.MERCADOPAGO_TEST_BUYER_EMAIL || 'TESTUSER3169499133033229626@testuser.com';
    const payerEmail = isSandbox
      ? testBuyerEmail
      : email;

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
        email: payerEmail,
      },
      back_urls: {
        success: `${baseRedirectUrl}?payment_success=true&plan=${plan}`,
        failure: `${baseRedirectUrl}?payment_cancel=true`,
        pending: `${baseRedirectUrl}?payment_success=pending&plan=${plan}`,
      },
      auto_return: 'approved',
      metadata: {
        user_id: userId,
        plan: plan,
        email: email,
      },
    };

    console.log('Sending Preference Body to MercadoPago:', JSON.stringify(preferenceBody, null, 2));

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

    const redirectUrl = (isSandbox && preference.sandbox_init_point) ? preference.sandbox_init_point : preference.init_point;

    return res.status(200).json({ id: preference.id, url: redirectUrl });
  } catch (error: any) {
    console.error('Error creating MercadoPago preference:', error);
    return res.status(500).json({ error: error.message });
  }
}
