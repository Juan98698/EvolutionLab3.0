import { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';

export const useTrainerClients = (
  profile: Profile | null, 
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void, 
  setTrainerSubscription?: (sub: any) => void
) => {
  const [clientes, setClientes] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [clientesLogros, setClientesLogros] = useState<Record<string, { titulo: string, icono: string, tipo: string }[]>>({});
  const [clientesRachas, setClientesRachas] = useState<Record<string, { actual: number, maxima: number }>>({});
  const [activePlanDays, setActivePlanDays] = useState<string>('7 Días / Sem');

  // Ref para throttling: evita re-fetch al cambiar de pestaña o restaurar ventana.
  // Solo vuelve a cargar si pasaron más de 5 minutos desde el último fetch.
  const lastFetchedAt = useRef<number>(0);
  const FETCH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

  // Ref estable para showToast — evita que fetchClientes cambie de identidad
  // cada vez que el componente padre re-renderiza con una nueva referencia de showToast.
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const calcularRachaLocal = useCallback((sessions: { fecha: string }[]): { actual: number; maxima: number } => {
    if (sessions.length === 0) return { actual: 0, maxima: 0 };
    const dates = [...new Set(sessions.map((s) => s.fecha))].sort();
    if (dates.length === 0) return { actual: 0, maxima: 0 };

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 4) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);

    const lastDate = new Date(dates[dates.length - 1]);
    const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const activeStreak = daysSinceLast <= 4 ? currentStreak : 0;

    return { actual: activeStreak, maxima: maxStreak };
  }, []);

  const fetchClientes = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastFetchedAt.current < FETCH_THROTTLE_MS && lastFetchedAt.current > 0) {
      // Datos recientes (<5 min) — saltar re-fetch para evitar parpadeo al cambiar pestaña
      return;
    }
    setLoading(true);
    try {
      if (profile?.id && setTrainerSubscription) {
        const { data: tData, error: tErr } = await supabase
          .from('profiles')
          .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
          .eq('id', profile.id)
          .maybeSingle();
        if (!tErr && tData) {
          setTrainerSubscription({
            plan: tData.suscripcion_plan || 'free',
            estado: tData.suscripcion_estado || 'activo',
            expira_at: tData.suscripcion_expira_at || null
          });
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('rol', 'cliente')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setClientes(data || []);

      if (data && data.length > 0) {
        const clientIds = data.map(c => c.id);

        const { data: achData } = await supabase
          .from('gamificacion')
          .select('cliente_id, titulo, tipo, datos')
          .in('cliente_id', clientIds);

        const logrosMap: Record<string, { titulo: string, icono: string, tipo: string }[]> = {};
        if (achData) {
          achData.forEach((item: any) => {
            if (!logrosMap[item.cliente_id]) {
              logrosMap[item.cliente_id] = [];
            }
            logrosMap[item.cliente_id].push({
              titulo: item.titulo,
              icono: item.datos?.icono || '🏆',
              tipo: item.tipo
            });
          });
        }
        setClientesLogros(logrosMap);

        const { data: sessData } = await supabase
          .from('sesiones_historial')
          .select('cliente_id, fecha')
          .in('cliente_id', clientIds);

        const rachasMap: Record<string, { actual: number; maxima: number }> = {};
        if (sessData) {
          const sessByClient: Record<string, { fecha: string }[]> = {};
          sessData.forEach((s: any) => {
            if (!sessByClient[s.cliente_id]) {
              sessByClient[s.cliente_id] = [];
            }
            sessByClient[s.cliente_id].push({ fecha: s.fecha });
          });

          clientIds.forEach((cid) => {
            const clientSessions = sessByClient[cid] || [];
            rachasMap[cid] = calcularRachaLocal(clientSessions);
          });
        }
        setClientesRachas(rachasMap);

        const { data: plansData, error: plansError } = await supabase
          .from('planes')
          .select('cliente_id, datos_plan')
          .in('cliente_id', clientIds)
          .eq('activo', true);

        if (!plansError && plansData && plansData.length > 0) {
          let totalTrainingDays = 0;
          let activePlansCount = 0;

          plansData.forEach(p => {
            const datosPlan = p.datos_plan as any;
            if (datosPlan && datosPlan.weekdayMapping) {
              const mapping = datosPlan.weekdayMapping;
              const trainingDaysCount = Object.values(mapping).filter(v => Number(v) !== -1).length;
              totalTrainingDays += trainingDaysCount;
              activePlansCount++;
            }
          });

          if (activePlansCount > 0) {
            const avgDays = Math.round(totalTrainingDays / activePlansCount);
            setActivePlanDays(`${avgDays} Días / Sem`);
          } else {
            setActivePlanDays('7 Días / Sem');
          }
        } else {
          setActivePlanDays('7 Días / Sem');
        }
      } else {
        setActivePlanDays('7 Días / Sem');
      }
    } catch (err: any) {
      console.error('Error al cargar clientes:', err);
      showToastRef.current('Error al cargar clientes: ' + err.message, 'error');
    } finally {
      setLoading(false);
      lastFetchedAt.current = Date.now();
    }
  }, [profile, setTrainerSubscription, calcularRachaLocal]);

  const filteredClientes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clientes, searchQuery]);

  return {
    clientes,
    setClientes,
    loading,
    searchQuery,
    setSearchQuery,
    filteredClientes,
    clientesLogros,
    clientesRachas,
    activePlanDays,
    fetchClientes
  };
};
