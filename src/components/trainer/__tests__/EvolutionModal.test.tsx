// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import EvolutionModal from '../modals/EvolutionModal';
import type { Profile } from '../../../types/database.types';

// ─── Mocks de dependencias externas ─────────────────────────────────────────

/**
 * Supabase: retorna historial vacío por defecto.
 * Esto hace que el modal muestre el estado "sin sesiones" que es más fácil de
 * verificar. Tests que necesiten datos pueden sobrescribir el mock localmente.
 */
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

/**
 * jsPDF: mock mínimo que evita errores de canvas en jsdom.
 * Solo necesitamos que el constructor no explote y que save() sea espiable.
 */
const mockSave = vi.fn();
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addImage: vi.fn(),
    addPage:  vi.fn(),
    save:     mockSave,
  })),
}));

/**
 * html2canvas: mock que retorna un canvas falso con toDataURL.
 * Necesario para que handlePrintPDFReport no cuelgue el test.
 */
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,abc'),
    width:  800,
    height: 600,
  }),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockAthlete: Profile = {
  id: 'athlete-1',
  nombre: 'Ana García',
  email: 'ana@test.com',
  objetivo: 'Hipertrofia',
  rol: 'cliente',
} as Profile;

const mockProfile: Profile = {
  id: 'trainer-1',
  nombre: 'Coach Pro',
  rol: 'entrenador',
  marca: { nombre_display: 'FitPro', eslogan: 'Tu mejor yo' },
} as any;

const freeSubscription = { plan: 'free', estado: 'activo', expira_at: null };
const premiumSubscription = { plan: 'iniciacion', estado: 'activo', expira_at: null };

/** Helper: renderiza el modal abierto con defaults sensatos */
function renderModal(overrides: {
  isOpen?: boolean;
  athlete?: Profile | null;
  subscription?: typeof freeSubscription | null;
  profile?: Profile | null;
} = {}) {
  const onClose  = vi.fn();
  const showToast = vi.fn();

  // Usar hasOwnProperty para permitir pasar null como atleta sin que el ?? lo reemplace por mockAthlete
  const selectedAthlete: Profile | null = overrides.hasOwnProperty('athlete')
    ? (overrides.athlete ?? null)
    : mockAthlete;

  const utils = render(
    <EvolutionModal
      isOpen={overrides.isOpen ?? true}
      onClose={onClose}
      selectedAthleteForEvolution={selectedAthlete}
      trainerSubscription={overrides.subscription ?? freeSubscription}
      profile={overrides.profile ?? mockProfile}
      showToast={showToast}
    />
  );
  return { ...utils, onClose, showToast };
}

