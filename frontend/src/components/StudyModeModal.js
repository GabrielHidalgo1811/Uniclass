import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const StudyModeModal = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handleSelect = async (mode) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ user_id: userId, study_mode: mode, career_semester: 1 });
      if (error) throw error;
      toast.success(`Modalidad ${mode === 'semestral' ? 'semestral' : 'trimestral'} configurada`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar preferencia');
      onClose(); // close anyway so user isn't stuck
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl dark:text-white">
            ¿Cómo organizas tu carrera?
          </DialogTitle>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
            Esto nos ayuda a organizar tus ramos por periodos académicos.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Semestral */}
          <button
            onClick={() => handleSelect('semestral')}
            disabled={loading}
            className="group flex flex-col items-center p-6 rounded-2xl border-2 border-gray-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 cursor-pointer"
          >
            <div className="text-3xl mb-3">📅</div>
            <div className="font-bold text-gray-900 dark:text-white text-base">Semestral</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              Mar–Jun<br />Ago–Dic
            </div>
          </button>

          {/* Trimestral */}
          <button
            onClick={() => handleSelect('trimestral')}
            disabled={loading}
            className="group flex flex-col items-center p-6 rounded-2xl border-2 border-gray-200 dark:border-slate-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 cursor-pointer"
          >
            <div className="text-3xl mb-3">🗓️</div>
            <div className="font-bold text-gray-900 dark:text-white text-base">Trimestral</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              3 periodos<br />por año
            </div>
          </button>
        </div>

        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={onClose}>
            Saltar por ahora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudyModeModal;
