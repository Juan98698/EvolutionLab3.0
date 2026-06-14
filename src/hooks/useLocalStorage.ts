import { useState, useCallback } from 'react';

/**
 * Hook de persistencia en localStorage con tipado TypeScript.
 *
 * Diseñado para mantener compatibilidad exacta con las claves de localStorage
 * del sistema legacy de Evolution Lab (por ejemplo, `checklist_YYYY-MM-DD`).
 *
 * @param key - La clave de localStorage.
 * @param initialValue - El valor por defecto si la clave no existe.
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Inicializar el estado leyendo de localStorage
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error al leer localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Setter que actualiza tanto el state de React como localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const valueToStore = value instanceof Function ? value(prev) : value;
          localStorage.setItem(key, JSON.stringify(valueToStore));
          return valueToStore;
        });
      } catch (error) {
        console.error(`Error al escribir localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  // Eliminar la clave de localStorage y restaurar el valor inicial
  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error al eliminar localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
