import React from 'react';

/**
 * Splash de arranque. Usa las mismas clases (`evolab-boot*`) definidas en
 * index.html, de modo que al pasar del splash estático al de React no hay
 * ningún salto visual.
 *
 * Reemplaza los `return null` que antes dejaban solo el fondo vacío mientras
 * se resolvía la sesión (HomeDispatcher y ProtectedRoute): si por cualquier
 * motivo esa espera se alargaba, el usuario veía una pantalla "en blanco".
 */
export const BootSplash: React.FC = () => (
  <div className="evolab-boot" role="status" aria-live="polite">
    <div className="evolab-boot__spinner" />
    <span className="evolab-boot__label">Cargando Evolution Lab...</span>
  </div>
);

export default BootSplash;
