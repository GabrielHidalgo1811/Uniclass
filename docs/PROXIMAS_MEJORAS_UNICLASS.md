# 🚀 Próximas Mejoras para Uniclass

## Estado Actual
✅ Sistema base implementado y funcionando
✅ Logo descargado en `/app/frontend/public/uniclass-logo.png`
✅ Estructura de base de datos lista

## Mejoras Solicitadas por Implementar

### 1. ✅ Paleta de 10 Colores
**Estado**: LISTO PARA IMPLEMENTAR
**Archivo**: `AddClassModal.js`
**Cambio**: Expandir el array COLORS de 6 a 10 colores

```javascript
const COLORS = [
  '#b4d5c8', // menta
  '#d4b4e0', // lavanda  
  '#b4d9e8', // azul claro
  '#f0d4b4', // naranja claro
  '#f0b4c8', // rosa
  '#c8e8d4', // verde agua
  '#e8d4b4', // beige
  '#d4c8e8', // lila
  '#c8d4e8', // azul gris
  '#e8c8d4'  // rosa gris
];
```

### 2. ✅ Logo en Login y Dashboard
**Estado**: LOGO DESCARGADO - Listo para agregar
**Archivos**: `Auth.js`, `NewLayout.js`
**Implementación**:
- Login: Agregar `<img src="/uniclass-logo.png" alt="Uniclass" className="w-16 h-16 mx-auto mb-4" />`
- Dashboard: En el sidebar, reemplazar el texto "Uniclass" con el logo

### 3. 🔨 Agregar Tema Inline (SIN prompt)
**Estado**: REQUIERE IMPLEMENTACIÓN
**Archivo**: `SubjectDetail.js`
**Cambio Actual**: Usa `prompt()` que abre ventana del navegador
**Cambio Deseado**: 
- Click en "Agregar Tema" → Se agrega un tema vacío directamente
- Aparece con un input inline con placeholder "Ingresa tema de estudio"
- Usuario escribe y presiona Enter o hace click fuera para guardar

**Código sugerido**:
```javascript
const [editingTopic, setEditingTopic] = useState(null);
const [newTopicText, setNewTopicText] = useState('');

// En el render de temario:
<div className="space-y-2">
  {gradeChecklists.map(item => (
    // ... render existente
  ))}
  
  {/* Nuevo tema inline */}
  <div className="flex items-center p-2 bg-gray-50 rounded">
    <Checkbox disabled />
    <Input
      placeholder="Ingresa tema de estudio"
      value={newTopicText}
      onChange={(e) => setNewTopicText(e.target.value)}
      onKeyPress={(e) => {
        if (e.key === 'Enter' && newTopicText.trim()) {
          addTopicInline(gradeId, newTopicText);
          setNewTopicText('');
        }
      }}
      className="ml-2 border-none bg-transparent"
      autoFocus
    />
  </div>
</div>
```

### 4. 🔨 Sidebar con Temarios Expandibles Inline
**Estado**: REQUIERE REDISEÑO COMPLETO
**Archivo**: `NewLayout.js`
**Cambio Actual**: Click en temario te lleva a la página del ramo
**Cambio Deseado**:
- Sidebar muestra: Ramo → Prueba 1 ▼
- Al expandir Prueba 1, se muestran los checkboxes del temario
- Se pueden marcar/desmarcar SIN salir del dashboard
- No navega a otra vista, todo inline en el sidebar

**Estructura deseada**:
```
📚 Física (color)
  └─ Prueba 1 ▼
     ☐ Mecánica
     ☐ Cinemática  
     ☑ Dinámica (marcado)
  └─ Prueba 2 ►
  └─ Prueba 3 ►
```

### 5. 🔨 Eliminar Ramos
**Estado**: FALTA IMPLEMENTAR
**Archivo**: `SubjectsView.js`
**Cambio**: Agregar botón de eliminar (icono de basura) en cada tarjeta de ramo
**Consideración**: Al eliminar un ramo, también se eliminan sus clases, pruebas y temarios (CASCADE en BD)

