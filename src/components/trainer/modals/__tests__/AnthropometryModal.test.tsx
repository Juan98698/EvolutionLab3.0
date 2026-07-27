// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnthropometryModal from '../AnthropometryModal';
import { Profile } from '../../../../types/database.types';

// Mock Supabase
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

// Mock html2canvas y jspdf
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,12345'),
    height: 1000,
    width: 800,
  }),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

const mockAthlete: Profile = {
  id: 'athlete-1',
  email: 'atleta@test.com',
  nombre: 'Veronika Echeverri',
  rol: 'cliente',
  modalidad: 'remoto',
  objetivo: 'Recomposición Corporal',
};

const mockTrainer: Profile = {
  id: 'trainer-1',
  email: 'trainer@test.com',
  nombre: 'Entrenador Pro',
  rol: 'entrenador',
  marca: {
    nombre_display: 'NUTRIFIT EVOLUTION',
    eslogan: 'Ciencia del Deporte',
    color_primario: '#00d4ff',
    color_secundario: '#1e293b',
    tipografia: 'Orbitron',
  },
};

describe('AnthropometryModal Component', () => {
  it('renderiza correctamente cuando isOpen es true', () => {
    render(
      <AnthropometryModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={mockTrainer}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByText(/VALORACIÓN ANTROPOMÉTRICA & MACROS/i)).toBeInTheDocument();
    expect(screen.getByText(/Veronika Echeverri/i)).toBeInTheDocument();
  });

  it('permite cambiar de método antropométrico en el desplegable', () => {
    render(
      <AnthropometryModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={mockTrainer}
        showToast={vi.fn()}
      />
    );

    const select = screen.getAllByRole('combobox')[0];
    expect(select).toHaveValue('Yuhasz');

    fireEvent.change(select, { target: { value: 'ISAK' } });
    expect(select).toHaveValue('ISAK');

    // Al seleccionar ISAK debe mostrar los campos avanzados (Estatura sentado)
    expect(screen.getByText(/ESTATURA SENTADO/i)).toBeInTheDocument();
  });

  it('navega entre las pestañas (Medidas, Macros, Resultados)', () => {
    render(
      <AnthropometryModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={mockTrainer}
        showToast={vi.fn()}
      />
    );

    const btnMacros = screen.getAllByText(/2. BALANCE Y MACROS/i)[0];
    fireEvent.click(btnMacros);
    expect(screen.getByText(/BMR \(Gasto Basal\)/i)).toBeInTheDocument();

    const btnResultados = screen.getAllByText(/3. RESULTADOS & SOMATOCARTA/i)[0];
    fireEvent.click(btnResultados);
    expect(screen.getAllByText(/SOMATOCARTA HEATH-CARTER/i)[0]).toBeInTheDocument();
  });
});
