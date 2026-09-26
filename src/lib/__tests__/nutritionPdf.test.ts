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

    it('nunca deja el título de recomendaciones huérfano al final de la página si los párrafos no caben', () => {
      // Caso idéntico a la captura: al final de la página 4 hay una fila de alimentos (Y=50 a Y=880).
      // La tarjeta de recomendaciones empieza en Y=910, su título termina en Y=945, pero el primer
      // párrafo no cabe antes de Y=1000 (de Y=955 a Y=1080).
      // El algoritmo DEBE cortar antes de Y=910 para mover la tarjeta y su título íntegros a la siguiente página.
      const blocks = [
        { top: 50, bottom: 880, type: 'equiv-card' },
        { top: 910, bottom: 1600, type: 'recommendations-card' },
        { top: 920, bottom: 945, type: 'rec-header' },
        { top: 955, bottom: 1080, type: 'rec-para' },
        { top: 1090, bottom: 1200, type: 'rec-para' },
        { top: 1210, bottom: 1350, type: 'rec-para' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1600,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      expect(slices.length).toBe(2);
      // La página 1 debe terminar antes de 910 (antes de recommendations-card y su título)
      expect(slices[0].sourceH).toBeLessThan(910);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(880);

      // La página 2 comienza donde terminó la página 1, llevando el título y todos sus párrafos juntos
      expect(slices[1].sourceY).toBe(slices[0].sourceH);
    });

    it('anti-orphan guard previene que un corte ingenuo corte justo después de rec-header', () => {
      // Supongamos que naiveCutY cae exactamente a 950 (justo después del título rec-header en 920-945)
      // y no hay ningún párrafo que quepa en la página actual.
      const blocks = [
        { top: 100, bottom: 800, type: 'meal-card' },
        { top: 890, bottom: 1500, type: 'recommendations-card' },
        { top: 900, bottom: 940, type: 'rec-header' },
        { top: 960, bottom: 1100, type: 'rec-para' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1500,
        canvasWidth: 800,
        pageCanvasHeight: 950, // naiveCutY = 950, corta justo después de rec-header
        blocks,
        topPaddingPx: 30,
      });

      // El guardián anti-huérfano debe forzar el corte antes de recommendations-card (890)
      expect(slices[0].sourceH).toBeLessThan(890);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(800);
    });

    it('mueve una meal-card (Cena) completa a la siguiente página sin fragmentar su cabecera ni filas', () => {
      // Caso idéntico a la captura 1: al final de la página 3 está Almuerzo/Merienda (Y=100 a Y=870).
      // Cena empieza en Y=890 y termina en Y=1150 (cruza naiveCutY = 1000).
      // Debe cortar antes de Y=890 para que la Cena entera empiece en la página 4.
      const blocks = [
        { top: 100, bottom: 870, type: 'meal-card' },
        { top: 890, bottom: 1150, type: 'meal-card' },
        { top: 890, bottom: 930, type: 'meal-header' },
        { top: 935, bottom: 980, type: 'meal-row' },
        { top: 985, bottom: 1040, type: 'meal-row' },
        { top: 1045, bottom: 1100, type: 'meal-row' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1400,
        canvasWidth: 800,
        pageCanvasHeight: 1000,
        blocks,
        topPaddingPx: 30,
      });

      expect(slices.length).toBe(2);
      expect(slices[0].sourceH).toBeLessThan(890);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(870);
      expect(slices[1].sourceY).toBe(slices[0].sourceH);
    });

    it('anti-orphan guard previene que un corte ingenuo corte justo después de meal-header', () => {
      const blocks = [
        { top: 100, bottom: 850, type: 'meal-card' },
        { top: 890, bottom: 1200, type: 'meal-card' },
        { top: 890, bottom: 940, type: 'meal-header' },
        { top: 960, bottom: 1050, type: 'meal-row' },
      ];

      const slices = calculatePdfSlices({
        canvasHeight: 1400,
        canvasWidth: 800,
        pageCanvasHeight: 950, // naiveCutY corta después de meal-header
        blocks,
        topPaddingPx: 30,
      });

      expect(slices[0].sourceH).toBeLessThan(890);
      expect(slices[0].sourceH).toBeGreaterThanOrEqual(850);
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

    it('utiliza fallback con offsetTop y offsetHeight si getBoundingClientRect retorna altura 0 (entornos móviles / offscreen)', () => {
      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, height: 0 }); // Simula culling de Chromium móvil
      Object.defineProperty(container, 'offsetHeight', { value: 600, configurable: true });

      const mealCard = document.createElement('div');
      mealCard.setAttribute('data-pdf-block', 'meal-card');
      mealCard.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, bottom: 0, height: 0 });
      Object.defineProperty(mealCard, 'offsetTop', { value: 120, configurable: true });
      Object.defineProperty(mealCard, 'offsetHeight', { value: 200, configurable: true });
      container.appendChild(mealCard);

      // canvasHeight = 1200, scale = 1200 / 600 = 2
      const boundaries = extractPdfBlockBoundaries(container, 1200);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]).toEqual({
        top: 120 * 2,
        bottom: (120 + 200) * 2,
        type: 'meal-card',
      });
    });

    it('retorna coordenadas 1:1 en píxeles CSS sin escalar si canvasHeight es 0 (para uso en onclone)', () => {
      const container = document.createElement('div');
      container.getBoundingClientRect = vi.fn().mockReturnValue({ top: 50, height: 400 });

      const card = document.createElement('div');
      card.setAttribute('data-pdf-block', 'meal-card');
      card.getBoundingClientRect = vi.fn().mockReturnValue({ top: 80, bottom: 220, height: 140 });
      container.appendChild(card);

      // canvasHeight = 0 -> scale = 1
      const boundaries = extractPdfBlockBoundaries(container, 0);

      expect(boundaries).toHaveLength(1);
      expect(boundaries[0]).toEqual({
        top: 30, // 80 - 50
        bottom: 170, // 220 - 50
        type: 'meal-card',
      });
    });

    it('renderNutritionPDFDoc invoca onclone, configura el ancho en 794px y extrae límites del clonedDoc', async () => {
      const div = document.createElement('div');
      div.id = 'nutrition-pdf-content';
      document.body.appendChild(div);

      let capturedOnclone: ((clonedDoc: any) => void) | undefined;
      vi.mocked(html2canvas).mockImplementation(async (_el: any, options: any) => {
        capturedOnclone = options?.onclone;
        if (capturedOnclone) {
          const fakeClonedElement = document.createElement('div');
          fakeClonedElement.id = 'nutrition-pdf-content';
          Object.defineProperty(fakeClonedElement, 'offsetHeight', { value: 1000, configurable: true });

          const fakeMeal = document.createElement('div');
          fakeMeal.setAttribute('data-pdf-block', 'meal-card');
          Object.defineProperty(fakeMeal, 'offsetTop', { value: 100, configurable: true });
          Object.defineProperty(fakeMeal, 'offsetHeight', { value: 200, configurable: true });
          fakeClonedElement.appendChild(fakeMeal);

          const fakeClonedDoc = {
            getElementById: vi.fn().mockReturnValue(fakeClonedElement),
            querySelector: vi.fn().mockReturnValue(fakeClonedElement),
          };
          capturedOnclone(fakeClonedDoc);

          // Verificar que onclone forzó el ancho a 794px
          expect(fakeClonedElement.style.width).toBe('794px');
          expect(fakeClonedElement.style.minWidth).toBe('794px');
        }

        return {
          width: 800,
          height: 2000,
          getContext: vi.fn().mockReturnValue(null),
          toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,data'),
        } as any;
      });

      const pdf = await renderNutritionPDFDoc('nutrition-pdf-content');
      expect(pdf).toBeDefined();
      expect(capturedOnclone).toBeDefined();
    });
  });
});
