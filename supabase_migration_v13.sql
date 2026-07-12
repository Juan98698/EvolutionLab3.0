-- 1. Agregar columna de gif_url a la tabla de catálogo global public.ejercicios_globales
ALTER TABLE public.ejercicios_globales 
ADD COLUMN IF NOT EXISTS gif_url text;

COMMENT ON COLUMN public.ejercicios_globales.gif_url IS
  'URL remota o ruta base64 para visualizar la animación GIF de ejecución del ejercicio';