// ---------------------------------------------------------------------------
// Suite 1: EvolutionModal — visibilidad
// ---------------------------------------------------------------------------
describe('EvolutionModal — visibilidad', () => {
  afterEach(cleanup);

  it('isOpen=false → no renderiza el modal (título ausente)', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText(/EVOLUCIÓN Y REPORTES/i)).toBeNull();
  });

  it('athlete=null con isOpen=true → no renderiza el modal', () => {
    renderModal({ isOpen: true, athlete: null });
    expect(screen.queryByText(/EVOLUCIÓN Y REPORTES/i)).toBeNull();
  });

  it('isOpen=true con atleta → muestra el modal y mensaje sin sesiones por defecto', async () => {
    renderModal();

    // Esperar a que el loading termine (Supabase resuelve rápido)
    await waitFor(() => {
      expect(screen.queryByText(/Cargando historial/i)).toBeNull();
    });

    expect(screen.getByText(/EVOLUCIÓN Y REPORTES/i)).toBeDefined();
    expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
    expect(screen.getByText(/El atleta aún no tiene sesiones registradas/i)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: EvolutionModal — selector de rango de fechas para PDF
// ---------------------------------------------------------------------------
describe('EvolutionModal — selector de rango de fechas para PDF', () => {
  afterEach(cleanup);

  async function renderModalWithData(subscription = freeSubscription) {
    const { supabase } = await import('../../../lib/supabaseClient');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({
        data: [{
          id: 'ses-1',
          fecha: '2024-01-15',
          notas_generales: null,
          sesiones_ejercicios: [{
            nombre_ejercicio: 'Press de banca',
            peso: 80,
            volumen: 2400,
            rm_estimado: 93.3,
            rpe_rir: 2,
            series_reps: [8, 8, 8],
          }]
        }],
        error: null
      }),
    } as any);

    const result = renderModal({ subscription });
    await waitFor(() => {
      expect(screen.queryByText(/Cargando historial/i)).toBeNull();
    });
    return result;
  }

  function getDateSelect() {
    const selects = screen.getAllByRole('combobox');
    const match = selects.find(el => 
      Array.from(el.children).some(opt => (opt as HTMLOptionElement).value === '30')
    );
    if (!match) throw new Error('No se encontró el selector de rango de fechas');
    return match as HTMLSelectElement;
  }

  it('estado inicial con datos → selector de fecha predeterminado en "Últimos 30 días", sin inputs de fecha custom', async () => {
    await renderModalWithData();

    // Verificar que el select de fecha está presente
    const select = getDateSelect();
    expect(select.value).toBe('30');

    // No debe haber inputs de fecha tipo "date" (a menos del custom que se monta condicionalmente)
    // El modal tiene inputs de fecha en custom. Al estar en "30", no se renderizan los inputs custom
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(0);
  });

  it('cambiar a "custom" → aparecen los dos inputs de fecha de rango personalizado', async () => {
    await renderModalWithData();

    const select = getDateSelect();
    fireEvent.change(select, { target: { value: 'custom' } });

    // Ahora deben estar renderizados los inputs de fecha (Start Date y End Date)
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  it('volver de "custom" a "30" → los inputs de fecha del rango personalizado desaparecen', async () => {
    await renderModalWithData();

    const select = getDateSelect();
    
    // Cambiar a custom
    fireEvent.change(select, { target: { value: 'custom' } });
    expect(document.querySelectorAll('input[type="date"]').length).toBe(2);

    // Volver a 30 días
    fireEvent.change(select, { target: { value: '30' } });
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: EvolutionModal — gate de suscripción (free vs premium)
// ---------------------------------------------------------------------------
describe('EvolutionModal — gate de suscripción (free vs premium)', () => {
  afterEach(cleanup);

  async function renderModalWithData(subscription: typeof freeSubscription) {
    const { supabase } = await import('../../../lib/supabaseClient');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({
        data: [{
          id: 'ses-1',
          fecha: '2024-01-15',
          notas_generales: null,
          sesiones_ejercicios: [{
            nombre_ejercicio: 'Press de banca',
            peso: 80,
            volumen: 2400,
            rm_estimado: 93.3,
            rpe_rir: 2,
            series_reps: [8, 8, 8],
          }]
        }],
        error: null
      }),
    } as any);

    const result = renderModal({ subscription });
    await waitFor(() => {
      expect(screen.queryByText(/Cargando historial/i)).toBeNull();
    });
    return result;
  }

  it('plan="free" → muestra banner locked y botón con candado', async () => {
    await renderModalWithData(freeSubscription);

    expect(screen.getByText(/REPORTES DE PROGRESO PDF:/)).toBeDefined();
    expect(screen.getByText('🔒 Descargar Reporte PDF')).toBeDefined();
  });

  it('plan="iniciacion" → muestra Premium Activo y botón sin candado', async () => {
    await renderModalWithData(premiumSubscription);

    expect(screen.getByText(/Premium Activo \(INICIACION\)/i)).toBeDefined();
    expect(screen.getByText('📄 Descargar Reporte PDF')).toBeDefined();
  });

  it('clic en botón PDF con plan="free" → llama showToast con aviso, no genera PDF', async () => {
    const { showToast } = await renderModalWithData(freeSubscription);
    mockSave.mockClear();

    const pdfBtn = screen.getByText('🔒 Descargar Reporte PDF');
    fireEvent.click(pdfBtn);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0]).toMatch(/funcionalidad Premium/i);
    expect(showToast.mock.calls[0][1]).toBe('info');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('clic en botón PDF con plan="iniciacion" → genera y descarga el PDF', async () => {
    const { showToast } = await renderModalWithData(premiumSubscription);
    mockSave.mockClear();

    const pdfBtn = screen.getByText('📄 Descargar Reporte PDF');
    fireEvent.click(pdfBtn);

    // El proceso de PDF es async (html2canvas y render loops)
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    expect(showToast.mock.calls[0][0]).toMatch(/Reporte PDF descargado/i);
    expect(showToast.mock.calls[0][1]).toBe('success');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: EvolutionModal — cierre
// ---------------------------------------------------------------------------
describe('EvolutionModal — cierre', () => {
  afterEach(cleanup);

  it('botón "×" → clic → onClose llamado 1 vez', async () => {
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.queryByText(/Cargando historial/i)).toBeNull();
    });

    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic en el overlay (.modal-overlay) → onClose llamado 1 vez', async () => {
    const { onClose } = renderModal();
    await waitFor(() => {
      expect(screen.queryByText(/Cargando historial/i)).toBeNull();
    });

    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
