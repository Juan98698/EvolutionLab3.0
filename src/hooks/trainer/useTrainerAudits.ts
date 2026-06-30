import { useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';
import { analizarSobrecargaProgresiva, Session, Notification } from '../../lib/overload';
import { DEFAULT_RULES } from '../../lib/rules';
import { resolveOverloadRules, resolveOverloadConfig } from '../../lib/sessions';

export const useTrainerAudits = (
  profile: Profile | null, 
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
) => {
  const [actividades, setActividades] = useState<any[]>([]);
  const [alertasClientes, setAlertasClientes] = useState<Record<string, Notification[]>>({});
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);
  
  const [selectedAnalysisClient, setSelectedAnalysisClient] = useState<string>('all');
  const [selectedAnalysisExercise, setSelectedAnalysisExercise] = useState<string>('all');
  const [auditViewMode, setAuditViewMode] = useState<'cronologica' | 'ejercicio'>('cronologica');
  const [expandedActividades, setExpandedActividades] = useState<Record<string, boolean>>({});

  const fetchAuditoria = useCallback(async (force = false) => {
    if (!profile) return;
    if (actividades.length > 0 && !force) return;

    setLoadingAuditoria(true);
    try {
      const { data: sesiones, error: errorSesiones } = await supabase
        .from('sesiones_historial')
        .select(`
          id,
          fecha,
          notas_generales,
          cliente_id,
          profiles!inner(id, nombre, entrenador_id),
          sesiones_ejercicios(*)
        `)
        .eq('profiles.entrenador_id', profile.id)
        .order('fecha', { ascending: false })
        .limit(30);

      if (errorSesiones) throw errorSesiones;

      const actList = sesiones || [];
      setActividades(actList);

      const clientIds = Array.from(new Set(actList.map((s: any) => s.cliente_id)));

      if (clientIds.length > 0) {
        const { data: ejerData, error: ejerError } = await supabase
          .from('sesiones_ejercicios')
          .select('*, sesiones_historial!inner(fecha, cliente_id)')
          .in('sesiones_historial.cliente_id', clientIds)
          .order('created_at', { ascending: true });

        if (ejerError) throw ejerError;

        const { data: plansData, error: plansError } = await supabase
          .from('planes')
          .select('cliente_id, datos_plan')
          .in('cliente_id', clientIds)
          .eq('activo', true);

        if (plansError) throw plansError;

        const ejerciciosPorCliente: Record<string, Session[]> = {};
        if (ejerData) {
          ejerData.forEach((s: any) => {
            const cid = s.sesiones_historial?.cliente_id;
            if (!cid) return;
            if (!ejerciciosPorCliente[cid]) {
              ejerciciosPorCliente[cid] = [];
            }
            if (ejerciciosPorCliente[cid].length < 200) {
              ejerciciosPorCliente[cid].push({
                id: s.id,
                fecha: s.sesiones_historial?.fecha || '',
                ejercicio: s.nombre_ejercicio,
                peso: Number(s.peso) || 0,
                rpe_rir: Number(s.rpe_rir) || 2,
                series_reps: Array.isArray(s.series_reps) ? s.series_reps : [],
                descanso: Number(s.descanso) || 90,
                volumen: Number(s.volumen) || 0,
                rm_estimado: Number(s.rm_estimado) || 0,
                grupo: s.grupo_muscular || 'General',
              });
            }
          });
        }

        const planMap: Record<string, { rules: any[]; config: any; exercises: any[] }> = {};
        if (plansData) {
          plansData.forEach((p) => {
            const datosPlan = p.datos_plan as any;
            const trackerRules = datosPlan?.trackerRules || [];
            const trackerConfig = datosPlan?.trackerConfig || {};
            const exercises: any[] = [];
            if (datosPlan?.trainingDays) {
              datosPlan.trainingDays.forEach((d: any) => {
                if (d.exercises) {
                  exercises.push(...d.exercises);
                }
              });
            }
            planMap[p.cliente_id] = {
              rules: resolveOverloadRules(trackerRules),
              config: resolveOverloadConfig(trackerConfig),
              exercises
            };
          });
        }

        const mapaAlertas: Record<string, Notification[]> = {};
        clientIds.forEach((cid) => {
          const clientSessions = ejerciciosPorCliente[cid] || [];
          if (clientSessions.length > 0) {
            const resolved = planMap[cid] || {
              rules: DEFAULT_RULES,
              config: {},
              exercises: []
            };
            mapaAlertas[cid] = analizarSobrecargaProgresiva(clientSessions, resolved.rules, resolved.config, resolved.exercises);
          } else {
            mapaAlertas[cid] = [];
          }
        });

        setAlertasClientes(mapaAlertas);
      }
    } catch (err: any) {
      console.error('Error al cargar auditoría:', err);
      showToast('Error al cargar la actividad: ' + err.message, 'error');
    } finally {
      setLoadingAuditoria(false);
    }
  }, [profile, actividades.length, showToast]);

  const mostRecentSessionIds = useMemo(() => {
    const seenClients = new Set<string>();
    const ids = new Set<string>();
    actividades.forEach((sesion) => {
      if (sesion.cliente_id && !seenClients.has(sesion.cliente_id)) {
        seenClients.add(sesion.cliente_id);
        ids.add(sesion.id);
      }
    });
    return ids;
  }, [actividades]);

  const aplanadosEjercicios = useMemo(() => {
    const rows: any[] = [];
    
    const chronologicalSessions = [...actividades].reverse();
    
    chronologicalSessions.forEach((sesion) => {
      const clienteId = sesion.cliente_id;
      const athleteName = sesion.profiles?.nombre || 'Atleta desconocido';
      if (!clienteId) return;
      
      const ejercicios = sesion.sesiones_ejercicios || [];
      ejercicios.forEach((ej: any) => {
        const exName = ej.nombre_ejercicio?.trim();
        if (!exName) return;
        
        const peso = parseFloat(String(ej.peso)) || 0;
        const repsArray: number[] = Array.isArray(ej.series_reps) 
          ? ej.series_reps.map((val: any) => parseInt(String(val), 10) || 0)
          : (typeof ej.series_reps === 'string' 
              ? ej.series_reps.split('-').map((x: string) => parseInt(x.trim(), 10)).filter((x: number) => !isNaN(x)) 
              : []);
        
        const totalReps = repsArray.reduce((sum: number, r: number) => sum + r, 0);
        const volumen = peso * totalReps;
        
        let rm = 0;
        if (repsArray.length > 0) {
          const maxReps = Math.max(...repsArray);
          const epley = peso * (1 + maxReps / 30);
          const brzycki = peso / (1.0278 - 0.0278 * maxReps);
          rm = (epley + brzycki) / 2;
        }
        
        rows.push({
          id_sesion: sesion.id,
          id_ej: ej.id,
          cliente_id: clienteId,
          atleta: athleteName,
          fecha: sesion.fecha || '',
          ejercicio: exName,
          grupo: ej.grupo_muscular || 'General',
          series: repsArray.length,
          repsStr: repsArray.join(', '),
          peso,
          rpe: ej.rpe_rir,
          descanso: ej.descanso,
          volumen,
          rm,
          notas: ej.notas_ej || sesion.notas_generales || ''
        });
      });
    });
    
    const mapPorClienteYEjercicio = new Map<string, any[]>();
    rows.forEach(r => {
      const key = `${r.cliente_id}_${r.ejercicio.toLowerCase()}`;
      if (!mapPorClienteYEjercicio.has(key)) {
        mapPorClienteYEjercicio.set(key, []);
      }
      mapPorClienteYEjercicio.get(key)!.push(r);
    });
    
    const rowsWithDelta = rows.map(r => {
      const key = `${r.cliente_id}_${r.ejercicio.toLowerCase()}`;
      const list = mapPorClienteYEjercicio.get(key) || [];
      const idx = list.findIndex(item => item.fecha === r.fecha && item.id_ej === r.id_ej);
      const prev = idx > 0 ? list[idx - 1] : null;
      
      let deltaHtml = '—';
      let deltaType: 'up' | 'dn' | 'eq' = 'eq';
      
      if (prev && prev.volumen > 0) {
        const diff = r.volumen - prev.volumen;
        const percent = (diff / prev.volumen) * 100;
        if (percent > 0.05) {
          deltaHtml = `▲ ${percent.toFixed(1)}%`;
          deltaType = 'up';
        } else if (percent < -0.05) {
          deltaHtml = `▼ ${Math.abs(percent).toFixed(1)}%`;
          deltaType = 'dn';
        } else {
          deltaHtml = `= 0%`;
          deltaType = 'eq';
        }
      }
      
      return { ...r, deltaHtml, deltaType };
    });
    
    return rowsWithDelta.reverse();
  }, [actividades]);

  const availableExercisesForFilter = useMemo(() => {
    const set = new Set<string>();
    aplanadosEjercicios.forEach(r => {
      if (selectedAnalysisClient === 'all' || r.cliente_id === selectedAnalysisClient) {
        set.add(r.ejercicio);
      }
    });
    return Array.from(set).sort();
  }, [aplanadosEjercicios, selectedAnalysisClient]);

  const filasFiltradasProgresion = useMemo(() => {
    return aplanadosEjercicios.filter(r => {
      const matchClient = selectedAnalysisClient === 'all' || r.cliente_id === selectedAnalysisClient;
      const matchEx = selectedAnalysisExercise === 'all' || r.ejercicio.toLowerCase() === selectedAnalysisExercise.toLowerCase();
      return matchClient && matchEx;
    });
  }, [aplanadosEjercicios, selectedAnalysisClient, selectedAnalysisExercise]);

  return {
    actividades,
    alertasClientes,
    loadingAuditoria,
    fetchAuditoria,
    mostRecentSessionIds,
    aplanadosEjercicios,
    availableExercisesForFilter,
    filasFiltradasProgresion,
    selectedAnalysisClient,
    setSelectedAnalysisClient,
    selectedAnalysisExercise,
    setSelectedAnalysisExercise,
    auditViewMode,
    setAuditViewMode,
    expandedActividades,
    setExpandedActividades
  };
};
