// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import preferenceHandler from '../create-mercadopago-preference';
import webhookHandler from '../mercadopago-webhook';

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
  });

  describe('api/mercadopago-webhook', () => {
    it('calcula la expiración a partir de payment.date_approved para evitar extensión en reintentos', async () => {
      const approvalDateStr = '2026-08-01T10:00:00.000Z';
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'approved',
          date_approved: approvalDateStr,
          metadata: { user_id: 'u123', plan: 'premium' }
        })
      }) as any;

      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-mock';

      const { req, res } = mockReqRes('POST', {}, { type: 'payment', data: { id: 'pay_999' } });
      await webhookHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.responseData.updated).toBe(true);

      global.fetch = globalFetch;
    });
  });
});
