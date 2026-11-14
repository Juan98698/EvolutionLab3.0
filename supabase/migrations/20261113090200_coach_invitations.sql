BEGIN;
CREATE OR REPLACE FUNCTION public.assert_trainer_capacity(p_coach uuid, p_modality text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE coach public.profiles; total int; same_modality int; max_clients int;
BEGIN
  SELECT * INTO coach FROM public.profiles WHERE id = p_coach AND rol = 'entrenador' FOR UPDATE;
  IF NOT FOUND OR coach.suscripcion_estado IN ('expirado','cancelado') OR coach.suscripcion_expira_at < now() THEN RAISE EXCEPTION 'La membresía del entrenador no está disponible'; END IF;
  SELECT count(*), count(*) FILTER (WHERE modalidad = p_modality) INTO total, same_modality FROM public.profiles WHERE entrenador_id = p_coach;
  max_clients := CASE coach.suscripcion_plan WHEN 'profesional' THEN 2147483647 WHEN 'intermedio' THEN 10 WHEN 'iniciacion' THEN 2 ELSE 2 END;
  IF total >= max_clients OR (coalesce(coach.suscripcion_plan,'free') = 'free' AND same_modality >= 1) THEN RAISE EXCEPTION 'El entrenador ha alcanzado el límite de atletas de su plan'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_trainer_capacity(uuid,text) FROM PUBLIC, anon, authenticated;

-- Defense in depth for all signup entry points, not only the login form.
CREATE OR REPLACE FUNCTION public.check_new_athlete_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.entrenador_id IS NOT NULL THEN PERFORM public.assert_trainer_capacity(NEW.entrenador_id, NEW.modalidad); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_new_athlete_capacity ON public.profiles;
CREATE TRIGGER check_new_athlete_capacity BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_new_athlete_capacity();

CREATE OR REPLACE FUNCTION public.trainer_invitation_info(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id',id,'nombre',nombre,'available',coalesce(suscripcion_estado NOT IN ('expirado','cancelado') AND (suscripcion_expira_at IS NULL OR suscripcion_expira_at > now()),false))
  FROM public.profiles WHERE id=p_id AND rol='entrenador';
$$;
REVOKE ALL ON FUNCTION public.trainer_invitation_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_invitation_info(uuid) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.coach_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id),
  athlete_id uuid NOT NULL REFERENCES public.profiles(id),
  modality text NOT NULL CHECK(modality IN ('remoto','presencial')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  UNIQUE(coach_id,athlete_id)
);
ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitation_participants ON public.coach_invitations;
CREATE POLICY invitation_participants ON public.coach_invitations FOR SELECT TO authenticated USING(athlete_id=auth.uid() OR coach_id=auth.uid());
REVOKE ALL ON public.coach_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.coach_invitations TO authenticated;
GRANT ALL ON public.coach_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.request_coach_invitation(p_email text, p_modality text DEFAULT 'remoto') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND rol='entrenador') THEN RAISE EXCEPTION 'Operación no autorizada'; END IF;
  IF p_modality NOT IN ('remoto','presencial') THEN RAISE EXCEPTION 'Modalidad no válida'; END IF;
  PERFORM public.assert_trainer_capacity(auth.uid(), p_modality);
  SELECT id INTO target FROM public.profiles WHERE lower(email)=lower(trim(p_email)) AND rol='cliente' AND entrenador_id IS NULL;
  -- Do not disclose whether an email has an account or belongs to another coach.
  IF target IS NOT NULL THEN
    INSERT INTO public.coach_invitations(coach_id,athlete_id,modality) VALUES(auth.uid(),target,p_modality)
    ON CONFLICT(coach_id,athlete_id) DO UPDATE SET status='pending', modality=excluded.modality, expires_at=now()+interval '7 days';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.request_coach_invitation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_coach_invitation(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_coach_invitation(p_id uuid, p_accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.coach_invitations;
BEGIN
  SELECT * INTO invitation FROM public.coach_invitations WHERE id=p_id AND athlete_id=auth.uid() AND status='pending' AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no disponible'; END IF;
  IF p_accept THEN
    PERFORM public.assert_trainer_capacity(invitation.coach_id, invitation.modality);
    UPDATE public.profiles SET entrenador_id=invitation.coach_id, modalidad=invitation.modality WHERE id=auth.uid() AND rol='cliente' AND entrenador_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ya tienes un entrenador vinculado'; END IF;
  END IF;
  UPDATE public.coach_invitations SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.respond_coach_invitation(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_coach_invitation(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.pending_coach_invitations() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'coach_name', p.nombre)), '[]'::jsonb)
  FROM public.coach_invitations i JOIN public.profiles p ON p.id=i.coach_id
  WHERE i.athlete_id=auth.uid() AND i.status='pending' AND i.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.pending_coach_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pending_coach_invitations() TO authenticated;
COMMIT;
