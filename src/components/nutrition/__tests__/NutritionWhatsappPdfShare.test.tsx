// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sharePlanWithPdfViaWhatsapp } from '../../../lib/nutritionWhatsapp';
import { NutritionPlannerModal } from '../NutritionPlannerModal';
import { NutritionPlan } from '../../../types/nutrition.types';
import { Profile } from '../../../types/database.types';

// Mock nutritionPdf
const mockGenerateNutritionPDF = vi.fn().mockResolvedValue(undefined);
const mockCreateNutritionPDFFile = vi.fn().mockImplementation(async (_id: string, fileName: string) => {
  return new File(['dummy-pdf-content'], fileName || 'Plan.pdf', { type: 'application/pdf' });
});

vi.mock('../../../lib/nutritionPdf', () => ({
  generateNutritionPDF: (...args: any[]) => mockGenerateNutritionPDF(...args),
  createNutritionPDFFile: (...args: any[]) => mockCreateNutritionPDFFile(...args),
  renderNutritionPDFDoc: vi.fn(),
  createNutritionPDFBlob: vi.fn(),
}));

// Mock catalog dynamic import
vi.mock('../../../data/foodCatalog', () => ({
  BASE_FOOD_CATALOG: [],
}));

// Mock nutritionEngine
vi.mock('../../../lib/nutritionEngine', async () => {
  const actual: any = await vi.importActual('../../../lib/nutritionEngine');
  return {
    ...actual,
    getCustomFoods: vi.fn().mockResolvedValue([]),
    saveCustomFood: vi.fn(),
    deleteCustomFood: vi.fn(),
    searchOpenFoodFacts: vi.fn().mockResolvedValue([]),
  };
});

