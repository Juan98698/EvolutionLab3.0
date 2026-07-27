// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  classifyBodyFat,
  classifyMuscleMass,
  calculateBodyFatPct,
  calculateFourMasses,
  calculateSomatotype,
  calculateEnergyAndMacros,
  processFullAnthropometry,
} from '../anthropometryEngine';

describe('anthropometryEngine Library', () => {
  describe('calculateBMI', () => {
    it('calcula correctamente el IMC y clasifica bajo OMS', () => {
      const normal = calculateBMI(70, 175);
      expect(normal.imc).toBe(22.9);
      expect(normal.categoria).toBe('Normal');

      const sobrepeso = calculateBMI(85, 175);
      expect(sobrepeso.imc).toBe(27.8);
      expect(sobrepeso.categoria).toBe('Sobrepeso');

      const obesidad = calculateBMI(78.6, 160);
      expect(obesidad.imc).toBe(30.7);
      expect(obesidad.categoria).toBe('Obesidad grado I');
    });

    it('maneja valores 0 sin lanzar errores', () => {
      const res = calculateBMI(0, 0);
      expect(res.imc).toBe(0);
      expect(res.categoria).toBe('No determinado');
    });
  });

  describe('classifyBodyFat (ACE)', () => {
    it('clasifica % grasa para mujeres según rangos de la ACE', () => {
      expect(classifyBodyFat(12, 'femenino').categoria).toBe('Grasa esencial');
      expect(classifyBodyFat(18, 'femenino').categoria).toBe('Atletas');
      expect(classifyBodyFat(22, 'femenino').categoria).toBe('Buena forma física (fitness)');
      expect(classifyBodyFat(28, 'femenino').categoria).toBe('Aceptable');
      expect(classifyBodyFat(40.2, 'femenino').categoria).toBe('Obesidad');
    });

    it('clasifica % grasa para hombres según rangos de la ACE', () => {
      expect(classifyBodyFat(4, 'masculino').categoria).toBe('Grasa esencial');
      expect(classifyBodyFat(10, 'masculino').categoria).toBe('Atletas');
      expect(classifyBodyFat(15, 'masculino').categoria).toBe('Buena forma física (fitness)');
      expect(classifyBodyFat(20, 'masculino').categoria).toBe('Aceptable');
      expect(classifyBodyFat(28, 'masculino').categoria).toBe('Obesidad');
    });
  });

  describe('classifyMuscleMass', () => {
    it('clasifica % de masa muscular para hombres y mujeres', () => {
      expect(classifyMuscleMass(25, 'femenino').categoria).toBe('Bajo');
      expect(classifyMuscleMass(28.2, 'femenino').categoria).toBe('Promedio');
      expect(classifyMuscleMass(35, 'femenino').categoria).toBe('Bueno');
      expect(classifyMuscleMass(40, 'femenino').categoria).toBe('Alto');

      expect(classifyMuscleMass(30, 'masculino').categoria).toBe('Bajo');
      expect(classifyMuscleMass(36, 'masculino').categoria).toBe('Promedio');
      expect(classifyMuscleMass(42, 'masculino').categoria).toBe('Bueno');
      expect(classifyMuscleMass(46, 'masculino').categoria).toBe('Alto');
    });
  });

  describe('calculateBodyFatPct', () => {
    const mockPliegues = {
      triceps: 12,
      subescapular: 14,
      suprailiaco: 15,
      abdominal: 18,
      muslo: 20,
      pantorrilla: 16,
    };

    it('calcula % grasa con el método Yuhasz (6 pliegues)', () => {
      const fatPct = calculateBodyFatPct(mockPliegues, 'Yuhasz', 'masculino');
      expect(fatPct).toBeGreaterThan(10);
      expect(fatPct).toBeLessThan(25);
    });

    it('calcula % grasa con el método Faulkner (4 pliegues)', () => {
      const fatPct = calculateBodyFatPct(mockPliegues, 'Faulkner', 'masculino');
      expect(fatPct).toBeGreaterThan(10);
      expect(fatPct).toBeLessThan(25);
    });

    it('calcula % grasa con el método ISAK (ampliado)', () => {
      const fatPct = calculateBodyFatPct(mockPliegues, 'ISAK', 'femenino');
      expect(fatPct).toBeGreaterThan(12);
      expect(fatPct).toBeLessThan(30);
    });
  });

  describe('calculateFourMasses', () => {
    it('fracciona los 4 componentes de masa corporal (Grasa, Muscular, Ósea, Residual)', () => {
      const masses = calculateFourMasses(70, 175, 15, { codo: 6.8, rodilla: 9.5 }, 'masculino');

      expect(masses.kgGrasa).toBe(10.5);
      expect(masses.kgOseo).toBeGreaterThan(6);
      expect(masses.kgResidual).toBeGreaterThan(10);
      expect(masses.kgMusculo).toBeGreaterThan(25);
      expect(masses.ratioMusculoGrasa).toBeGreaterThan(2);
    });
  });

  describe('calculateSomatotype (Heath-Carter)', () => {
    it('genera coordenadas X, Y y componentes Endomorfia, Mesomorfia, Ectomorfia', () => {
      const pliegues = { triceps: 14, subescapular: 16, suprailiaco: 18, pantorrilla: 15 };
      const perimetros = { brazo_contraido: 34, pantorrilla: 38 };
      const diametros = { codo: 6.8, rodilla: 9.6 };

      const somato = calculateSomatotype(78.6, 160, pliegues, perimetros, diametros);

      expect(somato.endo).toBeGreaterThan(0);
      expect(somato.meso).toBeGreaterThan(0);
      expect(somato.ecto).toBeGreaterThan(0);
      expect(typeof somato.x).toBe('number');
      expect(typeof somato.y).toBe('number');
    });
  });

  describe('calculateEnergyAndMacros', () => {
    it('calcula BMR, TDEE y distribución de macros en g, kcal y %', () => {
      const res = calculateEnergyAndMacros(70, 175, 25, 15, '3-4', -15, 2.0, 1.0, 'masculino');

      expect(res.bmr).toBeGreaterThan(1400);
      expect(res.tdee).toBeGreaterThan(res.bmr);
      expect(res.targetCalories).toBeLessThan(res.tdee); // Déficit del -15%
      expect(res.protein.grams).toBe(140); // 70kg * 2.0 g/kg
      expect(res.fat.grams).toBe(70); // 70kg * 1.0 g/kg
      expect(res.carbs.grams).toBeGreaterThan(100);
    });
  });

  describe('processFullAnthropometry', () => {
    it('integra el flujo completo de evaluación antropométrica', () => {
      const result = processFullAnthropometry({
        cliente_id: 'client-1',
        entrenador_id: 'trainer-1',
        fecha: '2026-07-26',
        edad: 25,
        peso: 78.6,
        estatura: 160,
        metodo: 'Yuhasz',
        objetivo: 'Perder Grasa Corporal',
        pliegues: { triceps: 35, subescapular: 40, suprailiaco: 38, abdominal: 36, muslo: 60, pantorrilla: 40 },
        genero: 'femenino',
      });

      expect(result.cliente_id).toBe('client-1');
      expect(result.imc).toBe(30.7);
      expect(result.clasificacion_imc).toBe('Obesidad grado I');
      expect(result.pct_grasa).toBeGreaterThan(20);
      expect(result.clasificacion_grasa).toBeDefined();
      expect(result.somatotipo).toBeDefined();
      expect(result.macros?.proteina.grams).toBeGreaterThan(100);
    });
  });
});
