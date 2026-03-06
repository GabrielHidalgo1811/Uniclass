import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const COLORS = ['#b4d5c8', '#d4b4e0', '#b4d9e8', '#f0d4b4', '#f0b4c8', '#c8e8d4'];
const CLASS_TYPES = ['Teoría', 'Ayudantía', 'Laboratorio'];

const AddSubjectModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [professor, setProfessor] = useState('');
  const [classType, setClassType] = useState('Teoría');
  const [loading, setLoading] = useState(false);

  const toggleDay = (dayValue) => {
    setSelectedDays(prev => 
      prev.includes(dayValue) 
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || selectedDays.length === 0 || !startTime || !endTime) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .insert([{ user_id: user.id, name, color }])
        .select()
        .single();

      if (subjectError) throw subjectError;

      const scheduleClasses = selectedDays.map(day => ({
        user_id: user.id,
        subject_id: subjectData.id,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        room: room || null,
        professor: professor || null,
        class_type: classType
      }));

      const { error: classesError } = await supabase
        .from('schedule_classes')
        .insert(scheduleClasses);

      if (classesError) throw classesError;

      toast.success('Ramo agregado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al agregar ramo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="add-subject-modal">
        <DialogHeader>
          <DialogTitle>Agregar Ramo</DialogTitle>
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
              data-testid="subject-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex space-x-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid="subject-color-option"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Días de la semana *</Label>
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map(day => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={selectedDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                    data-testid={`day-checkbox-${day.value}`}
                  />
                  <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                    {day.label}
                  </label>
                </div>
              ))}
            </div>
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
                data-testid="subject-start-time-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Hora Fin *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                data-testid="subject-end-time-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room">Sala/Lugar</Label>
            <Input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ej: Sala 301"
              data-testid="subject-room-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="professor">Profesor</Label>
            <Input
              id="professor"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Ej: Dr. Juan Pérez"
              data-testid="subject-professor-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-type">Tipo de Clase</Label>
            <Select value={classType} onValueChange={setClassType}>
              <SelectTrigger data-testid="subject-class-type-select">
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
            <Button type="button" variant="outline" onClick={onClose} data-testid="cancel-subject-button">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} data-testid="submit-subject-button">
              {loading ? 'Guardando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSubjectModal;
