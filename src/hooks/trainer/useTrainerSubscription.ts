import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';

export const useTrainerSubscription = (
  profile: Profile | null, 
  _refreshProfile: () => void,
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
) => {

  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [trainerSubscription, setTrainerSubscription] = useState<{
    plan: string;
    estado: string;
    expira_at: string | null;
  } | null>(null);

  // Checkout creation lives here; the shared usePaymentReturn hook owns
  // confirmation after the server has reconciled the payment.

  const handleMercadoPagoCheckout = async (plan: string, redirectPath: string) => {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Debes iniciar sesión para realizar la compra.');
      }

      const response = await fetch('/api/create-mercadopago-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: profile?.id,
          email: profile?.email,
          plan,
          redirectPath,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        throw new Error(data.error || 'No se obtuvo la URL de pago');
      }
    } catch (err: any) {
      console.error('MercadoPago redirect error:', err);
      showToast('Error al conectar con MercadoPago: ' + err.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const isTrainerExpired = useMemo(() => {
    if (!trainerSubscription) return false;
    const estado = trainerSubscription.estado;
    if (estado === 'expirado' || estado === 'cancelado') return true;
    if (trainerSubscription.expira_at) {
      const expDate = new Date(trainerSubscription.expira_at);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        return true;
      }
    }
    return false;
  }, [trainerSubscription]);

  return {
    paymentLoading,
    trainerSubscription,
    setTrainerSubscription,
    handleMercadoPagoCheckout,
    isTrainerExpired
  };
};
