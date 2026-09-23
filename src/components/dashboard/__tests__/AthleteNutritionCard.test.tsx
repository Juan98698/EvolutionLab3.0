// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AthleteNutritionCard } from '../AthleteNutritionCard';
import { NutritionPlan, NutritionDay, Meal, FoodGroup } from '../../../types/nutrition.types';

// Mock Supabase
let mockRemotePlan: any = null;

vi.mock('../../../lib/supabaseClient', () => {
  const mockQuery = () => {
    const obj: any = {};
    obj.select = vi.fn().mockReturnValue(obj);
    obj.eq = vi.fn().mockReturnValue(obj);
    obj.order = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockReturnValue(obj);
    obj.insert = vi.fn().mockReturnValue(obj);
    obj.update = vi.fn().mockReturnValue(obj);
    obj.maybeSingle = vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: mockRemotePlan, error: null });
    });
    obj.then = (resolve: any) => Promise.resolve({ data: mockRemotePlan, error: null }).then(resolve);
    return obj;
  };

  return {
    supabase: {
      from: vi.fn(() => {
        return mockQuery();
      }),
    },
  };
});

// Mock SupabaseContext
vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: { id: 'athlete-test-id' },
    profile: {
      id: 'athlete-test-id',
      nombre: 'Lorena Gamboa Hernandez',
      rol: 'cliente',
    },
  }),
}));

// Mock PDF generator
const mockGenerateNutritionPDF = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../lib/nutritionPdf', () => ({
  generateNutritionPDF: (...args: any[]) => mockGenerateNutritionPDF(...args),
}));

