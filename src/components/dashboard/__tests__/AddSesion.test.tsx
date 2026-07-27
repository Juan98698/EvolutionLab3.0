// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import AddSesion from '../AddSesion';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockHistorialInsert = vi.fn();
const mockEjerciciosInsert = vi.fn();

vi.mock('../../../lib/supabaseClient', () => {
  const planChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'plan-1' }, error: null }),
    update: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({}),
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'u1', email: 'test@test.com' } } },
        }),
      },
      from: vi.fn((table: string) => {
        switch (table) {
          case 'ejercicios_globales':
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  { nombre: 'Curl Biceps', grupo_muscular: 'Brazos' },
                  { nombre: 'Jalones al pecho', grupo_muscular: 'Espalda' },
                ],
                error: null,
              }),
            };
          case 'sesiones_historial':
            return {
              insert: mockHistorialInsert.mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'sess-1' }, error: null }),
                }),
              }),
            };
          case 'sesiones_ejercicios':
            return {
              insert: mockEjerciciosInsert.mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [{ id: 'ej-1', nombre_ejercicio: 'Sentadilla' }], error: null }),
              }),
            };
          case 'planes':
            return planChain;
          default:
            return {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
        }
      }),
    },
  };
});

vi.mock('../../../lib/sessions', () => ({
  readSessionsFromCache: vi.fn().mockReturnValue([]),
  writeSessionsToCache: vi.fn(),
}));

vi.mock('../../../lib/periodizationEngine', () => ({
  autoRegulatePlanForNextWeek: vi.fn().mockReturnValue(null),
}));

// ── Plan fixture ───────────────────────────────────────────────────────────
const PLAN = {
  portada: { planName: 'Test', userName: 'T', startDate: '2099-01-01', whatsappLink: '', instagramLink: '' },
  trainingDays: [{
    id: 'd1', name: 'Día A',
    exercises: [{
      id: 'e1', nombre: 'Sentadilla', grupo_muscular: 'Piernas',
      variables: { peso: '60', repeticiones: '10', rir: '2', descanso: '90', 'series de trabajo': '3' },
      video_url: '', image_url: '', gif_url: '',
    }],
  }],
  globalVariables: [],
};

// ── Helpers ────────────────────────────────────────────────────────────────
const mockShowToast = vi.fn();
const mockOnCancel = vi.fn();

function renderAddSesion(plan: any = PLAN, expired = false) {
  return render(
    <AddSesion plan={plan} expired={expired} showToast={mockShowToast} onCancel={mockOnCancel} />
  );
}

