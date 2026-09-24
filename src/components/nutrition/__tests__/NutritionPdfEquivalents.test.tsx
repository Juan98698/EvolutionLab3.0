// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { NutritionReportPDF } from '../NutritionReportPDF';
import { NutritionPlan } from '../../../types/nutrition.types';

describe('NutritionReportPDF — Guía de Intercambios y Alimentos Equivalentes', () => {
  afterEach(() => {
    cleanup();
  });
  const createPlanWithEquivalents = (includeEquivalents: boolean = true): NutritionPlan => ({
    id: 'plan-pdf-test',
    cliente_id: 'athlete-1',
    entrenador_id: 'trainer-1',
    activo: true,
    modo: 'semanal',
    nombre: 'Plan de Hipertrofia & Rendimiento',
    target_calorias: 2400,
    target_proteina_g: 160,
    target_carbohidratos_g: 300,
    target_grasa_g: 60,
    datos_plan: {
      modo: 'semanal',
      incluirEquivalenciasPdf: includeEquivalents,
      equivalencias: {
        'pechuga de pollo': [
          {
            foodId: 'tilapia-approved',
            nombre: 'Filete de Tilapia Blanca',
            grupo: 'Pescados y Mariscos',
            cantidad: 165,
            unidad: 'gr',
            calorias: 158,
            proteina: 33,
            carbohidratos: 0,
            grasa: 2.8,
            deltaCaloriasPct: -1,
            activo: true, // Aprobado
          },
          {
            foodId: 'pork-vetoed',
            nombre: 'Lomo de cerdo graso',
            grupo: 'Carnes y Aves',
            cantidad: 140,
            unidad: 'gr',
            calorias: 230,
            proteina: 30,
            carbohidratos: 0,
            grasa: 12,
            deltaCaloriasPct: 40,
            activo: false, // Vetado por el entrenador
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
                  id: 'f-chick',
                  foodId: 'chick-1',
                  nombre: 'Pechuga de pollo',
                  grupo: 'Carnes y Aves',
                  cantidad: 150,
                  cantidadBase: 100,
                  unidad: 'gr',
                  calorias: 160,
                  proteina: 33,
                  carbohidratos: 0,
                  grasa: 2.5,
                },
                {
                  id: 'f-rice',
                  foodId: 'rice-1',
                  nombre: 'Arroz blanco cocido',
                  grupo: 'Cereales y Tubérculos',
                  cantidad: 200,
                  cantidadBase: 100,
                  unidad: 'gr',
                  calorias: 260,
                  proteina: 4.8,
                  carbohidratos: 56.4,
                  grasa: 0.6,
                },
              ],
            },
          ],
        },
      },
    },
  });

  it('renderiza la tabla de equivalencias con data-pdf-block y solo opciones aprobadas', () => {
    const plan = createPlanWithEquivalents(true);

    const { container } = render(
      <NutritionReportPDF
        plan={plan}
        atletaNombre="Camila Rodriguez"
        trainerProfile={null}
        activeDayKey="todos"
      />
    );

    // Debe existir el bloque de equivalencias
    const equivSection = container.querySelector('[data-pdf-block="equivalents-section"]');
    expect(equivSection).not.toBeNull();
    expect(screen.getByText(/GUÍA DE INTERCAMBIOS Y ALIMENTOS EQUIVALENTES/i)).toBeInTheDocument();

    // Debe mostrar la opción aprobada (Tilapia)
    expect(screen.getByText(/Filete de Tilapia Blanca/i)).toBeInTheDocument();

    // NO debe mostrar la opción vetada por el entrenador (Lomo de cerdo graso)
    expect(screen.queryByText(/Lomo de cerdo graso/i)).toBeNull();

    // Debe contener filas con atributo equiv-row para la paginación inteligente
    const rows = container.querySelectorAll('[data-pdf-block="equiv-row"]');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('omite la tabla de equivalencias cuando incluirEquivalenciasPdf === false', () => {
    const plan = createPlanWithEquivalents(false);

    const { container } = render(
      <NutritionReportPDF
        plan={plan}
        atletaNombre="Camila Rodriguez"
        trainerProfile={null}
        activeDayKey="todos"
      />
    );

    const equivSection = container.querySelector('[data-pdf-block="equivalents-section"]');
    expect(equivSection).toBeNull();
    expect(screen.queryByText(/GUÍA DE INTERCAMBIOS Y ALIMENTOS EQUIVALENTES/i)).toBeNull();
  });
});
