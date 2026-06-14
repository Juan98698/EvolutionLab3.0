-- ============================================================================
-- MIGRATION: Link Existing Storage Images to Global Exercise Catalog
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/abducci_n_de_gl_teo_con_banda_image.jpg' 
WHERE nombre = 'Abduccion de cadera';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/abducci_n_de_hombros_con_mancuernas_image.jpg' 
WHERE nombre = 'Elevaciones laterales';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/aductores_en_maquina_image.jpg' 
WHERE nombre = 'Aduccion de cadera';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_b_ceps_con_barra_image.jpg' 
WHERE nombre = 'Curl con barra recta';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_concentrado_con_mancuerna_image.jpg' 
WHERE nombre = 'Curl concentrado';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_de_b_ceps_en_maquina_predicador_image.jpg' 
WHERE nombre = 'Curl predicador';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/curl_de_b_ceps_martillo_image.jpg' 
WHERE nombre = 'Curl martillo';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/extensi_n_de_rodilla_image.jpg' 
WHERE nombre = 'Extension de cuadriceps';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/fondos_en_banco_image.jpg' 
WHERE nombre = 'Fondos en banco';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/hip_thrust_con_barra_image.jpg' 
WHERE nombre = 'Hip thrust';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/peso_muerto_con_barra_image.jpg' 
WHERE nombre = 'Peso muerto convencional';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/plancha_image.jpg' 
WHERE nombre = 'Plancha frontal';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/prensa_45_pies_abajo_image.png' 
WHERE nombre = 'Prensa de piernas';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/press_militar_con_barra_image.jpg' 
WHERE nombre = 'Press militar con barra';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/pull_over_en_polea_image.jpg' 
WHERE nombre = 'Pullover en polea';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/remo_con_barra_image.jpg' 
WHERE nombre = 'Remo con barra';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/remo_con_mancuerna_unilateral_image.jpg' 
WHERE nombre = 'Remo con mancuerna';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/sentadilla_bulgara_image.jpg' 
WHERE nombre = 'Sentadilla bulgara';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/sentadilla_libre_con_barra_image.jpg' 
WHERE nombre = 'Sentadilla con barra';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/tijeras_con_mancuernas_image.jpg' 
WHERE nombre = 'Zancadas con mancuernas';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/flexi_n_de_hombros_con_mancuernas_image.jpg' 
WHERE nombre = 'Elevaciones frontales';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/flexi_n_de_rodilla_sentado_image.jpg' 
WHERE nombre = 'Curl femoral sentado';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/jal_n_en_maquina_hammer_pull_down_image.jpg' 
WHERE nombre = 'Jalon al pecho';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/extensi_n_de_codo_con_polea_por_encima_de_la_cabeza_image.jpg' 
WHERE nombre = 'Extension sobre cabeza';

UPDATE public.ejercicios_globales 
SET imagen_url = 'https://szqitksfxiuuiljftlrl.supabase.co/storage/v1/object/public/ejercicios/flex_n-extensi_n_de_codo_acostado_image.jpg' 
WHERE nombre = 'Press frances con barra Z';
