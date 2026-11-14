// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { StudioLogin } from '../StudioLogin';
import { useAuthFlow } from '../../../hooks/auth/useAuthFlow';
import { beginPasswordRecovery, captureRecoveryIntent, clearPasswordRecovery, getPasswordRecovery, hasPasswordRecoverySession, observePasswordRecovery, verifyPasswordRecovery } from '../../../lib/passwordRecovery';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), getSession: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ search: '' }) }));
vi.mock('../../../context/SupabaseContext', () => ({ useSupabase: () => ({ isAuthenticated: true, isTrainer: false, isAdmin: false, loading: false, needsRoleSelection: false }) }));
vi.mock('../../../lib/supabaseClient', () => ({ supabase: {
  auth: { ...mocks, getUser: async () => ({ data: { user: { id: 'recovering-user' } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { rol: 'cliente' } }) }) }) }),
} }));
const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;

beforeEach(() => {
  vi.resetAllMocks();
  clearPasswordRecovery();
  window.history.replaceState({}, '', '/login');
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'recovering-user' } } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); clearPasswordRecovery(); vi.restoreAllMocks(); });

describe('Password recovery', () => {
  it('does not show password fields or redirect an already signed-in user on the code page', () => {
    window.history.replaceState({}, '', '/login?recovery=code');
    captureRecoveryIntent();
    render(<StudioLogin />);
    expect(screen.getByLabelText('Código de recuperación')).toBeTruthy();
    expect(screen.queryByLabelText(/Nueva contraseña/)).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('retains a verified link when the SDK clears the hash before lazy login mounts', () => {
    window.history.replaceState({}, '', '/login#access_token=not-a-real-token&type=recovery');
    captureRecoveryIntent();
    window.history.replaceState({}, '', '/login');
    observePasswordRecovery('PASSWORD_RECOVERY', 'recovering-user');
    render(<StudioLogin />);
    expect(screen.getByLabelText('Nueva contraseña (Mín. 6 caracteres)')).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('evolab_password_recovery')).not.toContain('not-a-real-token');
  });

  it('does not trust an unrelated cached session when a legacy link is invalid', () => {
    window.history.replaceState({}, '', '/login#type=recovery');
    captureRecoveryIntent();
    observePasswordRecovery('INITIAL_SESSION', 'other-user');
    render(<StudioLogin />);
    expect(screen.queryByLabelText(/Nueva contraseña/)).toBeNull();
    expect(screen.getByLabelText('Código de recuperación')).toBeTruthy();
  });

  it('requests a code and verifies it before showing the new-password form', async () => {
    beginPasswordRecovery();
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'recovering-user' } } }, error: null });
    render(<StudioLogin />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código de recuperación' }));
    const code = await screen.findByLabelText('Código de recuperación');
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar código' }));
    expect(await screen.findByLabelText('Nueva contraseña (Mín. 6 caracteres)')).toBeTruthy();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: 'test@example.com', token: '123456', type: 'recovery' });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('evolab_password_recovery')).not.toContain('123456');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('keeps invalid or expired OTPs out of the password form', async () => {
    beginPasswordRecovery('code');
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired' } });
    const { result } = renderHook(() => useAuthFlow());
    act(() => { result.current.setEmail('test@example.com'); result.current.setRecoveryCode('123456'); });
    await act(() => result.current.handleVerifyRecoveryCode(event));
    expect(result.current.errorMsg).toMatch(/código no es válido o venció/);
    expect(result.current.isRecoveryMode).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([null, { user: { id: 'other-user' } }])('blocks an expired or different session before updateUser (%j)', async session => {
    verifyPasswordRecovery('recovering-user');
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    const { result } = renderHook(() => useAuthFlow());
    act(() => { result.current.setPassword('a-new-password'); result.current.setConfirmNewPassword('a-new-password'); });
    await act(() => result.current.handleUpdatePassword(event));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(result.current.isCodeMode).toBe(true);
    expect(result.current.errorMsg).toMatch(/sesión de recuperación venció/);
    expect(result.current.password).toBe('');
  });

  it('updates only a verified matching recovery session and clears the recovery state', async () => {
    verifyPasswordRecovery('recovering-user');
    const { result } = renderHook(() => useAuthFlow());
    act(() => { result.current.setPassword('a-new-password'); result.current.setConfirmNewPassword('a-new-password'); });
    await act(() => result.current.handleUpdatePassword(event));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'a-new-password' });
    expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    expect(getPasswordRecovery().step).toBe('idle');
    expect(sessionStorage.getItem('evolab_password_recovery')).toBeNull();
  });

  it('restores recovery after a boot reload only for the same user within 30 minutes', () => {
    verifyPasswordRecovery('recovering-user');
    captureRecoveryIntent();
    observePasswordRecovery('INITIAL_SESSION', 'recovering-user');
    expect(getPasswordRecovery().step).toBe('verified');
    captureRecoveryIntent();
    observePasswordRecovery('INITIAL_SESSION', 'other-user');
    expect(getPasswordRecovery().step).toBe('code');
    verifyPasswordRecovery('recovering-user');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
    expect(hasPasswordRecoverySession('recovering-user')).toBe(false);
  });
});
