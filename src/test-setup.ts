// Registra los matchers de @testing-library/jest-dom (toBeInTheDocument,
// toHaveTextContent, etc.) globalmente para toda la suite de Vitest, así
// ningún archivo de test necesita importarlo individualmente.
import '@testing-library/jest-dom/vitest';
