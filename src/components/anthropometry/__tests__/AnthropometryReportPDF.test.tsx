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

/** Devuelve la tabla <table> asociada al contenedor que incluye `tituloParcial`. */
function getTablaPorTitulo(container: HTMLElement, tituloParcial: string): HTMLElement {
  const tables = Array.from(container.querySelectorAll('table'));
  for (const table of tables) {
    const parentDiv = table.parentElement;
    if (parentDiv && parentDiv.textContent?.toLowerCase().includes(tituloParcial.toLowerCase())) {
      return table;
    }
  }
  throw new Error(`No se encontró la tabla para "${tituloParcial}"`);
}

/** Cuenta cuántas filas de la tabla están marcadas como activas (contienen 👉 o font-weight 800). */
function contarFilasMarcadas(tabla: HTMLElement): number {
  return Array.from(tabla.querySelectorAll('tbody tr')).filter((tr) => tr.textContent?.includes('◄') || tr.textContent?.includes('👉')).length;
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

  it('renderiza las tarjetas destacadas de Ratio Músculo/Grasa y Requerimiento Hídrico en la página 1', () => {
    const valoracion = buildValoracion({
      peso: 70,
      ratio_musculo_grasa: 1.57,
      agua_recomendada_l: '2.7 – 3.0 L / día',
      genero: 'femenino',
    });
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Atleta Test" trainerProfile={null} />
    );

    expect(container.textContent).toContain('Ratio Músculo / Grasa');
    expect(container.textContent).toContain('1.57');
    expect(container.textContent).toContain('Tienes 1.57 kg de músculo por cada 1 kg de grasa.');
    expect(container.textContent).toContain('Requerimiento Hídrico');
    expect(container.textContent).toContain('2.7 – 3.0 L / día');
  });

  it('renderiza la Página 3 del informe con las cadenas de numeración corregidas (1 de 3, 2 de 3, 3 de 3)', () => {
    const valoracion = buildValoracion({
      perimetros: { cintura: 94, cadera: 100 },
      estatura: 175,
      genero: 'masculino',
    });
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Carlos Test" trainerProfile={null} />
    );

    const p1 = container.querySelector('#anthropometry-pdf-page-1');
    const p2 = container.querySelector('#anthropometry-pdf-page-2');
    const p3 = container.querySelector('#anthropometry-pdf-page-3');

    expect(p1).toBeTruthy();
    expect(p2).toBeTruthy();
    expect(p3).toBeTruthy();

    expect(p1?.textContent).toContain('Página 1 de 3');
    expect(p2?.textContent).toContain('Página 2 de 3');
    expect(p3?.textContent).toContain('Página 3 de 3');
    expect(p3?.textContent).toContain('SALUD CARDIOMETABÓLICA Y VISCERAL');
    expect(p3?.textContent).toContain('🟡 Riesgo Elevado (ALAD / IDF / WHtR)');
    expect(p3?.textContent).toContain('◄ Carlos Test (94 cm)');
    expect(p3?.textContent).toContain('DIAGNÓSTICO CLÍNICO POBLACIONAL DE ADIPOSIDAD VISCERAL');
  });

  it('muestra estado neutral "Cintura no registrada" en la Página 3 cuando cintura es 0 o ausente sin badge verde falso', () => {
    const valoracionSinCintura = buildValoracion({
      perimetros: { cintura: 0, cadera: 0 },
      estatura: 170,
      genero: 'femenino',
    });

    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracionSinCintura} atletaNombre="Laura Test" trainerProfile={null} />
    );

    const p3 = container.querySelector('#anthropometry-pdf-page-3');
    expect(p3?.textContent).toContain('Sin registrar');
    expect(p3?.textContent).not.toContain('◄ Laura Test');
    expect(p3?.textContent).toContain('no se ha registrado el perímetro de cintura');
  });

  it('resalta correctamente la fila correspondiente en la tabla IMC de la OMS (ej. Sobrepeso 28.4)', () => {
    const valoracionIMC = buildValoracion({
      imc: 28.4,
      clasificacion_imc: 'Sobrepeso',
    });

    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracionIMC} atletaNombre="Mariano Test" trainerProfile={null} />
    );

    const p2 = container.querySelector('#anthropometry-pdf-page-2');
    expect(p2?.textContent).toContain('Índice de Masa Corporal (IMC) — OMS');
    expect(p2?.textContent).toContain('◄ Mariano Test (28.4)');
  });

  it('renderiza la marca del entrenador y branding en el encabezado de las páginas cuando se provee trainerProfile', () => {
    const mockTrainer = {
      nombre: 'Coach Alejandro Smith',
      marca: {
        nombre_display: 'Apex Performance Lab',
        eslogan: 'Ciencia del Alto Rendimiento',
      },
    };

    const valoracion = buildValoracion({});
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Diego Test" trainerProfile={mockTrainer as any} />
    );

    expect(container.textContent).toContain('Apex Performance Lab');
    expect(container.textContent).toContain('Coach Alejandro Smith');
  });

  it('coloca el nombre del atleta y su valor entre paréntesis en la columna Valoración de la tabla cardiometabólica', () => {
    const valoracion = buildValoracion({
      perimetros: { cintura: 84, cadera: 96 },
      estatura: 172,
      genero: 'masculino',
    });
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Jose Martinez" trainerProfile={null} />
    );

    const p3 = container.querySelector('#anthropometry-pdf-page-3');
    expect(p3?.textContent).toContain('TABLA NORMATIVA DE SALUD CARDIOMETABÓLICA Y VISCERAL');
    expect(p3?.textContent).toContain('◄ Jose Martinez (84 cm)');
  });

  it('renderiza el glosario de siglas con ALAD, WHtR, ATP III / OMS, NCEP-ATP, ACE, IOF / IDF, TMB y TDEE en la Página 3', () => {
    const valoracion = buildValoracion({
      perimetros: { cintura: 84, cadera: 96 },
      estatura: 172,
      genero: 'masculino',
    });
    const { container } = render(
      <AnthropometryReportPDF valoracion={valoracion} atletaNombre="Jose Martinez" trainerProfile={null} />
    );

    const p3 = container.querySelector('#anthropometry-pdf-page-3');
    expect(p3?.textContent).toContain('GLOSARIO DE SIGLAS & ESTÁNDARES CIENTÍFICOS');
    expect(p3?.textContent).toContain('ALAD');
    expect(p3?.textContent).toContain('Asoc. Latinoamericana Diabetes');
    expect(p3?.textContent).toContain('WHtR');
    expect(p3?.textContent).toContain('Waist-to-Height Ratio');
    expect(p3?.textContent).toContain('ATP III / OMS');
    expect(p3?.textContent).toContain('NCEP-ATP');
    expect(p3?.textContent).toContain('ACE');
    expect(p3?.textContent).toContain('American Council Exercise');
    expect(p3?.textContent).toContain('IOF / IDF');
    expect(p3?.textContent).toContain('TMB (BMR)');
    expect(p3?.textContent).toContain('TDEE');
    expect(p3?.textContent).toContain('Tasa Metabólica Basal');
    expect(p3?.textContent).toContain('Gasto Energético Diario');
  });
});


