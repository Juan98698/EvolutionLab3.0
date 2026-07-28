// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ExerciseLibrary } from '../ExerciseLibrary';
import { BrowserRouter } from 'react-router-dom';

// Mocks
vi.mock('../../common/AthleteNavbar', () => ({
  default: () => <div data-testid="athlete-navbar">Athlete Navbar</div>,
}));

vi.mock('../../common/BodyMuscleMap', () => ({
  default: ({ onSelectMuscle }: { onSelectMuscle: (m: string | null) => void }) => (
    <div data-testid="body-muscle-map">
      <button onClick={() => onSelectMuscle('Pecho')}>Filtrar Pecho</button>
      <button onClick={() => onSelectMuscle(null)}>Todos</button>
    </div>
  ),
}));

const mockProfile = {
  id: 'user-123',
  nombre: 'Juan Manuel',
  rol: 'cliente',
  suscripcion_plan: 'iniciacion',
};

const mockExercises = [
  {
    id: '1',
    nombre: 'Press de Banca Plano con Barra',
    grupo_muscular: 'Pecho',
    imagen_url: 'https://cdn.fit/press.jpg',
    gif_url: 'https://cdn.fit/press.gif',
    descripcion: 'Empuje horizontal básico para pectoral mayor.',
  },
  {
    id: '2',
    nombre: 'Sentadilla Libre con Barra',
    grupo_muscular: 'Cuádriceps',
    imagen_url: 'https://cdn.fit/squat.jpg',
    gif_url: 'https://cdn.fit/squat.gif',
    descripcion: 'Dominante de rodilla básico para cuádriceps.',
  },
];

let mockSupabaseSelectResponse = { data: mockExercises, error: null };

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: { id: 'user-123', email: 'trainer@example.com' },
    profile: mockProfile,
  }),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockImplementation((cb) => cb(mockSupabaseSelectResponse)),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseSelectResponse = { data: mockExercises, error: null };
});

afterEach(cleanup);

const renderLibrary = () => {
  return render(
    <BrowserRouter>
      <ExerciseLibrary />
    </BrowserRouter>
  );
};

describe('ExerciseLibrary Component', () => {
  it('renderiza el Navbar de atleta cuando el rol es cliente', async () => {
    renderLibrary();

    expect(screen.getByTestId('athlete-navbar')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/BIBLIOTECA DE EJERCICIOS/i)).toBeInTheDocument();
    });
  });

  it('renderiza el Header de Entrenador (sin AthleteNavbar) cuando el rol es entrenador', async () => {
    mockProfile.rol = 'entrenador';
    renderLibrary();

    expect(screen.queryByTestId('athlete-navbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /← Volver al Panel/i })).toBeInTheDocument();
    mockProfile.rol = 'cliente';
  });

  it('permite buscar ejercicios por nombre de forma insensible a mayúsculas/tildes', async () => {
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText('Press de Banca Plano con Barra')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar ejercicio/i);
    fireEvent.change(searchInput, { target: { value: 'sentadilla' } });

    await waitFor(() => {
      expect(screen.getByText('Sentadilla Libre con Barra')).toBeInTheDocument();
      expect(screen.queryByText('Press de Banca Plano con Barra')).not.toBeInTheDocument();
    });
  });

  it('filtra ejercicios por grupo muscular seleccionado desde BodyMuscleMap', async () => {
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText('Press de Banca Plano con Barra')).toBeInTheDocument();
    });

    const pechoBtn = screen.getByRole('button', { name: /Filtrar Pecho/i });
    fireEvent.click(pechoBtn);

    await waitFor(() => {
      expect(screen.getByText('Press de Banca Plano con Barra')).toBeInTheDocument();
      expect(screen.queryByText('Sentadilla Libre con Barra')).not.toBeInTheDocument();
    });
  });

  it('abre el visor de GIF al hacer clic en un ejercicio y permite cerrar la vista previa', async () => {
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText('Press de Banca Plano con Barra')).toBeInTheDocument();
    });

    // Encontrar el botón de ver GIF / imagen
    const gifBtns = screen.getAllByRole('button', { name: /ver gif/i });
    expect(gifBtns.length).toBeGreaterThan(0);

    fireEvent.click(gifBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Empuje horizontal básico para pectoral mayor/i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
