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

describe('GamificacionPanel — detección de subida de nivel (BUG: remount silenciaba la celebración)', () => {
  // Suficientes sesiones para calcular un total de puntos que dé un nivel
  // conocido: totalPoints = sesiones*50 + badges*200 + racha.actual*25 +
  // rachaSemanas.actual*100 + prCount*100. Con 5 sesiones en fechas
  // distintas (sin PRs, sin badges extra) totalPoints=250 -> nivel 2.
  const cincoSesiones: Session[] = [
    sesion({ id: 's1', fecha: '2026-01-01' }),
    sesion({ id: 's2', fecha: '2026-01-02' }),
    sesion({ id: 's3', fecha: '2026-01-03' }),
    sesion({ id: 's4', fecha: '2026-01-04' }),
    sesion({ id: 's5', fecha: '2026-01-05' }),
  ];

  afterEach(() => {
    localStorage.clear();
  });

  it('NO celebra en la primera vez que se usa la app (sin nivel guardado todavía)', async () => {
    render(<GamificacionPanel sesiones={cincoSesiones} />);

    await waitFor(() => {
      expect(localStorage.getItem('evolution_prev_level_test-user')).toBe('2');
    });
    expect(screen.queryByText(/Has subido del nivel/)).toBeNull();
  });

  it('BUG REGRESIÓN: SÍ celebra un nivel que subió en una sesión anterior de la app (remount con nivel guardado más bajo)', async () => {
    // Simula que ayer el atleta estaba en nivel 1 y hoy, al abrir la app
    // de nuevo (o al navegar de /historial de vuelta a /dashboard, lo cual
    // desmonta y remonta este panel), ya está en nivel 2.
    localStorage.setItem('evolution_prev_level_test-user', '1');

    render(<GamificacionPanel sesiones={cincoSesiones} />);

    await waitFor(() => {
      expect(screen.getByText(/Has subido del nivel/)).toBeTruthy();
    });
    expect(screen.getByText(/nivel 1 al nivel 2/)).toBeTruthy();
    expect(localStorage.getItem('evolution_prev_level_test-user')).toBe('2');
  });

  it('NO celebra si el nivel guardado ya coincide con el nivel actual (nada cambió)', async () => {
    localStorage.setItem('evolution_prev_level_test-user', '2');

    render(<GamificacionPanel sesiones={cincoSesiones} />);

    await waitFor(() => {
      expect(screen.getByText('Primera Sesión')).toBeTruthy();
    });
    expect(screen.queryByText(/Has subido del nivel/)).toBeNull();
  });
});
