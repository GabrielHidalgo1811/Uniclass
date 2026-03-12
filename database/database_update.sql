-- Actualización completa de la base de datos de Uniclass
-- Ejecuta estos comandos en el SQL Editor de Supabase

-- 1. Actualizar tabla schedule_classes para incluir nuevos campos
ALTER TABLE schedule_classes 
ADD COLUMN IF NOT EXISTS professor TEXT,
ADD COLUMN IF NOT EXISTS class_type TEXT DEFAULT 'Teoría';

-- 2. Actualizar tabla grades para incluir fecha de prueba y número
ALTER TABLE grades
ADD COLUMN IF NOT EXISTS exam_date DATE,
ADD COLUMN IF NOT EXISTS exam_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- 3. Actualizar study_checklists para vincular con grades en vez de subjects
-- Primero agregar la nueva columna
ALTER TABLE study_checklists
ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE CASCADE;

-- Hacer opcional el subject_id para permitir temarios por prueba
ALTER TABLE study_checklists
ALTER COLUMN subject_id DROP NOT NULL;

-- 4. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_study_checklists_grade_id ON study_checklists(grade_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);

-- 5. Asegurar que created_at existe en study_checklists
ALTER TABLE study_checklists 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Comentarios:
-- - Ahora cada prueba (grade) puede tener su propio temario (study_checklists con grade_id)
-- - exam_number se usa para Prueba 1, 2, 3, etc.
-- - exam_date es opcional para fecha de la prueba
-- - is_visible controla si el temario se muestra expandido o colapsado
