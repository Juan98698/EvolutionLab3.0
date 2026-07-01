// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import RegisterSessionModal from '../modals/RegisterSessionModal';
import type { Profile } from '../../../types/database.types';

// Mock de Supabase — retorna null por defecto (atleta sin plan activo en BD)
// Esto es equivalente al patron usado en PlanPlanner.test.tsx
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

/** Perfil mínimo de atleta para los tests */
const mockAthlete: Profile = {
  id: 'athlete-1',
  nombre: 'Juan Pérez',
  email: 'juan@test.com',
  modalidad: 'presencial',
  rol: 'cliente',
} as Profile;

/** Helper: renderiza el modal abierto con props mínimas */
function renderModal(overrides: {
  isOpen?: boolean;
  athlete?: Profile | null;
} = {}) {
  const isOpen = overrides.isOpen ?? true;
  const athlete = overrides.athlete ?? mockAthlete;
  const onClose = vi.fn();
  const fetchAuditoria = vi.fn();
  const showToast = vi.fn();

  const utils = render(
    <RegisterSessionModal
      isOpen={isOpen}
      onClose={onClose}
      selectedAthleteForSession={athlete}
      fetchAuditoria={fetchAuditoria}
      showToast={showToast}
    />
  );
  return { ...utils, onClose, fetchAuditoria, showToast };
}

// ---------------------------------------------------------------------------
// Suite 1: Visibilidad
// ---------------------------------------------------------------------------

