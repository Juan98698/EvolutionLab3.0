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
  getSomatotypeDiagnostic,
  calculateWaterRequirement,
  classifyMuscleFatRatio,
  calculateCardiometabolicRisk,
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

  describe('getSomatotypeDiagnostic', () => {
    it('genera diagnósticos explicativos claros para biotipos endo-mesomorfo, meso-ectomorfo y ectomorfo', () => {
      const endoMeso = getSomatotypeDiagnostic(5.5, 4.2, 1.2, 'Camila');
      expect(endoMeso).toContain('Camila');
      expect(endoMeso).toContain('endo-mesomorfo');

      const mesoEcto = getSomatotypeDiagnostic(1.5, 5.2, 4.1, 'Carlos');
      expect(mesoEcto).toContain('Carlos');
      expect(mesoEcto).toContain('meso-ectomorfo');

      const ectoPuro = getSomatotypeDiagnostic(1.0, 1.5, 6.0, 'Mateo');
      expect(ectoPuro).toContain('Mateo');
      expect(ectoPuro).toContain('ectomórfica');
    });
  });

  describe('processFullAnthropometry', () => {
    it('integra el flujo completo de evaluación antropométrica con 6 diámetros y género femenino', () => {
      const result = processFullAnthropometry({
        cliente_id: 'client-1',
        entrenador_id: 'trainer-1',
        fecha: '2026-07-26',
        edad: 25,
        peso: 78.6,
        estatura: 160,
        metodo: 'ISAK',
        objetivo: 'Perder Grasa Corporal',
        pliegues: { triceps: 35, subescapular: 40, suprailiaco: 38, abdominal: 36, muslo: 60, pantorrilla: 40, antebrazo: 12, supraespinal: 15 },
        perimetros: { brazo: 32, brazo_contraido: 34.5, torax: 100.3, cintura: 86, cadera: 109.9, muslo: 65.8, pantorrilla: 40.5, cefalico: 56 },
        diametros: { codo: 5.8, rodilla: 9, biiliocrestal: 28, biacromial: 38, anteroposterior: 4.6, transversal: 30 },
        genero: 'femenino',
      });

      expect(result.cliente_id).toBe('client-1');
      expect(result.genero).toBe('femenino');
      expect(result.imc).toBe(30.7);
      expect(result.clasificacion_imc).toBe('Obesidad grado I');
      expect(result.pct_grasa).toBeGreaterThan(20);
      expect(result.perimetros?.cefalico).toBe(56);
      expect(result.diametros?.biacromial).toBe(38);
      expect(result.diametros?.biiliocrestal).toBe(28);
      expect(result.somatotipo).toBeDefined();
      expect(result.macros?.proteina.grams).toBeGreaterThan(100);
    });

    it('aplica correctamente las tablas de clasificación normativas según género masculino', () => {
      const resultMale = processFullAnthropometry({
        cliente_id: 'client-male',
        fecha: '2026-07-27',
        edad: 30,
        peso: 70,
        estatura: 170,
        metodo: 'Yuhasz',
        genero: 'masculino',
        pliegues: { triceps: 12, subescapular: 14, suprailiaco: 15, abdominal: 18, muslo: 20, pantorrilla: 16 },
      });

      expect(resultMale.genero).toBe('masculino');
      expect(resultMale.clasificacion_grasa).toBeDefined();
      expect(resultMale.clasificacion_musculo).toBeDefined();
    });
  });

  describe('calculateWaterRequirement', () => {
    it('calcula el rango de agua según el peso y frecuencia de entrenamiento', () => {
      const baja = calculateWaterRequirement(70, '1-2');
      expect(baja.minL).toBe(2.5); // 70 * 35 / 1000
      expect(baja.maxL).toBe(2.8); // 70 * 40 / 1000

      const moderada = calculateWaterRequirement(70, '3-4');
      expect(moderada.minL).toBe(2.7); // 70 * 38 / 1000
      expect(moderada.maxL).toBe(3.0); // 70 * 43 / 1000

      const alta = calculateWaterRequirement(80, '5-6');
      expect(alta.minL).toBe(3.4); // 80 * 42 / 1000
      expect(alta.maxL).toBe(3.8); // 80 * 48 / 1000
    });
  });

  describe('classifyMuscleFatRatio', () => {
    it('clasifica correctamente el ratio músculo/grasa diferenciado por sexo', () => {
      const hombreBajo = classifyMuscleFatRatio(1.1, 'masculino');
      expect(hombreBajo.nivel).toBe('Inicial / Bajo');

      const hombreAvanzado = classifyMuscleFatRatio(2.2, 'masculino');
      expect(hombreAvanzado.nivel).toBe('Composición Atlética Avanzada');

      const mujerAvanzada = classifyMuscleFatRatio(1.8, 'femenino');
      expect(mujerAvanzada.nivel).toBe('Composición Atlética Avanzada');
    });
  });

  describe('calculateCardiometabolicRisk (ALAD / IDF / ATP III)', () => {
    it('clasifica umbrales de hombres según ALAD/IDF y ATP III', () => {
      const bajo = calculateCardiometabolicRisk(88, 100, 180, 'masculino');
      expect(bajo.categoria).toBe('Óptimo / Bajo Riesgo');
      expect(bajo.nivelRiesgo).toBe('bajo');
      expect(bajo.whtr).toBe(0.49);
      expect(bajo.whtrAlerta).toBe(false);

      const moderado = calculateCardiometabolicRisk(94, 100, 180, 'masculino');
      expect(moderado.categoria).toBe('Riesgo Elevado (ALAD / IDF / WHtR)');
      expect(moderado.nivelRiesgo).toBe('moderado');

      const alto = calculateCardiometabolicRisk(104, 110, 195, 'masculino');
      expect(alto.categoria).toBe('Riesgo Muy Elevado (ATP III / OMS)');
      expect(alto.nivelRiesgo).toBe('alto');
    });

    it('clasifica umbrales de mujeres según ALAD/IDF y ATP III', () => {
      const bajo = calculateCardiometabolicRisk(76, 95, 165, 'femenino');
      expect(bajo.categoria).toBe('Óptimo / Bajo Riesgo');
      expect(bajo.nivelRiesgo).toBe('bajo');

      const moderado = calculateCardiometabolicRisk(82, 95, 165, 'femenino');
      expect(moderado.categoria).toBe('Riesgo Elevado (ALAD / IDF / WHtR)');
      expect(moderado.nivelRiesgo).toBe('moderado');

      const alto = calculateCardiometabolicRisk(90, 100, 165, 'femenino');
      expect(alto.categoria).toBe('Riesgo Muy Elevado (ATP III / OMS)');
      expect(alto.nivelRiesgo).toBe('alto');
    });

    it('eleva a riesgo elevado cuando WHtR >= 0.50 aunque la cintura en cm sea normal', () => {
      const bajaEstatura = calculateCardiometabolicRisk(86, 98, 170, 'masculino');
      expect(bajaEstatura.whtr).toBe(0.51);
      expect(bajaEstatura.whtrAlerta).toBe(true);
      expect(bajaEstatura.categoria).toBe('Riesgo Elevado (ALAD / IDF / WHtR)');
      expect(bajaEstatura.nivelRiesgo).toBe('moderado');
    });

    it('maneja cadera undefined o 0 devolviendo icc null de forma segura', () => {
      const sinCadera = calculateCardiometabolicRisk(92, undefined, 175, 'masculino');
      expect(sinCadera.icc).toBeNull();
      expect(sinCadera.iccCategoria).toBe('No determinado');
      expect(sinCadera.cintura).toBe(92);
      expect(sinCadera.whtr).toBe(0.53);
    });

    it('clasifica correctamente el patrón androide vs ginoide mediante ICC', () => {
      const androide = calculateCardiometabolicRisk(95, 100, 180, 'masculino');
      expect(androide.icc).toBe(0.95);
      expect(androide.iccCategoria).toBe('Androide / Manzana (Alto Riesgo)');

      const ginoide = calculateCardiometabolicRisk(80, 100, 180, 'masculino');
      expect(ginoide.icc).toBe(0.80);
      expect(ginoide.iccCategoria).toBe('Ginoide / Periférico (Riesgo Bajo)');
    });

    it('menciona el método en la narrativa de diagnóstico (Yuhasz vs ISAK)', () => {
      const resYuhasz = calculateCardiometabolicRisk(94, 100, 175, 'masculino', 'Carlos', 'Yuhasz');
      expect(resYuhasz.diagnosticoText).toContain('YUHASZ');
      expect(resYuhasz.diagnosticoText).toContain('Carlos');
    });

    it('retorna estado neutral indeterminado cuando la cintura es 0 o undefined en lugar de disfrazarlo como riesgo bajo', () => {
      const sinCintura = calculateCardiometabolicRisk(0, 100, 175, 'masculino', 'Ana');
      expect(sinCintura.cinturaRegistrada).toBe(false);
      expect(sinCintura.nivelRiesgo).toBe('indeterminado');
      expect(sinCintura.categoria).toBe('No determinado (Sin datos de cintura)');
      expect(sinCintura.whtrCategoria).toBe('No determinado');
      expect(sinCintura.rangoStr).toBe('Sin registrar');
      expect(sinCintura.diagnosticoText).toContain('no se ha registrado el perímetro de cintura');
    });
  });
});
