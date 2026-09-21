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

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
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

