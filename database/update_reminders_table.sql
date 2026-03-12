-- SCRIPT DE RECONSTRUCCIÓN TOTAL (☢️ NUCLEAR FIX)
-- Esto borrará los recordatorios actuales y creará la tabla desde cero correctamente.

-- 1. Borrar la tabla existente para limpiar cualquier error de caché o esquema
DROP TABLE IF EXISTS reminders;

-- 2. Crear la tabla con TODAS las columnas necesarias
CREATE TABLE public.reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reminder_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reminder_time TIME NOT NULL DEFAULT '00:00:00',
    is_completed BOOLEAN DEFAULT false,
    type TEXT DEFAULT 'recordatorio', -- 'recordatorio' o 'evaluacion'
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Crear índices
CREATE INDEX idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX idx_reminders_date_time ON public.reminders(reminder_date, reminder_time);

-- 4. Habilitar RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 5. Crear política de acceso
CREATE POLICY "Users can manage their own reminders"
    ON public.reminders FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Forzar recarga de esquema (ejecutar esto al final)
NOTIFY pgrst, 'reload schema';
