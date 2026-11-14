import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { isRealEmailDomain } from '../../lib/validations';
import { isInAppBrowser } from '../../lib/inAppBrowser';

export function useAuthFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isTrainer, isAdmin, loading: authLoading, needsRoleSelection } = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [isRecoveryMode] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'));
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerRole, setRegisterRole] = useState<'cliente' | 'entrenador'>('cliente');
  const [registerWhatsapp, setRegisterWhatsapp] = useState('');
  const [registerInstagram, setRegisterInstagram] = useState('');
  const [trainerParam, setTrainerParam] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('');
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const skipAutoRedirect = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const trainerId = params.get('trainer') || params.get('ref');
    if (!trainerId) return;
    setTrainerParam(trainerId); setIsRegisterMode(true); setRegisterRole('cliente');
    let cancelled = false;
    void supabase.rpc('trainer_invitation_info', { p_id: trainerId }).then(({ data }) => {
      if (!cancelled && data?.nombre) setTrainerName(data.nombre);
    });
    return () => { cancelled = true; };
  }, [location.search]);
  useEffect(() => {
    if (!authLoading && isAuthenticated && !skipAutoRedirect.current && !isRecoveryMode && !needsRoleSelection) {
      navigate(isAdmin ? '/admin' : isTrainer ? '/trainer' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isTrainer, isAdmin, authLoading, navigate, isRecoveryMode, needsRoleSelection]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // Evitar que el useEffect de redirección automática interfiera durante la autenticación activa
      skipAutoRedirect.current = true;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      let target = '/dashboard';
      if (data.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile?.rol === 'entrenador') target = '/trainer';
        if (profile?.rol === 'admin') target = '/admin';
      }

      setLoading(false);
      navigate(target, { replace: true });
    } catch (err: unknown) {
      console.error('Error de login:', err);
      // Restaurar a false si falla el inicio de sesión
      skipAutoRedirect.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Correo o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim()) {
      setErrorMsg('Ingresá tu correo electrónico para continuar.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setInfoMsg('Listo. Revisá tu correo (y la carpeta de spam) para restablecer tu contraseña.');
    } catch (err: unknown) {
      console.error('Error al solicitar recuperación de contraseña:', err);
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos enviar el correo de recuperación. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmNewPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setInfoMsg('Contraseña actualizada. Ingresando...');

      let target = '/dashboard';
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.rol === 'entrenador') target = '/trainer';
        if (profile?.rol === 'admin') target = '/admin';
      }

      navigate(target, { replace: true });
    } catch (err: unknown) {
      console.error('Error al actualizar contraseña:', err);
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos actualizar tu contraseña. Probá solicitando un nuevo enlace.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (isInAppBrowser()) {
      setErrorMsg(
        'Google bloquea el inicio de sesión dentro de Instagram y Facebook por seguridad. Por favor abre este enlace en Safari o Chrome (toca los 3 puntos ••• arriba a la derecha), o inicia sesión con tu correo y contraseña.'
      );
      return;
    }
    try {
      skipAutoRedirect.current = true;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      console.error('Error al iniciar sesión con Google:', err);
      skipAutoRedirect.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google. Intentá nuevamente.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (!registerName.trim()) {
        throw new Error('Por favor ingresa tu nombre completo.');
      }

      if (!isRealEmailDomain(email)) {
        throw new Error('Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.');
      }

      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      if (password !== confirmRegisterPassword) {
        throw new Error('Las contraseñas no coinciden. Por favor verifica ambos campos de contraseña.');
      }

      if (trainerParam) {
        const { data: invitation, error: failure } = await supabase.rpc('trainer_invitation_info', { p_id: trainerParam });
        if (failure || !invitation?.available) throw new Error('La invitación de tu entrenador no está disponible.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nombre: registerName.trim(),
            rol: registerRole,
            entrenador_id: trainerParam || null,
            modalidad: 'remoto'
          }
        }
      });

      if (error) throw error;

      if (registerRole === 'entrenador' && data?.user?.id) {
        const defaultMarca = {
          nombre_display: registerName.trim(),
          color_primario: '#91b6a1',
          color_secundario: '#769888',
          tipografia: 'Inter' as const,
          eslogan: '',
          whatsapp: registerWhatsapp.trim() || '',
          instagram: registerInstagram.trim() || ''
        };
        await supabase
          .from('profiles')
          .update({ marca: defaultMarca })
          .eq('id', data.user.id);
      }

      setInfoMsg('Cuenta creada. Revisa tu correo para confirmar tu registro y luego inicia sesión.');
      setIsRegisterMode(false);
      setPassword('');
      setRegisterName('');
      setRegisterWhatsapp('');
      setRegisterInstagram('');
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error al registrarse:', err);
      setErrorMsg(err.message || 'Ocurrió un error al registrar tu cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return { email, setEmail, password, setPassword, loading, authLoading, errorMsg, infoMsg,
    isForgotMode, setIsForgotMode, isRecoveryMode, confirmNewPassword, setConfirmNewPassword,
    isRegisterMode, setIsRegisterMode, registerName, setRegisterName, registerRole, setRegisterRole,
    registerWhatsapp, setRegisterWhatsapp, registerInstagram, setRegisterInstagram, trainerName, trainerParam,
    emailTouched, setEmailTouched, confirmRegisterPassword, setConfirmRegisterPassword,
    confirmPasswordTouched, setConfirmPasswordTouched, handleLogin, handleForgotPassword,
    handleUpdatePassword, handleGoogleLogin, handleRegister, clearMessages: () => { setErrorMsg(null); setInfoMsg(null); } };
}