describe('RegisterSessionModal — visibilidad', () => {
  afterEach(cleanup);

  it('isOpen=false → no renderiza el modal', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('REGISTRAR ENTRENAMIENTO')).toBeNull();
  });

  it('athlete=null con isOpen=true → no renderiza el modal', () => {
    renderModal({ isOpen: true, athlete: null });
    expect(screen.queryByText('REGISTRAR ENTRENAMIENTO')).toBeNull();
  });

  it('isOpen=true con atleta → muestra el título y el nombre del atleta', async () => {
    renderModal({ isOpen: true });
    // Esperar a que el useEffect async termine para evitar warnings de act()
    await waitFor(() => {
      expect(screen.getByText(/REGISTRAR ENTRENAMIENTO/i)).toBeDefined();
    });
    expect(screen.getByText('Juan Pérez')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Buscador de ejercicios (autocomplete)
// ---------------------------------------------------------------------------

describe('RegisterSessionModal — buscador de ejercicios (autocomplete)', () => {
  afterEach(cleanup);

  it('query < 2 chars: escribir "P" → no muestra sugerencias', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    const input = screen.getByPlaceholderText(/Escribe el ejercicio/);
    fireEvent.change(input, { target: { value: 'P' } });

    // No debe haber ningún div con sugerencias (con emoji 🏋️)
    expect(screen.queryByText(/🏋️ Press de Banca/i)).toBeNull();
  });

  it('query >= 2 chars que coincide: escribir "Pre" → aparece "Press de Banca Plano con Barra"', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    const input = screen.getByPlaceholderText(/Escribe el ejercicio/);
    fireEvent.change(input, { target: { value: 'Pre' } });

    // Las sugerencias son sincrónicas (filtrado inline)
    expect(screen.getByText(/Press de Banca Plano/i)).toBeDefined();
  });

  it('clic en una sugerencia → agrega el ejercicio y deja el input vacío', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    const input = screen.getByPlaceholderText(/Escribe el ejercicio/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Pre' } });

    // Clic en la sugerencia (aparece con emoji)
    const suggestion = screen.getByText(/Press de Banca Plano/i);
    fireEvent.click(suggestion);

    // El ejercicio debe aparecer en la sección EJERCICIOS COMPLETADOS (1)
    expect(screen.getByText(/EJERCICIOS COMPLETADOS \(1\)/)).toBeDefined();

    // El input queda vacío
    expect(input.value).toBe('');
  });

  it('botón "Añadir" agrega el ejercicio con el nombre escrito', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    const input = screen.getByPlaceholderText(/Escribe el ejercicio/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Mi ejercicio personalizado' } });

    // El botón "Añadir" aparece cuando hay texto en el input
    const addBtn = screen.getByText('Añadir');
    fireEvent.click(addBtn);

    // Debe aparecer en la lista
    expect(screen.getByText(/EJERCICIOS COMPLETADOS \(1\)/)).toBeDefined();
    // El input queda vacío
    expect(input.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Gestión de series por ejercicio
// ---------------------------------------------------------------------------

describe('RegisterSessionModal — gestión de series por ejercicio', () => {
  afterEach(cleanup);

  /** Helper: monta el modal y agrega un ejercicio "Sentadilla" */
  async function renderWithExercise() {
    const result = renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    const input = screen.getByPlaceholderText(/Escribe el ejercicio/);
    fireEvent.change(input, { target: { value: 'Sentadilla' } });
    fireEvent.click(screen.getByText('Añadir'));

    return result;
  }

  it('el componente inicializa con 3 series por defecto', async () => {
    await renderWithExercise();
    // Deben existir "Serie 1:", "Serie 2:", "Serie 3:"
    expect(screen.getByText(/Serie 1:/)).toBeDefined();
    expect(screen.getByText(/Serie 2:/)).toBeDefined();
    expect(screen.getByText(/Serie 3:/)).toBeDefined();
    expect(screen.queryByText(/Serie 4:/)).toBeNull();
  });

  it('botón "➕ Añadir Serie" → clic → aparece "Serie 4:"', async () => {
    await renderWithExercise();
    fireEvent.click(screen.getByText('➕ Añadir Serie'));
    expect(screen.getByText(/Serie 4:/)).toBeDefined();
  });

  it('con 3 series: botón "➖ Quitar Serie" aparece (ex.series.length > 1)', async () => {
    await renderWithExercise();
    expect(screen.getByText('➖ Quitar Serie')).toBeDefined();
  });

  it('clic en "➖ Quitar Serie" → desaparece "Serie 3:"', async () => {
    await renderWithExercise();
    fireEvent.click(screen.getByText('➖ Quitar Serie'));
    expect(screen.queryByText(/Serie 3:/)).toBeNull();
    expect(screen.getByText(/Serie 2:/)).toBeDefined();
  });

  it('con exactamente 1 serie: botón "➖ Quitar Serie" NO aparece', async () => {
    await renderWithExercise();
    // Quitar serie dos veces (3 → 2 → 1)
    fireEvent.click(screen.getByText('➖ Quitar Serie'));
    fireEvent.click(screen.getByText('➖ Quitar Serie'));
    // Ahora sólo hay 1 serie, el botón no debe aparecer
    expect(screen.queryByText('➖ Quitar Serie')).toBeNull();
  });

  it('botón "✕ Eliminar Ejercicio" → clic → el ejercicio desaparece y muestra "No hay ejercicios"', async () => {
    await renderWithExercise();
    fireEvent.click(screen.getByText('✕ Eliminar Ejercicio'));
    expect(screen.getByText(/No hay ejercicios en la lista/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Validación al guardar
// ---------------------------------------------------------------------------

describe('RegisterSessionModal — validación al guardar', () => {
  afterEach(cleanup);

  it('submit con 0 ejercicios → showToast con mensaje de error sobre "un ejercicio"', async () => {
    const { showToast } = renderModal();
    await waitFor(() => screen.getByText(/REGISTRAR ENTRENAMIENTO/i));

    // Bypassear el botón y hacer submit directo al form para evitar bloqueo de validation HTML5
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(showToast).toHaveBeenCalledTimes(1);
    const [msg, type] = showToast.mock.calls[0];
    expect(msg).toMatch(/un ejercicio/i);
    expect(type).toBe('error');
  });

  it('submit con 1 ejercicio pero campos vacíos → showToast con el nombre del ejercicio', async () => {
    const { showToast } = renderModal();
    await waitFor(() => screen.getByPlaceholderText(/Escribe el ejercicio/));

    // Agregar un ejercicio (series vacías por defecto)
    const input = screen.getByPlaceholderText(/Escribe el ejercicio/);
    fireEvent.change(input, { target: { value: 'Sentadilla' } });
    fireEvent.click(screen.getByText('Añadir'));

    // Intentar guardar haciendo submit directo al form
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(showToast).toHaveBeenCalledTimes(1);
    const [msg, type] = showToast.mock.calls[0];
    // El mensaje debe incluir el nombre del ejercicio
    expect(msg).toMatch(/Sentadilla/i);
    expect(type).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Cierre del modal
// ---------------------------------------------------------------------------

describe('RegisterSessionModal — cierre', () => {
  afterEach(cleanup);

  it('botón "Cancelar" → clic → onClose llamado', async () => {
    const { onClose } = renderModal();
    await waitFor(() => screen.getByText('Cancelar'));

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('botón "×" → clic → onClose llamado', async () => {
    const { onClose } = renderModal();
    await waitFor(() => screen.getByText(/REGISTRAR ENTRENAMIENTO/i));

    // El botón × usa &times; que se renderiza como el carácter ×
    const closeBtn =
      screen.queryByRole('button', { name: /×/ }) ??
      screen.getAllByRole('button').find((b: HTMLElement) => b.textContent === '×') ??
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '×');

    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
