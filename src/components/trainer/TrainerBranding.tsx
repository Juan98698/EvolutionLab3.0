import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { FilosofiaPilar, MarcaConfig } from '../../types/database.types';
import Toast from '../common/Toast';

export interface CustomBadgeDef {
  id?: string;
  titulo: string;
  descripcion: string;
  icono: string;
  tipo: 'logro' | 'insignia' | 'pr';
  condicion: 'sesiones_total' | 'ejercicios_diferentes' | 'racha_actual' | 'tiene_pr';
  valor_objetivo: number;
}

const FONT_OPTIONS: MarcaConfig['tipografia'][] = ['Inter', 'Outfit', 'Montserrat', 'Bebas Neue', 'Oswald', 'Orbitron', 'Rajdhani', 'Chakra Petch'];

const FONT_PREVIEW: Record<string, string> = {
  'Inter': "'Inter', sans-serif",
  'Outfit': "'Outfit', sans-serif",
  'Montserrat': "'Montserrat', sans-serif",
  'Bebas Neue': "'Bebas Neue', cursive",
  'Oswald': "'Oswald', sans-serif",
  'Orbitron': "'Orbitron', sans-serif",
  'Rajdhani': "'Rajdhani', sans-serif",
  'Chakra Petch': "'Chakra Petch', sans-serif",
};

const COLOR_PRESETS = [
  { primary: '#00d4ff', secondary: '#0070a0', name: 'Cyan Ice' },
  { primary: '#a855f7', secondary: '#7c3aed', name: 'Purple Haze' },
  { primary: '#f97316', secondary: '#ea580c', name: 'Lava Core' },
  { primary: '#10b981', secondary: '#059669', name: 'Forest Bio' },
  { primary: '#ef4444', secondary: '#dc2626', name: 'Crimson Edge' },
  { primary: '#eab308', secondary: '#ca8a04', name: 'Gold Royal' },
  { primary: '#ec4899', secondary: '#db2777', name: 'Neon Pink' },
  { primary: '#6366f1', secondary: '#4f46e5', name: 'Indigo Night' },
  { primary: '#94a3b8', secondary: '#475569', name: 'Steel Grey' },
  { primary: '#ffffff', secondary: '#94a3b8', name: 'Pure White' },
  { primary: '#334155', secondary: '#0f172a', name: 'Obsidian Black' },
];

const EMOJI_ICONS = ['⚡', '🔥', '💪', '🎯', '🧠', '🏋️', '📊', '🫀', '🛡️', '⏱️', '🔬', '🧬', '🌟', '♻️', '🚀', '🏆', '🥇', '👑', '🤸', '🥊', '🥋'];

const DEFAULT_MARCA: MarcaConfig = {
  nombre_display: '',
  color_primario: '#00d4ff',
  color_secundario: '#0070a0',
  tipografia: 'Inter',
  eslogan: '',
  whatsapp: '',
  instagram: '',
};

const DEFAULT_PILAR: FilosofiaPilar = {
  id: '',
  titulo: '',
  descripcion: '',
  icono: '⚡',
};