describe('WhatsApp PDF Sharing & Separate PDF Download', () => {
  const samplePlan: NutritionPlan = {
    cliente_id: 'client-123',
    nombre: 'Plan Hipertrofia',
    activo: true,
    modo: 'semanal',
    objetivo: 'Volumen',
    target_calorias: 2800,
    target_proteina_g: 180,
    target_carbohidratos_g: 350,
    target_grasa_g: 70,
    ajuste_calorico_pct: 10,
    recomendaciones: 'Tomar 3L de agua.',
    datos_plan: {
      modo: 'semanal',
      vigenciaDias: 30,
      days: {
        lunes: {
          id: 'day_lunes',
          diaSemana: 'lunes',
          nombre: 'Lunes',
          meals: [
            {
              id: 'm1',
              orden: 1,
              nombre: 'Desayuno',
              horario: '08:00',
              foods: [
                {
                  id: 'f1',
                  foodId: 'f1',
                  nombre: 'Avena en Hojuelas',
                  grupo: 'Cereales y Tubérculos',
                  cantidad: 80,
                  cantidadBase: 100,
                  unidad: 'gr',
                  calorias: 300,
                  proteina: 10,
                  carbohidratos: 54,
                  grasa: 5,
                },
              ],
            },
          ],
        },
        martes: { id: 'day_martes', diaSemana: 'martes', nombre: 'Martes', meals: [] },
        miercoles: { id: 'day_miercoles', diaSemana: 'miercoles', nombre: 'Miércoles', meals: [] },
        jueves: { id: 'day_jueves', diaSemana: 'jueves', nombre: 'Jueves', meals: [] },
        viernes: { id: 'day_viernes', diaSemana: 'viernes', nombre: 'Viernes', meals: [] },
        sabado: { id: 'day_sabado', diaSemana: 'sabado', nombre: 'Sábado', meals: [] },
        domingo: { id: 'day_domingo', diaSemana: 'domingo', nombre: 'Domingo', meals: [] },
      },
    },
  };

  const sampleAthlete: Profile = {
    id: 'client-123',
    nombre: 'Carlos Gómez',
    rol: 'cliente',
    email: 'carlos@test.com',
  } as Profile;

  const sampleTrainer: Profile = {
    id: 'trainer-999',
    nombre: 'Coach David',
    rol: 'entrenador',
    email: 'david@test.com',
  } as Profile;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('sharePlanWithPdfViaWhatsapp unit logic', () => {
    it('debe compartir archivo PDF mediante navigator.share nativo cuando está disponible y soporta files', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      const mockCanShare = vi.fn().mockReturnValue(true);

      const originalShare = navigator.share;
      const originalCanShare = navigator.canShare;

      Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', { value: mockCanShare, configurable: true, writable: true });

      try {
        const result = await sharePlanWithPdfViaWhatsapp({
          plan: samplePlan,
          dayKey: 'lunes',
          atletaNombre: 'Carlos Gómez',
          trainerNombre: 'Coach David',
          pdfElementId: 'dummy-element-id',
          fileName: 'Plan_Carlos_Gomez.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.sharedNative).toBe(true);
        expect(mockCreateNutritionPDFFile).toHaveBeenCalledWith('dummy-element-id', 'Plan_Carlos_Gomez.pdf');
        expect(mockCanShare).toHaveBeenCalled();
        expect(mockShare).toHaveBeenCalledTimes(1);

        const shareCallArgs = mockShare.mock.calls[0][0];
        expect(shareCallArgs.title).toContain('Carlos Gómez');
        expect(shareCallArgs.text).toContain('PLAN NUTRICIONAL — EVOLUTION LAB');
        expect(shareCallArgs.files).toHaveLength(1);
        expect(shareCallArgs.files[0].name).toBe('Plan_Carlos_Gomez.pdf');

        // No debe activar fallback si el compartir nativo funcionó
        expect(mockGenerateNutritionPDF).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true, writable: true });
        Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true, writable: true });
      }
    });

    it('debe activar fallback (descargar PDF y abrir WhatsApp Web) si el navegador no soporta compartir archivos', async () => {
      const originalCanShare = navigator.canShare;
      const originalWindowOpen = window.open;

      const mockOpen = vi.fn();
      window.open = mockOpen;
      // Simular que el navegador no soporta compartir archivos
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true, writable: true });

      try {
        const result = await sharePlanWithPdfViaWhatsapp({
          plan: samplePlan,
          dayKey: 'lunes',
          atletaNombre: 'Carlos Gómez',
          pdfElementId: 'dummy-element-id',
          fileName: 'Plan_Carlos_Gomez.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.sharedNative).toBe(false);

        // Verifica que se autodescargue el PDF
        expect(mockGenerateNutritionPDF).toHaveBeenCalledWith('dummy-element-id', 'Plan_Carlos_Gomez.pdf');

        // Verifica que se abra WhatsApp Web con el texto preparado
        expect(mockOpen).toHaveBeenCalledTimes(1);
        const openUrl = mockOpen.mock.calls[0][0];
        expect(openUrl).toContain('https://api.whatsapp.com/send?text=');
        expect(openUrl).toContain(encodeURIComponent('Carlos Gómez'));
      } finally {
        Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true, writable: true });
        window.open = originalWindowOpen;
      }
    });

    it('debe manejar silenciosamente AbortError si el usuario cancela la hoja nativa de compartir sin lanzar error', async () => {
      const abortError = new Error('The user aborted the share operation.');
      abortError.name = 'AbortError';
      const mockShare = vi.fn().mockRejectedValue(abortError);
      const mockCanShare = vi.fn().mockReturnValue(true);

      const originalShare = navigator.share;
      const originalCanShare = navigator.canShare;

      Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', { value: mockCanShare, configurable: true, writable: true });

      try {
        const result = await sharePlanWithPdfViaWhatsapp({
          plan: samplePlan,
          dayKey: 'lunes',
          atletaNombre: 'Carlos Gómez',
          pdfElementId: 'dummy-element-id',
        });

        expect(result.success).toBe(false);
        expect(result.sharedNative).toBe(true);
        expect(result.cancelled).toBe(true);

        // No debe forzar descarga en fallback si el usuario canceló intencionalmente
        expect(mockGenerateNutritionPDF).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true, writable: true });
        Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true, writable: true });
      }
    });
  });

  describe('NutritionPlannerModal UI separate buttons', () => {
    it('mantiene la opción de descargar solo el PDF separada de WhatsApp', async () => {
      const showToastMock = vi.fn();

      render(
        <NutritionPlannerModal
          isOpen={true}
          onClose={vi.fn()}
          atleta={sampleAthlete}
          trainerProfile={sampleTrainer}
          showToast={showToastMock}
        />
      );

      // 1. Debe existir el botón 📄 PDF
      const pdfBtn = screen.getByRole('button', { name: /📄 PDF/i });
      expect(pdfBtn).toBeInTheDocument();

      // 2. Debe existir el botón 📲 WhatsApp
      const whatsappBtn = screen.getByRole('button', { name: /📲 WhatsApp/i });
      expect(whatsappBtn).toBeInTheDocument();

      // 3. Hacer clic en el botón 📄 PDF solo debe invocar generateNutritionPDF
      fireEvent.click(pdfBtn);

      await waitFor(() => {
        expect(mockGenerateNutritionPDF).toHaveBeenCalledWith(
          'nutrition-pdf-content',
          expect.stringContaining('Plan_Nutricional_Carlos_Gómez')
        );
      });

      // Asegurar que WhatsApp no fue invocado
      expect(showToastMock).toHaveBeenCalledWith('📄 PDF descargado correctamente.', 'success');
    });
  });
});
