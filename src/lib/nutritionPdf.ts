import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    // Multipágina: cortar el canvas en franjas equivalentes a la altura física de una página A4 (297mm)
    const totalPages = Math.ceil(totalPdfHeight / pdfPageHeight);
    const scaleFactor = canvas.width / pdfWidth;
    const pageCanvasHeight = pdfPageHeight * scaleFactor;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const sourceY = page * pageCanvasHeight;
      const sourceH = Math.min(pageCanvasHeight, canvas.height - sourceY);
      const destH = sourceH / scaleFactor;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sourceH;
      const sliceCtx = sliceCanvas.getContext('2d');
      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceH,
          0,
          0,
          canvas.width,
          sourceH
        );
      }

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(sliceData, 'JPEG', 0, 0, pdfWidth, destH);
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

