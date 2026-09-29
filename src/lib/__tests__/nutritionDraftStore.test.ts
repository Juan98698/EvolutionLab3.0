// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveActiveNutritionSession,
  getActiveNutritionSession,
  clearActiveNutritionSession,
  saveNutritionDraft,
  getNutritionDraft,
  getNutritionDraftAsync,
  clearNutritionDraft,
  NUTRITION_ACTIVE_SESSION_KEY,
  NUTRITION_DRAFT_KEY_PREFIX,
} from '../nutritionDraftStore';
import { Profile, ValoracionAntropometrica } from '../../types/database.types';
import { NutritionPlan } from '../../types/nutrition.types';
import { createPlanFromValuation } from '../nutritionEngine';

const mockAtleta: Profile = {
  id: 'atleta-test-123',
  nombre: 'Carlos Atleta',
  email: 'carlos@test.com',
  rol: 'cliente',
  created_at: '2026-01-01',
};

const mockValuation: ValoracionAntropometrica = {
  id: 'val-test-123',
  cliente_id: 'atleta-test-123',
  fecha: '2026-03-01',
  edad: 28,
  estatura: 175,
  metodo: 'ISAK',
  peso: 75,
  pct_grasa: 14,
  kg_musculo: 35,
  target_calorias: 2200,
};

