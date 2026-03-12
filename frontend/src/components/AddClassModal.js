import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const DAYS = [
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 7 }
];

const COLORS = [
  '#b4d5c8', '#d4b4e0', '#b4d9e8', '#f0d4b4', '#f0b4c8',
  '#c8e8d4', '#e8d4b4', '#d4c8e8', '#c8d4e8', '#e8c8d4'
];

const CLASS_TYPES = ['Teoría', 'Ayudantía', 'Laboratorio'];

// Auto-assign academic_year_period based on current month (1=Jan-Jun, 2=Jul-Dec)
const getAcademicPeriodForCreation = () => {
  const month = new Date().getMonth() + 1;
  return month <= 6 ? 1 : 2;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = ['00', '15', '30', '45'];

// Convert a 12h picker value {hour, minute, ampm} → "HH:MM"
const to24h = ({ hour, minute, ampm }) => {
  let h = parseInt(hour);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}`;
};

const timeTo24hMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Parse "HH:MM" → { hour, minute, ampm } for 12h display
const parse24hTo12h = (timeStr) => {
  if (!timeStr) return { hour: '8', minute: '00', ampm: 'AM' };
  const [h24, m] = timeStr.split(':').map(Number);
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return { hour: hour.toString(), minute: m.toString().padStart(2, '0'), ampm };
};

const TimePicker = ({ value, onChange, label, id }) => {
  const parsed = parse24hTo12h(value);

  const update = (field, val) => {
    const next = { ...parsed, [field]: val };
    onChange(to24h(next));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1 items-center">
        {/* Hour */}
        <Select value={parsed.hour} onValueChange={(v) => update('hour', v)}>
          <SelectTrigger className="w-16 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map(h => (
              <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-gray-500 font-bold">:</span>
        {/* Minute */}
        <Select value={parsed.minute} onValueChange={(v) => update('minute', v)}>
          <SelectTrigger className="w-16 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* AM/PM */}
        <Select value={parsed.ampm} onValueChange={(v) => update('ampm', v)}>
          <SelectTrigger className="w-20 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const AddClassModal = ({ onClose, onSuccess, initialDay = '1', initialStartTime = '', initialEndTime = '', initialSemester = 1 }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [startTime, setStartTime] = useState(initialStartTime || '08:00');
  const [endTime, setEndTime] = useState(initialEndTime || '09:30');
  const [room, setRoom] = useState('');
  const [professor, setProfessor] = useState('');
  const [classType, setClassType] = useState('Teoría');
  const [semester, setSemester] = useState(initialSemester.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    // Validate end > start
    if (timeTo24hMinutes(endTime) <= timeTo24hMinutes(startTime)) {
      toast.error('La hora de fin debe ser después de la hora de inicio');
      return;
    }

    setLoading(true);
    try {
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .insert([{ user_id: user.id, name, color, semester: parseInt(semester), academic_year_period: getAcademicPeriodForCreation() }])
        .select()
        .single();

      if (subjectError) throw subjectError;

      const { error: classError } = await supabase
        .from('schedule_classes')
        .insert([{
          user_id: user.id,
          subject_id: subjectData.id,
          day_of_week: parseInt(selectedDay),
          start_time: startTime + ':00',
          end_time: endTime + ':00',
          room: room || null,
          professor: professor || null,
          class_type: classType
        }]);

      if (classError) throw classError;

      const grades = [];
      for (let i = 1; i <= 3; i++) {
        grades.push({
          user_id: user.id,
          subject_id: subjectData.id,
          title: `Prueba ${i}`,
          score: 0,
          weight: 0,
          exam_number: i,
          is_visible: true
        });
      }

      const { error: gradesError } = await supabase
        .from('grades')
        .insert(grades);

      if (gradesError) throw gradesError;

      toast.success('Clase agregada exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al agregar clase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Clase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Ramo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Matemáticas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${color === c ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'
                    }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Día *</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semestre</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                    <SelectItem key={s} value={s.toString()}>Semestre {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 12h Time Pickers */}
          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              id="start-time"
              label="Hora Inicio *"
              value={startTime}
              onChange={setStartTime}
            />
            <TimePicker
              id="end-time"
              label="Hora Fin *"
              value={endTime}
              onChange={setEndTime}
            />
          </div>
          {timeTo24hMinutes(endTime) <= timeTo24hMinutes(startTime) && startTime && endTime && (
            <p className="text-xs text-red-500">⚠ La hora de fin debe ser posterior a la hora de inicio.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="room">Sala</Label>
            <Input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ej: Sala 301"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="professor">Profesor</Label>
            <Input
              id="professor"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Ej: Dr. García"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-type">Tipo de Clase</Label>
            <Select value={classType} onValueChange={setClassType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassModal;