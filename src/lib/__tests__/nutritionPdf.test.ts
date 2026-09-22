// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderNutritionPDFDoc,
  createNutritionPDFBlob,
  createNutritionPDFFile,
  generateNutritionPDF,
  calculatePdfSlices,
  extractPdfBlockBoundaries,
} from '../nutritionPdf';
import html2canvas from 'html2canvas';

const mockAddImage = vi.fn();
const mockAddPage = vi.fn();
const mockSave = vi.fn();
const mockOutput = vi.fn().mockReturnValue(new Blob(['mock-pdf'], { type: 'application/pdf' }));

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      addImage: mockAddImage,
      addPage: mockAddPage,
      save: mockSave,
      output: mockOutput,
    })),
  };
});

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

describe('nutritionPdf — Multi-page rendering and export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('lanza un error si el elemento DOM no existe', async () => {
    await expect(renderNutritionPDFDoc('non-existent-id')).rejects.toThrow(
      'Elemento con ID non-existent-id no encontrado'
    );
  });

  it('genera un PDF de una sola página si el contenido cabe dentro de 297mm', async () => {
    const div = document.createElement('div');
    div.id = 'nutrition-pdf-content';
    document.body.appendChild(div);

    // Canvas de 800x1000 px:
    // Con pdfWidth = 210mm, totalPdfHeight = (1000 * 210) / 800 = 262.5 mm <= 297 mm
    const mockCanvas = {
      width: 800,
      height: 1000,
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,sample1'),
    };
    vi.mocked(html2canvas).mockResolvedValue(mockCanvas as any);

    const pdf = await renderNutritionPDFDoc('nutrition-pdf-content');

    expect(html2canvas).toHaveBeenCalledWith(div, expect.any(Object));
    expect(mockAddImage).toHaveBeenCalledTimes(1);
    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,sample1',
      'JPEG',
      0,
      0,
      210,
      262.5
    );
    expect(mockAddPage).not.toHaveBeenCalled();
    expect(pdf).toBeDefined();
  });

  it('pagina automáticamente cortando el canvas en franjas A4 cuando el contenido excede 297mm', async () => {
    const div = document.createElement('div');
    div.id = 'nutrition-pdf-content';
    document.body.appendChild(div);

    // Canvas de 800x2500 px:
    // totalPdfHeight = (2500 * 210) / 800 = 656.25 mm
    // totalPages = Math.ceil(656.25 / 297) = 3 páginas
    const mockCanvas = {
      width: 800,
      height: 2500,
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,full'),
    };
    vi.mocked(html2canvas).mockResolvedValue(mockCanvas as any);

    // Mock para los sliceCanvas creados en document.createElement('canvas')
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'canvas') {
        const mockCtx = {
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        };
        (el as any).getContext = vi.fn().mockReturnValue(mockCtx);
        (el as any).toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,slice');
      }
      return el;
    });

    const pdf = await renderNutritionPDFDoc('nutrition-pdf-content');

    // Debe haber llamado a addPage() para las páginas 2 y 3 (2 veces)
    expect(mockAddPage).toHaveBeenCalledTimes(2);

    // Debe haber llamado a addImage() 3 veces (una por cada página)
    expect(mockAddImage).toHaveBeenCalledTimes(3);
    expect(pdf).toBeDefined();
  });

  it('createNutritionPDFBlob genera un Blob binario válido', async () => {
    const div = document.createElement('div');
    div.id = 'test-content';
    document.body.appendChild(div);

    vi.mocked(html2canvas).mockResolvedValue({
      width: 800,
      height: 800,
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,blobtest'),
    } as any);

    const blob = await createNutritionPDFBlob('test-content');
    expect(blob).toBeInstanceOf(Blob);
    expect(mockOutput).toHaveBeenCalledWith('blob');
  });

  it('createNutritionPDFFile genera un archivo File para compartir', async () => {
    const div = document.createElement('div');
    div.id = 'test-content';
    document.body.appendChild(div);

    vi.mocked(html2canvas).mockResolvedValue({
      width: 800,
      height: 800,
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,filetest'),
    } as any);

    const file = await createNutritionPDFFile('test-content', 'Dieta_Atleta.pdf');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('Dieta_Atleta.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('generateNutritionPDF llama al método save() con el nombre de archivo indicado', async () => {
    const div = document.createElement('div');
    div.id = 'test-content';
    document.body.appendChild(div);

    vi.mocked(html2canvas).mockResolvedValue({
      width: 800,
      height: 800,
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,savetest'),
    } as any);

    await generateNutritionPDF('test-content', 'Plan_Personalizado.pdf');
    expect(mockSave).toHaveBeenCalledWith('Plan_Personalizado.pdf');
  });

  describe('calculatePdfSlices — Paginación inteligente y prevención de cortes', () => {
    it('retorna un único slice si la altura cabe en una página', () => {
      const slices = calculatePdfSlices({
        canvasHeight: 800,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
      });

      expect(slices).toEqual([{ sourceY: 0, sourceH: 800, topPadding: 0 }]);
    });

    it('corta antes de una tarjeta de comida si el corte ingenuo la atravesaría', () => {
      // Página de 1000px de altura. Tarjeta de comida de Y=850 a Y=1150 (cruza 1000px).
      // Debe cortar antes de la tarjeta (por ej. Y = 838), dejando la tarjeta entera en la página 2.
      const blocks = [
        { top: 100, bottom: 300, type: 'athlete-info' },
        { top: 320, bottom: 820, type: 'meal-card' },
        { top: 850, bottom: 1150, type: 'meal-card' }, // Atraviesa el corte ingenuo (1000)
        { top: 1180, bottom: 1500, type: 'meal-card' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1600,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      expect(slices.length).toBe(2);
      // Página 1 debe terminar antes de 850 (top de la tarjeta de comida)
      expect(slices[0].sourceH).toBeLessThan(850);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(830);

      // Página 2 debe comenzar exactamente donde terminó la página 1
      expect(slices[1].sourceY).toBe(slices[0].sourceH);
      expect(slices[1].topPadding).toBe(30);
    });

    it('corta antes de la caja de recomendaciones si no cabe al final de la página', () => {
      // Página de 1000px. Recomendaciones de Y=880 a Y=1250 (cruza 1000px).
      // Debe cortar antes de 880 para mover recomendaciones limpias a la siguiente página.
      const blocks = [
        { top: 50, bottom: 450, type: 'meal-card' },
        { top: 480, bottom: 860, type: 'meal-card' },
        { top: 880, bottom: 1250, type: 'recommendations-card' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1300,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      expect(slices.length).toBe(2);
      expect(slices[0].sourceH).toBeLessThan(880);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(860);
    });

    it('evita dejar un encabezado de día huérfano cerca del final de la página', () => {
      // day-header en Y=920 a Y=960. El corte ingenuo es 1000.
      // Quedan solo 40px, insuficiente para la comida del día.
      // Debe cortar antes de 920 para mover el día entero a la siguiente página.
      const blocks = [
        { top: 50, bottom: 880, type: 'meal-card' },
        { top: 920, bottom: 960, type: 'day-header' },
        { top: 980, bottom: 1300, type: 'meal-card' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1400,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      expect(slices.length).toBe(2);
      expect(slices[0].sourceH).toBeLessThan(920);
    });

    it('si una caja de recomendaciones es más alta que una página completa, corta entre párrafos rec-para', () => {
      // Caja de recomendaciones gigante desde Y=100 hasta Y=2500
      // No se puede mover entera a la página 2 porque no cabe ni en una página completa.
      // Debe cortar entre párrafos rec-para.
      const blocks = [
        { top: 100, bottom: 2500, type: 'recommendations-card' },
        { top: 150, bottom: 400, type: 'rec-para' },
        { top: 420, bottom: 700, type: 'rec-para' },
        { top: 720, bottom: 950, type: 'rec-para' }, // Último párrafo antes de 1000
        { top: 970, bottom: 1250, type: 'rec-para' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 2500,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      // El corte debe ocurrir después del párrafo que termina en 950
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(950);
      expect(slices[0].sourceH).toBeLessThan(970);
    });
  });

  describe('extractPdfBlockBoundaries — Detección de elementos DOM', () => {
    it('extrae las coordenadas relativas de los bloques con data-pdf-block', () => {
      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({ top: 100, height: 500 });

      const mealCard = document.createElement('div');
      mealCard.setAttribute('data-pdf-block', 'meal-card');
      mealCard.getBoundingClientRect = vi.fn().mockReturnValue({ top: 150, bottom: 250, height: 100 });
      container.appendChild(mealCard);

      const recCard = document.createElement('div');
      recCard.setAttribute('data-pdf-block', 'recommendations-card');
      recCard.getBoundingClientRect = vi.fn().mockReturnValue({ top: 300, bottom: 450, height: 150 });
      container.appendChild(recCard);

      // canvasHeight = 1000, escala = 1000 / 500 = 2
      const boundaries = extractPdfBlockBoundaries(container, 1000);

      expect(boundaries).toEqual([
        { top: (150 - 100) * 2, bottom: (250 - 100) * 2, type: 'meal-card' },
        { top: (300 - 100) * 2, bottom: (450 - 100) * 2, type: 'recommendations-card' },
      ]);
    });
  });
});
