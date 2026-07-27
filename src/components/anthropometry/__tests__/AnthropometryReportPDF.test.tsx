// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnthropometryReportPDF from '../AnthropometryReportPDF';
import { ValoracionAntropometrica } from '../../../types/database.types';

function buildValoracion(overrides: Partial<ValoracionAntropometrica>): ValoracionAntropometrica {
  return {
    cliente_id: 'client-1',
    fecha: '2026-07-27',
    edad: 28,
    peso: 65,
    estatura: 165,
    metodo: 'Yuhasz',
    genero: 'femenino',
    pliegues: {},
    perimetros: {},
    diametros: {},
    imc: 23.9,
    clasificacion_imc: 'Normal',
    pct_grasa: 22,
    clasificacion_grasa: 'Aceptable',
    kg_grasa: 14.3,
    pct_musculo: 34.5,
    clasificacion_musculo: 'Bueno',
    kg_musculo: 22.4,
    pct_oseo: 12,
    kg_oseo: 7.8,
    pct_residual: 20.9,
    kg_residual: 13.6,
    ratio_musculo_grasa: 1.57,
    somatotipo: { endo: 3, meso: 3, ecto: 3, x: 0, y: 0 },
    bmr: 1400,
    tdee: 2100,
    target_calorias: 1900,
    macros: {
      proteina: { gPerKg: 2, grams: 130, calories: 520, percentage: 27 },
      grasa: { gPerKg: 1, grams: 65, calories: 585, percentage: 31 },
      carbohidratos: { gPerKg: 4, grams: 195, calories: 780, percentage: 41 },
    },
    ...overrides,
  } as ValoracionAntropometrica;
}

/** Devuelve la tabla <table> que sigue al <h4> cuyo texto incluye `tituloParcial`. */
function getTablaPorTitulo(container: HTMLElement, tituloParcial: string): HTMLElement {
  const headings = Array.from(container.querySelectorAll('h4'));
  const heading = headings.find((h) => h.textContent?.includes(tituloParcial));
  if (!heading) throw new Error(`No se encontró un <h4> que contenga "${tituloParcial}"`);
  const tabla = heading.parentElement?.querySelector('table');
  if (!tabla) throw new Error(`No se encontró la tabla debajo de "${tituloParcial}"`);
  return tabla as HTMLElement;
}

/** Cuenta cuántas filas de la tabla están marcadas como coincidencia (contienen el marcador ◄). */
function contarFilasMarcadas(tabla: HTMLElement): number {
  return Array.from(tabla.querySelectorAll('tbody tr')).filter((tr) => tr.textContent?.includes('◄')).length;
}

describe('AnthropometryReportPDF — tabla de % de masa muscular', () => {
  it('resalta una sola fila, no dos, para un valor en la ex-zona de solapamiento (34.5% femenino)', () => {
    const valoracion = buildValoracion({ pct_musculo: 34.5, clasificacion_musculo: 'Bueno', genero: 'femenino' });
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Atleta Test" trainerProfile={null} />
    );

    const tablaMuscular = getTablaPorTitulo(container, 'Masa Muscular');
    expect(contarFilasMarcadas(tablaMuscular)).toBe(1);
  });

  it('no hay solapamiento en ningún valor de borde, para ambos géneros', () => {
    const casos: Array<{ pct: number; genero: 'masculino' | 'femenino'; esperado: string }> = [
      { pct: 34.0, genero: 'femenino', esperado: 'Promedio' },
      { pct: 34.5, genero: 'femenino', esperado: 'Bueno' },
      { pct: 38.0, genero: 'masculino', esperado: 'Promedio' },
      { pct: 38.5, genero: 'masculino', esperado: 'Bueno' },
    ];

    for (const caso of casos) {
      const valoracion = buildValoracion({ pct_musculo: caso.pct, clasificacion_musculo: caso.esperado, genero: caso.genero });
      const { container, unmount } = render(
        <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Atleta Test" trainerProfile={null} />
      );
      const tablaMuscular = getTablaPorTitulo(container, 'Masa Muscular');
      expect(contarFilasMarcadas(tablaMuscular)).toBe(1);
      unmount();
    }
  });
});
