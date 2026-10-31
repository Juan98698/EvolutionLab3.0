// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import preferenceHandler from '../create-mercadopago-preference';
import webhookHandler from '../mercadopago-webhook';

/** Firma un payload de webhook igual que lo hace MercadoPago, para los tests. */
function signWebhook(paymentId: string, secret: string, requestId = 'req-abc') {
  const ts = Math.floor(Date.now() / 1000).toString();
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation((token: string) => {
        if (token === 'valid-jwt-token') {
          return Promise.resolve({ data: { user: { id: 'verified-user-123', email: 'verified@user.com' } }, error: null });
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } });
      })
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null })
    }))
  }))
}));

function mockReqRes(method: string, headers: Record<string, string> = {}, body: any = {}, query: any = {}) {
  const req: any = {
    method,
    headers,
    body,
    query
  };

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader: vi.fn((key: string, val: string) => { res.headers[key] = val; }),
    status: vi.fn((code: number) => { res.statusCode = code; return res; }),
    json: vi.fn((data: any) => { res.responseData = data; return res; }),
    end: vi.fn()
  };

  return { req, res };
}

describe('MercadoPago API Security & Webhook Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-ACCESS-TOKEN';
    process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'mock-key';
  });

  describe('api/create-mercadopago-preference', () => {
    it('retorna 401 si falta la cabecera Authorization', async () => {
      const { req, res } = mockReqRes('POST', {}, { plan: 'premium', redirectPath: '/dashboard' });
      await preferenceHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.responseData.error).toMatch(/Acceso no autorizado/i);
    });

    it('retorna 401 si el token JWT es inválido', async () => {
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer invalid-token' },
        { plan: 'premium', redirectPath: '/dashboard' }
      );
      await preferenceHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.responseData.error).toMatch(/Sesión no válida/i);
    });

    it('crea preferencia correctamente usando el userId del token verificado', async () => {
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'pref_123', init_point: 'https://mercadopago.com/init' })
      }) as any;

      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer valid-jwt-token' },
        { userId: 'malicious-attacker-id', plan: 'premium', redirectPath: '/dashboard' }
      );

      await preferenceHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.responseData.id).toBe('pref_123');

      // Verificar que fetch a MercadoPago recibió userId del JWT (verified-user-123) y NO malicious-attacker-id
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      const prefBody = JSON.parse(callArgs[1].body);
      expect(prefBody.metadata.user_id).toBe('verified-user-123');

      global.fetch = globalFetch;
    });

    it('permite CORS solo para orígenes en la allowlist y bloquea orígenes no autorizados', async () => {
      // Origen autorizado
      const { req: reqAllowed, res: resAllowed } = mockReqRes(
        'OPTIONS',
        { origin: 'https://evolution-lab.vercel.app' }
      );
      await preferenceHandler(reqAllowed, resAllowed);
      expect(resAllowed.headers['Access-Control-Allow-Origin']).toBe('https://evolution-lab.vercel.app');
      expect(resAllowed.headers['Access-Control-Allow-Credentials']).toBe('true');

      // Dominio del proyecto en Vercel
      const { req: reqProject, res: resProject } = mockReqRes(
        'OPTIONS',
        { origin: 'https://evolution-lab3-0.vercel.app' }
      );
      await preferenceHandler(reqProject, resProject);
      expect(resProject.headers['Access-Control-Allow-Origin']).toBe('https://evolution-lab3-0.vercel.app');

      // Origen no autorizado
      const { req: reqDenied, res: resDenied } = mockReqRes(
        'OPTIONS',
        { origin: 'https://evil-site.com' }
      );
      await preferenceHandler(reqDenied, resDenied);
      expect(resDenied.headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(resDenied.headers['Access-Control-Allow-Credentials']).toBeUndefined();
    });
  });

  describe('api/mercadopago-webhook', () => {
    beforeEach(() => {
      process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-mock';
    });

    it('calcula la expiración a partir de payment.date_approved para evitar extensión en reintentos', async () => {
      const approvalDateStr = '2026-08-01T10:00:00.000Z';
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'approved',
          date_approved: approvalDateStr,
          transaction_amount: 19900,
          currency_id: 'COP',
          metadata: { user_id: 'u123', plan: 'premium' }
        })
      }) as any;

      const headers = signWebhook('pay_999', 'test-webhook-secret');
      const { req, res } = mockReqRes('POST', headers, { type: 'payment', data: { id: 'pay_999' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.responseData.updated).toBe(true);

      global.fetch = globalFetch;
    });

    it('no activa el plan si el monto pagado no coincide con el precio del plan', async () => {
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'approved',
          date_approved: '2026-08-01T10:00:00.000Z',
          transaction_amount: 100,
          currency_id: 'COP',
          metadata: { user_id: 'u123', plan: 'profesional' }
        })
      }) as any;

      const headers = signWebhook('pay_1000', 'test-webhook-secret');
      const { req, res } = mockReqRes('POST', headers, { type: 'payment', data: { id: 'pay_1000' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.responseData.updated).toBeUndefined();
      expect(res.responseData.error).toMatch(/does not match/i);

      global.fetch = globalFetch;
    });

    it('acepta la notificación de prueba de MercadoPago (data.id en la URL) y luego consulta el pago', async () => {
      const globalFetch = global.fetch;
      // El pago 123456 de la simulación no existe: MercadoPago responde 404.
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;

      const headers = signWebhook('123456', 'test-webhook-secret');
      const { req, res } = mockReqRes(
        'POST',
        headers,
        { action: 'payment.updated', api_version: 'v1', data: { id: '123456' }, type: 'payment', live_mode: false },
        { 'data.id': '123456', type: 'payment' }
      );
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/payments/123456',
        expect.anything()
      );
      global.fetch = globalFetch;
    });

    it('ignora espacios o saltos de línea pegados junto a la clave secreta', async () => {
      process.env.MERCADOPAGO_WEBHOOK_SECRET = '  test-webhook-secret\n';
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;

      const headers = signWebhook('123456', 'test-webhook-secret');
      const { req, res } = mockReqRes('POST', headers, { type: 'payment', data: { id: '123456' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      global.fetch = globalFetch;
    });

    it('omite request-id de la firma cuando MercadoPago no envía x-request-id', async () => {
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;

      const ts = Math.floor(Date.now() / 1000).toString();
      const v1 = crypto.createHmac('sha256', 'test-webhook-secret').update(`id:123456;ts:${ts};`).digest('hex');
      const { req, res } = mockReqRes('POST', { 'x-signature': `ts=${ts},v1=${v1}` }, { type: 'payment', data: { id: '123456' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      global.fetch = globalFetch;
    });

    it('rechaza con 500 si MERCADOPAGO_WEBHOOK_SECRET no está configurado (falla cerrado, no abierto)', async () => {
      delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

      const { req, res } = mockReqRes('POST', {}, { type: 'payment', data: { id: 'pay_999' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(500);
    });

    it('rechaza con 401 si falta la cabecera x-signature', async () => {
      const { req, res } = mockReqRes('POST', {}, { type: 'payment', data: { id: 'pay_999' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.responseData.error).toMatch(/Missing webhook signature/i);
    });

    it('rechaza con 401 si la firma x-signature es inválida', async () => {
      const badHeaders = { 'x-signature': 'ts=1234567890,v1=firma-falsa', 'x-request-id': 'req-abc' };
      const { req, res } = mockReqRes('POST', badHeaders, { type: 'payment', data: { id: 'pay_999' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.responseData.error).toMatch(/Invalid webhook signature/i);
    });
  });
});
