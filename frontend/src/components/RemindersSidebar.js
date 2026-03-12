import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

const RemindersSidebar = ({ onClose }) => {
    const { user } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    // Dialog states
    const [isReminderOpen, setIsReminderOpen] = useState(false);
    const [isEvalOpen, setIsEvalOpen] = useState(false);
    
    // Form states
    const [title, setTitle] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('none');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [hour, setHour] = useState('9');
    const [ampm, setAmpm] = useState('AM');
    const [loading, setLoading] = useState(false);

    const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

    useEffect(() => {
        if (user) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const cleanupExpiredReminders = async (allReminders) => {
        if (!allReminders || allReminders.length === 0) return [];
        
        const now = new Date();
        const toDeleteIds = [];
        const validReminders = [];

        allReminders.forEach(rem => {
            let expiration;
            if (rem.type === 'evaluacion') {
                // Expire at the end of the day
                expiration = new Date(rem.reminder_date + 'T23:59:59');
            } else {
                // Expire at specific time
                expiration = new Date(rem.reminder_date + 'T' + rem.reminder_time);
            }

            if (expiration < now) {
                toDeleteIds.push(rem.id);
            } else {
                validReminders.push(rem);
            }
        });

        if (toDeleteIds.length > 0) {
            await supabase.from('reminders').delete().in('id', toDeleteIds);
            console.log('Cleaned up expired reminders:', toDeleteIds.length);
        }
        
        return validReminders;
    };

    const loadData = async () => {
        try {
            const [remRes, subRes] = await Promise.all([
                supabase
                    .from('reminders')
                    .select('*')
                    .eq('user_id', user.id),
                    // .order('reminder_date', { ascending: true }),
                supabase
                    .from('subjects')
                    .select('*')
                    .eq('user_id', user.id)
            ]);

            let fetchedReminders = remRes.data || [];
            // Run auto-cleanup
            fetchedReminders = await cleanupExpiredReminders(fetchedReminders);

            setReminders(fetchedReminders);
            setSubjects(subRes.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async (type) => {
        if (!title.trim()) {
            toast.error('Olvidaste el motivo');
            return;
        }

        setLoading(true);
        try {
            let finalTime = '00:00:00';
            let finalDate = date;

            if (type === 'recordatorio') {
                let h = parseInt(hour);
                if (ampm === 'PM' && h !== 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                finalTime = `${h.toString().padStart(2, '0')}:00:00`;
                finalDate = format(new Date(), 'yyyy-MM-dd');
            }

            const { error } = await supabase
                .from('reminders')
                .insert([{
                    user_id: user.id,
                    title: title.trim(),
                    reminder_date: finalDate,
                    reminder_time: finalTime,
                    subject_id: selectedSubject === 'none' ? null : selectedSubject,
                    type: type
                }]);

            if (error) throw error;

            setTitle('');
            setSelectedSubject('none');
            setIsReminderOpen(false);
            setIsEvalOpen(false);
            toast.success(type === 'recordatorio' ? 'Recordatorio añadido' : 'Evaluación añadida');
            loadData();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar. ¿Ejecutaste el SQL?');
        } finally {
            setLoading(false);
        }
    };

    const toggleReminder = async (id, currentStatus) => {
        try {
            setReminders(reminders.map(r => r.id === id ? { ...r, is_completed: !currentStatus } : r));
            await supabase.from('reminders').update({ is_completed: !currentStatus }).eq('id', id);
        } catch (error) {
            loadData();
        }
    };

    const deleteReminder = async (id) => {
        try {
            setReminders(reminders.filter(r => r.id !== id));
            await supabase.from('reminders').delete().eq('id', id);
            toast.success('Eliminado');
        } catch (error) {
            loadData();
        }
    };

    return (
        <div className="w-80 bg-white dark:bg-gray-900 border-l dark:border-gray-800 flex flex-col h-full shadow-lg transition-transform duration-300 z-10">
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    Recordatorios
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {reminders.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-sm italic">
                        No hay pendientes.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reminders.map(reminder => {
                            const subject = subjects.find(s => s.id === reminder.subject_id);
                            const isEval = reminder.type === 'evaluacion';
                            return (
                                <div
                                    key={reminder.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                        reminder.is_completed ? 'bg-gray-50 dark:bg-gray-800/30 opacity-50' : 'bg-white dark:bg-gray-800 shadow-sm border-gray-100 dark:border-gray-700 hover:border-purple-200'
                                    }`}
                                >
                                    <Checkbox
                                        checked={reminder.is_completed}
                                        onCheckedChange={() => toggleReminder(reminder.id, reminder.is_completed)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold ${reminder.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                            {reminder.title}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEval ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                                {isEval ? 'EVALUACIÓN' : 'PENDIENTE'}
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium">
                                                {isEval ? format(new Date(reminder.reminder_date + 'T12:00:00'), 'dd MMM') : reminder.reminder_time.substring(0, 5)}
                                            </span>
                                            {subject && (
                                                <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                                                    • {subject.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => deleteReminder(reminder.id)} className="text-gray-300 hover:text-red-500 p-1">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex flex-col gap-2">
                
                {/* Modal Recordatorio */}
                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-95">
                            <Plus className="h-5 w-5 mr-2" /> Agregar Recordatorio
                        </Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby="reminder-description" className="dark:bg-gray-900 dark:border-gray-800 sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold dark:text-gray-100">Nuevo Recordatorio</DialogTitle>
                            <p id="reminder-description" className="text-xs text-gray-500">Completa los detalles para tu recordatorio.</p>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Motivo</label>
                                <Input
                                    placeholder="Ej: Estudiar leyes"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-gray-200 dark:bg-gray-800 border-2 border-transparent focus-visible:border-purple-500 h-11 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Hora</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={hour}
                                        onChange={(e) => setHour(e.target.value)}
                                        className="flex-1 h-11 text-sm border-none rounded-md px-3 bg-gray-100 dark:bg-gray-800/50 dark:text-gray-200"
                                    >
                                        {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
                                    </select>
                                    <select 
                                        value={ampm}
                                        onChange={(e) => setAmpm(e.target.value)}
                                        className="h-11 w-20 text-sm border-none rounded-md px-3 bg-gray-100 dark:bg-gray-800/50 dark:text-gray-200"
                                    >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Ramo</label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full h-11 text-sm border-none rounded-md px-3 bg-gray-100 dark:bg-gray-800/50 dark:text-gray-200"
                                >
                                    <option value="none">Sin ramo específico</option>
                                    {subjects.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                onClick={() => handleAdd('recordatorio')} 
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-11"
                            >
                                {loading ? 'Guardando...' : 'Crear Recordatorio'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Modal Evaluación */}
                <Dialog open={isEvalOpen} onOpenChange={setIsEvalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-2 border-blue-600/50 hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold h-11 rounded-xl transition-all active:scale-95">
                            <Plus className="h-5 w-5 mr-2" /> Agregar Evaluación
                        </Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby="eval-description" className="dark:bg-gray-900 dark:border-gray-800 sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold dark:text-gray-100">Nueva Evaluación</DialogTitle>
                            <p id="eval-description" className="text-xs text-gray-500">Registra una fecha importante para tu ramo.</p>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Motivo / Nombre de Evaluación</label>
                                <Input
                                    placeholder="Ej: Presentación Lab 1"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-gray-200 dark:bg-gray-800 border-2 border-transparent focus-visible:border-blue-500 h-11 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Fecha</label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-gray-100 dark:bg-gray-800/50 border-none h-11 text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Ramo</label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full h-11 text-sm border-none rounded-md px-3 bg-gray-100 dark:bg-gray-800/50 dark:text-gray-200"
                                >
                                    <option value="none">Seleccionar ramo...</option>
                                    {subjects.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                onClick={() => handleAdd('evaluacion')} 
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                            >
                                {loading ? 'Guardando...' : 'Crear Evaluación'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default RemindersSidebar;
