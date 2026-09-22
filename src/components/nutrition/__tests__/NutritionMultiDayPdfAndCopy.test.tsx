import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NutritionReportPDF } from '../NutritionReportPDF';
import { NutritionPlannerModal } from '../NutritionPlannerModal';
import { NutritionPlan, NutritionDay } from '../../../types/nutrition.types';
import { Profile } from '../../../types/database.types';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => {
  const mockQuery = () => {
    const obj: any = {};
    obj.select = vi.fn().mockReturnValue(obj);
    obj.eq = vi.fn().mockReturnValue(obj);
    obj.order = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockReturnValue(obj);
    obj.single = vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'plan-123' }, error: null }));
    obj.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }));
    obj.upsert = vi.fn().mockImplementation(() => Promise.resolve({ error: null }));
    return obj;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'trainer-123' } } }),
      },
      from: vi.fn(() => mockQuery()),
    },
  };
});

// Mock SupabaseContext
vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: { id: 'trainer-123' },
    profile: {
      id: 'trainer-123',
      email: 'trainer@evolution.com',
      nombre: 'Coach Juan',
      rol: 'entrenador',
    },
  }),
}));

// Mock html2canvas and jspdf
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockpdfdata'),
    height: 1000,
    width: 800,
  }),
}));

vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addImage: vi.fn(),
    save: vi.fn(),
  }));
  return {
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

// Mock IndexedDb
vi.mock('../../../lib/indexedDbStore', () => ({
  idbSet: vi.fn().mockResolvedValue(undefined),
  idbGet: vi.fn().mockResolvedValue(null),
}));

const mockAthlete: Profile = {
  id: 'ath-1',
  email: 'atleta@test.com',
  nombre: 'Carlos Perez',
  rol: 'cliente',
  created_at: '2026-01-01',
};

function createSampleMultiDayPlan(): NutritionPlan {
  const baseDay = (nombre: string, dayKey: string): NutritionDay => ({
    id: `day_${dayKey}`,
    nombre,
    diaSemana: dayKey as any,
    meals: [
      {
        id: `meal_${dayKey}_1`,
        nombre: 'Desayuno Energético',
        orden: 1,
        horario: '08:00',
        foods: [
          {
            id: `food_${dayKey}_1`,
            foodId: 'food_avena',
            grupo: 'Cereales y Tubérculos',
            nombre: `Avena con Frutos (${nombre})`,
            cantidad: 80,
            cantidadBase: 100,
            unidad: 'gr',
            calorias: 300,
            proteina: 10,
            carbohidratos: 52,
            grasa: 5,
          },
        ],
      },
      {
        id: `meal_${dayKey}_2`,
        nombre: 'Almuerzo Anabólico',
        orden: 2,
        horario: '13:00',
        foods: [
          {
            id: `food_${dayKey}_2`,
            foodId: 'food_pollo',
            grupo: 'Carnes y Aves',
            nombre: `Pechuga de Pollo (${nombre})`,
            cantidad: 200,
            cantidadBase: 100,
            unidad: 'gr',
            calorias: 330,
            proteina: 62,
            carbohidratos: 0,
            grasa: 7,
          },
        ],
      },
    ],
  });

  const emptyDay = (nombre: string, dayKey: string): NutritionDay => ({
    id: `day_${dayKey}`,
    nombre,
    diaSemana: dayKey as any,
    meals: [
      {
        id: `meal_${dayKey}_empty`,
        nombre: 'Desayuno',
        orden: 1,
        foods: [],
      },
    ],
  });

  return {
    id: 'plan-multi-1',
    cliente_id: 'ath-1',
    entrenador_id: 'trainer-123',
    nombre: 'Plan Hipertrofia Semanal',
    objetivo: 'Volumen Limpio',
    activo: true,
    modo: 'semanal',
    target_calorias: 2400,
    target_proteina_g: 160,
    target_carbohidratos_g: 220,
    target_grasa_g: 65,
    ajuste_calorico_pct: 10,
    datos_plan: {
      modo: 'semanal',
      days: {
        lunes: baseDay('Lunes', 'lunes'),
        martes: emptyDay('Martes', 'martes'),
        miercoles: emptyDay('Miércoles', 'miercoles'),
        jueves: emptyDay('Jueves', 'jueves'),
        viernes: baseDay('Viernes', 'viernes'),
        sabado: emptyDay('Sábado', 'sabado'),
        domingo: emptyDay('Domingo', 'domingo'),
      },
    },
    recomendaciones: 'Beber 3L de agua diarios.',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

describe('NutritionReportPDF — Multi-day vs Single-day rendering', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders all configured days with day banners and meals when activeDayKey is "todos"', () => {
    const plan = createSampleMultiDayPlan();

    render(
      <NutritionReportPDF
        plan={plan}
        atletaNombre="Carlos Perez"
        trainerProfile={null}
        activeDayKey="todos"
      />
    );

    // Header info card should state "Semana Completa (Lunes, Viernes)"
    expect(screen.getByText(/Semana Completa \(Lunes, Viernes\)/i)).toBeInTheDocument();

    // Both days should have their day header banners visible
    expect(screen.getByText(/📅 LUNES/i)).toBeInTheDocument();
    expect(screen.getByText(/📅 VIERNES/i)).toBeInTheDocument();

    // Food items from both Lunes and Viernes should be present
    expect(screen.getByText(/Avena con Frutos \(Lunes\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pechuga de Pollo \(Lunes\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Avena con Frutos \(Viernes\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pechuga de Pollo \(Viernes\)/i)).toBeInTheDocument();

    // Empty days (Martes, Miércoles, etc.) should not be rendered
    expect(screen.queryByText(/📅 MARTES/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/📅 SÁBADO/i)).not.toBeInTheDocument();
  });

  it('renders only the requested day when activeDayKey is a specific day (e.g. "lunes")', () => {
    const plan = createSampleMultiDayPlan();

    render(
      <NutritionReportPDF
        plan={plan}
        atletaNombre="Carlos Perez"
        trainerProfile={null}
        activeDayKey="lunes"
      />
    );

    // Header info card should state "Lunes"
    expect(screen.getByText('DÍA DEL PLAN').parentElement?.textContent).toContain('Lunes');

    // Only Lunes header should be present
    expect(screen.getByText(/📅 LUNES/i)).toBeInTheDocument();
    expect(screen.queryByText(/📅 VIERNES/i)).not.toBeInTheDocument();

    // Food items from Lunes only
    expect(screen.getByText(/Avena con Frutos \(Lunes\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Avena con Frutos \(Viernes\)/i)).not.toBeInTheDocument();
  });
});

describe('NutritionPlannerModal — Copy Day Navigation & PDF Scope Toggle', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('automatically navigates activeDayKey to the destination day upon copying', async () => {
    const showToast = vi.fn();

    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={null}
        showToast={showToast}
      />
    );

    // Initial day active is Lunes
    const lunesTab = screen.getByRole('button', { name: /LUN/i });
    expect(lunesTab).toBeInTheDocument();

    // Open CopyDayModal by clicking "📋 COPIAR ESTE DÍA A..."
    const copyBtn = screen.getByRole('button', { name: /COPIAR ESTE DÍA A/i });
    fireEvent.click(copyBtn);

    // In CopyDayModal, check "Viernes"
    const viernesCheckbox = screen.getByRole('checkbox', { name: /Viernes/i });
    fireEvent.click(viernesCheckbox);

    // Confirm copy: button label will say "COPIAR A 1 DÍA(S)"
    const confirmBtn = screen.getByRole('button', { name: /COPIAR A 1 DÍA\(S\)/i });
    fireEvent.click(confirmBtn);

    // Check that toast was called with destination day name
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Viernes'),
      'success'
    );

    // The active day should have auto-switched to Viernes:
    // When Viernes is active, opening the copy modal again will have Viernes as the source day
    fireEvent.click(screen.getByRole('button', { name: /COPIAR ESTE DÍA A/i }));
    expect(screen.getByText('Viernes', { selector: 'strong' })).toBeInTheDocument();
  });

  it('toggles PDF scope between full week and current day in PDF preview', async () => {
    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={null}
        showToast={vi.fn()}
      />
    );

    // Toggle Vista Previa PDF
    const previewToggleBtn = screen.getByRole('button', { name: /Vista Previa PDF/i });
    fireEvent.click(previewToggleBtn);

    // Scope selector buttons should be visible
    const weekScopeBtn = screen.getByRole('button', { name: /Plan Completo \(Semana\)/i });
    const singleScopeBtn = screen.getByRole('button', { name: /Solo Lunes/i });
    expect(weekScopeBtn).toBeInTheDocument();
    expect(singleScopeBtn).toBeInTheDocument();

    // Footer PDF download button should reflect weekly scope
    const footerPdfBtn = screen.getByRole('button', { name: /📄 PDF \(Semana\)/i });
    expect(footerPdfBtn).toBeInTheDocument();

    // Switch to single day scope
    fireEvent.click(singleScopeBtn);

    // Footer PDF download button should update to single day
    expect(screen.getByRole('button', { name: '📄 PDF' })).toBeInTheDocument();

    // Switch back to week scope
    fireEvent.click(weekScopeBtn);
    expect(screen.getByRole('button', { name: /📄 PDF \(Semana\)/i })).toBeInTheDocument();
  });
});
