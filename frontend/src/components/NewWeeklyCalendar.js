import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { fetchRecentGoogleEvents } from '@/lib/googleCalendar';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, Undo2, Pencil, ZoomIn, ZoomOut, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { format, addDays, startOfWeek, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddClassModal from './AddClassModal';
import AddEventModal from './AddEventModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const START_HOUR = 7;
const END_HOUR = 22;
// HOUR_HEIGHT is derived dynamically from zoomLevel now

// ─── Academic Semester Logic ───────────────────────────────────────────────
// Accept an optional date to check. Defaults to today.
// Returns 1 (Semester 1: Mar–Jun), 2 (Semester 2: Aug 1–Dec 23), or null (break)
const getAcademicPeriod = (date = new Date()) => {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  if (month === 12 && day >= 24) return null; // summer break
  if (month === 1 || month === 2) return null;  // summer break (Dec 24 – Feb 28)
  if (month >= 3 && month <= 6) return 1;        // Semester 1
  if (month === 7) return null;                  // inter-semester break
  if (month >= 8) return 2;                      // Semester 2
  return null;
};

// Returns which academic period to assign a NEW class created today
const getAcademicPeriodForCreation = () => {
  const month = new Date().getMonth() + 1;
  return month <= 6 ? 1 : 2;
};

const BREAK_INFO = {
  7: { emoji: '📚', title: 'Receso entre semestres', subtitle: 'El Semestre 2 comienza el 1 de agosto.' },
  summer: { emoji: '☀️', title: 'Vacaciones de verano', subtitle: 'El Semestre 1 comienza el 1 de marzo.' },
};

const getBreakInfo = (date = new Date()) => {
  const month = date.getMonth() + 1;
  if (month === 7) return BREAK_INFO[7];
  return BREAK_INFO.summer;
};

const NewWeeklyCalendar = ({ onSubjectClick }) => {
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const HOUR_HEIGHT = 60 * zoomLevel;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [subjects, setSubjects] = useState([]);
  const [scheduleClasses, setScheduleClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalInitialData, setModalInitialData] = useState({ day: '0', startTime: '', endTime: '' });
  const [resizingClass, setResizingClass] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null); // { dayIndex, hourIndex }
  const [history, setHistory] = useState([]); // undo history stack
  const [dragPreview, setDragPreview] = useState(null); // { dayIndex, top, height, label }
  const [clipboard, setClipboard] = useState(null); // { type: 'class'|'event', data: {...} }
  const [hoveredItem, setHoveredItem] = useState(null); // { type: 'class'|'event', data: {...} }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  const weekStart = React.useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatTimeFromMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
  };

  const dataFetchId = React.useRef(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    const currentFetchId = ++dataFetchId.current;
    
    try {
      const activeperiod = getAcademicPeriod(weekStart);
      const cacheKey = `uniclass_cache_${user.id}_${activeperiod}`;

      // --- LOCAL CACHE ---
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.subjects) setSubjects(parsed.subjects);
          if (parsed.classes) setScheduleClasses(parsed.classes);
          if (parsed.events) setEvents(parsed.events);
        } catch (e) { console.error('Cache parse error', e); }
      }

      // Instant UI reset for classes (the main source of flickering)
      if (activeperiod === null && !cachedData) {
        setScheduleClasses([]);
      }

      // Start fetching subjects and events in parallel
      const [subjectsRes, eventsRes, googleEventsRaw] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', user.id),
        supabase.from('events').select('*').eq('user_id', user.id),
        fetchRecentGoogleEvents(new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString())
      ]);

      if (currentFetchId !== dataFetchId.current) return;

      const subjectsData = subjectsRes.data || [];
      const dbEventsData = eventsRes.data || [];

      // Format Google events to match Uniclass events
      const gEventsFormatted = (googleEventsRaw || []).map(ge => {
        // Skip events generated by Uniclass
        if (ge.summary && ge.summary.includes('[Uniclass]')) return null;

        let startD, endD;
        let isAllDay = false;
        
        if (ge.start?.dateTime) {
          startD = new Date(ge.start.dateTime);
          endD = new Date(ge.end?.dateTime || ge.start.dateTime);
        } else if (ge.start?.date) {
          isAllDay = true;
          const [y, m, d] = ge.start.date.split('-');
          startD = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 0, 0, 0); 
          endD = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 23, 59, 59); 
        }

        if (!startD) return null;

        // Visual handling for all-day events (span 1 hour, morning)
        if (isAllDay) {
          startD.setHours(7, 0, 0);
          endD.setHours(8, 0, 0);
        }

        return {
          id: ge.id,
          title: ge.summary || 'Evento',
          description: ge.description || '',
          start_timestamp: startD.toISOString(),
          end_timestamp: endD.toISOString(),
          is_fixed: false,
          day_of_week: null, 
          is_google: true,
          is_all_day: isAllDay,
          googleColor: ge.calendarColor || '#3b82f6'
        };
      }).filter(Boolean);

      const eventsData = [...dbEventsData, ...gEventsFormatted];
      setSubjects(subjectsData);

      // Handle classes filtering locally based on the fetched subjects
      let currentClasses = [];
      if (activeperiod !== null && subjectsData.length > 0) {
        const subjectsInPeriod = subjectsData
          .filter(s => (s.academic_year_period ?? 1) === activeperiod)
          .map(s => s.id);

        if (subjectsInPeriod.length > 0) {
          const { data: classesData, error: classesError } = await supabase
            .from('schedule_classes')
            .select('*')
            .eq('user_id', user.id)
            .in('subject_id', subjectsInPeriod);

          if (currentFetchId !== dataFetchId.current) return;

          if (!classesError) {
            currentClasses = classesData || [];
            setScheduleClasses(currentClasses);
          }
        } else {
          setScheduleClasses([]);
        }
      } else {
        setScheduleClasses([]);
      }

      // Filter and set events (Keep all events returned by DB and Google for the given ranges)
      const filteredEvents = eventsData;
      setEvents(filteredEvents);

      // --- SAVE TO CACHE ---
      localStorage.setItem(cacheKey, JSON.stringify({
        subjects: subjectsData,
        classes: currentClasses,
        events: filteredEvents
      }));

    } catch (error) {
      console.error('Error loading data:', error);
      if (currentFetchId === dataFetchId.current) {
        toast.error('Error al cargar datos');
      }
    }
  }, [user, weekStart]);



  // Ctrl+Z undo handler
  const handleUndo = useCallback(async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (history.length === 0) {
        toast('No hay cambios para deshacer');
        return;
      }
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));

      // Revert each changed class in DB
      for (const cls of prev) {
        await supabase.from('schedule_classes')
          .update({
            day_of_week: cls.day_of_week,
            start_time: cls.start_time,
            end_time: cls.end_time
          })
          .eq('id', cls.id);
      }
      setScheduleClasses(prev);
      toast.success('Cambio deshecho (Ctrl+Z)');
    }
  }, [history]);

  // Ctrl+C and Ctrl+V handlers
  const handleCopyPaste = useCallback(async (e) => {
    // Copy: Ctrl+C
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (hoveredItem) {
        setClipboard(hoveredItem);
        toast.success(`Copiado: ${hoveredItem.type === 'class' ? (hoveredItem.data.subject?.name || 'Clase') : (hoveredItem.data.title || 'Evento')}`);
      }
    }

    // Paste: Ctrl+V
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (!clipboard || !hoveredCell) return;
      e.preventDefault();

      const { dayIndex, hourIndex } = hoveredCell;
      const startMins = hourIndex * 60 + START_HOUR * 60;
      const formatTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
      };

      if (clipboard.type === 'class') {
        const duration = timeToMinutes(clipboard.data.end_time) - timeToMinutes(clipboard.data.start_time);
        const newStartTime = formatTime(startMins);
        const newEndTime = formatTime(startMins + duration);

        const { data, error } = await supabase
          .from('schedule_classes')
          .insert([{
            user_id: user.id,
            subject_id: clipboard.data.subject_id,
            day_of_week: dayIndex + 1,
            start_time: newStartTime,
            end_time: newEndTime,
            room: clipboard.data.room,
            professor: clipboard.data.professor,
            class_type: clipboard.data.class_type
          }])
          .select()
          .single();

        if (error) {
          toast.error('Error al pegar clase');
        } else {
          toast.success('Clase pegada');
          loadData();
        }
      } else if (clipboard.type === 'event') {
        const duration = (clipboard.data.end_time && clipboard.data.start_time) 
          ? (timeToMinutes(clipboard.data.end_time) - timeToMinutes(clipboard.data.start_time))
          : 60;

        const newStartTime = formatTime(startMins);
        const newEndTime = formatTime(startMins + duration);
        
        // Prepare timestamps if needed
        const today = new Date();
        const targetDate = addDays(startOfWeek(today, { weekStartsOn: 1 }), dayIndex);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');

        const { error } = await supabase
          .from('events')
          .insert([{
            user_id: user.id,
            title: clipboard.data.title,
            description: clipboard.data.description,
            color: clipboard.data.color,
            day_of_week: dayIndex,
            start_time: newStartTime,
            end_time: newEndTime,
            start_timestamp: `${targetDateStr}T${newStartTime}`,
            end_timestamp: `${targetDateStr}T${newEndTime}`,
            is_fixed: clipboard.data.is_fixed
          }]);

        if (error) {
          toast.error('Error al pegar evento');
        } else {
          toast.success('Evento pegado');
          loadData();
        }
      }
    }
  }, [clipboard, hoveredItem, hoveredCell, user, loadData]);

  const handleDelete = useCallback(async () => {
    const item = deletingItem || hoveredItem;
    if (!item || !user) return;

    const { type, data } = item;
    const table = type === 'class' ? 'schedule_classes' : 'events';
    
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', data.id)
      .eq('user_id', user.id);

    if (error) {
      toast.error(`Error al eliminar ${type === 'class' ? 'clase' : 'evento'}`);
    } else {
      toast.success(`${type === 'class' ? 'Clase' : 'Evento'} eliminada`);
      setHoveredItem(null);
      setDeletingItem(null);
      setShowDeleteConfirm(false);
      loadData();
    }
  }, [deletingItem, hoveredItem, user, loadData]);

  useEffect(() => {
    const handleKeyboardShortcuts = (e) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        handleUndo(e);
      }
      // Copy: Ctrl+C
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyPaste(e);
      }
      // Paste: Ctrl+V
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        handleCopyPaste(e);
      }
      // Delete: Delete key
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only trigger if not typing in an input
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          if (hoveredItem) {
            setDeletingItem(hoveredItem);
            setShowDeleteConfirm(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [handleUndo, handleCopyPaste, handleDelete]);

  useEffect(() => {
    if (user) {
      // Clear current classes to show feedback immediately (or avoid stale data)
      setScheduleClasses([]);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart.getTime()]);


  const pushHistory = () => {
    setHistory(h => [...h.slice(-19), [...scheduleClasses]]); // keep last 20 states
  };


  const getClassesForDay = (dayIndex) => {
    return scheduleClasses
      .filter(cls => cls.day_of_week === dayIndex + 1) // DB stores 1-7 (Mon=1)
      .map(cls => {
        const subject = subjects.find(s => s.id === cls.subject_id);
        const startMinutes = timeToMinutes(cls.start_time);
        const endMinutes = timeToMinutes(cls.end_time);
        const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

        return {
          ...cls,
          subject,
          top,
          height
        };
      });
  };

  const getEventsForDay = (dayIndex) => {
    return events
      .filter(event => {
        // Si el evento tiene day_of_week (nuevo sistema)
        if (event.day_of_week !== null && event.day_of_week !== undefined) {
          // Evento anclado: siempre se muestra si coincide el día
          if (event.is_fixed) {
            return event.day_of_week === dayIndex;
          }
          // Evento no anclado: solo se muestra en la semana actual
          const today = new Date();
          const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
          const isSameWeek = format(weekStart, 'yyyy-ww') === format(currentWeekStart, 'yyyy-ww');
          return isSameWeek && event.day_of_week === dayIndex;
        }

        // Fallback para eventos viejos con timestamp o de Google
        if (event.is_fixed) return false; // Eventos viejos "fijos" no se muestran
        const targetDate = addDays(weekStart, dayIndex);
        const eventStart = new Date(event.start_timestamp);
        const eventDate = format(eventStart, 'yyyy-MM-dd');
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        return eventDate === targetDateStr;
      })
      .map(event => {
        // Si tiene start_time (nuevo sistema), usar eso
        if (event.start_time && event.end_time) {
          const [startHour, startMinute] = event.start_time.split(':');
          const [endHour, endMinute] = event.end_time.split(':');
          const startMinutes = parseInt(startHour) * 60 + parseInt(startMinute);
          const endMinutes = parseInt(endHour) * 60 + parseInt(endMinute);
          const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

          return {
            ...event,
            top,
            height
          };
        }

        // Fallback para eventos viejos con timestamp
        const eventStart = new Date(event.start_timestamp);
        const eventEnd = new Date(event.end_timestamp);
        const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
        const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
        const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

        return {
          ...event,
          top,
          height
        };
      });
  };

  const getClassTypeBadgeColor = (type) => {
    switch (type) {
      case 'Teoría': return 'bg-blue-100 text-blue-800';
      case 'Ayudantía': return 'bg-green-100 text-green-800';
      case 'Laboratorio': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const currentPeriod = getAcademicPeriod(weekStart); // check the DISPLAYED week
  const isBreakPeriod = currentPeriod === null;
  const breakInfo = isBreakPeriod ? getBreakInfo(weekStart) : null;


  return (
    <TooltipProvider delayDuration={150}>
    <div className="h-full flex flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="border-b dark:border-slate-800 px-4 md:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 md:flex-wrap lg:flex-nowrap">
        <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-1 md:space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h2 className="text-lg md:text-xl font-semibold capitalize whitespace-nowrap">
              {format(weekStart, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" className="md:hidden" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
        </div>
        <div className="flex space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Button className="flex-1 md:flex-none text-xs md:text-sm whitespace-nowrap" size="sm" onClick={() => {
            setModalInitialData({ day: '1', startTime: '', endTime: '' });
            setShowClassModal(true);
          }}>
            <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            Agregar Clase
          </Button>
          <Button className="flex-1 md:flex-none text-xs md:text-sm whitespace-nowrap" variant="outline" size="sm" onClick={() => setShowEventModal(true)}>
            <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            Agregar Evento
          </Button>
          {history.length > 0 && (
            <Button
              className="flex-none text-xs md:text-sm whitespace-nowrap"
              variant="ghost"
              size="sm"
              title="Deshacer (Ctrl+Z)"
              onClick={() => handleUndo({ ctrlKey: true, key: 'z', preventDefault: () => {} })}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isBreakPeriod && breakInfo && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="text-lg">{breakInfo.emoji}</span>
          <span className="font-medium">{breakInfo.title}:</span>
          <span className="opacity-90">{breakInfo.subtitle}</span>
        </div>
      )}

      {/* Calendar */}
      <div 
        className="flex-1 overflow-auto touch-pan-x touch-pan-y"
        style={{ touchAction: 'pan-x pan-y' }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            e.currentTarget.dataset.initialPinchDist = dist;
            e.currentTarget.dataset.initialZoom = zoomLevel;
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const initialDist = parseFloat(e.currentTarget.dataset.initialPinchDist);
            const initialZoom = parseFloat(e.currentTarget.dataset.initialZoom);
            if (initialDist) {
              const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
              );
              const scale = currentDist / initialDist;
              const newZoom = Math.min(Math.max(0.3, initialZoom * scale), 3);
              setZoomLevel(newZoom);
            }
          }
        }}
        onTouchEnd={(e) => {
          delete e.currentTarget.dataset.initialPinchDist;
          delete e.currentTarget.dataset.initialZoom;
        }}
      >
        <div id="calendar-download-wrapper" className="flex min-w-max bg-gray-50 dark:bg-slate-900/50">
          {/* Time column */}
          <div className="w-12 md:w-16 flex-shrink-0 border-r dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 sticky left-0 z-20 font-mono">
            <div className="h-16 border-b dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 sticky top-0 z-30"></div>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map(hour => (
              <div key={hour} className="border-b dark:border-slate-800 flex items-start justify-end pr-1 md:pr-2 pt-1 bg-gray-50 dark:bg-slate-900/50" style={{ height: `${HOUR_HEIGHT}px` }}>
                <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Days */}
          {DAYS.map((day, dayIndex) => {
            const dayDate = addDays(weekStart, dayIndex);
            const dayClasses = getClassesForDay(dayIndex);
            const dayEvents = getEventsForDay(dayIndex);

            return (
              <div key={dayIndex} className="flex-1 border-r dark:border-slate-800 last:border-r-0" style={{ minWidth: `${Math.max(160, 180 * zoomLevel)}px` }}>
                {/* Day header */}
                <div className="h-16 border-b dark:border-slate-800 flex flex-col items-center justify-center bg-white dark:bg-slate-950 sticky top-0 z-20">
                  <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">{day.substring(0, 3)}</div>
                  <div className="text-xl md:text-2xl font-bold mt-1 dark:text-gray-200">{format(dayDate, 'd')}</div>
                </div>

                {/* Day content */}
                <div
                  className="relative group cursor-pointer"
                  style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
                  onDragOver={(e) => {
                    if (!isEditMode) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    // Compute ghost position for visual preview
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dropY = e.clientY - rect.top;
                    let startMins = Math.round(((dropY / HOUR_HEIGHT) * 60 + START_HOUR * 60) / 15) * 15;
                    const durationStr = e.dataTransfer.types.includes('application/duration')
                      ? Number(e.dataTransfer.getData('application/duration'))
                      : 90;
                    const ghostTop = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const ghostHeight = (durationStr / 60) * HOUR_HEIGHT;
                    const fmt = (m) => {
                      const h = Math.floor(m / 60); const mn = m % 60;
                      const ampm = h < 12 ? 'AM' : 'PM';
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      return `${h12}:${mn.toString().padStart(2, '0')} ${ampm}`;
                    };
                    setDragPreview({ dayIndex, top: ghostTop, height: ghostHeight, label: `${fmt(startMins)} – ${fmt(startMins + durationStr)}` });
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDragPreview(null);
                    }
                  }}
                  onClick={(e) => {
                    if (!isEditMode) return;
                    // Solo activar si se hace clic en el fondo, no en una clase/evento
                    // Allow clicks from hour-cell children by checking closest
                    if (e.target.closest('[data-class-block]') || e.target.closest('[data-event-block]')) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;

                    let clickedMinutes = (clickY / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
                    clickedMinutes = Math.floor(clickedMinutes / 30) * 30; // Snap to 30 mins

                    const formatTime = (mins) => {
                      const h = Math.floor(mins / 60);
                      const m = Math.floor(mins % 60);
                      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    };

                    const startTime = formatTime(clickedMinutes);
                    const endTime = formatTime(clickedMinutes + 90); // Default 1.5h duration

                    setModalInitialData({
                      day: (dayIndex + 1).toString(), // 1-7 (Mon=1)
                      startTime,
                      endTime
                    });
                    setShowClassModal(true);
                  }}
                  onDrop={async (e) => {
                    if (!isEditMode) return;
                    e.preventDefault();
                    try {
                      const dataInfo = e.dataTransfer.getData('text/plain');
                      if (!dataInfo) return;
                      const { type, id, durationMinutes } = JSON.parse(dataInfo);
                      pushHistory(); // save state before drag-drop change

                      // Calculate new time based on drop position
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dropY = e.clientY - rect.top;

                      // Convert Y to minutes from START_HOUR
                      let newStartMinutes = (dropY / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
                      // Snap to 15 minute intervals
                      newStartMinutes = Math.round(newStartMinutes / 15) * 15;

                      // Calculate end minutes based on duration
                      const newEndMinutes = newStartMinutes + durationMinutes;

                      const formatTime = (mins) => {
                        const h = Math.floor(mins / 60);
                        const m = Math.floor(mins % 60);
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                      };

                      const newStartTime = formatTime(newStartMinutes);
                      const newEndTime = formatTime(newEndMinutes);

                      if (type === 'class') {
                        const newDayOfWeek = dayIndex + 1; // DB stores 1-7
                        // Optimistic UI update
                        setScheduleClasses(prev => prev.map(c =>
                          c.id === id ? { ...c, day_of_week: newDayOfWeek, start_time: newStartTime, end_time: newEndTime } : c
                        ));
                        setDragPreview(null);

                        const { error } = await supabase
                          .from('schedule_classes')
                          .update({
                            day_of_week: newDayOfWeek,
                            start_time: newStartTime,
                            end_time: newEndTime
                          })
                          .eq('id', id);
                        if (error) throw error;
                        toast.success('Clase movida correctamente');
                        loadData();
                      } else if (type === 'event') {
                        // For events we try to update start_time and end_time, and day_of_week
                        // If it has timestamps we should probably update them too
                        const targetDate = format(dayDate, 'yyyy-MM-dd');
                        const startTimestamp = `${targetDate}T${newStartTime}`;
                        const endTimestamp = `${targetDate}T${newEndTime}`;

                        // Optimistic UI update
                        setEvents(prev => prev.map(e =>
                          e.id === id ? {
                            ...e,
                            day_of_week: dayIndex + 1, // events keep 1-7 too
                            start_time: newStartTime,
                            end_time: newEndTime,
                            start_timestamp: startTimestamp,
                            end_timestamp: endTimestamp
                          } : e
                        ));

                        const { error } = await supabase
                          .from('events')
                          .update({
                            day_of_week: dayIndex,
                            start_time: newStartTime,
                            end_time: newEndTime,
                            start_timestamp: startTimestamp,
                            end_timestamp: endTimestamp
                          })
                          .eq('id', id);
                        if (error) throw error;
                        toast.success('Evento movido correctamente');
                        loadData();
                      }
                    } catch (error) {
                      console.error('Error on drop:', error);
                      toast.error('Error al mover el elemento');
                      loadData();
                    }
                  }}
                >
                  {/* Hour cells — interactive hover glow */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
                    const isHovered = hoveredCell?.dayIndex === dayIndex && hoveredCell?.hourIndex === i;
                    return (
                      <div
                        key={i}
                        className={`absolute w-full border-b border-gray-100 dark:border-slate-800/60 transition-all duration-100 ${
                          isEditMode && isHovered
                            ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500 shadow-[inset_0_0_10px_rgba(96,165,250,0.25)] bg-blue-50/60 dark:bg-blue-950/30 z-10'
                            : ''
                        }`}
                        style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        onMouseEnter={() => isEditMode && setHoveredCell({ dayIndex, hourIndex: i })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {isHovered && (
                          <div className="flex w-full h-full items-center justify-center pointer-events-none">
                            <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                              <Plus className="h-5 w-5 drop-shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Classes */}
                  {dayClasses.map((cls, idx) => {
                    // Check if this class is currently being resized
                    const isResizing = resizingClass?.id === cls.id;
                    const displayTop = isResizing && resizingClass.type === 'top' ? resizingClass.newTop : cls.top;
                    const displayHeight = isResizing ? resizingClass.newHeight : cls.height;

                    // Format time for tooltip while resizing
                    let timeDisplay = `${cls.start_time.substring(0, 5)} - ${cls.end_time.substring(0, 5)}`;
                    if (isResizing) {
                      const newStartMins = (displayTop / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
                      const newEndMins = newStartMins + (displayHeight / HOUR_HEIGHT) * 60;
                      timeDisplay = `${formatTimeFromMinutes(newStartMins).substring(0, 5)} - ${formatTimeFromMinutes(newEndMins).substring(0, 5)}`;
                    }

                    return (
                      <div
                        key={`class-${idx}`}
                        className={`absolute left-1 right-1 rounded-lg shadow-sm group ${(!isResizing && isEditMode) ? 'cursor-move hover:shadow-md transition-shadow' : (isEditMode ? 'z-50 ring-2 ring-primary' : 'hover:shadow-md transition-shadow cursor-pointer')} overflow-hidden flex flex-col`}
                        style={{
                          top: `${displayTop}px`,
                          height: `${displayHeight}px`,
                          backgroundColor: cls.subject?.color || '#b4d5c8',
                          opacity: isResizing ? 0.9 : 1
                        }}
                        onClick={(e) => {
                          // Don't trigger if we are clicking handles or resizing
                          if (e.target.closest('.resize-handle') || isResizing) return;
                          e.stopPropagation();
                          setEditingClass(cls);
                          setShowClassModal(true);
                        }}
                        data-testid="calendar-class-item"
                        data-class-block="true"
                        onMouseEnter={() => setHoveredItem({ type: 'class', data: cls })}
                        onMouseLeave={() => setHoveredItem(null)}
                        draggable={!isResizing && isEditMode}
                        onDragStart={(e) => {
                          if (!isEditMode) {
                            e.preventDefault();
                            return;
                          }
                          if (isResizing) {
                            e.preventDefault();
                            return;
                          }
                          // Use basic drag for moving the whole block
                          e.dataTransfer.setData('text/plain', JSON.stringify({
                            type: 'class',
                            id: cls.id,
                            durationMinutes: timeToMinutes(cls.end_time) - timeToMinutes(cls.start_time)
                          }));
                        }}
                      >
                        {/* Top Resize Handle */}
                        {isEditMode && (
                        <div
                          className="resize-handle w-full h-2 cursor-ns-resize absolute top-0 left-0 bg-black/0 hover:bg-black/10 z-10 transition-colors"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startY = e.clientY;
                            const initialTop = cls.top;
                            const initialHeight = cls.height;

                            pushHistory(); // save before resize

                            const handlePointerMove = (moveEvt) => {
                              const deltaY = moveEvt.clientY - startY;
                              let newTop = initialTop + deltaY;

                              // Snap to 15 mins (0.25 hours = 15px if HOUR_HEIGHT is 60)
                              const snapGrid = HOUR_HEIGHT / 4;
                              newTop = Math.round(newTop / snapGrid) * snapGrid;

                              // Bounds checking
                              if (newTop < 0) newTop = 0; // Don't go above start hour
                              if (newTop >= initialTop + initialHeight - snapGrid) {
                                newTop = initialTop + initialHeight - snapGrid; // Minimum 15 min duration
                              }

                              const heightDiff = initialTop - newTop;
                              const newHeight = initialHeight + heightDiff;

                              setResizingClass({ id: cls.id, type: 'top', newTop, newHeight });
                            };

                            const handlePointerUp = async (upEvt) => {
                              window.removeEventListener('pointermove', handlePointerMove);
                              window.removeEventListener('pointerup', handlePointerUp);

                              setResizingClass(current => {
                                if (current && current.id === cls.id) {
                                  // Save to DB
                                  const newStartMins = (current.newTop / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
                                  const newStartTime = formatTimeFromMinutes(newStartMins);

                                  // Optimistic UI
                                  setScheduleClasses(prev => prev.map(c =>
                                    c.id === cls.id ? { ...c, start_time: newStartTime } : c
                                  ));

                                  supabase.from('schedule_classes')
                                    .update({ start_time: newStartTime })
                                    .eq('id', cls.id)
                                    .then(({ error }) => {
                                      if (error) {
                                        toast.error('Error al actualizar hora');
                                        loadData();
                                      }
                                    });
                                }
                                return null;
                              });
                            };

                            window.addEventListener('pointermove', handlePointerMove);
                            window.addEventListener('pointerup', handlePointerUp);
                          }}
                        />
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-1.5 md:p-2 flex-1 relative pointer-events-auto hover:bg-black/5 dark:hover:bg-white/5 transition-colors mt-1 overflow-hidden h-[calc(100%-12px)] rounded">
                              <div className="absolute top-1.5 right-1.5 pointer-events-auto flex flex-col items-end gap-1">
                                {cls.class_type && (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium ${getClassTypeBadgeColor(cls.class_type)}`}>
                                    {cls.class_type}
                                  </span>
                                )}
                                {cls.room && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-slate-700">
                                    {cls.room}
                                  </span>
                                )}
                              </div>

                              <div className={`font-semibold text-xs md:text-sm leading-tight break-words text-balance pr-10 md:pr-12 line-clamp-3 ${isResizing ? 'text-gray-900' : 'text-gray-900 dark:text-gray-100'}`}>
                                {cls.subject?.name}
                              </div>
                              <div className={`text-[9px] md:text-[11px] mt-0.5 md:mt-1 font-medium ${isResizing ? 'bg-black/80 text-white px-1 rounded inline-block w-max' : 'text-gray-800 dark:text-gray-300'}`}>
                                {timeDisplay}
                              </div>
                              {cls.professor && <div className="text-[10px] md:text-xs text-gray-800 dark:text-gray-400 hidden md:block line-clamp-1 mt-0.5">{cls.professor}</div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="z-[100] border-gray-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-800 p-3" side="right" align="start" sideOffset={8}>
                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{cls.subject?.name} {cls.class_type ? `(${cls.class_type})` : ''}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 border-b border-gray-100 dark:border-slate-700 pb-1 mb-1">{timeDisplay}</p>
                            {cls.room && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Sala: <span className="font-bold">{cls.room}</span></p>}
                            {cls.professor && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Prof: {cls.professor}</p>}
                          </TooltipContent>
                        </Tooltip>

                        {/* Bottom Resize Handle */}
                        {isEditMode && (
                        <div
                          className="resize-handle w-full h-2 cursor-ns-resize absolute bottom-0 left-0 bg-black/0 hover:bg-black/10 z-10 transition-colors"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startY = e.clientY;
                            const initialHeight = cls.height;

                            pushHistory(); // save before resize

                            const handlePointerMove = (moveEvt) => {
                              const deltaY = moveEvt.clientY - startY;
                              let newHeight = initialHeight + deltaY;

                              // Snap to 15 mins
                              const snapGrid = HOUR_HEIGHT / 4;
                              newHeight = Math.round(newHeight / snapGrid) * snapGrid;

                              // Bounds checking
                              if (newHeight < snapGrid) newHeight = snapGrid; // Min 15 mins
                              const maxBottom = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
                              if (cls.top + newHeight > maxBottom) {
                                newHeight = maxBottom - cls.top;
                              }

                              setResizingClass({ id: cls.id, type: 'bottom', newTop: cls.top, newHeight });
                            };

                            const handlePointerUp = async (upEvt) => {
                              window.removeEventListener('pointermove', handlePointerMove);
                              window.removeEventListener('pointerup', handlePointerUp);

                              setResizingClass(current => {
                                if (current && current.id === cls.id) {
                                  // Save to DB
                                  const newStartMins = (current.newTop / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
                                  const newEndMins = newStartMins + (current.newHeight / HOUR_HEIGHT) * 60;
                                  const newEndTime = formatTimeFromMinutes(newEndMins);

                                  // Optimistic UI
                                  setScheduleClasses(prev => prev.map(c =>
                                    c.id === cls.id ? { ...c, end_time: newEndTime } : c
                                  ));

                                  supabase.from('schedule_classes')
                                    .update({ end_time: newEndTime })
                                    .eq('id', cls.id)
                                    .then(({ error }) => {
                                      if (error) {
                                        toast.error('Error al actualizar hora');
                                        loadData();
                                      }
                                    });
                                }
                                return null;
                              });
                            };

                            window.addEventListener('pointermove', handlePointerMove);
                              window.addEventListener('pointerup', handlePointerUp);
                            }}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Drag preview ghost */}
                  {dragPreview && dragPreview.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-200/40 dark:bg-blue-700/25 z-30 flex flex-col items-center justify-center pointer-events-none"
                      style={{ top: `${dragPreview.top}px`, height: `${Math.max(dragPreview.height, 30)}px` }}
                    >
                      <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 select-none">{dragPreview.label}</span>
                    </div>
                  )}

                  {/* Events */}
                  {dayEvents.map((event, idx) => (
                    <Tooltip key={`event-${idx}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute left-1 right-1 rounded-lg shadow-sm border-l-4 overflow-hidden ${event.is_google ? 'cursor-default' : 'bg-purple-100 border-purple-500 cursor-move'}`}
                          style={{
                            top: `${event.top}px`,
                            height: `${event.height}px`,
                            ...(event.is_google ? { 
                              backgroundColor: `${event.googleColor}1A`, // 10% opacity for bg
                              borderColor: event.googleColor 
                            } : {})
                          }}
                          data-testid="calendar-event-item"
                          data-event-block="true"
                          data-is-google={event.is_google ? "true" : "false"}
                          draggable={isEditMode && !event.is_google}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditMode && !event.is_google) {
                              setEditingEvent(event);
                              setShowEventModal(true);
                            }
                          }}
                          onDragStart={(e) => {
                            if (!isEditMode || event.is_google) {
                              e.preventDefault();
                              return;
                            }
                            let durationMinutes = 60; // fallback
                            if (event.start_time && event.end_time) {
                              durationMinutes = timeToMinutes(event.end_time) - timeToMinutes(event.start_time);
                            } else if (event.start_timestamp && event.end_timestamp) {
                              const s = new Date(event.start_timestamp);
                              const end = new Date(event.end_timestamp);
                              durationMinutes = (end.getTime() - s.getTime()) / 60000;
                            }

                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              type: 'event',
                              id: event.id,
                              durationMinutes
                            }));
                          }}
                        >
                          <div className="p-1.5 md:p-2 h-full pointer-events-none">
                            <div 
                              className={`font-semibold text-[10px] md:text-sm leading-tight break-words text-balance pr-2 line-clamp-2 ${event.is_google ? '' : 'text-purple-900'}`}
                              style={event.is_google ? {color: event.googleColor} : {}}
                            >
                              {event.is_google && <span className="mr-1">📅</span>}
                              {event.title}
                            </div>
                            <div 
                              className={`text-[9px] md:text-[11px] mt-0.5 md:mt-1 font-medium ${event.is_google ? '' : 'text-purple-800'}`}
                              style={event.is_google ? {color: event.googleColor, opacity: 0.9} : {}}
                            >
                              {event.is_google && event.is_all_day 
                                ? "Todo el día" 
                                : event.start_timestamp 
                                  ? `${new Date(event.start_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(event.end_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                                  : `${event.start_time?.substring(0,5)} - ${event.end_time?.substring(0,5)}`
                              }
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="z-[100] border-gray-200 shadow-xl bg-white dark:bg-slate-800 max-w-xs" side="right" align="start" sideOffset={8}>
                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1" style={event.is_google ? {color: event.googleColor} : {}}>
                          {event.is_google && <span>📅</span>} {event.title}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {event.is_google && event.is_all_day 
                            ? "Todo el día" 
                            : event.start_timestamp 
                              ? `${new Date(event.start_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(event.end_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                              : `${event.start_time?.substring(0,5)} - ${event.end_time?.substring(0,5)}`
                          }
                        </p>
                        {event.description && <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-wrap">{event.description}</p>}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showClassModal && (
        <AddClassModal
          initialDay={modalInitialData.day}
          initialStartTime={modalInitialData.startTime}
          initialEndTime={modalInitialData.endTime}
          editingClass={editingClass}
          onClose={() => {
            setShowClassModal(false);
            setEditingClass(null);
          }}
          onSuccess={loadData}
        />
      )}
      {showEventModal && (
        <AddEventModal
          editingEvent={editingEvent}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
          onSuccess={loadData}
        />
      )}
      {/* Modal overlays */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingItem(null);
        }}
        onConfirm={handleDelete}
        title={deletingItem?.type === 'class' ? '¿Eliminar clase?' : '¿Eliminar evento?'}
        description={deletingItem?.type === 'class' 
          ? `Se eliminará esta sesión de ${deletingItem.data.subject?.name} del horario.` 
          : `"${deletingItem?.data.title}" se eliminará del horario.`}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <div className="hidden md:flex flex-col gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg border border-gray-200 dark:border-slate-700">

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => setZoomLevel(z => Math.min(z + 0.2, 3))}
            title="Acercar (Zoom In)"
          >
            <ZoomIn className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => setZoomLevel(z => Math.max(z - 0.2, 0.5))}
            title="Alejar (Zoom Out)"
          >
            <ZoomOut className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </Button>
        </div>
        <Button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`rounded-full h-14 w-14 shadow-xl transition-all flex items-center justify-center ${
            isEditMode 
              ? 'bg-blue-600 text-white hover:bg-blue-700 scale-110' 
              : 'bg-white text-gray-700 border-2 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700'
          }`}
          title={isEditMode ? "Desactivar modo edición" : "Activar modo edición"}
        >
          <Pencil className={`h-6 w-6 ${isEditMode ? '' : 'text-gray-500'}`} />
        </Button>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default NewWeeklyCalendar;
