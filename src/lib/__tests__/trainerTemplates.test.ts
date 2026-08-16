// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizePlanDaysForTemplate,
  saveTrainerTemplate,
  getTrainerTemplates,
  deleteTrainerTemplate,
  applyTemplateToPlan,
  getLocalTemplates,
  saveLocalTemplates
} from '../trainerTemplates';
import { TrainingDay, Exercise, TrainerTemplate } from '../../types/database.types';

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Offline mode' } }),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Offline mode' } }),
      delete: vi.fn().mockReturnThis()
    }))
  }
}));

describe('trainerTemplates Module', () => {
  const mockTrainerId = 'trainer_uuid_123';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('sanitizePlanDaysForTemplate', () => {
    it('elimina los pesos absolutos en kg pero CONSERVA ejercicios, GIFs, descripciones y videos de YouTube/Drive', () => {
      const days: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Día 1: Torso',
          exercises: [
            {
              id: 'ex_1',
              nombre: 'Press Inclinado con Mancuernas',
              nombre_original: 'Press Inclinado con Mancuernas',
              grupo_muscular: 'Pecho',
              image_url: 'https://cdn.fit/inclinado.jpg',
              gif_url: 'https://cdn.fit/inclinado.gif',
              video_url: 'https://drive.google.com/file/d/12345/view', // Video propio del entrenador
              description: 'Mantener retracción escapular',
              variables: {
                'series de trabajo': '4',
                'repeticiones': '8-10',
                'tempo': '3-0-1-0',
                'rir': '2',
                'descanso': '90',
                'peso': '40' // Peso en kg específico de un cliente previo
              }
            } as Exercise
          ]
        }
      ];

      const sanitized = sanitizePlanDaysForTemplate(days);
      const ex = sanitized[0].exercises[0];

      // Verificar que el peso en kg se eliminó
      expect(ex.variables['peso']).toBeUndefined();

      // Verificar que las variables prescritas y toda la multimedia SE CONSERVARON
      expect(ex.variables['series de trabajo']).toBe('4');
      expect(ex.variables['repeticiones']).toBe('8-10');
      expect(ex.variables['tempo']).toBe('3-0-1-0');
      expect(ex.variables['rir']).toBe('2');
      expect(ex.image_url).toBe('https://cdn.fit/inclinado.jpg');
      expect(ex.gif_url).toBe('https://cdn.fit/inclinado.gif');
      expect(ex.video_url).toBe('https://drive.google.com/file/d/12345/view'); // Mantiene video personalizado
      expect(ex.description).toBe('Mantener retracción escapular');
    });
  });

  describe('CRUD de Plantillas del Entrenador (Local & Supabase Fallback)', () => {
    it('guarda una nueva plantilla en la caché local e id de retorno', async () => {
      const saved = await saveTrainerTemplate({
        trainer_id: mockTrainerId,
        nombre: 'Torso Pierna 4 Días - Hipertrofia',
        descripcion: 'Ideal para etapa de volumen',
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        dias_semana: 4,
        trainingDays: [
          {
            id: 'd1',
            name: 'Torso A',
            exercises: [
              {
                id: 'e1',
                nombre: 'Press Militar',
                nombre_original: 'Press Militar',
                grupo_muscular: 'Hombros',
                variables: { 'series de trabajo': '4' }
              } as Exercise
            ]
          }
        ]
      });

      expect(saved.id).toBeDefined();
      expect(saved.nombre).toBe('Torso Pierna 4 Días - Hipertrofia');
      expect(saved.plan_data.trainingDays[0].exercises[0].nombre).toBe('Press Militar');

      const localList = getLocalTemplates(mockTrainerId);
      expect(localList).toHaveLength(1);
      expect(localList[0].nombre).toBe('Torso Pierna 4 Días - Hipertrofia');
    });

    it('actualiza/sobrescribe una plantilla existente si se provee su ID', async () => {
      const initial = await saveTrainerTemplate({
        trainer_id: mockTrainerId,
        nombre: 'Plan Original',
        objetivo: 'fuerza',
        nivel_atleta: 'principiante',
        dias_semana: 3,
        trainingDays: []
      });

      const updated = await saveTrainerTemplate({
        id: initial.id,
        trainer_id: mockTrainerId,
        nombre: 'Plan Actualizado v2',
        descripcion: 'Notas mejoradas',
        objetivo: 'fuerza',
        nivel_atleta: 'intermedio',
        dias_semana: 3,
        trainingDays: []
      });

      expect(updated.id).toBe(initial.id);
      expect(updated.nombre).toBe('Plan Actualizado v2');
      expect(updated.descripcion).toBe('Notas mejoradas');

      const templates = getLocalTemplates(mockTrainerId);
      expect(templates).toHaveLength(1);
      expect(templates[0].nombre).toBe('Plan Actualizado v2');
    });

    it('obtiene las plantillas desde el caché local cuando Supabase no responde', async () => {
      saveLocalTemplates(mockTrainerId, [
        {
          id: 'tpl_offline',
          trainer_id: mockTrainerId,
          nombre: 'Plantilla Offline Cache',
          objetivo: 'hipertrofia',
          nivel_atleta: 'intermedio',
          dias_semana: 3,
          plan_data: { trainingDays: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      const templates = await getTrainerTemplates(mockTrainerId);
      expect(templates).toHaveLength(1);
      expect(templates[0].nombre).toBe('Plantilla Offline Cache');
    });

    it('elimina una plantilla correctamente', async () => {
      const t1 = await saveTrainerTemplate({
        trainer_id: mockTrainerId,
        nombre: 'Plantilla 1',
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        dias_semana: 4,
        trainingDays: []
      });

      await saveTrainerTemplate({
        trainer_id: mockTrainerId,
        nombre: 'Plantilla 2',
        objetivo: 'fuerza',
        nivel_atleta: 'avanzado',
        dias_semana: 5,
        trainingDays: []
      });

      expect(getLocalTemplates(mockTrainerId)).toHaveLength(2);

      await deleteTrainerTemplate(t1.id, mockTrainerId);
      const remaining = getLocalTemplates(mockTrainerId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].nombre).toBe('Plantilla 2');
    });

    it('identifica correctamente cuando el error es falta de permisos GRANT en la tabla de Supabase', async () => {
      const { supabase } = await import('../supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'permission denied for table plantillas_entrenador', code: '42501' }
        })
      } as any);

      await expect(
        saveTrainerTemplate({
          trainer_id: 'trainer_test_grant',
          nombre: 'Plantilla Test Grant',
          objetivo: 'hipertrofia',
          nivel_atleta: 'intermedio',
          dias_semana: 3,
          trainingDays: []
        })
      ).rejects.toThrow('Error de permisos en Supabase: falta ejecutar los permisos GRANT');
    });

    it('identifica correctamente cuando el error es por restricción RLS de suscripción', async () => {
      const { supabase } = await import('../supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'new row violates row-level security policy for table "plantillas_entrenador"', code: '42501' }
        })
      } as any);

      await expect(
        saveTrainerTemplate({
          trainer_id: 'trainer_test_rls',
          nombre: 'Plantilla Test RLS',
          objetivo: 'hipertrofia',
          nivel_atleta: 'intermedio',
          dias_semana: 3,
          trainingDays: []
        })
      ).rejects.toThrow('Tu suscripción actual no permite guardar plantillas personalizadas');
    });

    it('ante una falla de red genuina (promesa rechazada, no un {error} de PostgREST), guarda localmente sin lanzar al usuario', async () => {
      const { supabase } = await import('../supabaseClient');
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
        delete: vi.fn().mockReturnThis()
      }) as any);

      const saved = await saveTrainerTemplate({
        trainer_id: mockTrainerId,
        nombre: 'Plantilla Sin Conexión',
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        dias_semana: 3,
        trainingDays: []
      });

      // No debe lanzar -- debe resolver con el payload guardado localmente
      expect(saved.nombre).toBe('Plantilla Sin Conexión');
      expect(getLocalTemplates(mockTrainerId).some(t => t.nombre === 'Plantilla Sin Conexión')).toBe(true);
    });
  });

  describe('applyTemplateToPlan', () => {
    it('clona los ejercicios con IDs nuevos y calcula automáticamente los pesos en kg según el 1RM del cliente', () => {
      const template: TrainerTemplate = {
        id: 'tpl_123',
        trainer_id: mockTrainerId,
        nombre: 'Fuerza Torso',
        objetivo: 'fuerza',
        nivel_atleta: 'intermedio',
        dias_semana: 1,
        plan_data: {
          trainingDays: [
            {
              id: 'tpl_day_1',
              name: 'Día 1',
              exercises: [
                {
                  id: 'tpl_ex_1',
                  nombre: 'Press de Banca con Barra',
                  nombre_original: 'Press de Banca con Barra',
                  grupo_muscular: 'Pecho',
                  gif_url: 'https://cdn.fit/banca.gif',
                  video_url: 'https://youtube.com/watch?v=123',
                  variables: {
                    'series de trabajo': '3',
                    'repeticiones': '5',
                    'porcentaje_1rm': '80%' // 80% de 100kg = 80kg
                  }
                } as Exercise
              ]
            }
          ],
          weeklyTargets: { Pecho: 3 }
        }
      };

      const client1RM = { 'press_banca': 100 };
      const applied = applyTemplateToPlan(template, client1RM);

      expect(applied.trainingDays).toHaveLength(1);
      const ex = applied.trainingDays[0].exercises[0];

      // ID nuevo generado
      expect(ex.id).not.toBe('tpl_ex_1');
      // Conserva multimedia y videos propios de YouTube/Drive
      expect(ex.gif_url).toBe('https://cdn.fit/banca.gif');
      expect(ex.video_url).toBe('https://youtube.com/watch?v=123');

      // Auto-cálculo de 80% de 100kg = 80kg y reps_objetivo = 5
      expect(ex.variables['peso']).toBe('🤖 80 kg');
      expect(ex.variables['reps_objetivo']).toBe('🤖 5');
    });
  });
});
