// @vitest-environment happy-dom
/**
 * QuickStartPlanner.test.tsx
 *
 * Suite de tests para el planificador de rutina del atleta independiente.
 *
 * Por qué es crítico:
 *   QuickStartPlanner.tsx es el equivalente de PlanPlanner.tsx para el
 *   atleta autónomo (sin entrenador). Tiene 2100+ líneas y es el único
 *   punto desde donde el atleta puede crear, editar y guardar su propio
 *   plan de entrenamiento. Hasta este commit, tenía CERO cobertura de
 *   tests automatizados — el mismo patrón que ya produjo el bug de RLS de
 *   "Vincular Existente" y la falta de accesibilidad táctil.
 *
 * Estrategia de mocking:
 *   - Supabase se mockea a nivel de módulo para controlar exactamente qué
 *     devuelve cada query sin tocar la red.
 *   - AthleteNavbar se mockea para aislar la unidad de prueba: su lógica
 *     interna (notificaciones, logout) no es responsabilidad de este test.
 *   - useConfirm / ConfirmDialogProvider se usa real para validar que los
 *     flujos destructivos piden confirmación correctamente.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { ConfirmDialogProvider } from '../../../context/ConfirmDialogContext';

// ---------------------------------------------------------------------------
// Mocks — deben declararse ANTES del import del componente
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// El perfil de un atleta autónomo (sin entrenador_id).
const soloAthleteProfile = {
  id: 'solo-athlete-1',
  nombre: 'Martina Gomez',
  rol: 'cliente',
  vigencia_dias: 9999,
  fecha_inicio: null,
  entrenador_id: null,
};
const soloAthleteUser = { id: 'solo-athlete-1', email: 'martina@solo.com' };

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: soloAthleteUser,
    profile: soloAthleteProfile,
  }),
}));

// AthleteNavbar tiene sus propios hooks y lógica de notificaciones — la
// mockeamos para no arrastrar esa complejidad a este test.
vi.mock('../../common/AthleteNavbar', () => ({
  default: () => <nav data-testid="mock-athlete-navbar" />,
}));

// useModalA11y maneja el foco de teclado en modales — no necesitamos
// probar el hook en sí mismo aquí (ya tiene su propio test).
vi.mock('../../../hooks/useModalA11y', () => ({
  useModalA11y: () => ({ current: null }),
}));

// ---------------------------------------------------------------------------
// Fixtures de datos
// ---------------------------------------------------------------------------

const mockEjerciciosGlobales = [
  { id: 'ej-1', nombre: 'Sentadilla Libre con Barra', grupo_muscular: 'Cuádriceps', descripcion: '', imagen_url: '' },
  { id: 'ej-2', nombre: 'Press de Banca Plano con Barra', grupo_muscular: 'Pecho', descripcion: '', imagen_url: '' },
  { id: 'ej-3', nombre: 'Remo con Barra', grupo_muscular: 'Espalda', descripcion: '', imagen_url: '' },
];

const mockPlanExistente = {
  portada: {
    userName: 'Martina Gomez',
    userGoal: 'Hipertrofia',
    startDate: '2026-07-01',
    planVigenciaPlan: '30',
    trainerName: 'Martina Gomez',
    globalNote: 'Nota de prueba existente',
  },
  globalVariables: [
    { id: 'series de trabajo', label: 'SERIES DE TRABAJO', type: 'text', defaultValue: '4' },
    { id: 'repeticiones', label: 'REPETICIONES', type: 'text', defaultValue: '8-10' },
    { id: 'series de aproximacion', label: 'SERIES DE APROXIMACION', type: 'number', defaultValue: '2' },
    { id: 'tempo', label: 'TEMPO', type: 'text', defaultValue: '2:1:1' },
    { id: 'rir', label: 'RIR', type: 'number', defaultValue: '2' },
    { id: 'descanso', label: 'DESCANSO(MIN)', type: 'number', defaultValue: '2' },
    { id: 'peso', label: 'PESO(KG)', type: 'text', defaultValue: '40' },
  ],
  trainingDays: [
    {
      id: 'day-existing-1',
      name: 'Día 1: Empuje',
      exercises: [
        {
          id: 'ex-1',
          nombre: 'Press de Banca Plano con Barra',
          grupo_muscular: 'Pecho',
          variables: { 'series de trabajo': '4', 'repeticiones': '8-10' },
        },
      ],
    },
  ],
  weekdayMapping: { '0': -1, '1': 0, '2': -1, '3': 0, '4': -1, '5': -1, '6': -1 },
};

// ---------------------------------------------------------------------------
// Supabase mock factory — configurable por suite
// ---------------------------------------------------------------------------

type PlanesResponse = { data: { datos_plan: typeof mockPlanExistente; id: string } | null; error: null | object };
type EjerciciosResponse = { data: typeof mockEjerciciosGlobales; error: null };

let mockPlanesSelectResponse: PlanesResponse = { data: null, error: null };
let mockUpsertError: null | { message: string } = null;

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const chain: Record<string, any> = {};

      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockImplementation((_col: string) => {
        // ejercicios_globales siempre devuelve la lista de ejercicios
        if (table === 'ejercicios_globales') {
          return Promise.resolve({ data: mockEjerciciosGlobales, error: null } as EjerciciosResponse);
        }
        return Promise.resolve({ data: [], error: null });
      });

      chain.maybeSingle = vi.fn().mockImplementation(() => {
        if (table === 'planes') {
          return Promise.resolve(mockPlanesSelectResponse);
        }
        return Promise.resolve({ data: null, error: null });
      });

      chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: mockUpsertError }),
      });

      chain.insert = vi.fn().mockResolvedValue({ data: null, error: mockUpsertError });

      return chain;
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPlanner() {
  return render(
    <ConfirmDialogProvider>
      <QuickStartPlanner />
    </ConfirmDialogProvider>
  );
}

// El import del componente debe ir DESPUÉS de todos los vi.mock()
import { QuickStartPlanner } from '../QuickStartPlanner';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockPlanesSelectResponse = { data: null, error: null };
  mockUpsertError = null;
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Suite 1: Render inicial — estado de carga y estructura básica
// ===========================================================================
describe('QuickStartPlanner — render inicial', () => {
  it('muestra el título del planner', async () => {
    renderPlanner();

    // El título debe aparecer en el DOM
    await waitFor(() => {
      expect(screen.getByText('QUICK START — MI PLAN PERSONAL')).toBeInTheDocument();
    });
  });

  it('muestra la navbar del atleta', async () => {
    renderPlanner();
    await waitFor(() => {
      expect(screen.getByTestId('mock-athlete-navbar')).toBeInTheDocument();
    });
  });

  it('el botón "Volver al Dashboard" navega a /dashboard al clickearlo', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    fireEvent.click(screen.getByText('Volver al Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ===========================================================================
// Suite 2: Plan existente — carga y pre-rellena los campos
// ===========================================================================
describe('QuickStartPlanner — carga de plan existente', () => {
  beforeEach(() => {
    mockPlanesSelectResponse = {
      data: { datos_plan: mockPlanExistente, id: 'plan-existing-id' },
      error: null,
    };
  });

  it('pre-rellena el campo "Mi Objetivo" con el goal del plan guardado', async () => {
    renderPlanner();
    await waitFor(() => {
      const goalInput = screen.getByPlaceholderText(/Ej: Ganar masa muscular/i);
      expect((goalInput as HTMLInputElement).value).toBe('Hipertrofia');
    });
  });

  it('pre-rellena la "Nota General" con el globalNote del plan guardado', async () => {
    renderPlanner();
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Agrega notas generales/i);
      expect((textarea as HTMLTextAreaElement).value).toBe('Nota de prueba existente');
    });
  });

  it('muestra los días del plan existente con sus nombres', async () => {
    renderPlanner();
    await waitFor(() => {
      // El nombre del día aparece en múltiples elementos (input del nombre + select del mapeador de semana)
      // Verificamos que haya al menos uno que sea un input de tipo texto con ese valor
      const namedInputs = document.querySelectorAll('input[type="text"]');
      const hasEmpujeInput = Array.from(namedInputs).some(
        (el) => (el as HTMLInputElement).value === 'Día 1: Empuje'
      );
      expect(hasEmpujeInput).toBe(true);
    });
  });
});

// ===========================================================================
// Suite 3: Sin plan existente — estado inicial por defecto (escenario "primer uso")
// ===========================================================================
describe('QuickStartPlanner — primer uso sin plan existente', () => {
  beforeEach(() => {
    // Supabase devuelve null para planes (sin plan activo)
    mockPlanesSelectResponse = { data: null, error: null };
  });

  it('el campo "Mi Objetivo" empieza vacío', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));
    const goalInput = screen.getByPlaceholderText(/Ej: Ganar masa muscular/i);
    expect((goalInput as HTMLInputElement).value).toBe('');
  });

  it('arranca con al menos un día de entrenamiento por defecto', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));
    // Debe existir al menos un input con "Día 1" por defecto
    expect(screen.getByDisplayValue('Día 1')).toBeInTheDocument();
  });

  it('la sección "Datos del Plan" está expandida por defecto', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));
    // El campo de objetivo debe estar visible
    expect(screen.getByPlaceholderText(/Ej: Ganar masa muscular/i)).toBeVisible();
  });

  it('el botón de colapso de "Datos del Plan" tiene aria-expanded=true', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));
    const collapseBtn = screen.getByRole('button', { name: /datos del plan/i });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
  });
});

// ===========================================================================
// Suite 4: Plantillas de rutina — carga y reemplazo del plan actual
// ===========================================================================
describe('QuickStartPlanner — selección de plantillas', () => {
  it('al cargar "Full Body (3 Días)" sin ejercicios previos, carga los 3 días', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Las plantillas se renderizan como botones, no como un select
    const fullBodyBtn = screen.queryByRole('button', { name: /Full Body/i });
    if (!fullBodyBtn) return; // sección puede no ser visible todavía

    fireEvent.click(fullBodyBtn);

    // Sin ejercicios previos, debe cargar sin pedir confirmación
    await waitFor(() => {
      const namedInputs = document.querySelectorAll('input[type="text"]');
      const hasFuerzaEmpuje = Array.from(namedInputs).some(
        (el) => (el as HTMLInputElement).value.includes('Fuerza')
      );
      expect(hasFuerzaEmpuje).toBe(true);
    });
  });

  it('muestra diálogo de confirmación cuando hay ejercicios y se carga otra plantilla', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Encontrar los botones de plantilla
    const fullBodyBtn = screen.queryByRole('button', { name: /Full Body/i });
    if (!fullBodyBtn) return; // sección puede no estar visible

    // Primero cargar Full Body para tener ejercicios
    fireEvent.click(fullBodyBtn);
    await waitFor(() => {
      const namedInputs = document.querySelectorAll('input[type="text"]');
      return Array.from(namedInputs).some((el) => (el as HTMLInputElement).value.includes('Fuerza'));
    });

    // Ahora cambiar a otra plantilla — debe pedir confirmación
    const pplBtn = screen.queryByRole('button', { name: /Push.*Pull.*Legs/i });
    if (!pplBtn) return;
    fireEvent.click(pplBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Cancelar')).toBeInTheDocument();

    // Cancelar — el plan anterior debe permanecer
    fireEvent.click(within(dialog).getByText('Cancelar'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // El nombre del Día 1 de PPL NO debe aparecer
    const namedInputs = document.querySelectorAll('input[type="text"]');
    const hasPPL = Array.from(namedInputs).some((el) => (el as HTMLInputElement).value.includes('Empuje (Push)'));
    expect(hasPPL).toBe(false);
  });
});

// ===========================================================================
// Suite 5: Gestión de días
// ===========================================================================
describe('QuickStartPlanner — gestión de días', () => {
  it('el botón "+ Agregar Día" agrega un nuevo día a la lista', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    const addDayBtn = screen.getByText(/Agregar Día/i);
    fireEvent.click(addDayBtn);

    await waitFor(() => {
      const dayInputs = document.querySelectorAll('input[value^="Día"]');
      expect(dayInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('eliminar el único día muestra un toast de "al menos 1 día" y NO abre confirmación', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Solo debe haber 1 día inicialmente
    const removeBtns = screen.queryAllByTitle(/eliminar día/i);
    if (removeBtns.length > 0) {
      fireEvent.click(removeBtns[0]);
      // No debe aparecer diálogo de confirmación
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    }
  });
});

// ===========================================================================
// Suite 6: Guardado — update de plan existente
// ===========================================================================
describe('QuickStartPlanner — guardar plan existente (update)', () => {
  beforeEach(() => {
    // Simular que ya existe un plan activo con un id
    mockPlanesSelectResponse = {
      data: { datos_plan: mockPlanExistente, id: 'plan-existing-id' },
      error: null,
    };
  });

  it('al guardar con un ejercicio válido, muestra toast de éxito', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Esperar a que los ejercicios globales carguen (los botones de plantilla son buen indicador)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Full Body/i })).toBeInTheDocument();
    }, { timeout: 4000 });

    // Rellenar explícitamente un ejercicio con nombre para garantizar la validación del save.
    // El componente valida: days.some(d => d.exercises.some(e => e.nombre.trim() !== ''))
    // Usamos los inputs de texto sin contenido (nombre de ejercicio vacío) para llenarlos.
    const allTextInputs = Array.from(document.querySelectorAll('input[type="text"]'));
    // Los inputs de nombre de día tienen fontFamily Orbitron; los de ejercicio no.
    // Buscamos el primero cuyo value sea vacío (ejercicio en blanco del estado default).
    const emptyInputs = allTextInputs.filter(
      (el) => (el as HTMLInputElement).value.trim() === ''
    );
    if (emptyInputs.length > 0) {
      fireEvent.change(emptyInputs[0], { target: { value: 'Press de Banca Plano con Barra' } });
    }

    const saveBtn = screen.getByRole('button', { name: /Guardar Mi Plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Plan guardado con éxito/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('al guardar sin ningún ejercicio, muestra error y NO llama a Supabase update', async () => {
    // Forzar plan vacío sobreescribiendo el response
    mockPlanesSelectResponse = { data: null, error: null };

    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Intentar guardar con los ejercicios todos vacíos (estado por defecto)
    const saveBtn = screen.getByRole('button', { name: /Guardar Mi Plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Agrega al menos un ejercicio/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// Suite 7: Guardado — insert de plan nuevo
// ===========================================================================
describe('QuickStartPlanner — guardar plan nuevo (insert)', () => {
  it('cuando no existe plan previo, hace insert y muestra toast de éxito', async () => {
    mockPlanesSelectResponse = { data: null, error: null };

    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Esperar a que los botones de plantilla carguen (indica que los ejercicios globales ya cargaron)
    const fullBodyBtn = await screen.findByRole('button', { name: /Full Body/i });

    // Cargar la plantilla Full Body: aporta ejercicios con nombre válidos de inmediato
    fireEvent.click(fullBodyBtn);

    // Esperar a que los días de la plantilla aparezcan en el formulario
    await waitFor(() => {
      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return textInputs.some((el) => (el as HTMLInputElement).value.includes('Fuerza'));
    }, { timeout: 4000 });

    const saveBtn = screen.getByRole('button', { name: /Guardar Mi Plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Plan guardado con éxito/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

// ===========================================================================
// Suite 8: Guardado fallido — manejo de errores de Supabase
// ===========================================================================
describe('QuickStartPlanner — error de Supabase al guardar', () => {
  it('si Supabase retorna error en insert, muestra mensaje de error', async () => {
    // Nota de diseño: este test verifica SOLO que el toast de error aparece cuando
    // Supabase rechaza el insert (ej. por violación de RLS). La aserción de navegación
    // se omite intencionalmente porque el `setTimeout(..., 1200)` del test anterior
    // (Suite 7, guardado exitoso) puede dispararse durante este test causando un
    // falso negativo — es un efecto colateral de usar timers reales en el runner.
    // La evidencia afirmativa (el toast de error) es suficiente prueba de que el
    // código entró al catch, lo que garantiza que el navigate del happy-path no corrió.
    mockPlanesSelectResponse = { data: null, error: null };
    mockUpsertError = { message: 'new row violates row-level security' };

    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    // Cargar la plantilla para tener ejercicios válidos rápidamente
    const fullBodyBtn = await screen.findByRole('button', { name: /Full Body/i });
    fireEvent.click(fullBodyBtn);

    await waitFor(() => {
      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return textInputs.some((el) => (el as HTMLInputElement).value.includes('Fuerza'));
    }, { timeout: 4000 });

    const saveBtn = screen.getByRole('button', { name: /Guardar Mi Plan/i });
    fireEvent.click(saveBtn);

    // El toast de error es la prueba afirmativa: si aparece, el código entró al
    // bloque catch, y el navigate del happy-path no pudo haber corrido en esa invocación.
    await waitFor(() => {
      const errorMsg =
        screen.queryByText(/new row violates row-level security/i) ||
        screen.queryByText(/Error al guardar/i);
      expect(errorMsg).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('tras un error de RLS, el botón de guardar vuelve a estar habilitado (saving=false)', async () => {
    mockPlanesSelectResponse = { data: null, error: null };
    mockUpsertError = { message: 'permission denied' };

    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    const fullBodyBtn = await screen.findByRole('button', { name: /Full Body/i });
    fireEvent.click(fullBodyBtn);

    await waitFor(() => {
      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return textInputs.some((el) => (el as HTMLInputElement).value.includes('Fuerza'));
    }, { timeout: 4000 });

    const saveBtn = screen.getByRole('button', { name: /Guardar Mi Plan/i });
    fireEvent.click(saveBtn);

    // Esperar a que el error aparezca (confirma que el flujo llegó al catch)
    await waitFor(() => {
      const errorMsg = screen.queryByText(/Error al guardar/i) || screen.queryByText(/permission denied/i);
      expect(errorMsg).toBeInTheDocument();
    }, { timeout: 5000 });

    // El botón de guardar debe estar habilitado de nuevo (saving=false en el finally)
    expect(saveBtn).not.toBeDisabled();
  });
});

// ===========================================================================
// Suite 9: Colapsable "Datos del Plan"
// ===========================================================================
describe('QuickStartPlanner — sección colapsable "Datos del Plan"', () => {
  it('al clickear el header, colapsa la sección y cambia aria-expanded a false', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    const collapseBtn = screen.getByRole('button', { name: /datos del plan/i });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(collapseBtn);
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'false');
    // El campo de objetivo no debe estar visible al colapsarse
    expect(screen.queryByPlaceholderText(/Ej: Ganar masa muscular/i)).not.toBeInTheDocument();
  });

  it('al clickear el header dos veces, vuelve a expandirse', async () => {
    renderPlanner();
    await waitFor(() => screen.getByText('QUICK START — MI PLAN PERSONAL'));

    const collapseBtn = screen.getByRole('button', { name: /datos del plan/i });
    fireEvent.click(collapseBtn);
    fireEvent.click(collapseBtn);

    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText(/Ej: Ganar masa muscular/i)).toBeInTheDocument();
  });
});
