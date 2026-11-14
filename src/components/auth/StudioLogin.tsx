import { AuthField } from './AuthField';
import { useAuthFlow } from '../../hooks/auth/useAuthFlow';
import { isRealEmailDomain } from '../../lib/validations';
import { isInAppBrowser } from '../../lib/inAppBrowser';
import { BootSplash } from '../common/BootSplash';
import { StudioWelcome } from './StudioWelcome';

export function StudioLogin() {
  const auth = useAuthFlow();
  if (auth.authLoading) return <BootSplash />;
  const title = auth.isRecoveryMode ? 'Elige una nueva contraseña' : auth.isForgotMode ? 'Recupera tu acceso' : auth.isRegisterMode ? 'Empieza tu próximo capítulo' : 'Bienvenido a tu espacio';
  const submit = auth.isRecoveryMode ? auth.handleUpdatePassword : auth.isForgotMode ? auth.handleForgotPassword : auth.isRegisterMode ? auth.handleRegister : auth.handleLogin;
  const emailError = auth.emailTouched && auth.email.length > 0 && !isRealEmailDomain(auth.email) ? '⚠️ Formato de correo no válido (ej: usuario@gmail.com)' : undefined;
  const mismatch = auth.confirmPasswordTouched && auth.confirmRegisterPassword.length > 0;
  return <div className="studio-auth">
    <header className="studio-auth-header"><a className="studio-wordmark" href="/">evolution<span>lab</span></a><a href="#studio-method">Conoce el espacio <span aria-hidden="true">↗</span></a></header>
    <main className="studio-auth-grid">
      <StudioWelcome />
      <section className="studio-auth-panel" aria-labelledby="studio-auth-form-title">
        <p className="studio-eyebrow">Evolution Lab · Mi cuenta</p>
        <h2 id="studio-auth-form-title">{title}</h2>
        <p className="studio-auth-description">{auth.isRegisterMode ? auth.trainerName ? `Invitación de ${auth.trainerName}` : 'Crea tu cuenta y organiza tu entrenamiento.' : auth.isForgotMode ? 'Te enviaremos un enlace para restablecer tu contraseña.' : 'Retoma tu entrenamiento desde donde lo dejaste.'}</p>
        {auth.errorMsg && <p className="studio-message studio-message--error" role="alert">{auth.errorMsg}</p>}
        {auth.infoMsg && <p className="studio-message" role="status">{auth.infoMsg}</p>}
        <form onSubmit={submit} className="studio-auth-form" aria-label={title}>
          {auth.isRegisterMode && !auth.isRecoveryMode && <AuthField id="registerName" label="Nombre completo" value={auth.registerName} onChange={auth.setRegisterName} autoComplete="name" />}
          {!auth.isRecoveryMode && <AuthField id="auth-email" label="Correo electrónico" type="email" value={auth.email} onChange={auth.setEmail} onBlur={() => auth.setEmailTouched(true)} error={emailError} autoComplete="username" />}
          {!auth.isForgotMode && <AuthField id="auth-password" label={auth.isRegisterMode ? 'Contraseña (Mín. 6 caracteres)' : auth.isRecoveryMode ? 'Nueva contraseña (Mín. 6 caracteres)' : 'Contraseña'} type="password" value={auth.password} onChange={auth.setPassword} autoComplete={auth.isRegisterMode || auth.isRecoveryMode ? 'new-password' : 'current-password'} />}
          {auth.isRegisterMode && !auth.isRecoveryMode && <AuthField id="confirmRegisterPassword" label="Confirmar contraseña" type="password" value={auth.confirmRegisterPassword} onChange={auth.setConfirmRegisterPassword} onBlur={() => auth.setConfirmPasswordTouched(true)} autoComplete="new-password" error={mismatch && auth.password !== auth.confirmRegisterPassword ? '⚠️ Las contraseñas no coinciden' : undefined} help={mismatch && auth.password === auth.confirmRegisterPassword ? '✓ Las contraseñas coinciden' : undefined} />}
          {auth.isRecoveryMode && <AuthField id="confirm-password" label="Confirmar nueva contraseña" type="password" value={auth.confirmNewPassword} onChange={auth.setConfirmNewPassword} autoComplete="new-password" />}
          {auth.isRegisterMode && !auth.trainerParam && <fieldset className="studio-role-picker"><legend>¿Cómo vas a usar el espacio?</legend>
            <button type="button" aria-pressed={auth.registerRole === 'cliente'} onClick={() => auth.setRegisterRole('cliente')}>Atleta autónomo</button>
            <button type="button" aria-pressed={auth.registerRole === 'entrenador'} onClick={() => auth.setRegisterRole('entrenador')}>Entrenador</button>
          </fieldset>}
          {auth.isRegisterMode && auth.registerRole === 'entrenador' && <details className="studio-details"><summary>Datos de contacto opcionales</summary><AuthField id="registerWhatsapp" label="WhatsApp" value={auth.registerWhatsapp} onChange={auth.setRegisterWhatsapp} required={false} /><AuthField id="registerInstagram" label="Instagram" value={auth.registerInstagram} onChange={auth.setRegisterInstagram} required={false} /></details>}
          {!auth.isRegisterMode && !auth.isForgotMode && !auth.isRecoveryMode && <button type="button" className="studio-text-button studio-forgot" onClick={() => { auth.clearMessages(); auth.setIsForgotMode(true); }}>¿Olvidaste tu contraseña?</button>}
          <button className="studio-primary" type="submit" disabled={auth.loading}>{auth.loading ? 'Un momento…' : auth.isRecoveryMode ? 'Guardar contraseña' : auth.isForgotMode ? 'Enviar enlace de recuperación' : auth.isRegisterMode ? 'Registrarse' : 'Entrar'}</button>
        </form>
        {!auth.isRecoveryMode && !auth.isForgotMode && <><div className="studio-auth-divider"><span>o</span></div><button className="studio-secondary studio-google" type="button" onClick={() => void auth.handleGoogleLogin()}>Continuar con Google <span aria-hidden="true">↗</span></button>
          {isInAppBrowser() && <p className="studio-field-help">Google no permite entrar dentro de Instagram/Facebook. Abre este enlace en Safari o Chrome.</p>}
          <button type="button" className="studio-text-button studio-register" onClick={() => { auth.clearMessages(); auth.setIsRegisterMode(!auth.isRegisterMode); }}>{auth.isRegisterMode ? 'Ya tengo cuenta. Iniciar sesión' : '¿No tienes cuenta? Regístrate gratis'}</button></>}
        {auth.isForgotMode && <button className="studio-text-button studio-register" type="button" onClick={() => { auth.clearMessages(); auth.setIsForgotMode(false); }}>Volver al inicio de sesión</button>}
      </section>
    </main>
    <footer className="studio-auth-footer">Evolution Lab <span>Planifica. Registra. Aprende de tu progreso.</span></footer>
  </div>;
}
