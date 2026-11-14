// Capture recovery before Supabase consumes the URL and before the lazy login
// screen mounts. Only a PASSWORD_RECOVERY event/verified OTP unlocks the form;
// a URL flag or an unrelated cached session never does.
type RecoveryState = { step: 'idle' | 'checking' | 'request' | 'code' | 'verified'; userId: string | null };
const storageKey = 'evolab_password_recovery';
const lifetime = 30 * 60 * 1000;
const listeners = new Set<() => void>();
let verifiedAt = 0;
let state: RecoveryState = { step: 'idle', userId: null };

function storedRecovery(): { userId: string; verifiedAt: number } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (typeof value?.userId === 'string' && typeof value.verifiedAt === 'number' && Date.now() - value.verifiedAt < lifetime && value.verifiedAt <= Date.now()) return value;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return null;
}

function publish(next: RecoveryState) {
  state = next;
  listeners.forEach(listener => listener());
}

export function captureRecoveryIntent() {
  if (typeof window === 'undefined') return;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const codePage = new URLSearchParams(window.location.search).get('recovery') === 'code';
  const previous = storedRecovery();
  verifiedAt = previous?.verifiedAt || 0;
  if (hash.get('type') === 'recovery') publish({ step: 'checking', userId: null });
  else if (codePage || hash.get('error_code') === 'otp_expired') beginPasswordRecovery('code');
  else if (previous) publish({ step: 'checking', userId: previous.userId });
}

export function beginPasswordRecovery(step: 'request' | 'code' = 'request') {
  try { sessionStorage.removeItem(storageKey); } catch { /* Optional persistence. */ }
  verifiedAt = 0;
  publish({ step, userId: null });
}

export function verifyPasswordRecovery(userId: string) {
  verifiedAt = Date.now();
  // Persist only identity and time, never the OTP, URL, password or JWT.
  try { sessionStorage.setItem(storageKey, JSON.stringify({ userId, verifiedAt })); } catch { /* Optional persistence. */ }
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('recovery') === 'code') {
    const url = new URL(window.location.href);
    url.searchParams.delete('recovery');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  publish({ step: 'verified', userId });
}

export function clearPasswordRecovery() {
  try { sessionStorage.removeItem(storageKey); } catch { /* Optional persistence. */ }
  verifiedAt = 0;
  publish({ step: 'idle', userId: null });
}

export function observePasswordRecovery(event: string, userId: string | null) {
  if (event === 'PASSWORD_RECOVERY' && userId) verifyPasswordRecovery(userId);
  else if (event === 'SIGNED_OUT') {
    if (state.step === 'verified' || state.step === 'checking') beginPasswordRecovery('code');
  } else if (event === 'INITIAL_SESSION' && state.step === 'checking') {
    if (userId && state.userId === userId && Date.now() - verifiedAt < lifetime) publish({ step: 'verified', userId });
    else beginPasswordRecovery('code');
  } else if (state.step === 'verified' && userId !== state.userId) beginPasswordRecovery('code');
}

export function hasPasswordRecoverySession(userId: string | undefined) {
  return !!userId && state.step === 'verified' && state.userId === userId && Date.now() - verifiedAt < lifetime;
}

export const getPasswordRecovery = () => state;
export const subscribePasswordRecovery = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

captureRecoveryIntent();