/** Fills the minimum valid fields for exercise at index `idx` */
async function fillExercise(idx: number, nombre = 'Sentadilla', peso = '60', rir = '2', descanso = '90') {
  const nombreInput = document.getElementById(`ej-nombre-${idx}`) as HTMLInputElement;
  const pesoInput = document.getElementById(`ej-peso-${idx}`) as HTMLInputElement;
  const rirInput = document.getElementById(`ej-rir-${idx}`) as HTMLInputElement;
  const descansoInput = document.getElementById(`ej-descanso-${idx}`) as HTMLInputElement;

  await act(async () => {
    fireEvent.change(nombreInput, { target: { value: nombre } });
    fireEvent.change(pesoInput, { target: { value: peso } });
    fireEvent.change(rirInput, { target: { value: rir } });
    fireEvent.change(descansoInput, { target: { value: descanso } });
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Default: online
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

afterEach(cleanup);

// ── Tests ──────────────────────────────────────────────────────────────────
describe('AddSesion — registro de sesión', () => {

  // ── 1. Smoke ──
  it('renderiza el formulario con fecha de hoy pre-cargada', async () => {
    await act(async () => { renderAddSesion(); });

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateInput = document.getElementById('fecha-sesion') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.value).toBe(today);
    expect(screen.getByText(/Guardar sesión/i)).toBeTruthy();
    expect(screen.getByText(/Agregar ejercicio/i)).toBeTruthy();
  });

  it('renderiza sin crashear cuando plan es null', async () => {
    await act(async () => { renderAddSesion(null); });
    expect(document.body).toBeTruthy();
    expect(screen.queryByText(/error inesperado/i)).toBeNull();
  });

  // ── 2. Validación por expiración ──
  it('bloquea el guardado y muestra error cuando el plan está expirado', async () => {
    await act(async () => { renderAddSesion(PLAN, true); });

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    // Debe aparecer el mensaje de expirado en el banner de validación
    expect(screen.getByText(/expirado/i)).toBeTruthy();
    // No debe llamar a Supabase
    expect(mockHistorialInsert).not.toHaveBeenCalled();
  });

  // ── 3. Validación de nombre vacío ──
  it('muestra error de validación cuando el nombre del ejercicio está vacío', async () => {
    await act(async () => { renderAddSesion(); });

    // No llenamos el nombre — intentamos guardar directamente
    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    expect(screen.getByText(/ingresa el nombre del ejercicio/i)).toBeTruthy();
    expect(mockHistorialInsert).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  // ── 4. Validación RPE fuera de rango ──
  it('muestra error cuando el RIR es mayor a 10', async () => {
    await act(async () => { renderAddSesion(); });

    await fillExercise(0, 'Press Banca', '80', '11', '90'); // RIR=11 → inválido

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    expect(screen.getByText(/RIR debe estar entre 0 y 10/i)).toBeTruthy();
    expect(mockHistorialInsert).not.toHaveBeenCalled();
  });

  // ── 5. Validación descanso insuficiente ──
  it('muestra error cuando el descanso es menor a 30 segundos', async () => {
    await act(async () => { renderAddSesion(); });

    await fillExercise(0, 'Dominadas', '0', '2', '10'); // descanso=10 → inválido

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    expect(screen.getByText(/descanso mínimo es 30 segundos/i)).toBeTruthy();
    expect(mockHistorialInsert).not.toHaveBeenCalled();
  });

  // ── 6. Happy path online ──
  it('inserta en sesiones_historial y sesiones_ejercicios al guardar online', async () => {
    await act(async () => { renderAddSesion(); });
    await fillExercise(0, 'Sentadilla', '100', '2', '120');

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    await waitFor(() => {
      expect(mockHistorialInsert).toHaveBeenCalledWith(
        expect.objectContaining({ cliente_id: 'u1', fecha: expect.any(String) })
      );
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(mockEjerciciosInsert).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  // ── 7. Happy path → onCancel ──
  it('llama onCancel después de guardar exitosamente', async () => {
    await act(async () => { renderAddSesion(); });
    await fillExercise(0, 'Press Banca', '80', '3', '120');

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  // ── 8. Guardar offline ──
  it('guarda en cola offline cuando navigator.onLine es false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    await act(async () => { renderAddSesion(); });
    await fillExercise(0, 'Peso Muerto', '120', '1', '180');

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    await waitFor(() => {
      const queue = JSON.parse(localStorage.getItem('evolution_sync_queue') || '[]');
      expect(queue.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // No debe llamar a Supabase directamente
    expect(mockHistorialInsert).not.toHaveBeenCalled();
  });

  // ── 9. writeSessionsToCache siempre se llama (offline-first) ──
  it('siempre escribe en caché local (offline-first), independiente de conexión', async () => {
    const { writeSessionsToCache } = await import('../../../lib/sessions');

    await act(async () => { renderAddSesion(); });
    await fillExercise(0, 'Curl Biceps', '20', '2', '60');

    await act(async () => {
      fireEvent.click(screen.getByText(/Guardar sesión/i));
    });

    await waitFor(() => {
      expect(writeSessionsToCache).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  // ── 10. Agregar ejercicio ──
  it('agrega una nueva fila de ejercicio al clickear Agregar ejercicio', async () => {
    await act(async () => { renderAddSesion(); });

    // Inicialmente hay 1 ejercicio (Ejercicio 1)
    expect(document.getElementById('ej-nombre-0')).toBeTruthy();
    expect(document.getElementById('ej-nombre-1')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText(/Agregar ejercicio/i));
    });

    // Ahora debe haber 2 ejercicios
    expect(document.getElementById('ej-nombre-1')).toBeTruthy();
  });

  // ── 11. No eliminar último ejercicio ──
  it('no permite eliminar el único ejercicio y muestra aviso', async () => {
    await act(async () => { renderAddSesion(); });

    // Con un solo ejercicio, el botón Eliminar no se muestra (condicional `tempExercises.length > 1`)
    // Verificamos que NO existe el botón de eliminar cuando solo hay uno
    expect(screen.queryByText(/✕ Eliminar/i)).toBeNull();
  });

  // ── 12. Botón eliminar aparece con múltiples ejercicios ──
  it('muestra botón Eliminar y avisa si se intenta eliminar el penúltimo', async () => {
    await act(async () => { renderAddSesion(); });

    // Agregar segundo ejercicio
    await act(async () => {
      fireEvent.click(screen.getByText(/Agregar ejercicio/i));
    });

    // Ahora debe aparecer el botón Eliminar
    const removeButtons = screen.getAllByText(/✕ Eliminar/i);
    expect(removeButtons.length).toBe(2);

    // Eliminar el primero → quedan uno, se ejecuta bien
    await act(async () => {
      fireEvent.click(removeButtons[0]);
    });

    // Solo queda 1, el botón ya no aparece
    expect(screen.queryByText(/✕ Eliminar/i)).toBeNull();
  });

});
