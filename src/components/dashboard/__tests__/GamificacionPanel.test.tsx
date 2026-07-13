// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { GamificacionPanel, CustomBadgeDef } from '../GamificacionPanel';
import { Session } from '../../../lib/overload';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [] }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  sessionStorage.clear();
});

/** Una sesión mínima válida para no disparar más logros de los que cada test necesita. */
function sesion(overrides: Partial<Session> = {}): Session {
  return {
    id: 'ses-1',
    fecha: '2026-01-01',
    ejercicio: 'Sentadilla',
    peso: 50,
    ...overrides,
  };
}

describe('GamificacionPanel — insignias personalizadas (fix: se suman, no reemplazan)', () => {
  it('muestra los 9 logros por defecto cuando no se pasan insignias personalizadas', async () => {
    render(<GamificacionPanel sesiones={[sesion()]} />);

    await waitFor(() => {
      expect(screen.getByText('Primera Sesión')).toBeTruthy();
    });
    expect(screen.getByText('Cazador de PRs')).toBeTruthy();
  });

  it('muestra los 9 logros por defecto cuando customBadges es un array vacío', async () => {
    render(<GamificacionPanel sesiones={[sesion()]} customBadges={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Primera Sesión')).toBeTruthy();
    });
  });

  it('REGRESIÓN: al agregar una insignia personalizada, los logros por defecto siguen presentes (antes desaparecían)', async () => {
    const custom: CustomBadgeDef[] = [
      {
        id: 'reto_verano',
        titulo: 'Reto de Verano',
        descripcion: 'Completaste el reto de verano',
        icono: '☀️',
        tipo: 'insignia',
        condicion: 'sesiones_total',
        valor_objetivo: 100,
      },
    ];

    render(<GamificacionPanel sesiones={[sesion()]} customBadges={custom} />);

    await waitFor(() => {
      // La insignia personalizada nueva aparece...
      expect(screen.getByText('Reto de Verano')).toBeTruthy();
    });
    // ...Y los logros por defecto NO desaparecieron.
    expect(screen.getByText('Primera Sesión')).toBeTruthy();
    expect(screen.getByText('Cazador de PRs')).toBeTruthy();
    expect(screen.getByText('Versatil')).toBeTruthy();
  });

  it('una insignia personalizada desbloqueada (condición cumplida) aparece en "Logros desbloqueados"', async () => {
    const custom: CustomBadgeDef[] = [
      {
        titulo: 'Tres Sesiones',
        descripcion: 'Registraste 3 sesiones',
        icono: '3️⃣',
        tipo: 'logro',
        condicion: 'sesiones_total',
        valor_objetivo: 3,
      },
    ];

    const sesiones = [
      sesion({ id: 's1', fecha: '2026-01-01' }),
      sesion({ id: 's2', fecha: '2026-01-02' }),
      sesion({ id: 's3', fecha: '2026-01-03' }),
    ];

    render(<GamificacionPanel sesiones={sesiones} customBadges={custom} />);

    await waitFor(() => {
      expect(screen.getByText(/Logros desbloqueados/)).toBeTruthy();
    });
    expect(screen.getByText('Tres Sesiones')).toBeTruthy();
  });

  it('una insignia personalizada sin desbloquear aparece en "Por desbloquear"', async () => {
    const custom: CustomBadgeDef[] = [
      {
        titulo: 'Cien Sesiones Custom',
        descripcion: 'Un objetivo lejano',
        icono: '💯',
        tipo: 'logro',
        condicion: 'sesiones_total',
        valor_objetivo: 100,
      },
    ];

    render(<GamificacionPanel sesiones={[sesion()]} customBadges={custom} />);

    await waitFor(() => {
      expect(screen.getByText('Por desbloquear')).toBeTruthy();
    });
    expect(screen.getByText('Cien Sesiones Custom')).toBeTruthy();
  });

  it('el contador de "Logros desbloqueados" incluye tanto defaults como personalizadas en el total', async () => {
    const custom: CustomBadgeDef[] = [
      {
        titulo: 'Custom A',
        descripcion: 'desc',
        icono: '🅰️',
        tipo: 'logro',
        condicion: 'sesiones_total',
        valor_objetivo: 500, // imposible de cumplir con 1 sesión -> queda bloqueada
      },
    ];

    render(<GamificacionPanel sesiones={[sesion()]} customBadges={custom} />);

    // Con 1 sesión: "Primera Sesión" desbloqueada, total de badges = 9 default + 1 custom = 10
    // (el "1/10" se arma con 3 nodos de texto separados en JSX — {n}/{n} — por eso se
    // verifica contra el textContent completo en vez de buscar el string exacto)
    await waitFor(() => {
      expect(document.body.textContent).toContain('1/10');
    });
  });
});
