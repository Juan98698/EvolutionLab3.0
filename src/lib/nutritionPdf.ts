import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfBlockBoundary {
  top: number;
  bottom: number;
  type: string;
}

export interface PdfSlice {
  sourceY: number;
  sourceH: number;
  topPadding: number;
}

/**
 * Extrae las coordenadas verticales de los bloques semánticos del DOM mapeadas a píxeles de canvas
 */
export function extractPdfBlockBoundaries(
  element: HTMLElement,
  canvasHeight: number
): PdfBlockBoundary[] {
  try {
    const parentRect = element.getBoundingClientRect();
    if (!parentRect || parentRect.height <= 0) return [];

    const scale = canvasHeight / parentRect.height;
    const blockElements = element.querySelectorAll<HTMLElement>('[data-pdf-block]');
    const boundaries: PdfBlockBoundary[] = [];

    blockElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        boundaries.push({
          top: Math.round((rect.top - parentRect.top) * scale),
          bottom: Math.round((rect.bottom - parentRect.top) * scale),
          type: el.getAttribute('data-pdf-block') || 'block',
        });
      }
    });

    return boundaries.sort((a, b) => a.top - b.top);
  } catch {
    return [];
  }
}

/**
 * Escanea el canvas buscando una fila horizontal de píxeles en blanco (#ffffff) cerca de targetY
 */
export function findWhiteRowNear(
  ctx: CanvasRenderingContext2D,
  width: number,
  targetY: number,
  searchWindowPx: number = 30
): number {
  try {
    const startY = Math.max(0, Math.floor(targetY - searchWindowPx));
    const endY = Math.floor(targetY);
    const height = endY - startY + 1;
    if (height <= 0 || width <= 0) return targetY;

    const imgData = ctx.getImageData(0, startY, width, height).data;
    for (let row = height - 1; row >= 0; row--) {
      let isWhite = true;
      const step = 4 * 15; // Muestrear cada 15px horizontalmente
      for (let x = 0; x < width * 4; x += step) {
        const idx = row * (width * 4) + x;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];
        // Si hay opacidad y no es blanco o casi blanco
        if (a > 200 && (r < 250 || g < 250 || b < 250)) {
          isWhite = false;
          break;
        }
      }
      if (isWhite) {
        return startY + row;
      }
    }
  } catch {
    // Si falla getImageData o el canvas es tainted, retornar targetY
  }
  return targetY;
}

/**
 * Calcula los cortes verticales óptimos para paginar el canvas sin fragmentar
 * tarjetas de comidas, cajas de recomendaciones, encabezados de día ni líneas de texto.
 */
export function calculatePdfSlices(options: {
  canvasHeight: number;
  canvasWidth: number;
  pageCanvasHeight: number;
  blocks?: PdfBlockBoundary[];
  topPaddingPx?: number;
  canvasCtx?: CanvasRenderingContext2D | null;
}): PdfSlice[] {
  const {
    canvasHeight,
    canvasWidth,
    pageCanvasHeight,
    blocks = [],
    topPaddingPx = 30,
    canvasCtx,
  } = options;

  const slices: PdfSlice[] = [];
  let currentY = 0;
  let pageIndex = 0;

  if (canvasHeight <= pageCanvasHeight) {
    return [{ sourceY: 0, sourceH: canvasHeight, topPadding: 0 }];
  }

  while (currentY < canvasHeight - 5) {
    const isFirstPage = pageIndex === 0;
    const topPadding = isFirstPage ? 0 : topPaddingPx;
    const maxSliceH = pageCanvasHeight - topPadding;
    const naiveCutY = currentY + maxSliceH;

    if (naiveCutY >= canvasHeight) {
      slices.push({
        sourceY: currentY,
        sourceH: canvasHeight - currentY,
        topPadding,
      });
      break;
    }

    let cutY = naiveCutY;

    if (blocks.length > 0) {
      // 1. Verificar si naiveCutY atraviesa un bloque atómico principal
      const slicedBlock = blocks.find(
        (b) =>
          b.top < naiveCutY &&
          b.bottom > naiveCutY &&
          (b.type === 'meal-card' ||
            b.type === 'recommendations-card' ||
            b.type === 'equivalents-section' ||
            b.type === 'equiv-card' ||
            b.type === 'day-header' ||
            b.type === 'athlete-info' ||
            b.type === 'daily-targets' ||
            b.type === 'header-branding')
      );

      if (slicedBlock) {
        const minContentOnPage = maxSliceH * 0.25;
        // Si cortar antes de este bloque deja al menos el 25% de la página ocupada,
        // movemos el bloque completo a la siguiente página.
        if (slicedBlock.top - currentY >= minContentOnPage) {
          // Si el bloque es una comida, verificar si tiene un encabezado de día inmediatamente previo
          // para no dejar el encabezado del día huérfano y aislado al fondo de la página
          const precedingDayHeader =
            slicedBlock.type === 'meal-card'
              ? blocks.find(
                  (b) =>
                    b.type === 'day-header' &&
                    b.bottom <= slicedBlock.top &&
                    slicedBlock.top - b.bottom < 80 &&
                    b.top - currentY >= minContentOnPage
                )
              : null;

          if (precedingDayHeader) {
            cutY = Math.max(currentY + 50, precedingDayHeader.top - 12);
          } else {
            cutY = Math.max(currentY + 50, slicedBlock.top - 12);
          }
        } else {
          // El bloque es muy largo o comenzó casi al inicio de la página:
          // Intentar cortar entre sub-bloques internos ('meal-row', 'rec-para' o 'equiv-row')
          const subBlocks = blocks.filter(
            (b) =>
              b.top >= slicedBlock.top &&
              b.bottom <= slicedBlock.bottom &&
              (b.type === 'meal-row' || b.type === 'rec-para' || b.type === 'equiv-row')
          );

          const candidateSub = [...subBlocks].reverse().find((sb) => sb.bottom <= naiveCutY);
          if (candidateSub && candidateSub.bottom - currentY >= minContentOnPage) {
            cutY = candidateSub.bottom + 4;
          }
        }
      } else {
        // 2. Comprobar si hay un encabezado de día (day-header) que quedaría huérfano cerca del fondo
        const orphanHeader = blocks.find(
          (b) =>
            b.type === 'day-header' &&
            b.top < naiveCutY &&
            b.bottom <= naiveCutY &&
            naiveCutY - b.bottom < 120
        );

        if (orphanHeader && orphanHeader.top - currentY >= maxSliceH * 0.25) {
          cutY = Math.max(currentY + 50, orphanHeader.top - 12);
        }
      }
    }

    // 3. Si disponemos de contexto de canvas, buscar una franja blanca exacta (#ffffff)
    if (canvasCtx && typeof canvasCtx.getImageData === 'function') {
      cutY = findWhiteRowNear(canvasCtx, canvasWidth, cutY, 30);
    }

    // Asegurar avance estricto para prevenir bucles
    if (cutY <= currentY + 30) {
      cutY = naiveCutY;
    }

    const actualSliceH = Math.min(cutY - currentY, canvasHeight - currentY);
    slices.push({
      sourceY: currentY,
      sourceH: actualSliceH,
      topPadding,
    });

    currentY += actualSliceH;
    pageIndex++;
  }

  return slices;
}

