import { describe, it, expect } from 'vitest';
import { normalizeSearchText, filterExercisesByQuery } from '../exerciseSearch';

describe('exerciseSearch helper', () => {
  const mockCatalog = [
    { id: '1', nombre: 'Press de Banca Plano con Barra', grupo_muscular: 'Pecho' },
    { id: '2', nombre: 'Press de Pecho Inclinado en Máquina Hammer', grupo_muscular: 'Pecho' },
    { id: '3', nombre: 'Press Inclinado con Mancuernas', grupo_muscular: 'Pecho' },
    { id: '4', nombre: 'Press Militar de Pie con Barra', grupo_muscular: 'Hombros' },
    { id: '5', nombre: 'Sentadilla Libre con Barra', grupo_muscular: 'Cuádriceps' },
    { id: '6', nombre: 'Remo con Mancuerna a una Mano', grupo_muscular: 'Espalda' },
    { id: '7', nombre: 'Press Inclinado Articulado Hammer', grupo_muscular: 'Pecho' }
  ];

  it('normalizes accents and special characters', () => {
    expect(normalizeSearchText('Máquina')).toBe('maquina');
    expect(normalizeSearchText('Cuádriceps!')).toBe('cuadriceps');
    expect(normalizeSearchText('Press & Pull')).toBe('press   pull');
  });

  it('finds exercises matching all query tokens in any order (e.g. press inclinado hammer)', () => {
    const results = filterExercisesByQuery(mockCatalog, 'press inclinado hammer');
    expect(results).toHaveLength(2);
    expect(results.map(r => r.nombre)).toContain('Press de Pecho Inclinado en Máquina Hammer');
    expect(results.map(r => r.nombre)).toContain('Press Inclinado Articulado Hammer');
  });

  it('finds exercises matching multi-word queries with accents (e.g. maquina hammer)', () => {
    const results = filterExercisesByQuery(mockCatalog, 'maquina hammer');
    expect(results).toHaveLength(1);
    expect(results[0].nombre).toBe('Press de Pecho Inclinado en Máquina Hammer');
  });

  it('returns initial catalog slice when query is empty', () => {
    const results = filterExercisesByQuery(mockCatalog, '', 3);
    expect(results).toHaveLength(3);
  });
});
