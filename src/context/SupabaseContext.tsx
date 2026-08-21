import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types/database.types';

interface SupabaseContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isTrainer: boolean;
  isAdmin: boolean;
  isSoloClient: boolean;
  needsRoleSelection: boolean;
  completeRoleSelection: (
    rol: 'cliente' | 'entrenador',
    trainerData?: { whatsapp?: string; instagram?: string; nombre?: string }
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    // Inicialización síncrona del perfil desde caché para arranque instantáneo sin parpadeo
    try {
      const cached = localStorage.getItem('pwa_user_profile');
      if (cached) return JSON.parse(cached) as Profile;
    } catch (e) {
      console.error('Error al restaurar perfil en caché de inicio:', e);
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [needsRoleSelection, setNeedsRoleSelection] = useState<boolean>(false);

  // Ref para evitar doble inicialización de la sesión por la carrera entre initSession y onAuthStateChange
  const initDone = useRef(false);

  // Transición de opacidad suave de la PWA al inicializar la sesión
  useEffect(() => {
    if (!loading) {
      document.body.classList.add('auth-ready');
    }
  }, [loading]);

  const fetchProfile = async (userId: string, currentUser?: User | null): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        localStorage.setItem('pwa_user_profile', JSON.stringify(data));

        // onboarding_completado es un flag dedicado (migración 20260821_fix_onboarding_completado_flag.sql)
        // que el trigger handle_new_user() marca en false SOLO cuando el perfil se creó sin
        // un 'rol' explícito en raw_user_meta_data (el caso de OAuth). El registro manual
        // siempre manda 'rol', así que nunca lo dispara. No depende de suscripcion_plan,
        // que tiene DEFAULT 'free' a nivel de columna y por eso nunca sirvió como señal.
        setNeedsRoleSelection(profileData.onboarding_completado === false);

        return profileData;
      } else {
        // Si el usuario acaba de registrarse con Google OAuth y no tiene perfil aún en BD
        try {
          const { data: authUserData } = await supabase.auth.getUser();
          const targetAuthUser = authUserData?.user || currentUser || user;
          if (targetAuthUser && targetAuthUser.id === userId) {
            const googleName =
              targetAuthUser.user_metadata?.full_name ||
              targetAuthUser.user_metadata?.name ||
              targetAuthUser.email?.split('@')[0] ||
              'Atleta';
            const newProfileData = {
              id: userId,
              email: targetAuthUser.email || '',
              nombre: googleName,
              rol: 'cliente' as const,
              vigencia_dias: 30,
              suscripcion_plan: 'free',
              suscripcion_estado: 'activo',
              suscripcion_expira_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              onboarding_completado: false
            };
            const { data: createdProfile } = await supabase
              .from('profiles')
              .upsert(newProfileData)
              .select()
              .maybeSingle();

            if (createdProfile) {
              const profileData = createdProfile as Profile;
              setProfile(profileData);
              localStorage.setItem('pwa_user_profile', JSON.stringify(profileData));
              setNeedsRoleSelection(true);
              return profileData;
            }
          }
        } catch (createErr) {
          console.error('Error al auto-crear perfil para OAuth:', createErr);
        }

        setProfile(null);
        return null;
      }
    } catch (err) {
      console.error('Error al obtener perfil de Supabase:', err);
      // En caso de error de red, intentar usar perfil cacheado
      try {
        const cached = localStorage.getItem('pwa_user_profile');
        if (cached) {
          const cachedProfile = JSON.parse(cached) as Profile;
          if (cachedProfile.id === userId) {
            setProfile(cachedProfile);
            return cachedProfile;
          }
        }
      } catch (e) {}
      return null;
    }
  };

  const completeRoleSelection = async (
    rol: 'cliente' | 'entrenador',
    trainerData?: { whatsapp?: string; instagram?: string; nombre?: string }
  ) => {
    const targetUser = user || (await supabase.auth.getUser()).data?.user;
    if (!targetUser) throw new Error('No hay usuario autenticado');

    const displayName =
      trainerData?.nombre?.trim() ||
      targetUser.user_metadata?.full_name ||
      targetUser.user_metadata?.name ||
      profile?.nombre ||
      targetUser.email?.split('@')[0] ||
      'Atleta';

    const whatsapp = trainerData?.whatsapp?.trim() || '';
    const instagram = trainerData?.instagram?.trim() || '';

    // NOTA IMPORTANTE: no existe una vía alternativa viable a esta RPC.
    // Las políticas RLS de 'profiles' solo permiten UPDATE cuando
    // es_entrenador(auth.uid()) es verdadero (ver supabase_setup.sql y
    // supabase_migration_v9.sql) — ni siquiera para el propio perfil. Un
    // 'cliente' recién creado por OAuth (que es exactamente a quien esta
    // función atiende) nunca cumple esa condición, así que un UPDATE
    // directo desde el cliente jamás puede tener éxito para él.
    //
    // Antes había un "fallback" que intentaba ese UPDATE directo y, si no
    // conseguía persistir nada, igual armaba un perfil "exitoso" solo en
    // memoria/localStorage. Como RLS no lanza excepción al bloquear un
    // UPDATE (devuelve 0 filas afectadas en silencio, no un error), ese
    // fallback nunca podía detectar el fallo: el atleta veía el modal
    // cerrarse como si hubiera terminado, mientras la fila real en la
    // base de datos no cambiaba — hasta el próximo refresh, donde
    // reaparecía el modal sin explicación. Por eso se removió: es mejor
    // mostrar el error real y dejar reintentar que fingir un éxito que
    // no existe.
    let updatedProfile: Profile | null = null;
    try {
      const { data, error } = await supabase.rpc('complete_role_selection', {
        p_rol: rol,
        p_nombre: displayName,
        p_whatsapp: whatsapp,
        p_instagram: instagram
      });

      if (error) throw error;
      if (!data) throw new Error('La operación no devolvió un perfil actualizado.');

      updatedProfile = data as Profile;
    } catch (rpcErr: any) {
      console.error('Error al completar la selección de rol vía RPC:', rpcErr);
      throw new Error(
        'No se pudo guardar tu rol. Revisa tu conexión e intenta nuevamente en unos segundos.'
      );
    }

    setProfile(updatedProfile);
    localStorage.setItem('pwa_user_profile', JSON.stringify(updatedProfile));
    setNeedsRoleSelection(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  const signOut = async () => {
    // 1. Limpieza de estado local y almacenamiento instantánea (0ms)
    // Esto previene que la interfaz se congele esperando la red
    setUser(null);
    setProfile(null);
    setNeedsRoleSelection(false);
    document.body.classList.remove('auth-ready');

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('auth') || key.includes('pwa_'))) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.clear();
    } catch (e) {}

    // 2. Ejecutar la invalidación de token en Supabase de forma asíncrona sin bloquear la UI
    supabase.auth.signOut().catch((err) => {
      console.error('Error silencioso en signOut de Supabase:', err);
    });
  };

  useEffect(() => {
    // Timeout de seguridad: si la inicialización tarda más de 6 segundos, forzar fin del loading
    // Esto previene el spinner infinito en caso de red lenta o token expirado
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Timeout de inicialización alcanzado (6s). Finalizando carga...');
        setLoading(false);
      }
    }, 6000);

    // Suscribirse a cambios en el estado de autenticación PRIMERO
    // Supabase emite un evento INITIAL_SESSION inmediatamente al suscribirse
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Supabase Auth Evento: ${event}`);

        if (event === 'INITIAL_SESSION') {
          // Este es el primer evento - equivale a lo que antes hacía initSession()
          if (initDone.current) return; // Protección contra doble ejecución
          initDone.current = true;

          if (session) {
            setUser(session.user);
            // Cargar el perfil en segundo plano de inmediato.
            fetchProfile(session.user.id, session.user);
          } else {
            setUser(null);
            // No borrar profile cacheado aquí; podría ser útil para UX offline
          }
          setLoading(false);
          return;
        }

        // Eventos posteriores (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
        if (session) {
          setUser(session.user);
          // fetchProfile en segundo plano sin bloquear
          fetchProfile(session.user.id, session.user);
        } else {
          setUser(null);
          setProfile(null);
          setNeedsRoleSelection(false);
          if (event === 'SIGNED_OUT') {
            document.body.classList.remove('auth-ready');
          }
          try {
            localStorage.removeItem('pwa_user_profile');
          } catch (e) {}
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthenticated = !!user;
  const isTrainer = profile?.rol === 'entrenador';
  const isAdmin = profile?.rol === 'admin';
  const isSoloClient = profile?.rol === 'cliente' && !profile?.entrenador_id;

  return (
    <SupabaseContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthenticated,
        isTrainer,
        isAdmin,
        isSoloClient,
        needsRoleSelection,
        completeRoleSelection,
        refreshProfile,
        signOut
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase debe usarse dentro de un SupabaseProvider');
  }
  return context;
};
