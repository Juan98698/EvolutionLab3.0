// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ActiveSession from '../ActiveSession';
import { lbsToKg, kgToLbs } from '../../../lib/exerciseUtils';
import { readSessionsFromCache } from '../../../lib/sessions';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dayIndex: '0' }),
  useNavigate: () => mockNavigate,
}));

// Mock Supabase client
const mockInsert = vi.fn().mockResolvedValue({ data: { id: 123 }, error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null })
});
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' }
          }
        }
      })
    },
    from: vi.fn((table) => {
      if (table === 'sesiones_historial' || table === 'sesiones_ejercicios') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null })
            })
          })
        };
      }
      if (table === 'planes') {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: { id: 'test-plan-id', datos_plan: {} }, error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'test-plan-id', datos_plan: {} }, error: null });
        return {
          update: mockUpdate,
          ...chain
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
      };
    })
  }
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

describe('ActiveSession - Weight Stepper & KG/LBS Capture Unit Tests', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();

    global.window.alert = vi.fn();
    global.navigator.vibrate = vi.fn() as any;

    const mockPlan = {
      id: 'test-plan-id',
      periodizationConfig: { enabled: true },
      trainingDays: [
        {
          name: 'Día 1: Fuerza',
          exercises: [
            {
              nombre: 'Press de Banca Plano',
              grupo_muscular: 'Pecho',
              variables: {
                'series de trabajo': '2',
                'repeticiones': '10',
                'peso': '80',
                'descanso': '90',
                'rir': '2'
              }
            }
          ]
        }
      ]
    };

    localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlan));
  });

  describe('1. Utilidades Matemáticas de Conversión (lbsToKg & kgToLbs)', () => {
    it('convierte libras a kilogramos con precisión limpia a 1 decimal', () => {
      expect(lbsToKg(190)).toBe(86.2);
      expect(lbsToKg(100)).toBe(45.4);
      expect(lbsToKg(220.46)).toBe(100);
      expect(lbsToKg(0)).toBe(0);
      expect(lbsToKg(null)).toBe(0);
      expect(lbsToKg('190')).toBe(86.2);
    });

    it('convierte kilogramos a libras para referencia visual del atleta', () => {
      expect(kgToLbs(80)).toBe(176.4);
      expect(kgToLbs(87.5)).toBe(192.9);
      expect(kgToLbs(100)).toBe(220.5);
      expect(kgToLbs(0)).toBe(0);
      expect(kgToLbs(undefined)).toBe(0);
      expect(kgToLbs('80')).toBe(176.4);
    });
  });

  describe('2. Micro-botones Stepper de Peso (+/-) y disponibilidad del teclado', () => {
    it('muestra los micro-botones [-2.5] y [+2.5] en modo KG y permite abrir el teclado en el input', () => {
      render(<ActiveSession />);

      // Verificar que los botones stepper existen
      const decBtn = screen.getByRole('button', { name: /Reducir peso serie 1/i });
      const incBtn = screen.getByRole('button', { name: /Aumentar peso serie 1/i });
      expect(decBtn).toBeTruthy();
      expect(incBtn).toBeTruthy();
      expect(decBtn.textContent).toBe('−2.5');
      expect(incBtn.textContent).toBe('+2.5');

      // Verificar que el input de peso está presente, con inputMode decimal y editable por teclado
      const pesoInput = screen.getByRole('textbox', { name: /Peso serie 1/i }) as HTMLInputElement;
      expect(pesoInput).toBeTruthy();
      expect(pesoInput.getAttribute('inputmode')).toBe('decimal');

      // Simular que el atleta abre el teclado y escribe directamente un peso arbitrario (ej. 85)
      fireEvent.change(pesoInput, { target: { value: '85' } });
      expect(pesoInput.value).toBe('85');
    });

    it('incrementa y decrementa en pasos de 2.5 kg con un solo toque sin abrir teclado', () => {
      render(<ActiveSession />);

      const pesoInput = screen.getByRole('textbox', { name: /Peso serie 1/i }) as HTMLInputElement;
      const decBtn = screen.getByRole('button', { name: /Reducir peso serie 1/i });
      const incBtn = screen.getByRole('button', { name: /Aumentar peso serie 1/i });

      // Si el input está vacío, al presionar [+2.5] parte del peso sugerido (80 kg) y pasa a 82.5 kg
      fireEvent.click(incBtn);
      expect(pesoInput.value).toBe('82.5');

      // Al presionar de nuevo pasa a 85 kg
      fireEvent.click(incBtn);
      expect(pesoInput.value).toBe('85');

      // Al presionar [-2.5] baja a 82.5 kg
      fireEvent.click(decBtn);
      expect(pesoInput.value).toBe('82.5');
    });

    it('no permite valores negativos al decrementar el peso', () => {
      render(<ActiveSession />);

      const pesoInput = screen.getByRole('textbox', { name: /Peso serie 1/i }) as HTMLInputElement;
      const decBtn = screen.getByRole('button', { name: /Reducir peso serie 1/i });

      // Escribir 1 kg
      fireEvent.change(pesoInput, { target: { value: '1' } });
      expect(pesoInput.value).toBe('1');

      // Decrementar: 1 - 2.5 debe detenerse en 0
      fireEvent.click(decBtn);
      expect(pesoInput.value).toBe('0');
    });
  });

  describe('3. Selector de Unidad [ KG | LBS ] y Prevalencia Canónica en Kilos', () => {
    it('permite alternar entre KG y LBS y ajusta la etiqueta y los steppers a +/- 5 lbs', () => {
      render(<ActiveSession />);

      // Verificar botones de unidad
      const kgBtn = screen.getByRole('button', { name: /Seleccionar Kilos/i });
      const lbsBtn = screen.getByRole('button', { name: /Seleccionar Libras/i });
      expect(kgBtn).toBeTruthy();
      expect(lbsBtn).toBeTruthy();

      // Cambiar a LBS
      fireEvent.click(lbsBtn);

      // Ahora los steppers deben mostrar [-5] y [+5]
      const decBtn = screen.getByRole('button', { name: /Reducir peso serie 1/i });
      const incBtn = screen.getByRole('button', { name: /Aumentar peso serie 1/i });
      expect(decBtn.textContent).toBe('−5');
      expect(incBtn.textContent).toBe('+5');

      // El placeholder en LBS refleja el equivalente del peso sugerido (80 kg -> 176.4 lbs)
      const pesoInput = screen.getByRole('textbox', { name: /Peso serie 1/i }) as HTMLInputElement;
      expect(pesoInput.placeholder).toContain('176.4');
    });

    it('en modo LBS muestra la equivalencia en kilos en vivo y almacena prevalencia en KG al guardar la sesión', async () => {
      const { container } = render(<ActiveSession />);

      const lbsBtn = screen.getByRole('button', { name: /Seleccionar Libras/i });
      fireEvent.click(lbsBtn);

      const pesoInput = screen.getByRole('textbox', { name: /Peso serie 1/i }) as HTMLInputElement;

      // El atleta ingresa 190 lbs usando el teclado
      fireEvent.change(pesoInput, { target: { value: '190' } });
      expect(pesoInput.value).toBe('190');

      // Se muestra la equivalencia visual en vivo: "≈ 86.2 kg"
      expect(container.textContent).toContain('≈ 86.2 kg');

      // Marcar ambas series como completadas
      const checkBtn1 = screen.getByRole('button', { name: /Marcar serie 1 como completada/i });
      fireEvent.click(checkBtn1);

      const checkBtn2 = screen.getByRole('button', { name: /Marcar serie 2 como completada/i });
      fireEvent.click(checkBtn2);

      // Finalizar y guardar sesión
      const finishBtn = screen.getByRole('button', { name: /Finalizar sesión/i });
      fireEvent.click(finishBtn);

      // Verificar en la caché local que el peso guardado prevalece en KG (86.2 kg, no 190)
      await waitFor(() => {
        const cachedSessions = readSessionsFromCache();
        expect(cachedSessions.length).toBeGreaterThan(0);
        const savedEx = cachedSessions[cachedSessions.length - 1].ejercicios[0];
        expect(savedEx.peso).toBe(86.2); // Prevalencia canónica en KG
      });
    });
  });
});
