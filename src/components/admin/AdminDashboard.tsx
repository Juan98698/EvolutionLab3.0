import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';
import Toast from '../common/Toast';
import { isRealEmailDomain } from '../../lib/validations';

type RolOption = 'admin' | 'entrenador' | 'cliente';

const ROLE_COLORS: Record<RolOption, { bg: string; border: string; text: string; label: string }> = {
  admin: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', text: '#f87171', label: 'Administrador' },
  entrenador: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.35)', text: '#a5b4fc', label: 'Entrenador' },
  cliente: { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.35)', text: '#5eead4', label: 'Cliente' },
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useSupabase();
  const [users, setUsers] = useState<Profile[]>([]);
  const [trainers, setTrainers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<RolOption | 'todos'>('todos');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Crear Usuario Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRol, setCreateRol] = useState<RolOption>('cliente');
  const [createVigencia, setCreateVigencia] = useState('30');
  const [createObjetivo, setCreateObjetivo] = useState('');
  const [createEntrenadorId, setCreateEntrenadorId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createWhatsapp, setCreateWhatsapp] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  // Editar Usuario Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState<RolOption>('cliente');
  const [editVigencia, setEditVigencia] = useState('30');
  const [editObjetivo, setEditObjetivo] = useState('');
  const [editEntrenadorId, setEditEntrenadorId] = useState('');
  const [editSuscripcionPlan, setEditSuscripcionPlan] = useState<string>('free');
  const [editSuscripcionEstado, setEditSuscripcionEstado] = useState<'activo' | 'expirado' | 'cancelado'>('activo');
  const [editSuscripcionExpiraAt, setEditSuscripcionExpiraAt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState<boolean>(false);

  // Toast State
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => setToastState((prev) => ({ ...prev, visible: false })), 3500);
  };

  // Resize listener for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const loadedUsers = data || [];
      setUsers(loadedUsers);

      // Filtrar entrenadores del sistema para asignación
      const loadedTrainers = loadedUsers.filter((u) => u.rol === 'entrenador');
      setTrainers(loadedTrainers);
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
      showToast('Error al cargar usuarios: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (filterRole !== 'todos') {
      result = result.filter((u) => u.rol === filterRole);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, filterRole, searchQuery]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.rol === 'admin').length;
    const trainersList = users.filter((u) => u.rol === 'entrenador').length;
    const clients = users.filter((u) => u.rol === 'cliente').length;
    return { total: users.length, admins, trainers: trainersList, clients };
  }, [users]);

  // handle registration using a secondary client instance (prevents admin logout)
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createNombre || !createEmail || !createPassword) {
      showToast('⚠️ Por favor completa los campos requeridos.', 'error');
      return;
    }

    const isBypass = profile?.rol === 'admin' || profile?.email === 'jmanuel8.5@outlook.com';
    if (!isBypass && !isRealEmailDomain(createEmail)) {
      showToast('⚠️ Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.', 'error');
      return;
    }

    setCreatingUser(true);
    try {
      const secondarySupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
          },
        }
      );

      const { data, error } = await secondarySupabase.auth.signUp({
        email: createEmail.trim(),
        password: createPassword,
        options: {
          data: {
            nombre: createNombre.trim(),
            rol: createRol,
            vigencia_dias: parseInt(createVigencia, 10) || 28,
            objetivo: createRol === 'cliente' ? createObjetivo.trim() : null,
            entrenador_id: createRol === 'cliente' && createEntrenadorId ? createEntrenadorId : null,
          },
        },
      });

      if (error) throw error;

      if (createRol === 'entrenador' && data?.user?.id) {
        const defaultMarca = {
          nombre_display: createNombre.trim(),
          color_primario: '#00d4ff',
          color_secundario: '#0070a0',
          tipografia: 'Inter' as const,
          eslogan: '',
          whatsapp: createWhatsapp.trim() || undefined
        };
        await supabase
          .from('profiles')
          .update({ marca: defaultMarca })
          .eq('id', data.user.id);
      }

      showToast(`🎉 Usuario "${createNombre}" creado correctamente.`, 'success');
      setCreateOpen(false);

      // Limpiar campos
      setCreateNombre('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRol('cliente');
      setCreateVigencia('28');
      setCreateObjetivo('');
      setCreateEntrenadorId('');
      setCreateWhatsapp('');

      // Recargar datos
      fetchUsers();
    } catch (err: any) {
      console.error('Error al crear usuario:', err);
      showToast('Error al crear usuario: ' + err.message, 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEditClick = (u: Profile) => {
    setEditingUser(u);
    setEditNombre(u.nombre);
    setEditRol(u.rol as RolOption);
    setEditVigencia(String(u.vigencia_dias !== undefined ? u.vigencia_dias : 28));
    setEditObjetivo(u.objetivo || '');
    setEditEntrenadorId(u.entrenador_id || '');
    setEditWhatsapp(u.marca?.whatsapp || '');
    setEditSuscripcionPlan(u.suscripcion_plan || 'free');
    setEditSuscripcionEstado(u.suscripcion_estado || 'activo');
    setEditSuscripcionExpiraAt(u.suscripcion_expira_at ? u.suscripcion_expira_at.substring(0, 10) : '');
    setEditOpen(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);

    try {
      const updatedMarca = editRol === 'entrenador' ? {
        ...(editingUser.marca || {
          nombre_display: editNombre.trim(),
          color_primario: '#00d4ff',
          color_secundario: '#0070a0',
          tipografia: 'Inter' as const,
          eslogan: '',
        }),
        whatsapp: editWhatsapp.trim() || undefined
      } : (editingUser.marca || null);

      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editNombre.trim(),
          rol: editRol,
          vigencia_dias: parseInt(editVigencia, 10) || 28,
          objetivo: editRol === 'cliente' ? editObjetivo.trim() : null,
          entrenador_id: editRol === 'cliente' && editEntrenadorId ? editEntrenadorId : null,
          marca: updatedMarca,
          suscripcion_plan: editSuscripcionPlan,
          suscripcion_estado: editSuscripcionEstado,
          suscripcion_expira_at: editSuscripcionExpiraAt ? new Date(editSuscripcionExpiraAt + 'T12:00:00').toISOString() : null,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      showToast(`✏️ Usuario "${editNombre}" actualizado con éxito.`, 'success');
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Error al editar usuario:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };  const handleVigenciaLocalChange = (userId: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, vigencia_dias: num } : u))
    );
  };

  const handleVigenciaSave = async (userId: string, newVigencia: number) => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vigencia_dias: newVigencia })
        .eq('id', userId);

      if (error) throw error;
      showToast('✅ Vigencia de usuario actualizada.', 'success');
    } catch (err: any) {
      console.error('Error al actualizar vigencia:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === profile?.id) {
      showToast('⚠️ No puedes eliminar tu propio usuario administrador.', 'error');
      return;
    }

    if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente al usuario "${userName}" y TODOS sus datos (planes, historiales, etc.) de forma irreversible?`)) {
      return;
    }

    setUpdatingId(userId);
    try {
      const { error } = await supabase.rpc('delete_user', { target_user_id: userId });

      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast(`🗑️ Usuario "${userName}" eliminado correctamente.`, 'success');
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      showToast('Error al eliminar: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que deseas cerrar la sesión?')) {
      await signOut();
      navigate('/login');
    }
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      {/* HEADER */}
      <div className="top-bar" style={{ marginBottom: '10px', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.35)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ffffff' }}>EVOLUTION</span>{' '}
                <span style={{ background: 'linear-gradient(90deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ADMIN</span>
              </h1>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Panel de Control — <span style={{ color: '#f87171', fontWeight: 600 }}>{profile?.nombre || 'Admin'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px', color: '#fca5a5', padding: '8px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Salir
          </button>
        </div>
      </div>

      {/* Banner de Suscripción Sutil del Administrador */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        borderTop: '1px solid rgba(255, 255, 255, 0.02)',
        padding: '6px 20px',
        textAlign: 'center',
        fontSize: '9px',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 600,
        letterSpacing: '1.2px',
        color: 'rgba(255, 255, 255, 0.65)',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
        <span>PLAN ACTUAL: ADMINISTRADOR DEL SISTEMA | ACCESO ILIMITADO</span>
        <button
          onClick={() => setShowPlanInfoModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ef4444',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            fontWeight: 'bold'
          }}
          title="Ver detalles del plan de administrador"
        >
          ⓘ
        </button>
      </div>

      {/* Modal de Información del Plan del Administrador */}
      {showPlanInfoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowPlanInfoModal(false)}>
          <div style={{
            background: 'var(--theme-card-bg, #0f172a)',
            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            color: 'white',
            fontFamily: "'Orbitron', sans-serif",
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPlanInfoModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: '13px', color: '#ef4444', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', marginTop: 0 }}>
              Detalles del Plan Admin
            </h3>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                Administrador del Sistema 🛡️
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                <p style={{ margin: '0 0 10px 0' }}>• <strong>Privilegios:</strong> Acceso completo e ilimitado.</p>
                <p style={{ margin: '0 0 10px 0' }}>• <strong>Gestión:</strong> Puedes editar roles, vigencias, suscripciones, marcas y base de datos de todos los usuarios.</p>
                <p style={{ margin: '0 0 10px 0' }}>• <strong>Restricciones:</strong> Ninguna. Tu cuenta está marcada con bypass de límites del sistema.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* STATS OVERVIEW CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Usuarios', value: stats.total, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.2)', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
            { label: 'Administradores', value: stats.admins, color: '#f87171', bg: ROLE_COLORS.admin.bg, border: ROLE_COLORS.admin.border, icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
            { label: 'Entrenadores', value: stats.trainers, color: '#a5b4fc', bg: ROLE_COLORS.entrenador.bg, border: ROLE_COLORS.entrenador.border, icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
            { label: 'Clientes', value: stats.clients, color: '#5eead4', bg: ROLE_COLORS.cliente.bg, border: ROLE_COLORS.cliente.border, icon: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v8H2zM6 12h4' },
          ].map((stat) => (
            <div key={stat.label} className="mcard" style={{ background: stat.bg, borderColor: stat.border, boxShadow: 'none' }}>
              <div className="mcard-label" style={{ color: stat.color, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={stat.icon} />
                </svg>
                {stat.label}
              </div>
              <div className="mcard-value" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '26px', fontWeight: 800 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* SEARCH, FILTER & ACTION BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flex: 1, gap: '12px', flexWrap: 'wrap', minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px', color: 'white', padding: '12px 16px', fontSize: '13px'
                }}
              />
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none', borderRadius: '10px', color: 'white',
                padding: '12px 20px', fontSize: '12px', fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)'
              }}
            >
              <span style={{ fontSize: '14px' }}>➕</span> Registrar Usuario
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px' }}>
            {(['todos', 'admin', 'entrenador', 'cliente'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterRole(f)}
                style={{
                  fontSize: '10px', padding: '8px 14px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif",
                  fontWeight: filterRole === f ? 700 : 500, letterSpacing: '0.5px',
                  background: filterRole === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: filterRole === f ? 'white' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.2s'
                }}
              >
                {f === 'todos' ? 'Todos' : ROLE_COLORS[f].label + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* USERS CONTAINER (TABLE OR MOBILE CARDS) */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#f87171', fontFamily: 'Orbitron, sans-serif' }}>
            <span>Cargando usuarios del sistema...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No se encontraron usuarios con los filtros actuales.</p>
          </div>
        ) : isMobile ? (
          /* MOBILE CARDS VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {filteredUsers.map((u) => {
              const roleStyle = ROLE_COLORS[u.rol as RolOption] || ROLE_COLORS.cliente;
              const isSelf = u.id === profile?.id;
              return (
                <div
                  key={u.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: `1px solid ${isSelf ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '16px', padding: '20px',
                    display: 'flex', flexDirection: 'column', gap: '14px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: `linear-gradient(135deg, ${roleStyle.bg}, ${roleStyle.border})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700, color: roleStyle.text,
                        border: `1px solid ${roleStyle.border}`
                      }}>
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                          {u.nombre}
                          {isSelf && <span style={{ fontSize: '9px', color: '#f87171', marginLeft: '6px', fontWeight: 700 }}>(Tú)</span>}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                          {u.email}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '20px', fontSize: '9px',
                      fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                      background: roleStyle.bg, border: `1px solid ${roleStyle.border}`,
                      color: roleStyle.text
                    }}>
                      {roleStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>Vigencia:</span>
                      <span style={{ fontWeight: 600, color: 'white', fontFamily: "'Orbitron', sans-serif" }}>{u.vigencia_dias !== undefined ? `${u.vigencia_dias} días` : 'No asignada'}</span>
                    </div>
                    {u.rol === 'cliente' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Tipo Cliente:</span>
                          <span style={{ fontWeight: 600, color: u.entrenador_id ? '#a5b4fc' : '#2dd4bf' }}>
                            {u.entrenador_id ? 'Asignado (Guiado)' : 'Autónomo (Solo)'}
                          </span>
                        </div>
                        {u.entrenador_id && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Entrenador:</span>
                            <span style={{ fontWeight: 600, color: 'white' }}>
                              {trainers.find(t => t.id === u.entrenador_id)?.nombre || 'Asignado'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {(u.rol === 'entrenador' || (u.rol === 'cliente' && !u.entrenador_id)) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>Suscripción:</span>
                        <span style={{ fontWeight: 600, color: u.suscripcion_estado === 'activo' ? '#2de484' : '#fca5a5' }}>
                          {u.suscripcion_plan?.toUpperCase() || 'FREE'} ({u.suscripcion_estado || 'activo'})
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleEditClick(u)}
                      style={{
                        flex: 1, padding: '10px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                        color: 'white', fontSize: '11px', fontWeight: 600,
                        fontFamily: "'Orbitron', sans-serif", cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      ✏️ Editar Campos
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                        style={{
                          padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px',
                          color: '#fca5a5', cursor: 'pointer', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DESKTOP TABLE VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.1fr 90px 80px 60px',
              padding: '10px 20px', background: 'rgba(255,255,255,0.02)',
              borderRadius: '10px', gap: '12px',
              fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
              fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase'
            }}>
              <span>Nombre</span>
              <span>Email</span>
              <span>Rol / Entrenador</span>
              <span style={{ textAlign: 'center' }}>Vigencia (Días)</span>
              <span style={{ textAlign: 'center' }}>Editar</span>
              <span style={{ textAlign: 'center' }}>Eliminar</span>
            </div>

            {/* User rows */}
            {filteredUsers.map((u) => {
              const roleStyle = ROLE_COLORS[u.rol as RolOption] || ROLE_COLORS.cliente;
              const isSelf = u.id === profile?.id;

              return (
                <div
                  key={u.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.1fr 90px 80px 60px',
                    padding: '14px 20px', gap: '12px', alignItems: 'center',
                    background: isSelf ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelf ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '12px', transition: 'all 0.2s',
                  }}
                >
                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${roleStyle.bg}, ${roleStyle.border})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, color: roleStyle.text,
                      border: `1px solid ${roleStyle.border}`, flexShrink: 0
                    }}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {u.nombre}
                        {isSelf && <span style={{ fontSize: '9px', color: '#f87171', marginLeft: '6px', fontWeight: 700 }}>(Tú)</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                  </div>

                  {/* Current Role Badge & Coach info */}
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '9px',
                        fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                        background: roleStyle.bg, border: `1px solid ${roleStyle.border}`,
                        color: roleStyle.text, letterSpacing: '0.5px'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: roleStyle.text }}></span>
                        {roleStyle.label}
                      </span>
                      {u.rol === 'cliente' && (
                        <span style={{ fontSize: '9px', color: u.entrenador_id ? '#a5b4fc' : '#2dd4bf', marginLeft: '4px', fontWeight: 500 }}>
                          {u.entrenador_id ? `Coach: ${trainers.find(t => t.id === u.entrenador_id)?.nombre || 'Asignado'}` : 'Autónomo'}
                        </span>
                      )}
                      {(u.rol === 'entrenador' || (u.rol === 'cliente' && !u.entrenador_id)) && (
                        <span style={{
                          fontSize: '8.5px',
                          color: u.suscripcion_estado === 'activo' ? '#2de484' : '#fca5a5',
                          fontWeight: 600,
                          marginLeft: '4px',
                          marginTop: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          Plan: {u.suscripcion_plan?.toUpperCase() || 'FREE'} ({u.suscripcion_estado || 'activo'})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vigencia (Días) */}
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      disabled={updatingId === u.id}
                      value={u.vigencia_dias !== undefined ? u.vigencia_dias : ''}
                      placeholder="28"
                      onChange={(e) => handleVigenciaLocalChange(u.id, e.target.value)}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          handleVigenciaSave(u.id, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          if (!isNaN(val)) {
                            handleVigenciaSave(u.id, val);
                            (e.target as HTMLInputElement).blur();
                          }
                        }
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: 'white', padding: '6px 10px',
                        fontSize: '11px', width: '65px', textAlign: 'center',
                        fontFamily: "'Orbitron', sans-serif",
                        outline: 'none',
                        opacity: updatingId === u.id ? 0.5 : 1,
                      }}
                    />
                  </div>

                  {/* Edit Button */}
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleEditClick(u)}
                      disabled={updatingId === u.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px', color: 'white',
                        padding: '6px 10px', cursor: 'pointer',
                        fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>

                  {/* Delete Button */}
                  <div style={{ textAlign: 'center' }}>
                    {isSelf ? (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>—</span>
                    ) : (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                        disabled={updatingId === u.id}
                        title="Eliminar usuario permanentemente"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '8px',
                          color: '#fca5a5',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: updatingId === u.id ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                          e.currentTarget.style.color = '#fca5a5';
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" />
                          <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" />
                          <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE USER MODAL OVERLAY */}
      {createOpen && (
        <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(6px)' }}>
          <div className="modal-box modal-enter" style={{ maxWidth: '500px', width: '90%', background: 'rgba(10, 15, 28, 0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '14px', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>➕ REGISTRAR NUEVO USUARIO</h3>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>NOMBRE COMPLETO *</label>
                <input
                  type="text" required placeholder="Ej. Carlos Mendoza"
                  value={createNombre} onChange={(e) => setCreateNombre(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>EMAIL *</label>
                <input
                  type="email" required placeholder="Ej. carlos@mail.com"
                  value={createEmail} onChange={(e) => setCreateEmail(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>CONTRASEÑA TEMPORAL *</label>
                <input
                  type="password" required placeholder="Min. 6 caracteres"
                  value={createPassword} onChange={(e) => setCreatePassword(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>ROL *</label>
                  <select
                    value={createRol} onChange={(e) => setCreateRol(e.target.value as RolOption)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <option value="cliente" style={{ background: '#0f172a' }}>Cliente</option>
                    <option value="entrenador" style={{ background: '#0f172a' }}>Entrenador</option>
                    <option value="admin" style={{ background: '#0f172a' }}>Admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>VIGENCIA (DÍAS) *</label>
                  <input
                    type="number" required min="1" max="9999"
                    value={createVigencia} onChange={(e) => setCreateVigencia(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontFamily: "'Orbitron', sans-serif" }}
                  />
                </div>
              </div>

              {createRol === 'entrenador' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>NÚMERO DE WHATSAPP / CONTACTO *</label>
                  <input
                    type="text" required placeholder="Ej. +573001234567"
                    value={createWhatsapp} onChange={(e) => setCreateWhatsapp(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                  />
                </div>
              )}

              {createRol === 'cliente' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>ENTRENADOR ASIGNADO</label>
                    <select
                      value={createEntrenadorId} onChange={(e) => setCreateEntrenadorId(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      <option value="">Cliente Autónomo (Sin Coach)</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>OBJETIVO INICIAL</label>
                    <input
                      type="text" placeholder="Ej. Definición, Aumento de masa muscular"
                      value={createObjetivo} onChange={(e) => setCreateObjetivo(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                    />
                  </div>
                </>
              )}

              <button
                type="submit" disabled={creatingUser}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', borderRadius: '10px', color: 'white',
                  padding: '12px', fontSize: '12px', fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700, cursor: 'pointer', marginTop: '10px',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)'
                }}
              >
                {creatingUser ? 'REGISTRANDO USUARIO...' : 'REGISTRAR USUARIO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL OVERLAY */}
      {editOpen && editingUser && (
        <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(6px)' }}>
          <div className="modal-box modal-enter" style={{ maxWidth: '500px', width: '90%', background: 'rgba(10, 15, 28, 0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '14px', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>✏️ EDITAR USUARIO</h3>
              <button onClick={() => setEditOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleEditUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>EMAIL (LECTURA)</label>
                <input
                  type="text" disabled value={editingUser.email}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>NOMBRE COMPLETO *</label>
                <input
                  type="text" required placeholder="Ej. Carlos Mendoza"
                  value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>ROL *</label>
                  <select
                    value={editRol} onChange={(e) => setEditRol(e.target.value as RolOption)}
                    disabled={editingUser.id === profile?.id}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: editingUser.id === profile?.id ? 'default' : 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="entrenador">Entrenador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>VIGENCIA (DÍAS) *</label>
                  <input
                    type="number" required min="1" max="9999"
                    value={editVigencia} onChange={(e) => setEditVigencia(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontFamily: "'Orbitron', sans-serif" }}
                  />
                </div>
              </div>

              {editRol === 'entrenador' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>NÚMERO DE WHATSAPP / CONTACTO</label>
                  <input
                    type="text" placeholder="Ej. +573001234567"
                    value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                  />
                </div>
              )}

              {editRol === 'cliente' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>ENTRENADOR ASIGNADO</label>
                    <select
                      value={editEntrenadorId} onChange={(e) => setEditEntrenadorId(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      <option value="">Cliente Autónomo (Sin Coach)</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>OBJETIVO</label>
                    <input
                      type="text" placeholder="Ej. Fuerza en sentadilla, Hipertrofia de hombros"
                      value={editObjetivo} onChange={(e) => setEditObjetivo(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
                    />
                  </div>
                </>
              )}

              {/* SECCIÓN DE SUSCRIPCIÓN */}
              {(editRol === 'entrenador' || editRol === 'cliente') && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: '#f87171', letterSpacing: '0.5px' }}>SUSCRIPCIÓN Y MEMBRESÍA</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>PLAN DE SUSCRIPCIÓN</label>
                      <select
                        value={editSuscripcionPlan}
                        onChange={(e) => setEditSuscripcionPlan(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                      >
                        {editRol === 'entrenador' ? (
                          <>
                            <option value="free">Gratuito (1 Atleta)</option>
                            <option value="iniciacion">Iniciación (2 Atletas - $14.900/mes)</option>
                            <option value="intermedio">Intermedio (10 Atletas - $59.900/mes)</option>
                            <option value="profesional">Profesional (Ilimitado - $299.900/mes)</option>
                          </>
                        ) : (
                          <>
                            <option value="free">Gratuito (1 Plan Activo)</option>
                            <option value="premium">Solo Lifter Pro (Ilimitado - $19.900/mes)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>ESTADO</label>
                      <select
                        value={editSuscripcionEstado}
                        onChange={(e) => setEditSuscripcionEstado(e.target.value as any)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                      >
                        <option value="activo">Activo / Al Día</option>
                        <option value="expirado">Expirado / Bloqueado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>FECHA DE EXPIRACIÓN</label>
                    <input
                      type="date"
                      value={editSuscripcionExpiraAt}
                      onChange={(e) => setEditSuscripcionExpiraAt(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontFamily: "'Orbitron', sans-serif" }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit" disabled={savingEdit}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', borderRadius: '10px', color: 'white',
                  padding: '12px', fontSize: '12px', fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700, cursor: 'pointer', marginTop: '10px',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)'
                }}
              >
                {savingEdit ? 'GUARDANDO CAMBIOS...' : 'GUARDAR CAMBIOS'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastState.visible && (
        <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
      )}
    </div>
  );
};

export default AdminDashboard;
