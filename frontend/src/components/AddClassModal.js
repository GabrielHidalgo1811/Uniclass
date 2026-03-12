import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import DeleteConfirmationModal from './DeleteConfirmationModal';

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
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#82E0AA', '#F1948A', '#85C1E9',
  '#73C6B6', '#F8C471', '#D2B4DE', '#EB984E'
];

const CLASS_TYPES = ['Teoría', 'Ayudantía', 'Laboratorio'];

const getAcademicPeriodForCreation = () => {
  const month = new Date().getMonth() + 1;
  return month <= 6 ? 1 : 2;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

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

const parse24hTo12h = (timeStr) => {
  if (!timeStr) return { hour: '8', minute: '00', ampm: 'AM' };
  const h24 = parseInt(timeStr.split(':')[0]);
  const m = timeStr.split(':')[1] || '00';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return { hour: hour.toString(), minute: m.padStart(2, '0'), ampm };
};

const TimePicker = ({ value, onChange, label, id }) => {
  const parsed = parse24hTo12h(value);

  const update = (field, val) => {
    const next = { ...parsed, [field]: val };
    onChange(to24h(next));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-gray-500">{label}</Label>
      <div className="flex gap-1 items-center">
        <Select value={parsed.hour} onValueChange={(v) => update('hour', v)}>
          <SelectTrigger className="w-full h-10 px-2 bg-gray-50 dark:bg-gray-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map(h => (
              <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-gray-400 font-bold">:</span>
        <Select value={parsed.minute} onValueChange={(v) => update('minute', v)}>
          <SelectTrigger className="w-full h-10 px-2 bg-gray-50 dark:bg-gray-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parsed.ampm} onValueChange={(v) => update('ampm', v)}>
          <SelectTrigger className="w-full h-10 px-2 bg-gray-50 dark:bg-gray-800">
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

const AddClassModal = ({ onClose, onSuccess, initialDay = '1', initialStartTime = '', initialEndTime = '', initialSemester = 1, editingClass = null }) => {
  const { user } = useAuth();
  const [name, setName] = useState(editingClass?.subject?.name || '');
  const [color, setColor] = useState(editingClass?.subject?.color || COLORS[0]);
  const [selectedDay, setSelectedDay] = useState(editingClass ? editingClass.day_of_week.toString() : initialDay);
  const [startTime, setStartTime] = useState(editingClass ? editingClass.start_time.substring(0, 5) : (initialStartTime || '08:00'));
  const [endTime, setEndTime] = useState(editingClass ? editingClass.end_time.substring(0, 5) : (initialEndTime || '09:30'));
  const [room, setRoom] = useState(editingClass?.room || '');
  const [professor, setProfessor] = useState(editingClass?.professor || '');
  const [classType, setClassType] = useState(editingClass?.class_type || 'Teoría');
  const [semester, setSemester] = useState(editingClass?.subject?.semester?.toString() || initialSemester.toString());
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (timeTo24hMinutes(endTime) <= timeTo24hMinutes(startTime)) {
      toast.error('La hora de fin debe ser después de la hora de inicio');
      return;
    }

    setLoading(true);
    try {
      if (editingClass) {
        // Update Subject
        const { error: subjectError } = await supabase
          .from('subjects')
          .update({ name, color, semester: parseInt(semester) })
          .eq('id', editingClass.subject_id)
          .eq('user_id', user.id);

        if (subjectError) throw subjectError;

        // Update Class
        const { error: classError } = await supabase
          .from('schedule_classes')
          .update({
            day_of_week: parseInt(selectedDay),
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            room: room || null,
            professor: professor || null,
            class_type: classType
          })
          .eq('id', editingClass.id)
          .eq('user_id', user.id);

        if (classError) throw classError;
        toast.success('Clase actualizada');
      } else {
        // Create new or Reuse existing subject
        // Robust search: Fetch all and match locally to handle subtle differences
        const { data: allSubjects, error: searchError } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('user_id', user.id);

        if (searchError) throw searchError;

        const normalizedInput = name.trim().toLowerCase();
        const existingSubject = allSubjects?.find(s => 
          s.name.trim().toLowerCase() === normalizedInput
        );

        let subjectId;
        if (existingSubject) {
          subjectId = existingSubject.id;
        } else {
          const { data: subjectData, error: subjectError } = await supabase
            .from('subjects')
            .insert([{ 
              user_id: user.id, 
              name: name.trim(), 
              color, 
              semester: parseInt(semester), 
              academic_year_period: getAcademicPeriodForCreation() 
            }])
            .select()
            .single();

          if (subjectError) throw subjectError;
          subjectId = subjectData.id;

          // Create default grades for NEW subjects
          const grades = Array.from({ length: 3 }, (_, i) => ({
            user_id: user.id,
            subject_id: subjectId,
            title: `Prueba ${i + 1}`,
            score: 0,
            weight: 0,
            exam_number: i + 1,
            is_visible: true
          }));
          
          await supabase.from('grades').insert(grades);
        }

        const { error: classError } = await supabase
          .from('schedule_classes')
          .insert([{
            user_id: user.id,
            subject_id: subjectId,
            day_of_week: parseInt(selectedDay),
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            room: room || null,
            professor: professor || null,
            class_type: classType
          }]);

        if (classError) throw classError;
        toast.success('Clase agregada exitosamente');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingClass || !user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('schedule_classes')
        .delete()
        .eq('id', editingClass.id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Clase eliminada');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-none shadow-2xl dark:bg-gray-900">
        <div className="h-2 w-full" style={{ backgroundColor: color }} />
        <div className="p-6 pt-2">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold dark:text-white">
              {editingClass ? 'Editar Clase' : 'Agregar Clase'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold text-gray-500 uppercase">Nombre del Ramo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Matemáticas"
                className="h-11 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Color del Ramo</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${color === c ? 'border-gray-800 ring-2 ring-gray-400' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <div className="relative">
                  <Input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day" className="text-xs font-semibold text-gray-500 uppercase">Día *</Label>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200">
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
                <Label htmlFor="semester" className="text-xs font-semibold text-gray-500 uppercase">Semestre</Label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200">
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

            <div className="grid grid-cols-2 gap-4">
              <TimePicker id="start-time" label="HORA INICIO *" value={startTime} onChange={setStartTime} />
              <TimePicker id="end-time" label="HORA FIN *" value={endTime} onChange={setEndTime} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room" className="text-xs font-semibold text-gray-500 uppercase">Sala</Label>
                <Input
                  id="room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Ej: 301"
                  className="h-11 bg-gray-50 border-gray-200 dark:bg-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-type" className="text-xs font-semibold text-gray-500 uppercase">Tipo</Label>
                <Select value={classType} onValueChange={setClassType}>
                  <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="professor" className="text-xs font-semibold text-gray-500 uppercase">Profesor</Label>
              <Input
                id="professor"
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                placeholder="Nombre del profesor..."
                className="h-11 bg-gray-50 border-gray-200 dark:bg-gray-800"
              />
            </div>

            <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
              {editingClass && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)} 
                  disabled={loading}
                  className="sm:mr-auto"
                >
                  Eliminar
                </Button>
              )}
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="ghost" onClick={onClose} className="hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="px-8 bg-black hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-all active:scale-95">
                  {loading ? 'Guardando...' : (editingClass ? 'Guardar Cambios' : 'Agregar Clase')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>

    <DeleteConfirmationModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      loading={loading}
      title="¿Eliminar esta clase?"
      description={`Se eliminará esta sesión de ${name || 'este ramo'} del horario. Otros bloques de este ramo no se verán afectados.`}
    />
    </>
  );
};

export default AddClassModal;