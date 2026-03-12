# 🎉 Uniclass - Sistema Completamente Rediseñado

## ✅ Cambios Implementados

### 1. Sistema de Clases Individual
- **ANTES**: Seleccionabas múltiples días para una misma clase
- **AHORA**: Cada clase se agrega individualmente (un día, un horario)
- Esto permite tener diferentes horarios por día (ej: Lunes 8am, Miércoles 2pm)

### 2. Pruebas y Temarios Automáticos
- **Al crear un ramo**, se generan automáticamente Prueba 1, 2 y 3
- Cada prueba tiene su propio temario (checklist)
- Botón "+" para agregar más pruebas cuando las necesites
- Click en la prueba para expandir/colapsar el temario

### 3. Sidebar con Temarios
- **Eliminado**: Vista general de "Temarios"
- **NUEVO**: Los temarios aparecen organizados por ramo y prueba en el sidebar
- Ejemplo: "Física > Prueba 1"
- Click en un temario te lleva directo a esa prueba expandida

### 4. Fecha de Prueba Opcional
- Cada prueba puede tener una fecha asociada
- Se muestra en el sidebar y en la vista de detalles

## 📋 IMPORTANTE: Actualizar Base de Datos en Supabase

**DEBES ejecutar estos comandos en tu SQL Editor de Supabase:**

```sql
-- 1. Agregar columnas a schedule_classes
ALTER TABLE schedule_classes 
ADD COLUMN IF NOT EXISTS professor TEXT,
ADD COLUMN IF NOT EXISTS class_type TEXT DEFAULT 'Teoría';

-- 2. Agregar columnas a grades (pruebas)
ALTER TABLE grades
ADD COLUMN IF NOT EXISTS exam_date DATE,
ADD COLUMN IF NOT EXISTS exam_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- 3. Actualizar study_checklists para vincular con pruebas
ALTER TABLE study_checklists
ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE CASCADE;

ALTER TABLE study_checklists
ALTER COLUMN subject_id DROP NOT NULL;

-- 4. Crear índices
CREATE INDEX IF NOT EXISTS idx_study_checklists_grade_id ON study_checklists(grade_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);

-- 5. Asegurar created_at
ALTER TABLE study_checklists 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
```

### Cómo ejecutar:
1. Ve a tu Dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor** (icono de código en el menú izquierdo)
4. Click en **New Query**
5. Copia y pega todo el SQL de arriba
6. Click en **Run** o presiona Ctrl+Enter
7. Verifica que diga "Success. No rows returned"

## 🚀 Cómo Usar la Nueva Versión

### Agregar una Clase:
1. Click en "Agregar Clase" (botón verde)
2. Llena los datos:
   - Nombre del ramo
   - Color
   - **UN solo día** (Lunes, Martes, etc.)
   - Hora inicio y fin
   - Sala (opcional)
   - Profesor (opcional)
   - Tipo de clase (Teoría/Ayudantía/Laboratorio)
3. Click en "Agregar"
4. **Automáticamente** se crean Prueba 1, 2 y 3 para ese ramo

### Si necesitas la misma clase en otro día:
1. Agregar la clase de nuevo con el mismo nombre pero otro día
2. Ejemplo: "Matemáticas" Lunes 8am + "Matemáticas" Miércoles 2pm

### Gestionar Pruebas y Temarios:
1. Click en una clase del calendario O en el ramo desde la vista "Ramos"
2. Verás todas las pruebas (colapsadas por defecto)
3. Click en una prueba para expandirla
4. Ingresa nota, ponderación y fecha (opcional)
5. Agrega temas al temario de esa prueba específica
6. Marca temas como completados
7. Click en "+" abajo de todo para agregar más pruebas si necesitas

### Ver Temarios desde el Sidebar:
1. En el sidebar izquierdo, debajo de "Temarios"
2. Verás tus ramos con flechita
3. Click para expandir y ver las pruebas
4. Click en una prueba para ir directo a ella

## 🎯 Flujo Completo de Ejemplo

1. **Login** con: `prueba@Uniclass.com` / `123456`
2. **Agregar clase**: "Física" - Lunes 10:00-12:00 - Lab 201 - Dr. García
3. Ver en el calendario el bloque de Física
4. Click en el bloque
5. Verás Prueba 1, 2, 3 ya creadas
6. Expandir Prueba 1:
   - Nota: 6.5
   - Ponderación: 30%
   - Fecha: 15/03/2026
   - Agregar temas: "Mecánica", "Cinemática", "Dinámica"
7. Ir al sidebar → Ver "Física > Prueba 1" con la fecha
8. Click para volver a ella cuando quieras

## ⚠️ Notas Importantes

- **NO olvides ejecutar el SQL** o la app dará errores al agregar clases
- Las clases viejas que agregaste antes seguirán funcionando
- El cálculo del promedio ponderado es automático
- Los temarios ahora están vinculados a PRUEBAS, no a ramos generales

## 🆘 Si algo no funciona

1. Verifica que ejecutaste TODO el SQL en Supabase
2. Refresca la página (F5)
3. Intenta logout y login de nuevo
4. Revisa la consola del navegador (F12) por errores

¡Disfruta tu nueva Uniclass! 🎓