/**
 * Genera el documento jsPDF a partir de un elemento HTML del DOM
 */
export const renderNutritionPDFDoc = async (elementId: string): Promise<jsPDF> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Elemento con ID ${elementId} no encontrado para generar PDF.`);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1200,
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const totalPdfHeight = (canvas.height * pdfWidth) / canvas.width;

  if (totalPdfHeight <= pdfPageHeight) {
    // Si cabe en una sola página A4, estampar imagen directamente
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, totalPdfHeight);
  } else {
    // Multipágina inteligente: cortar respetando límites de elementos y agregando márgenes superiores
    const scaleFactor = canvas.width / pdfWidth;
    const pageCanvasHeight = pdfPageHeight * scaleFactor;
    const blocks = extractPdfBlockBoundaries(element, canvas.height);
    const canvasCtx = canvas.getContext ? canvas.getContext('2d') : null;

    const slices = calculatePdfSlices({
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      pageCanvasHeight,
      blocks,
      topPaddingPx: 30,
      canvasCtx,
    });

    for (let page = 0; page < slices.length; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const slice = slices[page];
      const sliceTotalH = slice.sourceH + slice.topPadding;
      const destH = sliceTotalH / scaleFactor;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceTotalH;
      const sliceCtx = sliceCanvas.getContext('2d');
      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0,
          slice.sourceY,
          canvas.width,
          slice.sourceH,
          0,
          slice.topPadding,
          canvas.width,
          slice.sourceH
        );
      }

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(sliceData, 'JPEG', 0, 0, pdfWidth, destH);
    }

    // Foliado / Numeración de páginas elegante en el pie si jsPDF lo soporta
    try {
      const pageCount = (pdf.internal as any).getNumberOfPages
        ? (pdf.internal as any).getNumberOfPages()
        : slices.length;
      if (typeof (pdf as any).setFontSize === 'function' && typeof (pdf as any).text === 'function') {
        for (let p = 1; p <= pageCount; p++) {
          pdf.setPage(p);
          pdf.setFontSize(8);
          if (typeof (pdf as any).setTextColor === 'function') {
            pdf.setTextColor(148, 163, 184); // slate-400
          }
          pdf.text(`Página ${p} de ${pageCount}`, pdfWidth - 28, pdfPageHeight - 6);
        }
      }
    } catch {
      // Continuar sin foliado si el entorno es mockeado
    }
  }

  return pdf;
};

/**
 * Genera el Blob binario del PDF en memoria
 */
export const createNutritionPDFBlob = async (elementId: string): Promise<Blob> => {
  const pdf = await renderNutritionPDFDoc(elementId);
  return pdf.output('blob');
};

/**
 * Crea un objeto File estándar listo para compartir vía Web Share API
 */
export const createNutritionPDFFile = async (
  elementId: string,
  fileName: string = 'Plan_Nutricional_Personalizado.pdf'
): Promise<File> => {
  const blob = await createNutritionPDFBlob(elementId);
  return new File([blob], fileName, { type: 'application/pdf' });
};

/**
 * Genera y descarga directamente el archivo PDF en el navegador
 */
export const generateNutritionPDF = async (
  elementId: string,
  fileName: string = 'Plan_Nutricional_Personalizado.pdf'
): Promise<void> => {
  const pdf = await renderNutritionPDFDoc(elementId);
  pdf.save(fileName);
};

