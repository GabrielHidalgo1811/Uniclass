-- 1. Crear la tabla de recordatorios
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_time TIME NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date_time ON public.reminders(reminder_date, reminder_time);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Solo el usuario puede ver y modificar sus propios recordatorios)
CREATE POLICY "Users can view their own reminders"
    ON public.reminders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders"
    ON public.reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
    ON public.reminders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
    ON public.reminders FOR DELETE
    USING (auth.uid() = user_id);
