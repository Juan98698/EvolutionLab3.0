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

  // Ref para evitar doble inicialización de la sesión por la carrera entre initSession y onAuthStateChange
  const initDone = useRef(false);

  // Transición de opacidad suave de la PWA al inicializar la sesión
  useEffect(() => {
    if (!loading) {
      document.body.classList.add('auth-ready');
    }
  }, [loading]);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
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
        return profileData;
      } else {
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

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    // 1. Limpieza de estado local y almacenamiento instantánea (0ms)
    // Esto previene que la interfaz se congele esperando la red
    setUser(null);
    setProfile(null);
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
            // Al no hacer 'await' aquí, la PWA inicializa la interfaz instantáneamente (0ms)
            // utilizando el perfil previamente restaurado de caché síncrona en useState,
            // haciéndola sumamente robusta ante redes lentas, interrupciones o modo offline.
            fetchProfile(session.user.id);
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
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
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
