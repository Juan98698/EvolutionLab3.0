-- ==========================================================================
-- SEED: Catalogo Global de Ejercicios para EvolutionLab
-- Ejecutar DESPUES de supabase_migration_v2.sql
-- ==========================================================================

INSERT INTO public.ejercicios_globales (nombre, grupo_muscular, descripcion) VALUES
-- === PECHO ===
('Press de banca plano', 'Pecho', 'Ejercicio compuesto principal para pecho, deltoides anterior y triceps.'),
('Press de banca inclinado', 'Pecho', 'Variante inclinada que enfatiza la porcion clavicular del pectoral.'),
('Press de banca declinado', 'Pecho', 'Enfatiza la porcion inferior del pectoral mayor.'),
('Press con mancuernas plano', 'Pecho', 'Mayor rango de movimiento que la barra, mayor activacion de estabilizadores.'),
('Press con mancuernas inclinado', 'Pecho', 'Combina inclinacion con mayor ROM de mancuernas.'),
('Aperturas con mancuernas', 'Pecho', 'Ejercicio de aislamiento para pectoral con enfasis en estiramiento.'),
('Aperturas en polea', 'Pecho', 'Tension constante en el pectoral a lo largo de todo el rango.'),
('Fondos en paralelas', 'Pecho', 'Ejercicio compuesto de empuje con peso corporal.'),
('Press en maquina', 'Pecho', 'Ejercicio guiado ideal para volumen controlado.'),
('Pullover con mancuerna', 'Pecho', 'Trabaja pecho y dorsal, expandiendo la caja toracica.'),

-- === ESPALDA ===
('Dominadas', 'Espalda', 'Rey de los ejercicios de traccion vertical. Dorsal ancho y biceps.'),
('Dominadas con agarre neutro', 'Espalda', 'Variante con menos estres en hombros, enfasis en dorsal bajo.'),
('Jalon al pecho', 'Espalda', 'Traccion vertical en polea, alternativa a dominadas.'),
('Jalon tras nuca', 'Espalda', 'Variante de traccion posterior, mayor activacion de romboides.'),
('Remo con barra', 'Espalda', 'Ejercicio compuesto de traccion horizontal con barra.'),
('Remo con mancuerna', 'Espalda', 'Traccion horizontal unilateral. Corrige desbalances.'),
('Remo en polea baja', 'Espalda', 'Traccion horizontal con tension constante.'),
('Remo T-bar', 'Espalda', 'Remo con soporte de torso, enfasis en grosor de espalda.'),
('Peso muerto convencional', 'Espalda', 'Ejercicio compuesto de cadena posterior. Fuerza total del cuerpo.'),
('Peso muerto sumo', 'Espalda', 'Variante con postura amplia, mas cuadriceps y aductores.'),
('Face pull', 'Espalda', 'Ejercicio de traccion para deltoides posterior y rotadores externos.'),
('Pullover en polea', 'Espalda', 'Aislamiento de dorsal con tension constante.'),

-- === HOMBROS ===
('Press militar con barra', 'Hombros', 'Ejercicio compuesto principal para deltoides anterior y medio.'),
('Press militar con mancuernas', 'Hombros', 'Mayor rango de movimiento y activacion de estabilizadores.'),
('Elevaciones laterales', 'Hombros', 'Aislamiento del deltoides medio. Fundamental para amplitud.'),
('Elevaciones frontales', 'Hombros', 'Aislamiento del deltoides anterior.'),
('Pajaros con mancuernas', 'Hombros', 'Aislamiento del deltoides posterior en flexion de tronco.'),
('Press Arnold', 'Hombros', 'Variante rotatoria que activa las tres cabezas del deltoides.'),
('Elevaciones laterales en polea', 'Hombros', 'Tension constante lateral con polea.'),
('Encogimiento de hombros', 'Hombros', 'Aislamiento de trapecio superior.'),

