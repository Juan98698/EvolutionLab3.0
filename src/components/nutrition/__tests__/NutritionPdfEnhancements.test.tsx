// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { NutritionReportPDF } from '../NutritionReportPDF';
import { NutritionPlan } from '../../../types/nutrition.types';
import { Profile } from '../../../types/database.types';
import { calculatePdfSlices } from '../../../lib/nutritionPdf';

describe('NutritionReportPDF — Trainer Logo, Water Requirement & Single-page Layout', () => {
  afterEach(() => {
    cleanup();
  });

  const basePlan: NutritionPlan = {
    id: 'plan-enhancements-test',
    cliente_id: 'athlete-lorena',
    entrenador_id: 'trainer-jm',
    activo: true,
    modo: 'semanal',
    nombre: 'Plan Nutricional: Ganancia Muscular',
    target_calorias: 1730,
    target_proteina_g: 116,
    target_carbohidratos_g: 195,
    target_grasa_g: 54,
    datos_plan: {
      modo: 'semanal',
      incluirEquivalenciasPdf: true,
      equivalencias: {
        'atun enlatado': [
          {
            foodId: 'opt-1',
            nombre: 'Chorizo de pollo, crudo',
            grupo: 'Carnes y Aves',
            cantidad: 90,
            unidad: 'gr',
            calorias: 195,
            proteina: 20,
            carbohidratos: 0,
            grasa: 12,
            deltaCaloriasPct: 0,
            activo: true,
          },
        ],
      },
      days: {
        lunes: {
          id: 'day-lun',
          diaSemana: 'lunes',
          nombre: 'Lunes',
          meals: [
            {
              id: 'm-lun-1',
              nombre: 'Almuerzo',
              orden: 1,
              foods: [
                {
                  id: 'f-atun',
                  foodId: 'atun-1',
                  nombre: 'Atun enlatado',
                  grupo: 'Pescados y Mariscos',
                  cantidad: 100,
                  cantidadBase: 100,
                  unidad: 'gr',
                  calorias: 196,
                  proteina: 28,
                  carbohidratos: 0,
                  grasa: 9.3,
                },
              ],
            },
          ],
        },
      },
    },
    recomendaciones:
      '• Pesar los alimentos en crudo antes de la cocción.\n• Consumir entre 2 y 3 litros de agua.\n• Sal marina y especias al gusto.\n• Mantener los horarios con regularidad.',
  };

  it('renders trainer logo image when trainerProfile.logo_url is provided', () => {
    const mockTrainer: Profile = {
      id: 'trainer-1',
      email: 'trainer@evolutionlab.com',
      nombre: 'JM TRAINER',
      rol: 'entrenador',
      logo_url: 'https://supabase.co/storage/v1/object/public/logos/jm-trainer-logo.png',
      marca: {
        nombre_display: 'JM TRAINER',
        color_primario: '#00d4ff',
        color_secundario: '#0f172a',
        tipografia: 'Orbitron',
        eslogan: 'No necesitas entrenar más, necesitas entrenar mejor',
      },
    };

    render(
      <NutritionReportPDF
        plan={basePlan}
        atletaNombre="Lorena Echavarria"
        trainerProfile={mockTrainer}
        activeDayKey="lunes"
      />
    );

    const logoImg = screen.getByRole('img', { name: /JM TRAINER/i });
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute(
      'src',
      'https://supabase.co/storage/v1/object/public/logos/jm-trainer-logo.png'
    );
    expect(screen.getByText(/No necesitas entrenar más, necesitas entrenar mejor/i)).toBeInTheDocument();
  });

  it('falls back to h1 brand text when no logo_url is provided', () => {
    const mockTrainerNoLogo: Profile = {
      id: 'trainer-2',
      email: 'trainer2@evolutionlab.com',
      nombre: 'EVOLUTION LAB',
      rol: 'entrenador',
      logo_url: null,
      marca: {
        nombre_display: 'EVOLUTION LAB',
        color_primario: '#00d4ff',
        color_secundario: '#0f172a',
        tipografia: 'Orbitron',
      },
    };

    render(
      <NutritionReportPDF
        plan={basePlan}
        atletaNombre="Lorena Echavarria"
        trainerProfile={mockTrainerNoLogo}
        activeDayKey="lunes"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /EVOLUTION LAB/i })).toBeInTheDocument();
  });

  it('renders daily water requirement when aguaRecomendada prop is passed', () => {
    const { container } = render(
      <NutritionReportPDF
        plan={basePlan}
        atletaNombre="Lorena Echavarria"
        trainerProfile={null}
        activeDayKey="lunes"
        aguaRecomendada="2.4 – 2.7 L / día"
      />
    );

    const waterBlock = container.querySelector('[data-pdf-block="water-requirement"]');
    expect(waterBlock).not.toBeNull();
    expect(screen.getByText(/Requerimiento Hídrico Diario/i)).toBeInTheDocument();
    expect(screen.getByText('2.4 – 2.7 L / día')).toBeInTheDocument();
  });

  it('renders daily water requirement when stored in plan.datos_plan.aguaRecomendada', () => {
    const planWithWater: NutritionPlan = {
      ...basePlan,
      datos_plan: {
        ...basePlan.datos_plan,
        aguaRecomendada: '3.0 – 3.3 L / día',
      },
    };

    const { container } = render(
      <NutritionReportPDF
        plan={planWithWater}
        atletaNombre="Lorena Echavarria"
        trainerProfile={null}
        activeDayKey="lunes"
      />
    );

    const waterBlock = container.querySelector('[data-pdf-block="water-requirement"]');
    expect(waterBlock).not.toBeNull();
    expect(screen.getByText('3.0 – 3.3 L / día')).toBeInTheDocument();
  });

  it('omits daily water requirement when neither prop nor plan.datos_plan contains it', () => {
    const { container } = render(
      <NutritionReportPDF
        plan={basePlan}
        atletaNombre="Lorena Echavarria"
        trainerProfile={null}
        activeDayKey="lunes"
      />
    );

    const waterBlock = container.querySelector('[data-pdf-block="water-requirement"]');
    expect(waterBlock).toBeNull();
  });

  it('sets data-pdf-break-before and page-break styling on equivalents-section in multi-day mode', () => {
    const { container } = render(
      <NutritionReportPDF
        plan={basePlan}
        atletaNombre="Lorena Echavarria"
        trainerProfile={null}
        activeDayKey="todos"
      />
    );

    const equivSection = container.querySelector('[data-pdf-block="equivalents-section"]');
    expect(equivSection).not.toBeNull();
    expect(equivSection?.getAttribute('data-pdf-break-before')).toBe('true');
  });

  it('calculatePdfSlices cuts cleanly before a block marked with breakBefore', () => {
    const blocks = [
      { top: 100, bottom: 200, type: 'header-branding' },
      { top: 220, bottom: 500, type: 'meal-card' },
      { top: 600, bottom: 1100, type: 'meal-card' },
      // Forced break block ahead on the first page
      { top: 1200, bottom: 1800, type: 'equivalents-section', breakBefore: true },
    ];

    const slices = calculatePdfSlices({
      canvasHeight: 2500,
      canvasWidth: 1588,
      pageCanvasHeight: 2246,
      blocks,
      topPaddingPx: 30,
    });

    // The first slice must cut before the forcedBreakBlock (at top - 12 = 1188)
    expect(slices.length).toBeGreaterThan(1);
    expect(slices[0].sourceH).toBeLessThanOrEqual(1200);
    expect(slices[0].sourceH).toBeGreaterThan(1000);
    // The second slice starts exactly at the cut point where equivalents-section resides
    expect(slices[1].sourceY).toBe(slices[0].sourceH);
  });
});
