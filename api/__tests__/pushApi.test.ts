// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock de Supabase: soporta la tabla `profiles` (para la autorización
// entrenador→atleta) y `push_subscriptions` (para las suscripciones push). ──
const PROFILES: Record<string, { id: string; entrenador_id: string | null }> = {
  'athlete-1': { id: 'athlete-1', entrenador_id: 'trainer-1' },
  'athlete-2': { id: 'athlete-2', entrenador_id: 'trainer-2' },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation((token: string) => {
        if (token === 'trainer-1-token') {
          return Promise.resolve({ data: { user: { id: 'trainer-1', email: 't1@test.com' } }, error: null });
        }
        if (token === 'athlete-1-token') {
          return Promise.resolve({ data: { user: { id: 'athlete-1', email: 'a1@test.com' } }, error: null });
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } });
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(function (this: any, _col: string, val: string) {
            this._id = val;
            return this;
          }),
          maybeSingle: vi.fn(function (this: any) {
            return Promise.resolve({ data: PROFILES[this._id] || null, error: null });
          }),
        };
      }
      // push_subscriptions: query builder encadenable y "thenable" a la vez,
      // igual que el builder real de supabase-js.
      const queryBuilder: any = {
        eq: vi.fn(() => queryBuilder),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return {
        select: vi.fn(() => queryBuilder),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn(() => queryBuilder),
        delete: vi.fn(() => queryBuilder),
      };
    }),
  })),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

function mockReqRes(method: string, headers: Record<string, string> = {}, body: any = {}) {
  const req: any = { method, headers, body };
  const res: any = {
    statusCode: 200,
    status: vi.fn((code: number) => { res.statusCode = code; return res; }),
    json: vi.fn((data: any) => { res.responseData = data; return res; }),
  };
  return { req, res };
}

describe('API de notificaciones push — auth y autorización', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-mock';
    process.env.VITE_VAPID_PUBLIC_KEY = 'mock-public-vapid';
    process.env.VAPID_PRIVATE_KEY = 'mock-private-vapid';
  });

  describe('api/send-push', () => {
    it('retorna 401 sin cabecera Authorization', async () => {
      const { default: handler } = await import('../send-push');
      const { req, res } = mockReqRes('POST', {}, { userId: 'athlete-1', title: 't', body: 'b' });
      await handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('permite a un usuario enviarse push a sí mismo', async () => {
      const { default: handler } = await import('../send-push');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer athlete-1-token' },
        { userId: 'athlete-1', title: 't', body: 'b' }
      );
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    });

    it('permite al entrenador notificar a su propio atleta', async () => {
      const { default: handler } = await import('../send-push');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer trainer-1-token' },
        { userId: 'athlete-1', title: 't', body: 'b' }
      );
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    });

    it('bloquea con 403 si el entrenador intenta notificar a un atleta ajeno', async () => {
      const { default: handler } = await import('../send-push');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer trainer-1-token' },
        { userId: 'athlete-2', title: 't', body: 'b' } // athlete-2 pertenece a trainer-2
      );
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    it('retorna 500 si las llaves VAPID no están configuradas (sin fallback hardcodeado)', async () => {
      delete process.env.VITE_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      const { default: handler } = await import('../send-push');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer athlete-1-token' },
        { userId: 'athlete-1', title: 't', body: 'b' }
      );
      await handler(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('api/save-subscription', () => {
    it('retorna 401 sin cabecera Authorization', async () => {
      const { default: handler } = await import('../save-subscription');
      const { req, res } = mockReqRes('POST', {}, { userId: 'athlete-1', subscription: { endpoint: 'https://push/1' } });
      await handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('bloquea con 403 si intenta guardar una suscripción a nombre de otro usuario', async () => {
      const { default: handler } = await import('../save-subscription');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer athlete-1-token' },
        { userId: 'athlete-2', subscription: { endpoint: 'https://push/1' } }
      );
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    it('permite guardar la propia suscripción', async () => {
      const { default: handler } = await import('../save-subscription');
      const { req, res } = mockReqRes(
        'POST',
        { authorization: 'Bearer athlete-1-token' },
        { userId: 'athlete-1', subscription: { endpoint: 'https://push/1' } }
      );
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    });
  });
});
