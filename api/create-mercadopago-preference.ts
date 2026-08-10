import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS securely
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verificación obligatoria de autenticación del usuario vía Token JWT en la cabecera Authorization
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso no autorizado: Se requiere cabecera Authorization con token de sesión.' });
    }

    const token = authHeader.substring(7);
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('⚠️ Variables de entorno de Supabase no configuradas en el servidor.');
      return res.status(500).json({ error: 'Error de configuración en el servidor.' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('⚠️ Fallo en la autenticación del token de la sesión:', authError?.message);
      return res.status(401).json({ error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.' });
    }

    // 2. SEGURIDAD: userId se asigna EXCLUSIVAMENTE desde el user.id verificado del token JWT.
    const verifiedUserId = user.id;
    const { plan, redirectPath } = req.body;
    const userEmail = user.email || req.body.email;

    if (!plan || !redirectPath) {
      return res.status(400).json({ error: 'Missing required parameters: plan or redirectPath' });
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
        amount = 17900;
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
    let clientOrigin = req.headers.origin;
    if (!clientOrigin || clientOrigin === 'null') {
      clientOrigin = host ? `${protocol}://${host}` : '';
    }
    if (!clientOrigin) {
      clientOrigin = isLocal ? 'http://localhost:3000' : 'https://evolution-lab.vercel.app';
    }

    const cleanOrigin = clientOrigin.endsWith('/') ? clientOrigin.slice(0, -1) : clientOrigin;
    const cleanPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    let baseRedirectUrl = `${cleanOrigin}${cleanPath}`;

    if (baseRedirectUrl.startsWith('http://')) {
      baseRedirectUrl = baseRedirectUrl.replace('http://', 'https://');
    }

    let notificationUrl = '';
    if (process.env.MERCADOPAGO_WEBHOOK_URL) {
      notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
    } else if (host && !isLocal) {
      notificationUrl = `https://${host}/api/mercadopago-webhook`;
    }

    const testBuyerEmail = process.env.MERCADOPAGO_TEST_BUYER_EMAIL || 'TESTUSER3169499133033229626@testuser.com';
    const payerEmail = isSandbox
      ? testBuyerEmail
      : userEmail;

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
        user_id: verifiedUserId, // FORZADO a la identidad real verificada por JWT
        plan: plan,
        email: userEmail,
      },
    };

    if (notificationUrl) {
      preferenceBody.notification_url = notificationUrl;
    }

    console.log(`Creating MercadoPago preference for authenticated user ${verifiedUserId}, plan: ${plan}, notify: ${notificationUrl}`);

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