describe('AthleteNutritionCard — Vista de Nutrición del Atleta', () => {
  const mockTrainerProfile = {
    id: 'trainer-test-id',
    nombre: 'Coach Juan',
    marca: {
      nombre_display: 'JUAN COACH ELITE',
      eslogan: 'Ciencia aplicada a la hipertrofia',
      logo_url: 'https://example.com/logo.png',
      color_primario: '#00d4ff',
      color_secundario: '#ff0055',
      tipografia: 'Orbitron',
    },
  };

  const createSampleWeekPlan = (): NutritionPlan => {
    const buildMeal = (id: string, nombre: string, horario: string, foodName: string): Meal => ({
      id,
      nombre,
      horario,
      orden: 1,
      foods: [
        {
          id: `food-${id}`,
          foodId: `f-${id}`,
          nombre: foodName,
          grupo: 'Cereales y Tubérculos' as FoodGroup,
          cantidad: 100,
          cantidadBase: 100,
          unidad: 'gr',
          proteina: 10,
          carbohidratos: 50,
          grasa: 5,
          calorias: 285,
          completado: false,
        },
      ],
    });

    const buildDay = (key: any, label: string, meals: Meal[]): NutritionDay => ({
      id: `day-${key}`,
      diaSemana: key,
      nombre: label,
      meals,
    });

    return {
      id: 'plan-week-1',
      cliente_id: 'athlete-test-id',
      entrenador_id: 'trainer-test-id',
      activo: true,
      modo: 'semanal',
      nombre: 'Plan Nutricional Completo',
      objetivo: 'Recomposición Corporal',
      target_calorias: 2200,
      target_proteina_g: 150,
      target_carbohidratos_g: 250,
      target_grasa_g: 65,
      recomendaciones: 'Tomar 3 litros de agua al día y priorizar el descanso.',
      datos_plan: {
        modo: 'semanal',
        days: {
          lunes: buildDay('lunes', 'Lunes', [
            buildMeal('m-lun-1', '🍳 Desayuno', '08:00', 'Avena con proteína'),
            buildMeal('m-lun-2', '🥩 Almuerzo', '13:00', 'Arroz con pollo'),
          ]),
          martes: buildDay('martes', 'Martes', [
            buildMeal('m-mar-1', '🍳 Desayuno', '08:00', 'Huevos con tostadas'),
          ]),
          miercoles: buildDay('miercoles', 'Miércoles', [
            // Insertadas desordenadas a propósito para verificar orden cronológico
            buildMeal('m-mie-2', '🥩 Almuerzo', '13:00', 'Salmón con papas'),
            buildMeal('m-mie-1', '🍎 Media Mañana', '10:30', 'Fruta con yogurt'),
          ]),
          jueves: buildDay('jueves', 'Jueves', [
            buildMeal('m-jue-1', '🥗 Cena', '20:00', 'Ensalada con atún'),
          ]),
          viernes: buildDay('viernes', 'Viernes', [
            buildMeal('m-vie-1', '🍳 Desayuno', '08:30', 'Pancakes de avena'),
          ]),
          sabado: buildDay('sabado', 'Sábado', [
            buildMeal('m-sab-1', '⚡ Merienda', '16:00', 'Batido de proteína'),
          ]),
          domingo: buildDay('domingo', 'Domingo', [
            buildMeal('m-dom-1', '🥩 Almuerzo', '13:30', 'Carne con vegetales'),
          ]),
        },
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRemotePlan = createSampleWeekPlan();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza colapsado por defecto cuando defaultExpanded={false}, reduciendo el scroll de la pantalla', async () => {
    render(
      <AthleteNutritionCard
        clienteId="athlete-test-id"
        trainerProfile={mockTrainerProfile}
        defaultExpanded={false}
      />
    );

    // Esperar a que el plan cargue
    await waitFor(() => {
      expect(screen.getAllByText(/MI DIETA/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Plan Nutricional Completo').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Recomposición Corporal').length).toBeGreaterThan(0);
    });

    // En modo colapsado debe mostrar las píldoras resumen de macros de hoy
    expect(screen.getByText(/Meta Hoy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2200/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150g/i).length).toBeGreaterThan(0);

    // Botones de acción rápida visibles
    expect(screen.getByRole('button', { name: /📄 Descargar PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver Comidas/i })).toBeInTheDocument();

    // El botón inferior de ocultar NO debe estar visible porque está colapsado
    expect(screen.queryByText(/Ocultar detalle de comidas/i)).toBeNull();
  });

  it('2. Permite desplegar y contraer la tarjeta mediante el botón acordeón', async () => {
    render(
      <AthleteNutritionCard
        clienteId="athlete-test-id"
        trainerProfile={mockTrainerProfile}
        defaultExpanded={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ver Comidas/i })).toBeInTheDocument();
    });

    // 1. Desplegar
    const expandBtn = screen.getByRole('button', { name: /Ver Comidas/i });
    fireEvent.click(expandBtn);

    // Ahora deben verse los controles de días y el detalle de comidas
    await waitFor(() => {
      expect(screen.getByText(/Formato de descarga PDF:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Semana Completa/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ocultar detalle de comidas/i })).toBeInTheDocument();
      expect(screen.getByText(/PAUTAS DE TU ENTRENADOR/i)).toBeInTheDocument();
    });

    // 2. Contraer con el botón inferior
    const collapseBottomBtn = screen.getByRole('button', { name: /Ocultar detalle de comidas/i });
    fireEvent.click(collapseBottomBtn);

    // Vuelve a estar colapsado
    expect(screen.queryByText(/Formato de descarga PDF:/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Ver Comidas/i })).toBeInTheDocument();
  });

  it('3. Genera el PDF con la Semana Completa y el branding del entrenador por defecto', async () => {
    render(
      <AthleteNutritionCard
        clienteId="athlete-test-id"
        trainerProfile={mockTrainerProfile}
        defaultExpanded={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /📄 Descargar PDF/i })).toBeInTheDocument();
    });

    // Verificar que en el render oculto del PDF existe el branding del entrenador
    const pdfHiddenContainer = document.getElementById('athlete-pdf-render');
    expect(pdfHiddenContainer).toBeInTheDocument();
    expect(pdfHiddenContainer?.textContent).toContain('JUAN COACH ELITE');
    expect(pdfHiddenContainer?.textContent).toContain('Ciencia aplicada a la hipertrofia');

    // Verificar que en el PDF aparecen los demás días de la semana (y no solo el lunes)
    expect(pdfHiddenContainer?.textContent).toContain('LUNES');
    expect(pdfHiddenContainer?.textContent).toContain('MARTES');
    expect(pdfHiddenContainer?.textContent).toContain('MIÉRCOLES');
    expect(pdfHiddenContainer?.textContent).toContain('JUEVES');
    expect(pdfHiddenContainer?.textContent).toContain('VIERNES');
    expect(pdfHiddenContainer?.textContent).toContain('SÁBADO');
    expect(pdfHiddenContainer?.textContent).toContain('DOMINGO');

    // Presionar el botón Descargar PDF
    const downloadPdfBtn = screen.getByRole('button', { name: /📄 Descargar PDF/i });
    fireEvent.click(downloadPdfBtn);

    // Debe invocar generateNutritionPDF con el alcance de Semana_Completa y el nombre del atleta
    await waitFor(() => {
      expect(mockGenerateNutritionPDF).toHaveBeenCalledWith(
        'athlete-pdf-render',
        expect.stringContaining('Plan_Nutricional_Lorena_Gamboa_Hernandez_Semana_Completa.pdf')
      );
    });
  });

  it('4. Permite alternar el alcance del PDF a un solo día si el atleta lo desea', async () => {
    render(
      <AthleteNutritionCard
        clienteId="athlete-test-id"
        trainerProfile={mockTrainerProfile}
        defaultExpanded={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Semana Completa/i })).toBeInTheDocument();
    });

    // Cambiar a "Solo [Día]"
    const singleDayBtn = screen.getByRole('button', { name: /Solo/i });
    fireEvent.click(singleDayBtn);

    // Descargar PDF
    const downloadPdfBtn = screen.getByRole('button', { name: /📄 Descargar PDF/i });
    fireEvent.click(downloadPdfBtn);

    await waitFor(() => {
      expect(mockGenerateNutritionPDF).toHaveBeenCalled();
      const calls = mockGenerateNutritionPDF.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('athlete-pdf-render');
      expect(lastCall[1]).not.toContain('Semana_Completa');
    });
  });

  it('5. Renderiza las comidas en estricto orden cronológico en la pantalla del atleta', async () => {
    render(
      <AthleteNutritionCard
        clienteId="athlete-test-id"
        trainerProfile={mockTrainerProfile}
        defaultExpanded={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Miércoles/i })).toBeInTheDocument();
    });

    const mieBtn = screen.getByRole('button', { name: /^Miércoles/i });
    fireEvent.click(mieBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Fruta con yogurt').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Salmón con papas').length).toBeGreaterThan(0);
    });

    // En el DOM, Media Mañana (10:30) debe aparecer antes que Almuerzo (13:00)
    const mealTitles = screen.getAllByText(/Media Mañana|Almuerzo/i).map((el) => el.textContent);
    const mediaMananaIdx = mealTitles.findIndex((t) => t?.includes('Media Mañana'));
    const almuerzoIdx = mealTitles.findIndex((t) => t?.includes('Almuerzo'));

    expect(mediaMananaIdx).toBeLessThan(almuerzoIdx);
  });
});
