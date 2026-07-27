-- ============================================================================
-- SQL SCRIPT: Update Curl de Biceps con Barra Romana Media URLs
-- Ejecutar en el SQL Editor de Supabase (https://supabase.com)
-- ============================================================================

-- 1. Asegurar privilegios para actualizar la tabla ejercicios_globales
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_globales TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_globales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_globales TO anon;

-- 2. Actualizar el ejercicio con los nuevos archivos de alta definicion (IA) subidos a Storage
UPDATE public.ejercicios_globales
SET 
  gif_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_olimpico_de_martillo_con_barra_0636_480.gif',
  imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_olimpico_de_martillo_con_barra_0636_480.webp'
WHERE nombre = 'Curl de biceps con barra romana';