### 6. 🔥 Drag & Drop en Calendario
**Estado**: REQUIERE IMPLEMENTACIÓN COMPLEJA
**Archivo**: `NewWeeklyCalendar.js`
**Funcionalidad**:
- Usuario puede arrastrar una clase en el calendario
- Al soltar en otro día/hora, se actualiza automáticamente en la BD
- Calcular nueva hora de inicio y fin basado en la posición donde se suelta

**Librerías sugeridas**:
- `react-dnd` o `@dnd-kit/core`
- O implementación custom con eventos drag de HTML5

**Flujo**:
1. Usuario hace drag de una clase
2. Mientras arrastra, muestra preview/ghost
3. Al soltar, calcula:
   - Nuevo día (columna donde cayó)
   - Nueva hora inicio (posición Y)
   - Nueva hora fin (mantiene duración original)
4. Actualiza en Supabase
5. Refresca vista

### 7. 🔥 Panel de Recordatorios con Email
**Estado**: REQUIERE MÚLTIPLES COMPONENTES NUEVOS

#### Componentes a crear:
- `RemindersPanel.js` - Panel lateral derecho deslizante
- `ReminderItem.js` - Item de recordatorio individual

#### Flujo:
1. Agregar "Recordatorios" al menú lateral izquierdo
2. Click abre panel desde la derecha (slide-in animation)
3. Panel muestra lista de recordatorios
4. Botón "+" para agregar nuevo:
   - Mensaje
   - Fecha y hora
   - Email del usuario (auto del perfil)
5. Backend (necesita crear):
   - Tabla `reminders` con: user_id, message, remind_at, email_sent, created_at
   - Cron job o función serverless para enviar emails
   - Integración con servicio de email (SendGrid, Resend, etc.)

#### Base de Datos:
```sql
CREATE TABLE user_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### Email Service:
- Necesita integrar con API de email (ej: Resend)
- Crear función en Supabase Edge Functions o backend separado
- Scheduler que revise cada hora si hay recordatorios pendientes

---

## Priorización Sugerida

### FASE 1 - Mejoras Rápidas (1-2 horas)
1. ✅ Paleta de 10 colores
2. ✅ Logo en login y dashboard  
3. ✅ Eliminar ramos
4. ✅ Agregar tema inline

### FASE 2 - Mejoras Intermedias (3-4 horas)
5. 🔨 Sidebar con temarios expandibles inline

### FASE 3 - Funcionalidades Avanzadas (5-8 horas)
6. 🔥 Drag & Drop en calendario
7. 🔥 Sistema completo de recordatorios con emails

---

## Notas Técnicas

### Para Drag & Drop:
- Necesita state management robusto
- Considerar performance con muchas clases
- Validaciones: no permitir overlap, respetar horarios válidos

### Para Recordatorios con Email:
- **CRÍTICO**: Necesita servicio de email externo
- Opciones recomendadas:
  - Resend (más fácil, 100 emails gratis/día)
  - SendGrid (3000 emails gratis/mes)
  - AWS SES (económico)
- Necesita backend para procesar y enviar
- Supabase Edge Functions es ideal para esto

---

## ¿Por Dónde Empezar?

### Si quieres resultados rápidos:
Implementa FASE 1 (cambios visuales y UX mejorada)

### Si quieres funcionalidad completa:
1. Primero FASE 1
2. Luego FASE 2  
3. Finalmente FASE 3 (requiere servicios externos)

### Si quieres que implemente TODO:
Dime y voy paso por paso, pero serán varios mensajes porque son muchos cambios.

---

## Recursos Necesarios

- ✅ Logo: Ya descargado
- ⏳ Servicio de Email: Necesita API key
- ⏳ Tiempo de desarrollo: ~10-15 horas para TODO
- ⏳ Testing completo después de cada fase

¿Quieres que empiece con la FASE 1 completa ahora?