-- === BICEPS ===
('Curl con barra recta', 'Biceps', 'Ejercicio principal de biceps con barra.'),
('Curl con barra Z', 'Biceps', 'Menor estres en munecas que la barra recta.'),
('Curl con mancuernas alterno', 'Biceps', 'Curl unilateral con supinacion.'),
('Curl martillo', 'Biceps', 'Enfasis en braquial y braquiorradial.'),
('Curl concentrado', 'Biceps', 'Aislamiento maximo de biceps sin compensacion.'),
('Curl en polea', 'Biceps', 'Tension constante durante todo el recorrido.'),
('Curl predicador', 'Biceps', 'Aislamiento en banco Scott, sin compensacion.'),
('Curl inclinado', 'Biceps', 'Mayor estiramiento de la cabeza larga del biceps.'),

-- === TRICEPS ===
('Press frances con barra Z', 'Triceps', 'Extension de triceps en banco plano.'),
('Extension de triceps en polea', 'Triceps', 'Aislamiento de triceps con cuerda o barra en polea alta.'),
('Fondos en banco', 'Triceps', 'Extension de triceps con peso corporal.'),
('Patada de triceps', 'Triceps', 'Aislamiento con mancuerna en extension posterior.'),
('Press cerrado', 'Triceps', 'Press de banca con agarre estrecho, enfasis en triceps.'),
('Extension sobre cabeza', 'Triceps', 'Extension de triceps unilateral o bilateral sobre la cabeza.'),

-- === PIERNAS ===
('Sentadilla con barra', 'Piernas', 'Rey de los ejercicios. Cuadriceps, gluteos y cadena posterior.'),
('Sentadilla frontal', 'Piernas', 'Mayor enfasis en cuadriceps y core por la posicion frontal.'),
('Sentadilla bulgara', 'Piernas', 'Ejercicio unilateral para cuadriceps y gluteos.'),
('Prensa de piernas', 'Piernas', 'Ejercicio compuesto guiado para tren inferior.'),
('Extension de cuadriceps', 'Piernas', 'Aislamiento de cuadriceps en maquina.'),
('Curl femoral acostado', 'Piernas', 'Aislamiento de isquiotibiales.'),
('Curl femoral sentado', 'Piernas', 'Variante sentada de aislamiento de isquiotibiales.'),
('Peso muerto rumano', 'Piernas', 'Enfasis en isquiotibiales y gluteos con rodillas ligeramente flexionadas.'),
('Hip thrust', 'Piernas', 'Ejercicio principal de activacion y fuerza glutea.'),
('Zancadas con mancuernas', 'Piernas', 'Ejercicio unilateral funcional.'),
('Elevacion de talones de pie', 'Piernas', 'Aislamiento de gastrocnemio.'),
('Elevacion de talones sentado', 'Piernas', 'Aislamiento del soleo.'),
('Sentadilla hack', 'Piernas', 'Sentadilla guiada con enfasis en cuadriceps.'),
('Abduccion de cadera', 'Piernas', 'Aislamiento de gluteo medio y abductores.'),
('Aduccion de cadera', 'Piernas', 'Aislamiento de aductores.'),

-- === ABDOMEN ===
('Crunch en polea', 'Abdomen', 'Flexion de tronco con resistencia en polea alta.'),
('Elevacion de piernas colgado', 'Abdomen', 'Ejercicio avanzado para abdomen inferior.'),
('Plancha frontal', 'Abdomen', 'Ejercicio isometrico de estabilidad del core.'),
('Plancha lateral', 'Abdomen', 'Isometrico para oblicuos y estabilidad lateral.'),
('Russian twist', 'Abdomen', 'Rotacion de tronco para oblicuos con resistencia.'),
('Ab wheel rollout', 'Abdomen', 'Extension anti-extension avanzada del core.'),
('Crunch en maquina', 'Abdomen', 'Flexion de tronco con resistencia guiada.')

ON CONFLICT (nombre, grupo_muscular) DO NOTHING;