export const TrainerBranding: React.FC = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useSupabase();

  // States
  const [marca, setMarca] = useState<MarcaConfig>(DEFAULT_MARCA);
  const [filosofia, setFilosofia] = useState<FilosofiaPilar[]>([]);
  const [insigniasCustom, setInsigniasCustom] = useState<CustomBadgeDef[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'marca' | 'filosofia' | 'insignias'>('marca');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Resize listener for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toast
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false, message: '', type: 'success',
  });
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => setToastState((prev) => ({ ...prev, visible: false })), 3500);
  };

  // Load saved data from profile
  useEffect(() => {
    if (profile) {
      if (profile.marca) {
        setMarca(profile.marca);
      } else {
        setMarca({ ...DEFAULT_MARCA, nombre_display: profile.nombre || '' });
      }
      if (profile.filosofia && Array.isArray(profile.filosofia)) {
        setFilosofia(profile.filosofia);
      }
      if (profile.insignias_custom && Array.isArray(profile.insignias_custom)) {
        setInsigniasCustom(profile.insignias_custom);
      }
      if (profile.logo_url) {
        setLogoUrl(profile.logo_url);
      } else {
        setLogoUrl('');
      }
    }
  }, [profile]);

  const generateId = () => `pilar_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const generateBadgeId = () => `badge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Filosofia pilars
  const addPilar = () => {
    setFilosofia((prev) => [
      ...prev,
      { ...DEFAULT_PILAR, id: generateId() },
    ]);
  };

  const removePilar = (id: string) => {
    setFilosofia((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePilar = (id: string, field: keyof FilosofiaPilar, value: string) => {
    setFilosofia((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const movePilar = (index: number, direction: 'up' | 'down') => {
    setFilosofia((prev) => {
      const arr = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= arr.length) return prev;
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
  };

  // Insignias personalizadas
  const addBadge = () => {
    setInsigniasCustom((prev) => [
      ...prev,
      {
        id: generateBadgeId(),
        titulo: '',
        descripcion: '',
        icono: '🏆',
        tipo: 'logro',
        condicion: 'sesiones_total',
        valor_objetivo: 5
      }
    ]);
  };

  const removeBadge = (id: string) => {
    setInsigniasCustom((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBadge = (id: string, field: keyof CustomBadgeDef, value: any) => {
    setInsigniasCustom((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  // Upload brand logo
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile) return;
    const file = e.target.files[0];
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${profile.id}/brand_logo.${ext}`;

    setUploadingLogo(true);
    showToast('⏳ Subiendo logo al servidor...', 'info');

    try {
      // 1. List and delete any existing files starting with 'brand_logo' to avoid duplicates of different extensions
      try {
        const { data: files } = await supabase.storage
          .from('ejercicios')
          .list(profile.id);
        
        if (files && files.length > 0) {
          const filesToDelete = files
            .filter(f => f.name.startsWith('brand_logo'))
            .map(f => `${profile.id}/${f.name}`);
            
          if (filesToDelete.length > 0) {
            console.log('Deleting old brand logos:', filesToDelete);
            await supabase.storage.from('ejercicios').remove(filesToDelete);
          }
        }
      } catch (listError) {
        console.warn('Non-blocking: Failed to clean up old logos before uploading:', listError);
      }

      // 2. Upload the new file
      const { error: uploadError } = await supabase.storage
        .from('ejercicios')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const { data: publicData } = supabase.storage
        .from('ejercicios')
        .getPublicUrl(filePath);

      if (!publicData || !publicData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública del logo.');
      }

      // 4. Cache bust: append a timestamp so that the PWA/browsers bypass cache and show the new logo immediately
      const cacheBustUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      setLogoUrl(cacheBustUrl);
      showToast('¡Logo subido con éxito! Guarda los cambios para aplicar.', 'success');
    } catch (err: any) {
      console.error('Error al subir logo:', err);
      showToast('Error al subir logo: ' + err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save everything
  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          marca,
          filosofia: filosofia.length > 0 ? filosofia : null,
          logo_url: logoUrl || null,
          insignias_custom: insigniasCustom.length > 0 ? insigniasCustom : null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      await refreshProfile();
      showToast('✅ Cambios guardados exitosamente en la nube.', 'success');
    } catch (err: any) {
      console.error('Error al guardar branding:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }, [profile, marca, filosofia, logoUrl, insigniasCustom, refreshProfile]);

  // Logo preview component
  const LogoPreview = () => {
    const displayName = marca.nombre_display || profile?.nombre || 'Tu Nombre';
    const initials = displayName.split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase();

    return (
      <div style={{
        background: 'var(--theme-card-bg)', borderRadius: '16px', padding: '32px',
        border: '1px solid var(--theme-border)', textAlign: 'center',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
      }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '2px', textTransform: 'uppercase' }}>
          Vista Previa del Logo
        </div>

        <div style={{
          width: '100px', height: '100px', borderRadius: '20px',
          background: logoUrl ? 'transparent' : `linear-gradient(135deg, ${marca.color_primario}, ${marca.color_secundario})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: logoUrl ? 'none' : `0 8px 32px ${marca.color_primario}40`,
          border: logoUrl ? '1px solid rgba(255,255,255,0.1)' : 'none',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo de Marca" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              fontFamily: FONT_PREVIEW[marca.tipografia] || "'Inter', sans-serif",
              fontSize: '32px', fontWeight: 800, color: 'white', letterSpacing: '2px',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {initials}
            </span>
          )}
        </div>

        <div style={{ fontFamily: FONT_PREVIEW[marca.tipografia], color: 'white', fontSize: '18px', fontWeight: 700, letterSpacing: '1px' }}>
          {displayName}
        </div>

        {marca.eslogan && (
          <div style={{ fontSize: '12px', color: marca.color_primario, fontStyle: 'italic', maxWidth: '280px' }}>
            "{marca.eslogan}"
          </div>
        )}

        <div style={{
          marginTop: '8px', padding: '16px 24px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${marca.color_primario}15, ${marca.color_secundario}08)`,
          border: `1px solid ${marca.color_primario}30`,
          width: '100%', maxWidth: '320px'
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', marginBottom: '8px' }}>
            Sistema de Entrenamiento por
          </div>
          <div style={{ fontFamily: FONT_PREVIEW[marca.tipografia], fontSize: '16px', fontWeight: 700, color: marca.color_primario }}>
            {displayName}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      {/* HEADER */}
      <div className="top-bar" style={{ marginBottom: '20px', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/trainer')}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: 'white', padding: '8px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
                fontFamily: "'Orbitron', sans-serif", fontWeight: 600
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Volver
            </button>
            <div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '14px', fontWeight: 800, margin: 0, letterSpacing: '1px' }}>
                <span style={{ color: '#ffffff' }}>IDENTIDAD DE</span>{' '}
                <span className="theme-text-gradient">MARCA</span>
              </h1>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                Personaliza tu logo, colores, filosofía y logros interactivos
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700,
              opacity: saving ? 0.6 : 1, padding: '10px 18px'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {saving ? 'Guardando...' : 'Guardar Todo'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', marginBottom: '24px', maxWidth: '450px' }}>
          {([
            { key: 'marca' as const, label: '🎨 Marca & Logo' },
            { key: 'filosofia' as const, label: '⚡ Filosofía' },
            { key: 'insignias' as const, label: '🏆 Insignias' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, fontSize: '11px', padding: '10px 12px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif",
                fontWeight: activeTab === tab.key ? 700 : 500,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === tab.key ? 'white' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MARCA TAB */}
        {activeTab === 'marca' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Logo de Marca */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Logo Personal (Imagen)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {logoUrl ? (
                    <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                      <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.15)' }}>
                      <span style={{ fontSize: '24px' }}>🖼️</span>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label
                        style={{
                          background: `linear-gradient(135deg, ${marca.color_primario}, ${marca.color_secundario})`,
                          border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: uploadingLogo ? 'default' : 'pointer',
                          fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: 'white',
                          display: 'inline-block', textAlign: 'center', opacity: uploadingLogo ? 0.6 : 1,
                          boxShadow: `0 4px 12px ${marca.color_primario}30`
                        }}
                      >
                        {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          disabled={uploadingLogo}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {logoUrl && (
                        <button
                          onClick={() => {
                            setLogoUrl('');
                            showToast('Logo removido localmente. Recuerda guardar.', 'info');
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px', color: '#f87171', padding: '8px 14px', cursor: 'pointer',
                            fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 600
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.4' }}>
                      Carga una imagen cuadrada (.png, .jpg o .svg) para que aparezca en la portada y cabeceras de tus clientes.
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label htmlFor="brand-name" style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Nombre / Alias / Seudónimo
                </label>
                <input
                  id="brand-name"
                  type="text"
                  value={marca.nombre_display}
                  onChange={(e) => setMarca((prev) => ({ ...prev, nombre_display: e.target.value }))}
                  placeholder="Ej: Coach JM, FitLab Pro..."
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border)',
                    borderRadius: '8px', color: 'white', padding: '12px', fontSize: '14px'
                  }}
                />
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
                  Así aparecerá en los planes de tus clientes: "Sistema de Entrenamiento por <strong style={{ color: marca.color_primario }}>{marca.nombre_display || 'Tu Nombre'}</strong>"
                </div>
              </div>

              {/* Eslogan */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label htmlFor="brand-eslogan" style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Eslogan
                </label>
                <input
                  id="brand-eslogan"
                  type="text"
                  value={marca.eslogan || ''}
                  onChange={(e) => setMarca((prev) => ({ ...prev, eslogan: e.target.value }))}
                  placeholder="Ej: Entrena con propósito, evoluciona con ciencia"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border)',
                    borderRadius: '8px', color: 'white', padding: '12px', fontSize: '13px'
                  }}
                />
              </div>

              {/* Info redes de contacto */}
              <div style={{
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'start',
                gap: '10px',
                marginBottom: '4px'
              }}>
                <span style={{ fontSize: '16px', marginTop: '-2px' }}>ℹ️</span>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.5', fontFamily: 'Inter, sans-serif' }}>
                  <strong style={{ color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontSize: '10px', display: 'block', marginBottom: '4px' }}>DIRECTORIO PÚBLICO DE ENTRENADORES</strong>
                  El número de WhatsApp y tu usuario de Instagram serán visibles para los atletas independientes dentro de la aplicación que estén interesados en ponerse en contacto contigo para solicitarte un plan de entrenamiento.
                </div>
              </div>

              {/* WhatsApp */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label htmlFor="brand-whatsapp" style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Número de WhatsApp / Contacto
                </label>
                <input
                  id="brand-whatsapp"
                  type="text"
                  value={marca.whatsapp || ''}
                  onChange={(e) => setMarca((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="Ej: +573001234567"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border)',
                    borderRadius: '8px', color: 'white', padding: '12px', fontSize: '13px'
                  }}
                />
              </div>

              {/* Instagram */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label htmlFor="brand-instagram" style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Usuario de Instagram
                </label>
                <input
                  id="brand-instagram"
                  type="text"
                  value={marca.instagram || ''}
                  onChange={(e) => setMarca((prev) => ({ ...prev, instagram: e.target.value }))}
                  placeholder="Ej: @tu_coach"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border)',
                    borderRadius: '8px', color: 'white', padding: '12px', fontSize: '13px'
                  }}
                />
              </div>

              {/* Color Palette */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '12px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Paleta de Colores
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = marca.color_primario === preset.primary;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => setMarca((prev) => ({ ...prev, color_primario: preset.primary, color_secundario: preset.secondary }))}
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                          border: isSelected ? '2px solid white' : '2px solid transparent',
                          borderRadius: '10px', padding: '10px 8px', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? `0 0 12px ${preset.primary}50` : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                        }}
                      >
                        <span style={{ fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: "'Orbitron', sans-serif", textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="color-primario" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>Primario</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input id="color-primario" type="color" value={marca.color_primario} onChange={(e) => setMarca((prev) => ({ ...prev, color_primario: e.target.value }))} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }} />
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{marca.color_primario}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="color-secundario" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>Secundario</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input id="color-secundario" type="color" value={marca.color_secundario} onChange={(e) => setMarca((prev) => ({ ...prev, color_secundario: e.target.value }))} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }} />
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{marca.color_secundario}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '12px', letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
                  Tipografía
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font}
                      onClick={() => setMarca((prev) => ({ ...prev, tipografia: font }))}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                        background: marca.tipografia === font ? 'var(--theme-badge-bg)' : 'rgba(255,255,255,0.02)',
                        border: marca.tipografia === font ? `1px solid ${marca.color_primario}50` : '1px solid var(--theme-border)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontFamily: FONT_PREVIEW[font], fontSize: '15px', color: marca.tipografia === font ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                        {font}
                      </span>
                      <span style={{ fontFamily: FONT_PREVIEW[font], fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                        AaBbCcDd 123
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ position: isMobile ? 'static' : 'sticky', top: '20px', alignSelf: 'start' }}>
              <LogoPreview />
            </div>
          </div>
        )}

        {/* FILOSOFIA TAB */}
        {activeTab === 'filosofia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-border)',
              borderRadius: '14px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '12px',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
            }}>
              <span style={{ fontSize: '20px' }}>💡</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>
                  Filosofía Personalizable
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                  Agrega tantos pilares como necesites. Estos se mostrarán a tus clientes en la portada de su plan de entrenamiento.
                </div>
              </div>
            </div>

            {filosofia.map((pilar, index) => (
              <div
                key={pilar.id}
                style={{
                  background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)',
                  borderRadius: '14px', padding: '20px', position: 'relative',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                      color: marca.color_primario, letterSpacing: '1px'
                    }}>
                      PILAR {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => movePilar(index, 'up')} disabled={index === 0} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: index === 0 ? 'rgba(255,255,255,0.15)' : 'white', padding: '4px 8px', cursor: index === 0 ? 'default' : 'pointer', fontSize: '11px' }}>↑</button>
                    <button onClick={() => movePilar(index, 'down')} disabled={index === filosofia.length - 1} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: index === filosofia.length - 1 ? 'rgba(255,255,255,0.15)' : 'white', padding: '4px 8px', cursor: index === filosofia.length - 1 ? 'default' : 'pointer', fontSize: '11px' }}>↓</button>
                    <button onClick={() => removePilar(pilar.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>ICONO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {EMOJI_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => updatePilar(pilar.id, 'icono', emoji)}
                        style={{
                          width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
                          fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: pilar.icono === emoji ? `${marca.color_primario}20` : 'rgba(255,255,255,0.03)',
                          border: pilar.icono === emoji ? `1px solid ${marca.color_primario}50` : '1px solid rgba(255,255,255,0.06)',
                          transition: 'all 0.15s'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor={`pilar-titulo-${pilar.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>TÍTULO DEL PILAR</label>
                  <input
                    id={`pilar-titulo-${pilar.id}`}
                    type="text"
                    value={pilar.titulo}
                    onChange={(e) => updatePilar(pilar.id, 'titulo', e.target.value)}
                    placeholder="Ej: Entrenamiento basado en estímulo real"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label htmlFor={`pilar-desc-${pilar.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>DESCRIPCIÓN</label>
                  <textarea
                    id={`pilar-desc-${pilar.id}`}
                    value={pilar.descripcion}
                    onChange={(e) => updatePilar(pilar.id, 'descripcion', e.target.value)}
                    placeholder="Describe este principio de entrenamiento..."
                    rows={3}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addPilar}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '16px', borderRadius: '14px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontFamily: "'Orbitron', sans-serif",
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar Nuevo Pilar
            </button>
          </div>
        )}

        {/* INSIGNIAS TAB */}
        {activeTab === 'insignias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-border)',
              borderRadius: '14px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '12px',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
            }}>
              <span style={{ fontSize: '20px' }}>🏆</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>
                  Logros & Insignias Personalizadas para tus Clientes
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                  Configura insignias gamificadas que tus atletas vinculados desbloquearán automáticamente al cumplir las condiciones de entrenamiento.
                </div>
              </div>
            </div>

            {insigniasCustom.map((badge, index) => (
              <div
                key={badge.id || index}
                style={{
                  background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)',
                  borderRadius: '14px', padding: '20px', position: 'relative',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                    color: marca.color_primario, letterSpacing: '1.2px'
                  }}>
                    LOGRO PERSONALIZADO {String(index + 1).padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => removeBadge(badge.id || '')}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px', color: '#f87171', padding: '6px 12px', cursor: 'pointer',
                      fontSize: '10px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700
                    }}
                  >
                    ✕ ELIMINAR
                  </button>
                </div>

                {/* Emoji Selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>ÍCONO / EMOJI</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {EMOJI_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => updateBadge(badge.id || '', 'icono', emoji)}
                        style={{
                          width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
                          fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: badge.icono === emoji ? `${marca.color_primario}20` : 'rgba(255,255,255,0.03)',
                          border: badge.icono === emoji ? `1px solid ${marca.color_primario}50` : '1px solid rgba(255,255,255,0.06)',
                          transition: 'all 0.15s'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  {/* Title */}
                  <div>
                    <label htmlFor={`badge-titulo-${badge.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>TÍTULO DE LA INSIGNIA</label>
                    <input
                      id={`badge-titulo-${badge.id}`}
                      type="text"
                      value={badge.titulo}
                      onChange={(e) => updateBadge(badge.id || '', 'titulo', e.target.value)}
                      placeholder="Ej: Guerrero de Acero, Bestia del Squat"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label htmlFor={`badge-tipo-${badge.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>CATEGORÍA DE INSIGNIA</label>
                    <select
                      id={`badge-tipo-${badge.id}`}
                      value={badge.tipo}
                      onChange={(e) => updateBadge(badge.id || '', 'tipo', e.target.value as any)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', height: '40px' }}
                    >
                      <option value="logro">Logro (Asistencia/Constancia)</option>
                      <option value="insignia">Insignia (Técnica/Esfuerzo)</option>
                      <option value="pr">Récord Personal (PR/Fuerza)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  {/* Condition */}
                  <div>
                    <label htmlFor={`badge-condicion-${badge.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>CONDICIÓN PARA GANAR</label>
                    <select
                      id={`badge-condicion-${badge.id}`}
                      value={badge.condicion}
                      onChange={(e) => updateBadge(badge.id || '', 'condicion', e.target.value as any)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', height: '40px' }}
                    >
                      <option value="sesiones_total">Sesiones de entrenamiento totales completadas</option>
                      <option value="ejercicios_diferentes">Ejercicios diferentes registrados en el historial</option>
                      <option value="racha_actual">Días de racha de entrenamiento activa</option>
                      <option value="tiene_pr">Haber roto al menos un Récord Personal (PR)</option>
                    </select>
                  </div>

                  {/* Target value */}
                  <div>
                    <label htmlFor={`badge-objetivo-${badge.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>VALOR OBJETIVO (UMBRAL)</label>
                    <input
                      id={`badge-objetivo-${badge.id}`}
                      type="number"
                      value={badge.valor_objetivo}
                      disabled={badge.condicion === 'tiene_pr'}
                      onChange={(e) => updateBadge(badge.id || '', 'valor_objetivo', parseInt(e.target.value, 10) || 0)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', opacity: badge.condicion === 'tiene_pr' ? 0.3 : 1 }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor={`badge-desc-${badge.id}`} style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', cursor: 'pointer' }}>DESCRIPCIÓN DE CELEBRACIÓN</label>
                  <textarea
                    id={`badge-desc-${badge.id}`}
                    value={badge.descripcion}
                    onChange={(e) => updateBadge(badge.id || '', 'descripcion', e.target.value)}
                    placeholder="Ej: ¡Espectacular! Has entrenado 10 días seguidos sin romper tu racha. Eres imparable."
                    rows={2}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addBadge}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '16px', borderRadius: '14px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontFamily: "'Orbitron', sans-serif",
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Crear Nueva Insignia Personalizada
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          visible={toastState.visible}
        />
      )}
    </div>
  );
};

export default TrainerBranding;