describe('nutritionDraftStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Active Nutrition Session', () => {
    it('guarda y recupera la sesión activa correctamente', () => {
      saveActiveNutritionSession(mockAtleta, mockValuation, 'trainer-999');

      const session = getActiveNutritionSession('trainer-999');
      expect(session).not.toBeNull();
      expect(session?.atleta.id).toBe('atleta-test-123');
      expect(session?.trainerId).toBe('trainer-999');
      expect(session?.valuation?.id).toBe('val-test-123');
    });

    it('permite recuperar la sesión activa sin filtrar por entrenador si no se pasa trainerId', () => {
      saveActiveNutritionSession(mockAtleta, mockValuation, 'trainer-999');

      const session = getActiveNutritionSession();
      expect(session).not.toBeNull();
      expect(session?.atleta.id).toBe('atleta-test-123');
    });

    it('devuelve null si el trainerId solicitado no coincide con el que abrió la sesión', () => {
      saveActiveNutritionSession(mockAtleta, mockValuation, 'trainer-original');

      const session = getActiveNutritionSession('otro-entrenador');
      expect(session).toBeNull();
    });

    it('devuelve null y limpia la sesión si ha expirado (> 24 horas)', () => {
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      localStorage.setItem(
        NUTRITION_ACTIVE_SESSION_KEY,
        JSON.stringify({
          trainerId: 'trainer-999',
          atleta: mockAtleta,
          valuation: mockValuation,
          timestamp: expiredTimestamp,
        })
      );

      const session = getActiveNutritionSession();
      expect(session).toBeNull();
      expect(localStorage.getItem(NUTRITION_ACTIVE_SESSION_KEY)).toBeNull();
    });

    it('limpia deliberadamente la sesión activa al llamar a clearActiveNutritionSession', () => {
      saveActiveNutritionSession(mockAtleta, mockValuation, 'trainer-999');
      expect(localStorage.getItem(NUTRITION_ACTIVE_SESSION_KEY)).not.toBeNull();

      clearActiveNutritionSession();
      expect(localStorage.getItem(NUTRITION_ACTIVE_SESSION_KEY)).toBeNull();
      expect(getActiveNutritionSession()).toBeNull();
    });

    it('maneja datos corruptos en localStorage sin lanzar excepción', () => {
      localStorage.setItem(NUTRITION_ACTIVE_SESSION_KEY, 'invalid-json{{{');
      expect(getActiveNutritionSession()).toBeNull();
    });
  });

  describe('Nutrition Draft Store (Borradores en tiempo real)', () => {
    let mockPlan: NutritionPlan;

    beforeEach(() => {
      mockPlan = createPlanFromValuation(mockAtleta.id, mockValuation, 'trainer-999');
    });

    it('guarda el borrador en localStorage de manera inmediata y síncrona', () => {
      saveNutritionDraft(mockAtleta.id, mockPlan, 'martes');

      const raw = localStorage.getItem(`${NUTRITION_DRAFT_KEY_PREFIX}${mockAtleta.id}`);
      expect(raw).not.toBeNull();

      const draft = getNutritionDraft(mockAtleta.id);
      expect(draft).not.toBeNull();
      expect(draft?.atletaId).toBe(mockAtleta.id);
      expect(draft?.activeDayKey).toBe('martes');
      expect(draft?.plan.target_calorias).toBe(mockPlan.target_calorias);
    });

    it('aísla los borradores entre diferentes atletas', () => {
      const atletaA = 'atleta-A';
      const atletaB = 'atleta-B';

      const planA = createPlanFromValuation(atletaA, mockValuation);
      planA.target_calorias = 2100;
      const planB = createPlanFromValuation(atletaB, mockValuation);
      planB.target_calorias = 2800;

      saveNutritionDraft(atletaA, planA, 'lunes');
      saveNutritionDraft(atletaB, planB, 'viernes');

      const draftA = getNutritionDraft(atletaA);
      const draftB = getNutritionDraft(atletaB);

      expect(draftA?.plan.target_calorias).toBe(2100);
      expect(draftA?.activeDayKey).toBe('lunes');
      expect(draftB?.plan.target_calorias).toBe(2800);
      expect(draftB?.activeDayKey).toBe('viernes');
    });

    it('devuelve null y limpia el borrador si ha superado la vigencia de 7 días', () => {
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      localStorage.setItem(
        `${NUTRITION_DRAFT_KEY_PREFIX}${mockAtleta.id}`,
        JSON.stringify({
          atletaId: mockAtleta.id,
          activeDayKey: 'miercoles',
          plan: mockPlan,
          timestamp: expiredTimestamp,
        })
      );

      const draft = getNutritionDraft(mockAtleta.id);
      expect(draft).toBeNull();
      expect(localStorage.getItem(`${NUTRITION_DRAFT_KEY_PREFIX}${mockAtleta.id}`)).toBeNull();
    });

    it('clearNutritionDraft elimina el borrador de localStorage e IndexedDB', async () => {
      saveNutritionDraft(mockAtleta.id, mockPlan, 'jueves');
      expect(getNutritionDraft(mockAtleta.id)).not.toBeNull();

      clearNutritionDraft(mockAtleta.id);
      expect(getNutritionDraft(mockAtleta.id)).toBeNull();

      const asyncDraft = await getNutritionDraftAsync(mockAtleta.id);
      expect(asyncDraft).toBeNull();
    });

    it('getNutritionDraftAsync recupera el borrador desde IndexedDB si localStorage fue limpiado', async () => {
      saveNutritionDraft(mockAtleta.id, mockPlan, 'sabado');

      // Simular que localStorage se vació por el navegador pero IndexedDB conserva el respaldo
      localStorage.removeItem(`${NUTRITION_DRAFT_KEY_PREFIX}${mockAtleta.id}`);
      expect(getNutritionDraft(mockAtleta.id)).toBeNull();

      const idbDraft = await getNutritionDraftAsync(mockAtleta.id);
      expect(idbDraft).not.toBeNull();
      expect(idbDraft?.activeDayKey).toBe('sabado');
      expect(idbDraft?.atletaId).toBe(mockAtleta.id);
    });

    it('maneja argumentos inválidos sin romper la aplicación', () => {
      expect(() => saveNutritionDraft('', null as any, 'lunes')).not.toThrow();
      expect(getNutritionDraft('')).toBeNull();
      expect(() => clearNutritionDraft('')).not.toThrow();
    });
  });
});
