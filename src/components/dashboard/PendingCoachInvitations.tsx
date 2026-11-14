import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../context/SupabaseContext';

type Invitation = { id: string; coach_name: string };
export function PendingCoachInvitations() {
  const { user, isSoloClient, refreshProfile } = useSupabase();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || !isSoloClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.rpc('pending_coach_invitations');
        if (!cancelled) setInvitations(Array.isArray(data) ? data : []);
      } catch { /* Existing deployments remain usable until migrations are applied. */ }
    })();
    return () => { cancelled = true; };
  }, [user, isSoloClient]);
  const respond = async (id: string, accept: boolean) => {
    setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.rpc('respond_coach_invitation', { p_id: id, p_accept: accept });
      if (failure) throw failure;
      setInvitations(previous => previous.filter(invitation => invitation.id !== id));
      if (accept) await refreshProfile();
    } catch { setError('No se pudo responder a la invitación. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  if (!isSoloClient || !invitations.length) return null;
  return <section className="card" aria-label="Invitaciones de entrenadores">
    <h2>Invitaciones de entrenador</h2>
    <p>Al aceptar, compartes tu plan e historial de entrenamiento con ese entrenador.</p>
    {error && <p role="alert">{error}</p>}
    {invitations.map(invitation => <div key={invitation.id}>
      <p>{invitation.coach_name} quiere acompañar tu entrenamiento.</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => void respond(invitation.id, true)}>Aceptar invitación</button>
      <button className="btn" disabled={busy} onClick={() => void respond(invitation.id, false)}>Rechazar</button>
    </div>)}
  </section>;
}
