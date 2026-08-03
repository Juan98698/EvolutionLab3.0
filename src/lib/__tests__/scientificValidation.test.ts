// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  calculateBodyFatPct,
  calculateFourMasses,
  calculateEnergyAndMacros
} from '../anthropometryEngine';
import {
  calculate1RM,
  getPrescribedLoadDetailed
} from '../periodizationEngine';

describe('Scientific Validation Suite — Benchmark Academic Cases', () => {

  describe('Anthropometry Engine (ISAK & Cineanthropometry Standard Equations)', () => {
    it('calculates BMI and WHO classification accurately for standard subject', () => {
      // Benchmark: Subject 70kg, 175cm -> BMI = 70 / (1.75^2) = 22.857 -> 22.9 (Normal)
      const res = calculateBMI(70, 175);
      expect(res.imc).toBe(22.9);
      expect(res.categoria).toBe('Normal');
    });

    it('calculates body fat % via Faulkner (1968) formula (4 skinfolds)', () => {
      // Benchmark: 4 folds sum = 40mm (Triceps: 10, Subscapular: 10, Suprailiac: 10, Abdominal: 10)
      // Faulkner (1968): %Fat = 5.783 + 0.153 * 40 = 5.783 + 6.12 = 11.903 -> 11.9%
      const folds = { triceps: 10, subescapular: 10, suprailiaco: 10, abdominal: 10 };
      const fatPct = calculateBodyFatPct(folds, 'Faulkner', 'masculino');
      expect(fatPct).toBe(11.9);
    });

    it('calculates body fat % via Carter (1982) / Yuhasz (1974) formula (6 skinfolds)', () => {
      // Benchmark Male: 6 folds sum = 60mm -> 3.64 + 0.097 * 60 = 3.64 + 5.82 = 9.46 -> 9.5%
      const folds = { triceps: 10, subescapular: 10, suprailiaco: 10, abdominal: 10, muslo: 10, pantorrilla: 10 };
      const fatPctMale = calculateBodyFatPct(folds, 'Yuhasz', 'masculino');
      expect(fatPctMale).toBe(9.5);

      // Benchmark Female: 6 folds sum = 60mm -> 4.56 + 0.143 * 60 = 4.56 + 8.58 = 13.14 -> 13.1%
      const fatPctFemale = calculateBodyFatPct(folds, 'Yuhasz', 'femenino');
      expect(fatPctFemale).toBe(13.1);
    });

    it('calculates bone mass via von Döbeln (1964) / Rocha (1975) equation', () => {
      // Benchmark: 170cm height, 6.5cm wrist diameter, 9.5cm knee diameter
      // MO = 3.02 * [(1.7^2 * 0.065 * 0.095 * 400)^0.712]
      const diametros = { anteroposterior: 6.5, rodilla: 9.5 };
      const fourMasses = calculateFourMasses(70, 170, 15, diametros, 'masculino');
      expect(fourMasses.kgOseo).toBeGreaterThan(8);
      expect(fourMasses.kgOseo).toBeLessThan(14);
      expect(fourMasses.pctOseo).toBeGreaterThan(10);
    });

    it('calculates BMR using Mifflin-St Jeor (1990) academic benchmark', () => {
      // Benchmark: Male, 80kg, 180cm, 25 yo
      // BMR = 10(80) + 6.25(180) - 5(25) + 5 = 800 + 1125 - 125 + 5 = 1805 kcal
      const result = calculateEnergyAndMacros(80, 180, 25, 0, '3-4', 0, 2.0, 1.0, 'masculino');
      expect(result.bmr).toBe(1805);
    });
  });

  describe('Periodization Engine (Epley 1985 & Brzycki 1993 Equations)', () => {
    it('calculates 1RM estimate integrating reps and RIR using Epley & Brzycki average', () => {
      // Benchmark: 100 kg x 5 reps @ RIR 2 -> Effective Reps = 7
      // Epley: 123.33 kg, Brzycki: 120.0 kg -> Promedio Epley-Brzycki = 121.7 kg
      const estimated1RM = calculate1RM(100, 5, 2);
      expect(estimated1RM).toBe(121.7);
    });

    it('prescribes training load using Epley inverse formula with RIR targets', () => {
      // Benchmark: 1RM = 100kg, target 8 reps @ RIR 2 (Effective Reps = 10)
      // Epley %1RM = 30 / (30 + 10) = 75% -> 75 kg
      const load = getPrescribedLoadDetailed(100, 8, 2, 'epley', 2.5);
      expect(load.pct1RM).toBe(0.75);
      expect(load.weight).toBe(75);
    });

    it('prescribes training load using Brzycki (1993) formula', () => {
      // Benchmark: 1RM = 100kg, target 8 reps @ RIR 2 (Effective Reps = 10)
      // Brzycki %1RM = 1.0278 - 0.0278 * 10 = 0.7498 -> ~75%
      const load = getPrescribedLoadDetailed(100, 8, 2, 'brzycki', 2.5);
      expect(load.pct1RM).toBeCloseTo(0.75, 2);
      expect(load.weight).toBe(75);
    });
  });

});
