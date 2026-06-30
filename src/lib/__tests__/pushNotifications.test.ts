// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribirNotificacionesPush, verificarSuscripcionPushActiva } from '../pushNotifications';

// Mock Notification permission
const mockRequestPermission = vi.fn();
Object.defineProperty(global, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockRequestPermission
  },
  writable: true,
  configurable: true
});

// Mock PushManager and push subscriptions
const mockGetSubscription = vi.fn();
const mockSubscribe = vi.fn();
const mockPushManager = {
  getSubscription: mockGetSubscription,
  subscribe: mockSubscribe
};

const mockRegistration = {
  active: true,
  pushManager: mockPushManager
};

const mockGetRegistrations = vi.fn();
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    getRegistrations: mockGetRegistrations,
    ready: Promise.resolve(mockRegistration)
  },
  writable: true,
  configurable: true
});

// Mock PushManager constructor on window
Object.defineProperty(global, 'PushManager', {
  value: vi.fn(),
  writable: true,
  configurable: true
});

// Mock Supabase
let mockMaybeSingleResolve = { data: null, error: null };
vi.mock('../supabaseClient', () => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(mockMaybeSingleResolve));
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockReturnValue(chain);

  return {
    supabase: {
      from: vi.fn(() => chain)
    }
  };
});

describe('Push Notifications Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestPermission.mockReset();
    mockGetSubscription.mockReset();
    mockSubscribe.mockReset();
    mockGetRegistrations.mockReset();
    mockMaybeSingleResolve = { data: null, error: null };
    Object.defineProperty(Notification, 'permission', {
      value: 'default',
      writable: true,
      configurable: true
    });
  });

  it('should return false if notification permission is denied', async () => {
    mockRequestPermission.mockResolvedValue('denied');

    const result = await subscribirNotificacionesPush('test-user-id');
    expect(result).toBe(false);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('should register subscription and return true when permission is granted', async () => {
    mockRequestPermission.mockResolvedValue('granted');
    mockGetRegistrations.mockResolvedValue([mockRegistration]);
    mockGetSubscription.mockResolvedValue(null);

    const mockSubObject = {
      endpoint: 'https://updates.push.services.com/mock-endpoint-id',
      toJSON: () => ({ endpoint: 'https://updates.push.services.com/mock-endpoint-id' })
    };
    mockSubscribe.mockResolvedValue(mockSubObject);

    const result = await subscribirNotificacionesPush('test-user-id');
    expect(result).toBe(true);
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should verify active subscription correctly when both browser and supabase have records', async () => {
    Object.defineProperty(Notification, 'permission', {
      value: 'granted',
      writable: true,
      configurable: true
    });
    mockGetRegistrations.mockResolvedValue([mockRegistration]);
    mockGetSubscription.mockResolvedValue({ endpoint: 'some-endpoint' });
    mockMaybeSingleResolve = { data: { id: 'subscription-id' } as any, error: null };

    const isActive = await verificarSuscripcionPushActiva('test-user-id');
    expect(isActive).toBe(true);
  });

  it('should return false when subscription is active in browser but missing in Supabase', async () => {
    Object.defineProperty(Notification, 'permission', {
      value: 'granted',
      writable: true,
      configurable: true
    });
    mockGetRegistrations.mockResolvedValue([mockRegistration]);
    mockGetSubscription.mockResolvedValue({ endpoint: 'some-endpoint' });
    mockMaybeSingleResolve = { data: null, error: null };

    const isActive = await verificarSuscripcionPushActiva('test-user-id');
    expect(isActive).toBe(false);
  });
});
