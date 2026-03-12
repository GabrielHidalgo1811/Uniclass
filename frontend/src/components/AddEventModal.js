import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

const AddEventModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [isFixed, setIsFixed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startTime) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    // End time validation
    if (endTime && timeTo24hMinutes(endTime) <= timeTo24hMinutes(startTime)) {
      toast.error('La hora de fin debe ser posterior a la de inicio');
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const startTimestamp = new Date(today);
      const [startHour, startMinute] = startTime.split(':');
      startTimestamp.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const actualEndTime = endTime || startTime;
      const endTimestamp = new Date(today);
      const [endHour, endMinute] = actualEndTime.split(':');
      endTimestamp.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      const { error } = await supabase
        .from('events')
        .insert([{
          user_id: user.id,
          title,
          description: description || null,
          day_of_week: parseInt(dayOfWeek),
          start_time: startTime,
          end_time: actualEndTime,
          is_fixed: isFixed,
          start_timestamp: startTimestamp.toISOString(),
          end_timestamp: endTimestamp.toISOString()
        }]);

      if (error) throw error;

      toast.success(isFixed ? 'Evento anclado creado' : 'Evento creado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al agregar evento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Reunión de grupo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles del evento..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day">Día de la semana *</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(day => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              id="start-time"
              label="Hora Inicio *"
              value={startTime}
              onChange={setStartTime}
            />
            <TimePicker
              id="end-time"
              label="Hora Fin"
              value={endTime}
              onChange={setEndTime}
            />
          </div>

          <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              id="is-fixed"
              checked={isFixed}
              onCheckedChange={setIsFixed}
            />
            <div className="flex-1">
              <Label htmlFor="is-fixed" className="cursor-pointer font-medium">
                Anclar evento
              </Label>
              <p className="text-xs text-gray-600 mt-0.5">
                El evento se repetirá cada semana en este día y hora
              </p>
            </div>
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

export default AddEventModal;
