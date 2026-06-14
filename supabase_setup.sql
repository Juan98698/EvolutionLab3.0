-- =====================================================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS PARA EVOLUTION LAB (SUPABASE)
-- =====================================================================
-- Copia y pega todo este script en el editor SQL (SQL Editor) de tu
-- panel de control de Supabase y haz clic en "Run".

-- 1. CREACIÓN DE TABLAS PRINCIPALES

-- Tabla de perfiles de usuario (conecta con auth.users de Supabase Auth)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    nombre text not null,
    rol text not null check (rol in ('entrenador', 'cliente')) default 'cliente',
    objetivo text,
    fecha_inicio date default current_date,
    vigencia_dias integer default 28,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabla de planes de entrenamiento asignados
create table public.planes (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.profiles(id) on delete cascade not null,
    creador_id uuid references public.profiles(id) on delete set null,
    activo boolean default true not null,
    datos_plan jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabla de días de entrenamiento dentro de un plan
create table public.dias_plan (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid references public.planes(id) on delete cascade not null,
    nombre text not null,
    orden integer not null,
    weekday_mapping jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabla de ejercicios correspondientes a cada día de entrenamiento
create table public.ejercicios_plan (
    id uuid primary key default gen_random_uuid(),
    dia_id uuid references public.dias_plan(id) on delete cascade not null,
    nombre text not null,
    variables jsonb default '{}'::jsonb not null, -- Contiene reps, RIR, descanso, etc.
    video_url text,
    image_url text, -- Base64 o URL remota de la foto estática
    gif_url text,   -- Base64 o URL remota de la animación offline
    orden integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabla de historial de sesiones completadas
create table public.sesiones_historial (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.profiles(id) on delete cascade not null,
    fecha date not null default current_date,
    notas_generales text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabla de registros detallados de ejercicios en cada sesión (historico de sobrecarga progresiva)
create table public.sesiones_ejercicios (
    id uuid primary key default gen_random_uuid(),
    sesion_id uuid references public.sesiones_historial(id) on delete cascade not null,
    nombre_ejercicio text not null,
    grupo_muscular text,
    series_reps jsonb not null default '[]'::jsonb, -- Array de repeticiones de las series completadas
    peso numeric not null,
    rpe_rir numeric not null,
    descanso integer not null,
    volumen numeric not null,
    rm_estimado numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. AUTOMATIZACIÓN DE PERFILES DE USUARIOS (TRIGGERS)

-- Función para que cada vez que crees un usuario por Supabase Auth, se cree su perfil público automáticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nombre, rol, objetivo, vigencia_dias, entrenador_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', 'Nuevo Atleta'),
    coalesce(new.raw_user_meta_data->>'rol', 'cliente'),
    new.raw_user_meta_data->>'objetivo',
    coalesce((new.raw_user_meta_data->>'vigencia_dias')::integer, 28),
    (new.raw_user_meta_data->>'entrenador_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger disparado inmediatamente tras registro en auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Función auxiliar para comprobar si un usuario es entrenador sin causar recursión RLS
create or replace function public.es_entrenador(user_id uuid)
returns boolean as $$
declare
  is_trainer boolean;
begin
  select exists (
    select 1 from public.profiles 
    where id = user_id and rol = 'entrenador'
  ) into is_trainer;
  return is_trainer;
end;
$$ language plpgsql security definer;

-- 3. HABILITACIÓN DE SEGURIDAD A NIVEL DE FILA (RLS)

alter table public.profiles enable row level security;
alter table public.planes enable row level security;
alter table public.dias_plan enable row level security;
alter table public.ejercicios_plan enable row level security;
alter table public.sesiones_historial enable row level security;
alter table public.sesiones_ejercicios enable row level security;

-- 4. POLÍTICAS DE ACCESO (POLICIES) PARA CADA TABLA

-- === Políticas de Profiles ===
create policy "Permitir lectura de propio perfil" 
  on public.profiles for select using (auth.uid() = id);

create policy "Permitir entrenador leer todos los perfiles" 
  on public.profiles for select using (
    public.es_entrenador(auth.uid())
  );

create policy "Permitir entrenador crear perfiles" 
  on public.profiles for insert with check (
    public.es_entrenador(auth.uid())
  );

create policy "Permitir entrenador actualizar todos los perfiles" 
  on public.profiles for update using (
    public.es_entrenador(auth.uid())
  );

-- === Políticas de Planes ===
create policy "Atletas pueden ver sus propios planes"
  on public.planes for select using (cliente_id = auth.uid());

create policy "Entrenadores pueden leer todos los planes"
  on public.planes for select using (
    public.es_entrenador(auth.uid())
  );

create policy "Entrenadores pueden gestionar planes"
  on public.planes for all using (
    public.es_entrenador(auth.uid())
  );

-- === Políticas de Dias de Plan ===
create policy "Atletas pueden ver los dias de sus planes"
  on public.dias_plan for select using (
    exists (
      select 1 from public.planes 
      where planes.id = dias_plan.plan_id and planes.cliente_id = auth.uid()
    )
  );

create policy "Entrenadores pueden gestionar los dias de los planes"
  on public.dias_plan for all using (
    public.es_entrenador(auth.uid())
  );

-- === Políticas de Ejercicios de Plan ===
create policy "Atletas pueden ver los ejercicios de sus planes"
  on public.ejercicios_plan for select using (
    exists (
      select 1 from public.dias_plan
      join public.planes on planes.id = dias_plan.plan_id
      where dias_plan.id = ejercicios_plan.dia_id and planes.cliente_id = auth.uid()
    )
  );

create policy "Entrenadores pueden gestionar los ejercicios de los planes"
  on public.ejercicios_plan for all using (
    public.es_entrenador(auth.uid())
  );

-- === Políticas de Historial de Sesiones ===
create policy "Atletas pueden ver su propio historial"
  on public.sesiones_historial for select using (cliente_id = auth.uid());

create policy "Atletas pueden registrar sus propias sesiones"
  on public.sesiones_historial for insert with check (cliente_id = auth.uid());

create policy "Atletas pueden editar su propio historial"
  on public.sesiones_historial for update using (cliente_id = auth.uid());

create policy "Atletas pueden borrar su propio historial"
  on public.sesiones_historial for delete using (cliente_id = auth.uid());

create policy "Entrenadores pueden leer todo el historial de sesiones"
  on public.sesiones_historial for select using (
    public.es_entrenador(auth.uid())
  );

-- === Políticas de Detalles de Ejercicios en Sesiones ===
create policy "Atletas pueden ver los ejercicios de sus propias sesiones"
  on public.sesiones_ejercicios for select using (
    exists (
      select 1 from public.sesiones_historial 
      where sesiones_historial.id = sesiones_ejercicios.sesion_id and sesiones_historial.cliente_id = auth.uid()
    )
  );

create policy "Atletas pueden registrar detalles de sus sesiones"
  on public.sesiones_ejercicios for insert with check (
    exists (
      select 1 from public.sesiones_historial 
      where sesiones_historial.id = sesiones_ejercicios.sesion_id and sesiones_historial.cliente_id = auth.uid()
    )
  );

create policy "Atletas pueden actualizar detalles de sus propias sesiones"
  on public.sesiones_ejercicios for update using (
    exists (
      select 1 from public.sesiones_historial 
      where sesiones_historial.id = sesiones_ejercicios.sesion_id and sesiones_historial.cliente_id = auth.uid()
    )
  );

create policy "Atletas pueden borrar detalles de sus propias sesiones"
  on public.sesiones_ejercicios for delete using (
    exists (
      select 1 from public.sesiones_historial 
      where sesiones_historial.id = sesiones_ejercicios.sesion_id and sesiones_historial.cliente_id = auth.uid()
    )
  );

create policy "Entrenadores pueden ver los detalles de todos los ejercicios de sesiones"
  on public.sesiones_ejercicios for select using (
    public.es_entrenador(auth.uid())
  );

-- 5. CREACIÓN DEL PRIMER USUARIO COMO ENTRENADOR (PASO OPCIONAL)
-- Nota: La primera vez que te registres en Supabase Auth con tu correo personal,
-- puedes forzar que tu rol sea 'entrenador' ejecutando esta consulta SQL (cambiando tu email):
-- UPDATE public.profiles SET rol = 'entrenador' WHERE email = 'tu_correo@gmail.com';

-- 6. CONCESIÓN DE PERMISOS (GRANTS) PARA ROLES DE SUPABASE
-- Esto asegura que los usuarios autenticados y anónimos tengan permisos de lectura/escritura y de ejecución de funciones auxiliares
grant execute on function public.es_entrenador(uuid) to anon, authenticated, public;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.planes to anon, authenticated;
grant select, insert, update, delete on public.dias_plan to anon, authenticated;
grant select, insert, update, delete on public.ejercicios_plan to anon, authenticated;
grant select, insert, update, delete on public.sesiones_historial to anon, authenticated;
grant select, insert, update, delete on public.sesiones_ejercicios to anon, authenticated;

-- 7. FUNCIÓN PARA ELIMINAR USUARIO POR ADMINISTRADOR (Con Cascada)
create or replace function public.delete_user(target_user_id uuid)
returns void AS $$
begin
  -- Validar que el ejecutor sea un administrador
  if not public.es_admin(auth.uid()) then
    raise exception 'Acceso denegado. Solo los administradores pueden eliminar usuarios.';
  end if;

  -- Eliminar de auth.users (la base de datos propaga por CASCADE a public.profiles y el resto)
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Grants de acceso para permitir ejecución
grant execute on function public.delete_user(uuid) to authenticated;

