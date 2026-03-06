import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import AddClassModal from './AddClassModal';
import AddEventModal from './AddEventModal';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_HEIGHT = 60; // pixels per hour

const NewWeeklyCalendar = ({ onSubjectClick }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [subjects, setSubjects] = useState([]);
  const [scheduleClasses, setScheduleClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    try {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id);
      setSubjects(subjectsData || []);

      const { data: classesData } = await supabase
        .from('schedule_classes')
        .select('*')
        .eq('user_id', user.id);
      setScheduleClasses(classesData || []);

      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id);

      const now = new Date();
      const filteredEvents = (eventsData || []).filter(event => {
        if (event.is_fixed) return true;
        const eventDate = new Date(event.start_timestamp);
        return !isBefore(eventDate, now);
      });
      setEvents(filteredEvents);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getClassesForDay = (dayIndex) => {
    return scheduleClasses
      .filter(cls => cls.day_of_week === dayIndex)
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

        // Fallback para eventos viejos con timestamp
        if (event.is_fixed) return false; // Eventos viejos "fijos" no se muestran
        const targetDate = addDays(weekStart, dayIndex);
        const eventStart = new Date(event.start_timestamp);
        const eventDate = format(eventStart, 'yyyy-MM-dd');
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        const now = new Date();
        return eventDate === targetDateStr && !isBefore(eventStart, now);
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold">
              {format(weekStart, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowClassModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Clase
          </Button>
          <Button variant="outline" onClick={() => setShowEventModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Evento
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-max">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r bg-gray-50">
            <div className="h-16 border-b"></div>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map(hour => (
              <div key={hour} className="h-[60px] border-b flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-gray-500">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Days */}
          {DAYS.map((day, dayIndex) => {
            const dayDate = addDays(weekStart, dayIndex);
            const dayClasses = getClassesForDay(dayIndex);
            const dayEvents = getEventsForDay(dayIndex);

            return (
              <div key={dayIndex} className="flex-1 min-w-[140px] border-r last:border-r-0">
                {/* Day header */}
                <div className="h-16 border-b flex flex-col items-center justify-center bg-white">
                  <div className="text-xs text-gray-500 uppercase font-medium">{day.substring(0, 3)}</div>
                  <div className="text-2xl font-bold mt-1">{format(dayDate, 'd')}</div>
                </div>

                {/* Day content */}
                <div
                  className="relative"
                  style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    try {
                      const dataInfo = e.dataTransfer.getData('text/plain');
                      if (!dataInfo) return;
                      const { type, id, durationMinutes } = JSON.parse(dataInfo);

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
                        // Optimistic UI update
                        setScheduleClasses(prev => prev.map(c =>
                          c.id === id ? { ...c, day_of_week: dayIndex, start_time: newStartTime, end_time: newEndTime } : c
                        ));

                        const { error } = await supabase
                          .from('schedule_classes')
                          .update({
                            day_of_week: dayIndex,
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
                            day_of_week: dayIndex,
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
                  {/* Hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i} className="absolute w-full border-b border-gray-100" style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Classes */}
                  {dayClasses.map((cls, idx) => (
                    <div
                      key={`class-${idx}`}
                      className="absolute left-1 right-1 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                      style={{
                        top: `${cls.top}px`,
                        height: `${cls.height}px`,
                        backgroundColor: cls.subject?.color || '#b4d5c8'
                      }}
                      onClick={() => onSubjectClick && onSubjectClick(cls.subject_id)}
                      data-testid="calendar-class-item"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                          type: 'class',
                          id: cls.id,
                          durationMinutes: timeToMinutes(cls.end_time) - timeToMinutes(cls.start_time)
                        }));
                      }}
                    >
                      <div className="p-2 h-full flex flex-col relative pointer-events-none">
                        {/* Badge en superior derecho */}
                        {cls.class_type && (
                          <div className="absolute top-1 right-1 pointer-events-auto">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getClassTypeBadgeColor(cls.class_type)}`}>
                              {cls.class_type}
                            </span>
                          </div>
                        )}

                        <div className="font-semibold text-sm text-gray-900 leading-tight pr-16">{cls.subject?.name}</div>
                        <div className="text-xs text-gray-700 mt-1">
                          {cls.start_time.substring(0, 5)} - {cls.end_time.substring(0, 5)}
                        </div>
                        {cls.room && <div className="text-xs text-gray-700">{cls.room}</div>}
                        {cls.professor && <div className="text-xs text-gray-700">{cls.professor}</div>}
                      </div>
                    </div>
                  ))}

                  {/* Events */}
                  {dayEvents.map((event, idx) => (
                    <div
                      key={`event-${idx}`}
                      className="absolute left-1 right-1 rounded-lg shadow-sm bg-purple-100 border-l-4 border-purple-500 overflow-hidden cursor-move"
                      style={{
                        top: `${event.top}px`,
                        height: `${event.height}px`
                      }}
                      data-testid="calendar-event-item"
                      draggable={true}
                      onDragStart={(e) => {
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
                      <div className="p-2 h-full pointer-events-none">
                        <div className="font-semibold text-sm text-purple-900">{event.title}</div>
                        {event.description && <div className="text-xs text-purple-700 mt-1">{event.description}</div>}
                      </div>
                    </div>
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
          onClose={() => setShowClassModal(false)}
          onSuccess={loadData}
        />
      )}
      {showEventModal && (
        <AddEventModal
          onClose={() => setShowEventModal(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

export default NewWeeklyCalendar;
