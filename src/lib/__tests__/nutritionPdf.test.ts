// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderNutritionPDFDoc,
  createNutritionPDFBlob,
  createNutritionPDFFile,
  generateNutritionPDF,
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
});
