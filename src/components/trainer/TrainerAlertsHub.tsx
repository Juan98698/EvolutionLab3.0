import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { analizarSobrecargaProgresiva, Session, Notification } from '../../lib/overload';
import { DEFAULT_RULES } from '../../lib/rules';
import { resolveOverloadRules, resolveOverloadConfig } from '../../lib/sessions';

interface ClientAlert {
  clienteId: string;
  clienteNombre: string;
  clienteEmail: string;
  alertas: Notification[];
  totalSesiones: number;
  ultimaSesion: string | null;
  diasInactivo: number;
}

interface TrainerAlertsHubProps {
  visible: boolean;
  onClose: () => void;
}

const ALERT_PRIORITY: Record<string, number> = {
  error: 0,
  warning: 1,
  success: 2,
  info: 3,
};

const ALERT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: '#f87171', icon: '🔴' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#fbbf24', icon: '🟡' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#34d399', icon: '🟢' },
  info: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.25)', text: '#a5b4fc', icon: '🔵' },
};

export const TrainerAlertsHub: React.FC<TrainerAlertsHubProps> = ({ visible, onClose }) => {
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [clientAlerts, setClientAlerts] = useState<ClientAlert[]>([]);
  const [filterType, setFilterType] = useState<'todos' | 'criticos' | 'inactivos' | 'positivos'>('todos');

  useEffect(() => {
    if (!visible || !user) return;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        // 1. Get all clients assigned to this trainer
        const { data: clientes } = await supabase
          .from('profiles')
          .select('id, nombre, email')
          .eq('rol', 'cliente')
          .eq('entrenador_id', user.id)
          .order('nombre');

        if (!clientes || clientes.length === 0) {
          setClientAlerts([]);
          setLoading(false);
          return;
        }

        const clientIds = clientes.map((c) => c.id);
        const alerts: ClientAlert[] = [];

        // 2. Consulta Agrupada Única (Batching) para sesiones
        const { data: ejerData, error: ejerError } = await supabase
          .from('sesiones_ejercicios')
          .select('*, sesiones_historial!inner(fecha, cliente_id)')
          .in('sesiones_historial.cliente_id', clientIds)
          .order('created_at', { ascending: true });

        if (ejerError) throw ejerError;

        // 3. Consulta Agrupada Única (Batching) para planes activos
        const { data: plansData, error: plansError } = await supabase
          .from('planes')
          .select('cliente_id, datos_plan')
          .in('cliente_id', clientIds)
          .eq('activo', true);

        if (plansError) throw plansError;

        // 4. Agrupar ejercicios por cliente en memoria local (0ms en JS)
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

        // 5. Agrupar planes por cliente en memoria local
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

        // 6. Analizar sobrecarga para cada cliente
        for (const cliente of clientes) {
          try {
            const overloadSessions = ejerciciosPorCliente[cliente.id] || [];
            if (overloadSessions.length === 0) {
              // Client with no sessions
              alerts.push({
                clienteId: cliente.id,
                clienteNombre: cliente.nombre,
                clienteEmail: cliente.email,
                alertas: [],
                totalSesiones: 0,
                ultimaSesion: null,
                diasInactivo: -1,
              });
              continue;
            }

            // Get unique dates for session count
            const fechasUnicas = [...new Set(overloadSessions.map((s) => s.fecha))].sort();
            const ultimaFecha = fechasUnicas[fechasUnicas.length - 1] || null;
            const diasInactivo = ultimaFecha
              ? Math.round((Date.now() - new Date(ultimaFecha).getTime()) / (1000 * 60 * 60 * 24))
              : -1;

            // Resolve rules and config for this specific client
            const resolved = planMap[cliente.id] || {
              rules: DEFAULT_RULES,
              config: {},
              exercises: []
            };

            // Run overload analysis
            const notifs = analizarSobrecargaProgresiva(overloadSessions, resolved.rules, resolved.config, resolved.exercises);

            alerts.push({
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
              clienteEmail: cliente.email,
              alertas: notifs,
              totalSesiones: fechasUnicas.length,
              ultimaSesion: ultimaFecha,
              diasInactivo,
            });
          } catch (err) {
            console.warn(`Error procesando cliente ${cliente.nombre}:`, err);
          }
        }

        // Sort: clients with critical alerts first, then by inactivity
        alerts.sort((a, b) => {
          const aCritical = a.alertas.filter((n) => n.tipo === 'error' || n.tipo === 'warning').length;
          const bCritical = b.alertas.filter((n) => n.tipo === 'error' || n.tipo === 'warning').length;
          if (aCritical !== bCritical) return bCritical - aCritical;
          return b.diasInactivo - a.diasInactivo;
        });

        setClientAlerts(alerts);
      } catch (err) {
        console.error('Error al cargar alertas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [visible, user]);

  const filteredAlerts = useMemo(() => {
    switch (filterType) {
      case 'criticos':
        return clientAlerts.filter(
          (c) => c.alertas.some((a) => a.tipo === 'error' || a.tipo === 'warning') || c.diasInactivo > 14
        );
      case 'inactivos':
        return clientAlerts.filter((c) => c.diasInactivo > 7 || c.totalSesiones === 0);
      case 'positivos':
        return clientAlerts.filter((c) => c.alertas.some((a) => a.tipo === 'success'));
      default:
        return clientAlerts;
    }
  }, [clientAlerts, filterType]);

  const stats = useMemo(() => {
    const criticos = clientAlerts.filter(
      (c) => c.alertas.some((a) => a.tipo === 'error' || a.tipo === 'warning')
    ).length;
    const inactivos = clientAlerts.filter((c) => c.diasInactivo > 7).length;
    const enRacha = clientAlerts.filter((c) => c.alertas.some((a) => a.tipo === 'success')).length;
    return { criticos, inactivos, enRacha, total: clientAlerts.length };
  }, [clientAlerts]);

  if (!visible) return null;

  return (
    <div
      className="modal-overlay modal-overlay-enter open"
      style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        zIndex: 99999, backdropFilter: 'blur(8px)', paddingTop: '40px',
      }}
    >
      <div
        className="modal-box modal-enter"
        style={{
          maxWidth: '700px', width: '95%', maxHeight: '85vh',
          overflowY: 'auto', border: '1px solid var(--theme-border)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          background: 'var(--theme-card-bg)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '18px', padding: '0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px', borderBottom: '1px solid var(--theme-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'sticky', top: 0, background: 'var(--theme-card-bg)', zIndex: 1,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '18px 18px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
              }}
            >
              <span style={{ fontSize: '18px' }}>📊</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', color: 'white' }}>
                HUB DE ALERTAS
              </h3>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>
                Estado de sobrecarga de todos tus atletas
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.5)', padding: '6px 10px',
              cursor: 'pointer', fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Stats Summary */}
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
            { label: 'Cr\u00edticos', value: stats.criticos, color: '#f87171', bg: 'rgba(239,68,68,0.08)' },
            { label: 'Inactivos', value: stats.inactivos, color: '#fbbf24', bg: 'rgba(245,158,11,0.08)' },
            { label: 'En racha', value: stats.enRacha, color: '#34d399', bg: 'rgba(16,185,129,0.08)' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: s.bg, borderRadius: '10px', padding: '12px', textAlign: 'center',
                border: `1px solid ${s.color}20`,
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div style={{ padding: '0 24px 12px', display: 'flex', gap: '4px', background: 'transparent' }}>
          {([
            { key: 'todos' as const, label: 'Todos' },
            { key: 'criticos' as const, label: 'Cr\u00edticos' },
            { key: 'inactivos' as const, label: 'Inactivos' },
            { key: 'positivos' as const, label: 'En racha' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                fontSize: '10px', padding: '6px 12px', borderRadius: '6px',
                border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif",
                fontWeight: filterType === f.key ? 700 : 500,
                background: filterType === f.key ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                color: filterType === f.key ? 'white' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", fontSize: '12px' }}>
              Analizando atletas...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              No hay alertas con el filtro actual.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredAlerts.map((client) => {
                const criticalCount = client.alertas.filter((a) => a.tipo === 'error' || a.tipo === 'warning').length;
                const positiveCount = client.alertas.filter((a) => a.tipo === 'success').length;
                const isInactive = client.diasInactivo > 7;
                const hasNoSessions = client.totalSesiones === 0;

                return (
                  <div
                    key={client.clienteId}
                    style={{
                      background: 'var(--theme-card-bg)',
                      border: `1px solid ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.35)' : isInactive ? 'rgba(245, 158, 11, 0.3)' : 'var(--theme-border)'}`,
                      borderRadius: '12px', padding: '16px', transition: 'all 0.2s',
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    {/* Client header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: client.alertas.length > 0 ? '10px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: criticalCount > 0 ? 'rgba(239,68,68,0.15)' : positiveCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700,
                            color: criticalCount > 0 ? '#f87171' : positiveCount > 0 ? '#34d399' : '#94a3b8',
                            border: `1px solid ${criticalCount > 0 ? 'rgba(239,68,68,0.3)' : positiveCount > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.15)'}`,
                          }}
                        >
                          {client.clienteNombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{client.clienteNombre}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
                            {hasNoSessions
                              ? 'Sin sesiones registradas'
                              : `${client.totalSesiones} sesiones | ${client.diasInactivo === 0 ? 'Activo hoy' : `Hace ${client.diasInactivo}d`}`}
                          </div>
                        </div>
                      </div>

                      {/* Status badges */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {criticalCount > 0 && (
                          <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 700 }}>
                            {criticalCount} alerta{criticalCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {isInactive && (
                          <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontWeight: 700 }}>
                            Inactivo
                          </span>
                        )}
                        {positiveCount > 0 && !criticalCount && (
                          <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 700 }}>
                            En racha
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alert details (top 3) */}
                    {client.alertas.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {client.alertas
                          .sort((a, b) => (ALERT_PRIORITY[a.tipo] ?? 3) - (ALERT_PRIORITY[b.tipo] ?? 3))
                          .slice(0, 3)
                          .map((alerta, i) => {
                            const style = ALERT_COLORS[alerta.tipo] || ALERT_COLORS.info;
                            return (
                              <div
                                key={`${alerta.id}-${i}`}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '6px 10px', borderRadius: '8px',
                                  background: style.bg, fontSize: '10px',
                                }}
                              >
                                <span style={{ fontSize: '10px' }}>{style.icon}</span>
                                <span style={{ color: style.text, fontWeight: 600 }}>{alerta.ejercicio}:</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', flex: 1 }}>{alerta.mensaje.substring(0, 80)}{alerta.mensaje.length > 80 ? '...' : ''}</span>
                              </div>
                            );
                          })}
                        {client.alertas.length > 3 && (
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingRight: '10px' }}>
                            +{client.alertas.length - 3} alertas m{'\u00e1'}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainerAlertsHub;
