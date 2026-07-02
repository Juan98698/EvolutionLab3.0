import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { Profile } from '../../../types/database.types';
import { isRealEmailDomain } from '../../../lib/validations';

interface RegisterClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  clientes: Profile[];
  fetchClientes: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const RegisterClientModal: React.FC<RegisterClientModalProps> = ({
  isOpen,
  onClose,
  profile,
  clientes,
  fetchClientes,
  showToast
}) => {
  // ── Modo: 'crear' | 'vincular' ────────────────────────────────────────────
  const [mode, setMode] = useState<'crear' | 'vincular'>('crear');

  // Crear cuenta
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newModality, setNewModality] = useState<'remoto' | 'presencial'>('remoto');

  // Vincular existente
  const [linkEmail, setLinkEmail] = useState('');
  const [linkModality, setLinkModality] = useState<'remoto' | 'presencial'>('remoto');
  const [linkPreview, setLinkPreview] = useState<{ id: string; nombre: string; email: string } | null>(null);
  const [linkSearching, setLinkSearching] = useState(false);

  const [registerLoading, setRegisterLoading] = useState(false);

  // Copiar link de la app
  const [linkCopied, setLinkCopied] = useState(false);
  const handleCopyAppLink = async () => {
    try {
      const url = window.location.origin;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const ta = document.createElement('textarea');
      ta.value = window.location.origin;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const validatePlanLimits = async () => {
    const { data: updatedTrainer, error: trainerError } = await supabase
      .from('profiles')
      .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
      .eq('id', profile!.id)
      .maybeSingle();

    if (trainerError) throw trainerError;

    const estado = updatedTrainer?.suscripcion_estado || 'activo';
    let isExpired = estado === 'expirado' || estado === 'cancelado';
    if (updatedTrainer?.suscripcion_expira_at) {
      const expDate = new Date(updatedTrainer.suscripcion_expira_at);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) isExpired = true;
    }
    if (isExpired) throw new Error('Tu membresía está inactiva o ha expirado. Por favor, realiza la renovación para poder registrar nuevos atletas.');

    const plan = updatedTrainer?.suscripcion_plan || 'free';
    let limit = 1;
    if (plan === 'iniciacion') limit = 2;
    else if (plan === 'intermedio') limit = 10;
    else if (plan === 'profesional') limit = 999999;

    const countRemotos = clientes.filter(c => c.modalidad === 'remoto' || !c.modalidad).length;
    const countPresenciales = clientes.filter(c => c.modalidad === 'presencial').length;
    const modality = mode === 'crear' ? newModality : linkModality;

    if (plan === 'free') {
      if (modality === 'remoto' && countRemotos >= 1)
        throw new Error('El plan gratuito permite un máximo de 1 atleta remoto. Actualiza tu plan para registrar más atletas remotos.');
      if (modality === 'presencial' && countPresenciales >= 1)
        throw new Error('El plan gratuito permite un máximo de 1 atleta presencial. Actualiza tu plan para registrar más atletas presenciales.');
      if (clientes.length >= 2)
        throw new Error('Has alcanzado el límite del plan gratuito (máximo 2 atletas: 1 remoto y 1 presencial).');
    } else {
      if (clientes.length >= limit)
        throw new Error(`Has alcanzado el límite de tu plan actual (${limit} atleta${limit > 1 ? 's' : ''}). Por favor actualiza tu suscripción para continuar.`);
    }
  };

  const resetAll = () => {
    setNewEmail(''); setNewPassword(''); setNewName(''); setNewGoal(''); setNewModality('remoto');
    setLinkEmail(''); setLinkModality('remoto'); setLinkPreview(null);
  };

  // ── Buscar atleta por email ───────────────────────────────────────────────
  const handleSearchByEmail = async () => {
    if (!linkEmail.trim()) return;
    setLinkSearching(true);
    setLinkPreview(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre, email, entrenador_id, rol')
        .eq('email', linkEmail.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showToast('No se encontró ningún usuario con ese correo.', 'error');
        return;
      }
      if (data.rol === 'entrenador' || data.rol === 'admin') {
        showToast('Ese usuario es un entrenador o admin, no puede ser vinculado como atleta.', 'error');
        return;
      }
      if (data.entrenador_id && data.entrenador_id !== profile?.id) {
        showToast('Ese atleta ya está vinculado a otro entrenador.', 'error');
        return;
      }
      if (data.entrenador_id === profile?.id) {
        showToast('Ese atleta ya está en tu lista.', 'info');
        return;
      }
      setLinkPreview({ id: data.id, nombre: data.nombre, email: data.email });
    } catch (err: any) {
      showToast('Error al buscar: ' + err.message, 'error');
    } finally {
      setLinkSearching(false);
    }
  };

  // ── Vincular atleta existente ─────────────────────────────────────────────
  const handleLinkClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkPreview) return;
    setRegisterLoading(true);
    try {
      if (!profile?.id) throw new Error('Sesión de entrenador no válida.');
      await validatePlanLimits();

      const { error } = await supabase
        .from('profiles')
        .update({ entrenador_id: profile.id, rol: 'cliente', modalidad: linkModality })
        .eq('id', linkPreview.id);

      if (error) throw error;

      // ── Notificación push al atleta ──────────────────────────────────────
      const trainerName = profile.marca?.nombre_display || profile.nombre || 'Tu entrenador';
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: linkPreview.id,
            title: '🏋️ ¡Tienes un nuevo entrenador!',
            body: `${trainerName} te ha vinculado a su equipo en Evolution Lab. Ya puedes ver tu plan de entrenamiento.`,
            icon: '/icon-192.png',
            url: '/dashboard'
          })
        });
      } catch {
        // La notificación es opcional — si falla no bloquea el flujo
      }

      showToast(`🎉 ¡${linkPreview.nombre} vinculado a tu cuenta exitosamente!`, 'success');
      resetAll();
      onClose();
      fetchClientes(true);
    } catch (err: any) {
      showToast('Error al vincular: ' + err.message, 'error');
    } finally {
      setRegisterLoading(false);
    }
  };


  // ── Crear cuenta nueva ────────────────────────────────────────────────────
  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    try {
      if (!profile?.id) throw new Error('Sesión de entrenador no válida.');
      await validatePlanLimits();

      const isBypass = profile?.rol === 'admin' || profile?.email === 'jmanuel8.5@outlook.com';
      if (!isBypass && !isRealEmailDomain(newEmail)) {
        throw new Error('Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.');
      }

      const secondarySupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } }
      );

      const { data: signUpData, error } = await secondarySupabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: {
            nombre: newName.trim(),
            rol: 'cliente',
            objetivo: newGoal.trim(),
            entrenador_id: profile?.id,
            modalidad: newModality,
          },
        },
      });

      if (error) throw error;

      if (signUpData?.user?.id) {
        await supabase
          .from('profiles')
          .update({ modalidad: newModality })
          .eq('id', signUpData.user.id);
      }

      showToast(`🎉 ¡Atleta ${newName} registrado con éxito!`, 'success');
      resetAll();
      onClose();
      fetchClientes(true);
    } catch (err: any) {
      showToast('Error al registrar: ' + err.message, 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  // ── Estilos compartidos ───────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box'
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)',
    fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px'
  };

  return (
    <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
      <div className="modal-box modal-enter" style={{ maxWidth: '460px', width: '90%', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
            AGREGAR ATLETA
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* Botón compartir link de la app */}
        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Link de la app</span><br />
            <span style={{ fontSize: '10px' }}>{window.location.origin}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyAppLink}
            style={{
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              background: linkCopied ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.07)',
              color: linkCopied ? '#00ff88' : 'rgba(255,255,255,0.8)',
              fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.25s', whiteSpace: 'nowrap',
              border: linkCopied ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {linkCopied ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> ¡Copiado!</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar link</>
            )}
          </button>
        </div>

        {/* Toggle modo */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
          {(['crear', 'vincular'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setLinkPreview(null); }}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                transition: 'all 0.2s',
                background: mode === m ? 'var(--theme-primary)' : 'transparent',
                color: mode === m ? '#000' : 'rgba(255,255,255,0.5)',
              }}
            >
              {m === 'crear' ? '➕ NUEVA CUENTA' : '🔗 VINCULAR EXISTENTE'}
            </button>
          ))}
        </div>

        {/* ── MODO: CREAR CUENTA ── */}
        {mode === 'crear' && (
          <form onSubmit={handleRegisterClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>NOMBRE COMPLETO</label>
              <input type="text" required placeholder="Ej. Juan Manuel Cardona" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CORREO ELECTRÓNICO</label>
              <input type="email" required placeholder="ejemplo@correo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CONTRASEÑA TEMPORAL</label>
              <input type="password" required placeholder="Min. 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>OBJETIVO / FOCO PRINCIPAL</label>
              <input type="text" required placeholder="Ej. Hipertrofia general, Fuerza en banca" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>MODALIDAD DE ENTRENAMIENTO</label>
              <select value={newModality} onChange={(e) => setNewModality(e.target.value as 'remoto' | 'presencial')} style={{ ...inputStyle, background: 'rgba(0,0,0,0.45)' }}>
                <option value="remoto">🌐 Remoto (Online)</option>
                <option value="presencial">🏋️ Presencial (En Gimnasio)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={registerLoading} style={{ marginTop: '6px' }}>
              <span>{registerLoading ? 'REGISTRANDO ATLETA...' : 'Confirmar y Guardar'}</span>
            </button>
          </form>
        )}

        {/* ── MODO: VINCULAR EXISTENTE ── */}
        {mode === 'vincular' && (
          <form onSubmit={handleLinkClient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}>
              💡 Usa esto cuando un atleta ya tiene cuenta en Evolution Lab (como atleta autónomo) y quiere contratarte como entrenador. Ingresa su correo registrado y vincúlalo a tu lista.
            </div>

            <div>
              <label style={labelStyle}>CORREO DEL ATLETA EN EVOLUTION LAB</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  required
                  placeholder="correo@registrado.com"
                  value={linkEmail}
                  onChange={(e) => { setLinkEmail(e.target.value); setLinkPreview(null); }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleSearchByEmail}
                  disabled={linkSearching || !linkEmail.trim()}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'var(--theme-primary)', color: '#000', fontWeight: 700,
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', whiteSpace: 'nowrap',
                    opacity: (!linkEmail.trim() || linkSearching) ? 0.5 : 1
                  }}
                >
                  {linkSearching ? '...' : 'Buscar'}
                </button>
              </div>
            </div>

            {/* Preview del atleta encontrado */}
            {linkPreview && (
              <div style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '1.5px solid rgba(0,255,136,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#00ff88', fontFamily: "'Orbitron', sans-serif", flexShrink: 0 }}>
                  {linkPreview.nombre.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', fontFamily: "'Orbitron', sans-serif" }}>{linkPreview.nombre}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(0,255,136,0.8)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>✓ Atleta encontrado — listo para vincular</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', marginTop: '1px' }}>{linkPreview.email}</div>
                </div>
              </div>
            )}

            {linkPreview && (
              <div>
                <label style={labelStyle}>MODALIDAD DE ENTRENAMIENTO</label>
                <select value={linkModality} onChange={(e) => setLinkModality(e.target.value as 'remoto' | 'presencial')} style={{ ...inputStyle, background: 'rgba(0,0,0,0.45)' }}>
                  <option value="remoto">🌐 Remoto (Online)</option>
                  <option value="presencial">🏋️ Presencial (En Gimnasio)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={registerLoading || !linkPreview}
              style={{ marginTop: '4px', opacity: !linkPreview ? 0.4 : 1 }}
            >
              <span>{registerLoading ? 'VINCULANDO...' : '🔗 Vincular Atleta'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterClientModal;
