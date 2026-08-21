import React, { useState } from 'react';
import { useSupabase } from '../../context/SupabaseContext';

interface RoleSelectionModalProps {
  onComplete?: () => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({ onComplete }) => {
  const { user, completeRoleSelection } = useSupabase();
  const [selectedRole, setSelectedRole] = useState<'cliente' | 'entrenador' | null>(null);
  const [trainerName, setTrainerName] = useState(() => {
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      ''
    );
  });
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const googleName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Atleta';

  const handleConfirm = async () => {
    if (!selectedRole) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      if (selectedRole === 'entrenador') {
        await completeRoleSelection('entrenador', {
          nombre: trainerName.trim() || googleName,
          whatsapp: whatsapp.trim(),
          instagram: instagram.trim().replace(/^@/, '')
        });
      } else {
        await completeRoleSelection('cliente', {
          nombre: googleName
        });
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Error al guardar rol:', err);
      setErrorMsg(err.message || 'Ocurrió un error al guardar tu perfil. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-selection-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 8, 16, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 29, 0.98) 100%)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 20px 60px rgba(0, 212, 255, 0.15), 0 0 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          color: 'white',
          position: 'relative'
        }}
      >
        {/* Glow Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              fontSize: '11px',
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '1.5px',
              color: '#00d4ff',
              textTransform: 'uppercase'
            }}
          >
            Paso 1: Configura tu Perfil
          </div>

          <h2
            id="role-selection-title"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              background: 'linear-gradient(135deg, #ffffff 30%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}
          >
            ¡Hola, {googleName}!
          </h2>

          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            ¿Cómo deseas utilizar <strong style={{ color: 'white' }}>Evolution Lab</strong>?
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              color: '#fca5a5',
              fontSize: '12px',
              lineHeight: 1.4
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Tarjetas de Selección de Rol */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
          {/* Opción 1: Atleta Autónomo */}
          <button
            type="button"
            data-testid="role-athlete-btn"
            onClick={() => setSelectedRole('cliente')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              padding: '18px',
              borderRadius: '16px',
              background:
                selectedRole === 'cliente'
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.16) 0%, rgba(123, 47, 247, 0.12) 100%)'
                  : 'rgba(255, 255, 255, 0.03)',
              border:
                selectedRole === 'cliente'
                  ? '2px solid #00d4ff'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow:
                selectedRole === 'cliente'
                  ? '0 0 20px rgba(0, 212, 255, 0.25)'
                  : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.25s ease'
            }}
          >
            <div
              style={{
                fontSize: '28px',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: selectedRole === 'cliente' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              🏋️‍♂️
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '14px',
                    fontWeight: 700,
                    color: selectedRole === 'cliente' ? '#00d4ff' : 'white'
                  }}
                >
                  Soy Atleta Autónomo
                </span>
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: selectedRole === 'cliente' ? '5px solid #00d4ff' : '2px solid rgba(255,255,255,0.3)',
                    background: selectedRole === 'cliente' ? 'white' : 'transparent',
                    display: 'inline-block'
                  }}
                />
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Entreno por mi cuenta. Quiero registrar mis series, recibir sugerencias de peso inteligentes y gestionar mi sobrecarga progresiva.
              </p>
            </div>
          </button>

          {/* Opción 2: Entrenador / Preparador */}
          <button
            type="button"
            data-testid="role-trainer-btn"
            onClick={() => setSelectedRole('entrenador')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              padding: '18px',
              borderRadius: '16px',
              background:
                selectedRole === 'entrenador'
                  ? 'linear-gradient(135deg, rgba(123, 47, 247, 0.16) 0%, rgba(0, 212, 255, 0.12) 100%)'
                  : 'rgba(255, 255, 255, 0.03)',
              border:
                selectedRole === 'entrenador'
                  ? '2px solid #7b2ff7'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow:
                selectedRole === 'entrenador'
                  ? '0 0 20px rgba(123, 47, 247, 0.25)'
                  : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.25s ease'
            }}
          >
            <div
              style={{
                fontSize: '28px',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: selectedRole === 'entrenador' ? 'rgba(123, 47, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              👔
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '14px',
                    fontWeight: 700,
                    color: selectedRole === 'entrenador' ? '#a78bfa' : 'white'
                  }}
                >
                  Soy Entrenador / Coach
                </span>
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: selectedRole === 'entrenador' ? '5px solid #7b2ff7' : '2px solid rgba(255,255,255,0.3)',
                    background: selectedRole === 'entrenador' ? 'white' : 'transparent',
                    display: 'inline-block'
                  }}
                />
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Diseño planificaciones para mis clientes, personalizo mi marca deportiva y superviso el progreso y fatiga de mis atletas.
              </p>
            </div>
          </button>
        </div>

        {/* Campos adicionales para Entrenador */}
        {selectedRole === 'entrenador' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(123, 47, 247, 0.06)',
              border: '1px solid rgba(123, 47, 247, 0.2)'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#c4b5fd', letterSpacing: '0.5px' }}>
              Datos de tu Marca Deportiva (Opcionales):
            </span>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                Nombre comercial o de entrenador
              </label>
              <input
                type="text"
                data-testid="trainer-name-input"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                placeholder="Ej. Coach Juan Pérez"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  WhatsApp
                </label>
                <input
                  type="text"
                  data-testid="trainer-whatsapp-input"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+57 300 1234567"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Instagram
                </label>
                <input
                  type="text"
                  data-testid="trainer-instagram-input"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@mi_cuenta"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Botón de Confirmación */}
        <button
          type="button"
          data-testid="confirm-role-btn"
          disabled={!selectedRole || loading}
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: selectedRole
              ? selectedRole === 'entrenador'
                ? 'linear-gradient(135deg, #7b2ff7 0%, #00d4ff 100%)'
                : 'linear-gradient(135deg, #00d4ff 0%, #0070a0 100%)'
              : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: selectedRole ? 'white' : 'rgba(255, 255, 255, 0.3)',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            cursor: selectedRole && !loading ? 'pointer' : 'not-allowed',
            boxShadow: selectedRole && !loading ? '0 0 25px rgba(0, 212, 255, 0.35)' : 'none',
            transition: 'all 0.25s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spinner 0.8s linear infinite'
                }}
              />
              Configurando perfil...
            </>
          ) : (
            'Comenzar Experiencia'
          )}
        </button>
      </div>
    </div>
  );
};

export default RoleSelectionModal;
