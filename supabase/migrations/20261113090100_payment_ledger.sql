BEGIN;
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  payment_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  plan text NOT NULL CHECK (plan IN ('premium','iniciacion','intermedio','profesional')),
  status text NOT NULL,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_ledger_user ON public.payment_ledger(user_id, approved_at);
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_ledger TO service_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_payment_id text;

CREATE OR REPLACE FUNCTION public.apply_verified_payment(p_payment_id text, p_user_id uuid, p_plan text, p_status text, p_approved_at timestamptz, p_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous public.payment_ledger; item public.payment_ledger; expires timestamptz; latest public.payment_ledger; managed text;
BEGIN
  IF p_status NOT IN ('approved','refunded','charged_back','cancelled','rejected','pending','in_process','authorized','in_mediation') OR p_updated_at IS NULL
    OR p_plan NOT IN ('premium','iniciacion','intermedio','profesional') OR (p_status = 'approved' AND p_approved_at IS NULL) THEN RAISE EXCEPTION 'Pago no válido'; END IF;
  -- Serializes all payments for one account, including different payment IDs.
  SELECT billing_payment_id INTO managed FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de pago no encontrado'; END IF;
  SELECT * INTO previous FROM public.payment_ledger WHERE payment_id = p_payment_id;
  IF FOUND AND (previous.user_id <> p_user_id OR previous.plan <> p_plan) THEN RAISE EXCEPTION 'Identidad de pago incompatible'; END IF;
  IF previous.updated_at IS NOT NULL AND previous.updated_at >= p_updated_at THEN RETURN jsonb_build_object('updated', false, 'duplicate', true); END IF;
  INSERT INTO public.payment_ledger VALUES (p_payment_id, p_user_id, p_plan, p_status, p_approved_at, p_updated_at)
  ON CONFLICT(payment_id) DO UPDATE SET status = excluded.status, approved_at = excluded.approved_at, updated_at = excluded.updated_at;
  -- Deterministic reconciliation: delivery order does not change entitlement.
  -- Each approved purchase adds 30 days; refunded purchases contribute nothing.
  FOR item IN SELECT * FROM public.payment_ledger WHERE user_id = p_user_id AND status = 'approved' ORDER BY approved_at, payment_id LOOP
    expires := greatest(coalesce(expires, item.approved_at), item.approved_at) + interval '30 days';
    latest := item;
  END LOOP;
  IF latest.payment_id IS NOT NULL THEN
    UPDATE public.profiles SET suscripcion_plan = latest.plan,
      suscripcion_estado = CASE WHEN expires > now() THEN 'activo' ELSE 'expirado' END,
      suscripcion_expira_at = expires, billing_payment_id = latest.payment_id WHERE id = p_user_id;
    IF latest.plan = 'premium' THEN
      INSERT INTO public.suscripciones(cliente_id, tipo, estado, fecha_inicio, fecha_expiracion)
      VALUES(p_user_id, 'premium', CASE WHEN expires > now() THEN 'activa' ELSE 'expirada' END, latest.approved_at, expires)
      ON CONFLICT(cliente_id) DO UPDATE SET tipo = excluded.tipo, estado = excluded.estado, fecha_inicio = excluded.fecha_inicio, fecha_expiracion = excluded.fecha_expiracion;
    ELSE
      UPDATE public.suscripciones SET estado = 'cancelada' WHERE cliente_id = p_user_id;
    END IF;
  ELSIF managed IS NOT NULL THEN
    UPDATE public.profiles SET suscripcion_plan = 'free', suscripcion_estado = 'cancelado', suscripcion_expira_at = now(), billing_payment_id = NULL WHERE id = p_user_id;
    UPDATE public.suscripciones SET estado = 'cancelada', fecha_expiracion = now() WHERE cliente_id = p_user_id;
  END IF;
  RETURN jsonb_build_object('updated', true, 'duplicate', false);
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_payment(text,uuid,text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,uuid,text,text,timestamptz,timestamptz) TO service_role;

-- Billing provenance is just as sensitive as plan and role.
CREATE OR REPLACE FUNCTION public.protect_billing_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.billing_payment_id IS DISTINCT FROM OLD.billing_payment_id AND current_user NOT IN ('postgres','supabase_admin','service_role') AND NOT public.es_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Campo de facturación protegido' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_billing_provenance ON public.profiles;
CREATE TRIGGER protect_billing_provenance BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_billing_provenance();
COMMIT;
