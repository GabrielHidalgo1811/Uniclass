import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const RemindersSidebar = ({ onClose }) => {
    const { user } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [newTime, setNewTime] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadReminders();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadReminders = async () => {
        try {
            const { data, error } = await supabase
                .from('reminders')
                .select('*')
                .eq('user_id', user.id)
                .order('reminder_date', { ascending: true })
                .order('reminder_time', { ascending: true });

            if (error) {
                // Just fail silently if the table doesn't exist yet, to not spam the user
                if (error.code !== '42P01') {
                    console.error(error);
                }
                return;
            }
            setReminders(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddReminder = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newTime) return;

        setLoading(true);
        try {
            const today = new Date();
            // Use today's date for standard reminders unless specified directly
            const dateStr = format(today, 'yyyy-MM-dd');

            const { error } = await supabase
                .from('reminders')
                .insert([{
                    user_id: user.id,
                    title: newTitle.trim(),
                    reminder_date: dateStr,
                    reminder_time: newTime
                }]);

            if (error) throw error;

            setNewTitle('');
            setNewTime('');
            toast.success('Recordatorio agregado');
            loadReminders();
        } catch (error) {
            console.error(error);
            if (error.code === '42P01') {
                toast.error('La tabla de recordatorios no existe. Ejecuta el SQL en Supabase.');
            } else {
                toast.error('Error al agregar el recordatorio');
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleReminder = async (id, currentStatus) => {
        try {
            // Optimistic upate
            setReminders(reminders.map(r => r.id === id ? { ...r, is_completed: !currentStatus } : r));

            const { error } = await supabase
                .from('reminders')
                .update({ is_completed: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            loadReminders();
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar recordatorio');
            loadReminders(); // reload correct data
        }
    };

    const deleteReminder = async (id) => {
        try {
            setReminders(reminders.filter(r => r.id !== id));
            const { error } = await supabase
                .from('reminders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Recordatorio eliminado');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar recordatorio');
            loadReminders();
        }
    };

    // Group by date logic can be added later, currently sorting by time for today.
    return (
        <div className="w-80 bg-white dark:bg-gray-900 border-l dark:border-gray-800 flex flex-col h-full shadow-lg transition-transform duration-300 z-10">
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20">
                <h2 className="font-semibold text-lg text-purple-900 dark:text-purple-100">Recordatorios</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-purple-900 dark:text-purple-200">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {reminders.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 mt-10 text-sm">
                        <p>No tienes recordatorios activos.</p>
                        <p>¡Agrega uno nuevo abajo!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {reminders.map(reminder => (
                            <div
                                key={reminder.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border dark:border-gray-800 transition-colors ${reminder.is_completed ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60' : 'bg-white dark:bg-gray-800 shadow-sm'
                                    }`}
                            >
                                <Checkbox
                                    checked={reminder.is_completed}
                                    onCheckedChange={() => toggleReminder(reminder.id, reminder.is_completed)}
                                    className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium break-words ${reminder.is_completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                                        }`}>
                                        {reminder.title}
                                    </p>
                                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 font-medium">
                                        {reminder.reminder_time.substring(0, 5)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => deleteReminder(reminder.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <form onSubmit={handleAddReminder} className="space-y-3">
                    <Input
                        placeholder="¿Qué necesitas recordar?"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <div className="flex gap-2">
                        <Input
                            type="time"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="flex-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        />
                        <Button
                            type="submit"
                            disabled={loading || !newTitle.trim() || !newTime}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RemindersSidebar;
