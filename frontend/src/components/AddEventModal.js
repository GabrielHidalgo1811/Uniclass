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
  { label: 'Lunes', value: 0 },
  { label: 'Martes', value: 1 },
  { label: 'Miércoles', value: 2 },
  { label: 'Jueves', value: 3 },
  { label: 'Viernes', value: 4 },
  { label: 'Sábado', value: 5 },
  { label: 'Domingo', value: 6 }
];

const AddEventModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isFixed, setIsFixed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startTime) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      // Crear fecha de referencia para timestamp (opcional, para compatibilidad)
      const today = new Date();
      const startTimestamp = new Date(today);
      const [startHour, startMinute] = startTime.split(':');
      startTimestamp.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const endTimestamp = endTime ? new Date(today) : startTimestamp;
      if (endTime) {
        const [endHour, endMinute] = endTime.split(':');
        endTimestamp.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      }

      const { error } = await supabase
        .from('events')
        .insert([{
          user_id: user.id,
          title,
          description: description || null,
          day_of_week: parseInt(dayOfWeek),
          start_time: startTime,
          end_time: endTime || startTime,
          is_fixed: isFixed,
          // Mantener timestamps para compatibilidad
          start_timestamp: startTimestamp.toISOString(),
          end_timestamp: endTimestamp.toISOString()
        }]);

      if (error) throw error;

      toast.success(isFixed ? 'Evento anclado creado (se repetirá cada semana)' : 'Evento creado exitosamente');
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
            <div className="space-y-2">
              <Label htmlFor="start-time">Hora Inicio *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Hora Fin</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
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
