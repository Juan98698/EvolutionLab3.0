import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Profile } from '../../types/database.types';

export const useTrainerSubscription = (
  profile: Profile | null, 
  refreshProfile: () => void, 
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [trainerSubscription, setTrainerSubscription] = useState<{
    plan: string;
    estado: string;
    expira_at: string | null;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentSuccess = params.get('payment_success');
    const paymentCancel = params.get('payment_cancel');

    if (paymentSuccess === 'true') {
      showToast('🎉 ¡Tu membresía de entrenador ha sido renovada/actualizada con éxito!', 'success');
      refreshProfile();
      navigate(location.pathname, { replace: true });
    } else if (paymentCancel === 'true') {
      showToast('Pago cancelado. Si tienes dudas, ponte en contacto con soporte.', 'info');
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate, location.pathname, refreshProfile, showToast]);

  const handleMercadoPagoCheckout = async (plan: string, redirectPath: string) => {
    setPaymentLoading(true);
    try {
      const response = await fetch('/api/create-mercadopago-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
