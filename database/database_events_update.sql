-- Actualización de tabla events para sistema de eventos mejorado
-- Ejecutar en SQL Editor de Supabase

-- 1. Agregar nuevas columnas para eventos recurrentes
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 2. Crear índice para mejor performance
CREATE INDEX IF NOT EXISTS idx_events_day_of_week ON events(day_of_week);
CREATE INDEX IF NOT EXISTS idx_events_is_fixed ON events(is_fixed);

-- NOTA: 
-- - day_of_week: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
-- - start_time y end_time: formato TIME (HH:MM:SS)
-- - is_fixed: true = evento se repite cada semana, false = solo esta semana
-- - Los campos start_timestamp y end_timestamp quedan como referencia opcional
