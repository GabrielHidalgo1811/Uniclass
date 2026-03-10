import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SubjectsView = ({ onSelectSubject }) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (user) {
      loadSubjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      toast.error('Error al cargar ramos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subjectId) => {
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Ramo eliminado exitosamente');
      setDeleteConfirm(null);
      loadSubjects();
    } catch (error) {
      toast.error('Error al eliminar ramo');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-lg text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-auto p-4 md:p-6 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">Mis Ramos</h1>

          {subjects.length === 0 ? (
            <Card className="dark:bg-slate-900/50 dark:border-slate-800">
              <CardContent className="py-8 md:py-12 text-center text-sm md:text-base text-gray-500 dark:text-gray-400">
                No tienes ramos registrados aún.
                <br />
                Agrégalos desde la vista de Horario.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map(subject => (
                <Card
                  key={subject.id}
                  className="relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 dark:bg-slate-900 dark:border-slate-800 overflow-hidden"
                  data-testid="subject-card"
                >
                  {/* Subtle color accent line at the top of the card */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: subject.color }}></div>
                  <div
                    className="cursor-pointer p-1"
                    onClick={() => onSelectSubject(subject.id)}
                  >
                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm border border-black/10 dark:border-white/10"
                            style={{ backgroundColor: subject.color }}
                          />
                          <CardTitle className="text-lg font-bold text-gray-900 dark:text-slate-100">{subject.name}</CardTitle>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                      </div>
                    </CardHeader>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(subject);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">¿Eliminar {deleteConfirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              Esta acción eliminará el ramo y todas sus clases, pruebas y temarios asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubjectsView;