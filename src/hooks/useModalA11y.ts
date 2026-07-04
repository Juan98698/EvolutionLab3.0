import { useEffect, useRef } from 'react';

interface UseModalA11yOptions {
  /** true mientras el modal está abierto/visible */
  isOpen: boolean;
  /** se llama al presionar Escape */
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hook compartido de accesibilidad para modales/diálogos.
 *
 * Se lo conecta al contenedor del CONTENIDO del modal (no al backdrop) vía
 * el `ref` que devuelve. Mientras `isOpen` es true:
 *   - Mueve el foco al primer elemento enfocable del modal al abrirse.
 *   - Atrapa el Tab / Shift+Tab dentro del modal (focus trap).
 *   - Cierra el modal con Escape (llamando a `onClose`).
 *   - Al cerrarse, devuelve el foco a donde estaba antes de abrir el modal.
 *
 * Uso:
 *   const dialogRef = useModalA11y({ isOpen: showModal, onClose: () => setShowModal(false) });
 *   <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="mi-titulo" tabIndex={-1}>
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
}: UseModalA11yOptions) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Mover el foco adentro del modal (al primer elemento enfocable, o al
    // contenedor mismo si no hay ninguno) para que los lectores de pantalla
    // anuncien el diálogo y el teclado quede "atrapado" desde el inicio.
    const focusFirstElement = () => {
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusables[0] ?? container).focus();
    };
    // Se espera un tick por si el modal recién está montando/animando.
    const focusTimeout = window.setTimeout(focusFirstElement, 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && container) {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restaurar el foco a donde estaba antes de abrir el modal.
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  return containerRef;
}

export default useModalA11y;
