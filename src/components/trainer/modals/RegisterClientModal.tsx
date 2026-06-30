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
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newModality, setNewModality] = useState<'remoto' | 'presencial'>('remoto');
  const [registerLoading, setRegisterLoading] = useState(false);

  if (!isOpen) return null;

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);

    try {
      if (!profile?.id) throw new Error('Sesión de entrenador no válida.');

      // 1. Obtener datos actualizados del entrenador para validar límites y expiración
      const { data: updatedTrainer, error: trainerError } = await supabase
        .from('profiles')
        .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
        .eq('id', profile.id)
        .maybeSingle();

      if (trainerError) throw trainerError;

      // 2. Validar expiración del entrenador
      const estado = updatedTrainer?.suscripcion_estado || 'activo';
      let isExpired = estado === 'expirado' || estado === 'cancelado';
      if (updatedTrainer?.suscripcion_expira_at) {
        const expDate = new Date(updatedTrainer.suscripcion_expira_at);
        if (!isNaN(expDate.getTime()) && expDate < new Date()) {
          isExpired = true;
        }
      }

      if (isExpired) {
        throw new Error('Tu membresía está inactiva o ha expirado. Por favor, realiza la renovación para poder registrar nuevos atletas.');
      }

      // 3. Validar límite de atletas según plan
      const plan = updatedTrainer?.suscripcion_plan || 'free';
      let limit = 1;
      if (plan === 'iniciacion') limit = 2;
      else if (plan === 'intermedio') limit = 10;
      else if (plan === 'profesional') limit = 999999;

      const countRemotos = clientes.filter(c => c.modalidad === 'remoto' || !c.modalidad).length;
      const countPresenciales = clientes.filter(c => c.modalidad === 'presencial').length;

      if (plan === 'free') {
        if (newModality === 'remoto' && countRemotos >= 1) {
          throw new Error('El plan gratuito permite un máximo de 1 atleta remoto. Actualiza tu plan para registrar más atletas remotos.');
        }
        if (newModality === 'presencial' && countPresenciales >= 1) {
          throw new Error('El plan gratuito permite un máximo de 1 atleta presencial. Actualiza tu plan para registrar más atletas presenciales.');
        }
        if (clientes.length >= 2) {
          throw new Error('Has alcanzado el límite del plan gratuito (máximo 2 atletas: 1 remoto y 1 presencial).');
        }
      } else {
        if (clientes.length >= limit) {
          throw new Error(`Has alcanzado el límite de tu plan actual (${limit} atleta${limit > 1 ? 's' : ''}). Por favor actualiza tu suscripción para continuar.`);
        }
      }

      const isBypass = profile?.rol === 'admin' || profile?.email === 'jmanuel8.5@outlook.com';
      if (!isBypass && !isRealEmailDomain(newEmail)) {
        throw new Error('Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.');
      }

      // Instancia secundaria independiente de Supabase (evita desloguear al entrenador)
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
      
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewGoal('');
      setNewModality('remoto');
      onClose();
      fetchClientes();

    } catch (err: any) {
      console.error('Error al registrar cliente:', err);
      showToast('Error al registrar: ' + err.message, 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className={`modal-overlay modal-overlay-enter open`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
      <div className="modal-box modal-enter" style={{ maxWidth: '450px', width: '90%', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
            REGISTRAR ATLETA
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleRegisterClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>NOMBRE COMPLETO</label>
            <input
              type="text"
              required
              placeholder="Ej. Juan Manuel Cardona"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>CORREO ELECTRÓNICO</label>
            <input
              type="email"
              required
              placeholder="ejemplo@correo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>CONTRASEÑA TEMPORAL</label>
            <input
              type="password"
              required
              placeholder="Min. 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>OBJETIVO / FOCO PRINCIPAL</label>
            <input
              type="text"
              required
              placeholder="Ej. Hipertrofia general, Fuerza en banca"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>MODALIDAD DE ENTRENAMIENTO</label>
            <select
              value={newModality}
              onChange={(e) => setNewModality(e.target.value as 'remoto' | 'presencial')}
              style={{ width: '100%', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', outline: 'none' }}
            >
              <option value="remoto">🌐 Remoto (Online)</option>
              <option value="presencial">🏋️ Presencial (En Gimnasio)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={registerLoading} style={{ marginTop: '10px' }}>
            <span>{registerLoading ? 'REGISTRANDO ATLETA...' : 'Confirmar y Guardar'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterClientModal;
