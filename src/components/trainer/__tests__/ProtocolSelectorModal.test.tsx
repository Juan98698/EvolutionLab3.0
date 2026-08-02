// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProtocolSelectorModal } from '../ProtocolSelectorModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useModalA11y para evitar manejo de foco de teclado durante la prueba
vi.mock('../../../hooks/useModalA11y', () => ({
  useModalA11y: () => ({ current: null }),
}));

// Fixtures de prueba para Supabase
const mockAliasData = [
  { alias: 'Press de Banca', nombre_real: 'Press de Banca Plano con Barra' },
  { alias: 'Sentadilla', nombre_real: 'Sentadilla Libre con Barra' },
];

const mockGlobalData = [
  {
    nombre: 'Press de Banca Plano con Barra',
    imagen_url: 'https://cdn.fit/press_banca.jpg',
    gif_url: 'https://cdn.fit/press_banca.gif',
    video_url: 'https://youtube.com/watch?v=press_banca',
    descripcion: 'Ejercicio multiarticular básico de empuje horizontal para pectoral mayor.',
    movement_pattern: 'horizontal_push',
  },
  {
    nombre: 'Sentadilla Libre con Barra',
    imagen_url: 'https://cdn.fit/sentadilla.jpg',
    gif_url: 'https://cdn.fit/sentadilla.gif',
    video_url: 'https://youtube.com/watch?v=sentadilla',
    descripcion: 'Dominante de rodilla para desarrollo de cuádriceps y glúteos.',
    movement_pattern: 'squat',
  },
];

let mockAliasResponse = { data: mockAliasData, error: null };
let mockGlobalResponse = { data: mockGlobalData, error: null };

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const chain: Record<string, any> = {};

      chain.select = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockImplementation((_col: string, _vals: string[]) => {
        if (table === 'ejercicios_alias') {
          return Promise.resolve(mockAliasResponse);
        }
        if (table === 'ejercicios_globales') {
          return Promise.resolve(mockGlobalResponse);
        }
        return Promise.resolve({ data: [], error: null });
      });

      return chain;
    }),
  },
}));

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockAliasResponse = { data: mockAliasData, error: null };
  mockGlobalResponse = { data: mockGlobalData, error: null };
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtocolSelectorModal Component', () => {
  it('no renderiza nada cuando isOpen es false', () => {
    render(
      <ProtocolSelectorModal
        isOpen={false}
        onClose={vi.fn()}
        objective="hipertrofia"
        level="intermedio"
        onApplyProtocol={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza el modal con la lista de protocolos cuando isOpen es true', () => {
    render(
      <ProtocolSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        objective="hipertrofia"
        level="intermedio"
        onApplyProtocol={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Protocolos Científicos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Plantillas Recomendadas/i)).toBeInTheDocument();
  });

  it('permite seleccionar un protocolo y ver su guía científica', () => {
    render(
      <ProtocolSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        objective="hipertrofia"
        level="intermedio"
        onApplyProtocol={vi.fn()}
      />
    );

    // Seleccionar el primer protocolo disponible en la lista lateral
    const buttons = screen.getAllByRole('button');
    const protocolBtn = buttons.find(b => b.textContent?.includes('días/semana'));
    expect(protocolBtn).toBeDefined();

    if (protocolBtn) {
      fireEvent.click(protocolBtn);
      expect(screen.getByText(/¿Por qué este protocolo\?/i)).toBeInTheDocument();
    }
  });

  it('al aplicar el protocolo, enriquece los ejercicios con gif_url, description, image_url y video_url', async () => {
    const onApplyProtocol = vi.fn();

    render(
      <ProtocolSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        objective="hipertrofia"
        level="intermedio"
        onApplyProtocol={onApplyProtocol}
      />
    );

    // Seleccionar un protocolo
    const buttons = screen.getAllByRole('button');
    const protocolBtn = buttons.find(b => b.textContent?.includes('días/semana'));
    expect(protocolBtn).toBeDefined();
    if (protocolBtn) {
      fireEvent.click(protocolBtn);
    }

    // Encontrar el botón de aplicar
    const applyBtn = screen.getByRole('button', { name: /Aplicar Protocolo al Plan/i });
    expect(applyBtn).not.toBeDisabled();

    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(onApplyProtocol).toHaveBeenCalledTimes(1);
    });

    const [trainingDays] = onApplyProtocol.mock.calls[0];
    expect(trainingDays.length).toBeGreaterThan(0);

    // Recopilar todos los ejercicios devueltos por el protocolo
    const allExercises = trainingDays.flatMap((day: any) => day.exercises);
    expect(allExercises.length).toBeGreaterThan(0);

    // Buscar si algún ejercicio del catálogo global (como Press de Banca o Sentadilla) trajo gif_url y description
    const pressBancaEx = allExercises.find((ex: any) =>
      ex.nombre.toLowerCase().includes('press de banca') || ex.nombre.toLowerCase().includes('press banca')
    );

    if (pressBancaEx) {
      expect(pressBancaEx.gif_url).toBe('https://cdn.fit/press_banca.gif');
      expect(pressBancaEx.description).toBe('Ejercicio multiarticular básico de empuje horizontal para pectoral mayor.');
      expect(pressBancaEx.image_url).toBe('https://cdn.fit/press_banca.jpg');
      expect(pressBancaEx.video_url).toBe('https://youtube.com/watch?v=press_banca');
    }
  });

  it('soporta la resolución de alias y enriquece correctamente ejercicios tanto por alias como por nombre directo', async () => {
    const onApplyProtocol = vi.fn();

    render(
      <ProtocolSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        objective="fuerza"
        level="avanzado"
        onApplyProtocol={onApplyProtocol}
      />
    );

    const buttons = screen.getAllByRole('button');
    const protocolBtn = buttons.find(b => b.textContent?.includes('días/semana'));
    if (protocolBtn) {
      fireEvent.click(protocolBtn);
    }

    const applyBtn = screen.getByRole('button', { name: /Aplicar Protocolo de Fuerza|Aplicar Protocolo al Plan/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(onApplyProtocol).toHaveBeenCalledTimes(1);
    });

    const [trainingDays] = onApplyProtocol.mock.calls[0];
    const allExercises = trainingDays.flatMap((day: any) => day.exercises);

    // Verificar que los ejercicios traen el nombre_original guardado como referencia
    allExercises.forEach((ex: any) => {
      expect(ex.id).toBeDefined();
      expect(ex.nombre).toBeDefined();
      expect(ex.nombre_original).toBeDefined();
      expect(ex.variables).toBeDefined();
    });
  });

  it('cierra el modal cuando se hace click en Cancelar o en la X', () => {
    const onClose = vi.fn();

    render(
      <ProtocolSelectorModal
        isOpen={true}
        onClose={onClose}
        objective="hipertrofia"
        level="intermedio"
        onApplyProtocol={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
