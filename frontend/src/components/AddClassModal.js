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
  { label: 'Lunes', value: 0 },
  { label: 'Martes', value: 1 },
  { label: 'Miércoles', value: 2 },
  { label: 'Jueves', value: 3 },
  { label: 'Viernes', value: 4 },
  { label: 'Sábado', value: 5 },
  { label: 'Domingo', value: 6 }
];

const COLORS = [
  '#b4d5c8', '#d4b4e0', '#b4d9e8', '#f0d4b4', '#f0b4c8',
  '#c8e8d4', '#e8d4b4', '#d4c8e8', '#c8d4e8', '#e8c8d4'
];

const CLASS_TYPES = ['Teoría', 'Ayudantía', 'Laboratorio'];

const AddClassModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedDay, setSelectedDay] = useState('0');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [professor, setProfessor] = useState('');
  const [classType, setClassType] = useState('Teoría');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) {
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

      const { error: classError } = await supabase
        .from('schedule_classes')
        .insert([{
          user_id: user.id,
          subject_id: subjectData.id,
          day_of_week: parseInt(selectedDay),
          start_time: startTime,
          end_time: endTime,
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
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                    color === c ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="day">Día de la semana *</Label>
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
              <Label htmlFor="end-time">Hora Fin *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

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