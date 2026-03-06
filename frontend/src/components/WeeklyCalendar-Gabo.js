import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import AddSubjectModal from './AddSubjectModal';
import AddEventModal from './AddEventModal';
import SubjectDetail from './SubjectDetail';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm

const WeeklyCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [subjects, setSubjects] = useState([]);
  const [scheduleClasses, setScheduleClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

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

      // Filter out non-fixed past events
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

  const getClassesForDayAndHour = (dayIndex, hour) => {
    return scheduleClasses.filter(cls => {
      const startHour = parseInt(cls.start_time.split(':')[0]);
      const endHour = parseInt(cls.end_time.split(':')[0]);
      return cls.day_of_week === dayIndex && hour >= startHour && hour < endHour;
    });
  };

  const getEventsForDayAndHour = (dayIndex, hour) => {
    const targetDate = addDays(weekStart, dayIndex);
    return events.filter(event => {
      const eventStart = new Date(event.start_timestamp);
      const eventDate = format(eventStart, 'yyyy-MM-dd');
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');
      const eventHour = eventStart.getHours();
      return eventDate === targetDateStr && eventHour === hour;
    });
  };

  const handleSubjectClick = (subjectId) => {
    setSelectedSubject(subjectId);
  };

  if (selectedSubject) {
    return <SubjectDetail subjectId={selectedSubject} onBack={() => setSelectedSubject(null)} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))} data-testid="prev-week-button">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold">
              {format(weekStart, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))} data-testid="next-week-button">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())} data-testid="today-button">
            Hoy
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowSubjectModal(true)} data-testid="add-subject-button">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Ramo
          </Button>
          <Button variant="outline" onClick={() => setShowEventModal(true)} data-testid="add-event-button">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Evento
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-8 gap-2 min-w-max">
          {/* Time column */}
          <div className="sticky left-0 bg-gray-50">
            <div className="h-16"></div>
            {HOURS.map(hour => (
              <div key={hour} className="h-24 flex items-start justify-end pr-2 text-sm text-gray-500">
                {hour}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((day, dayIndex) => {
            const dayDate = addDays(weekStart, dayIndex);
            return (
              <div key={dayIndex} className="min-w-[150px]">
                <div className="h-16 flex flex-col items-center justify-center border-b">
                  <div className="text-xs text-gray-500 uppercase">{day.substring(0, 3)}</div>
                  <div className="text-2xl font-semibold mt-1">{format(dayDate, 'd')}</div>
                </div>
                {HOURS.map(hour => {
                  const classes = getClassesForDayAndHour(dayIndex, hour);
                  const dayEvents = getEventsForDayAndHour(dayIndex, hour);
                  const items = [...classes.map(c => ({ ...c, type: 'class' })), ...dayEvents.map(e => ({ ...e, type: 'event' }))];

                  return (
                    <div key={hour} className="h-24 border border-gray-200 p-1 relative">
                      {items.map((item, idx) => {
                        if (item.type === 'class') {
                          const subject = subjects.find(s => s.id === item.subject_id);
                          return (
                            <div
                              key={`class-${idx}`}
                              className="rounded-lg p-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: subject?.color || '#b4d5c8' }}
                              onClick={() => handleSubjectClick(item.subject_id)}
                              data-testid="calendar-class-item"
                            >
                              <div className="text-xs font-medium text-gray-800">{subject?.name}</div>
                              <div className="text-xs text-gray-600">{item.room}</div>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={`event-${idx}`}
                              className="rounded-lg p-2 mb-1"
                              style={{ backgroundColor: '#e8d4f0' }}
                              data-testid="calendar-event-item"
                            >
                              <div className="text-xs font-medium text-gray-800">{item.title}</div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showSubjectModal && (
        <AddSubjectModal
          onClose={() => setShowSubjectModal(false)}
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

export default WeeklyCalendar;
