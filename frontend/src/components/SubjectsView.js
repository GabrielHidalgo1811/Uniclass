import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Trash2, Pencil, Check, X } from 'lucide-react';
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

const SEMESTER_LABEL = {
  semestral: (n) => `Semestre ${n}`,
  trimestral: (n) => `Trimestre ${n}`,
};

const SubjectsView = ({ onSelectSubject }) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [profile, setProfile] = useState({ study_mode: 'semestral', career_semester: 1 });
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedSemesters, setExpandedSemesters] = useState({});
  const [editingSemester, setEditingSemester] = useState(false);
  const [newCareerSemester, setNewCareerSemester] = useState(1);

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, profileRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', user.id).order('semester').order('name'),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      setSubjects(subjectsRes.data || []);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setNewCareerSemester(profileRes.data.career_semester);
        // Auto-expand current semester
        setExpandedSemesters({ [profileRes.data.career_semester]: true });
      }
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
      loadData();
    } catch (error) {
      toast.error('Error al eliminar ramo');
    }
  };

  const saveCareerSemester = async () => {
    try {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, career_semester: newCareerSemester });
      setProfile(p => ({ ...p, career_semester: newCareerSemester }));
      setExpandedSemesters({ [newCareerSemester]: true });
      setEditingSemester(false);
      toast.success('Semestre actualizado');
    } catch {
      toast.error('Error al actualizar semestre');
    }
  };

  const toggleSemester = (sem) => {
    setExpandedSemesters(prev => ({ ...prev, [sem]: !prev[sem] }));
  };

  // Group subjects by semester
  const grouped = subjects.reduce((acc, subj) => {
    const sem = subj.semester || 1;
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(subj);
    return acc;
  }, {});

  const semesterGroups = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const modeLabel = SEMESTER_LABEL[profile.study_mode] || SEMESTER_LABEL.semestral;

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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Mis Ramos</h1>

            {/* Career semester badge */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2 shadow-sm">
              {editingSemester ? (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">En</span>
                  <select
                    className="bg-transparent text-sm font-medium dark:text-white border-b border-blue-500 focus:outline-none"
                    value={newCareerSemester}
                    onChange={e => setNewCareerSemester(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>{modeLabel(s)}</option>
                    ))}
                  </select>
                  <button onClick={saveCareerSemester} className="text-green-500 hover:text-green-700 ml-1"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingSemester(false)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Cursando:</span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{modeLabel(profile.career_semester)}</span>
                  <button onClick={() => setEditingSemester(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {subjects.length === 0 ? (
            <Card className="dark:bg-slate-900/50 dark:border-slate-800">
              <CardContent className="py-8 md:py-12 text-center text-sm md:text-base text-gray-500 dark:text-gray-400">
                No tienes ramos registrados aún.
                <br />
                Agrégalos desde la vista de Horario.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {semesterGroups.map(sem => {
                const isCurrentSem = sem === profile.career_semester;
                const isExpanded = expandedSemesters[sem];
                return (
                  <div key={sem} className={`rounded-2xl border ${isCurrentSem ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-slate-800'} overflow-hidden`}>
                    {/* Semester folder header */}
                    <button
                      onClick={() => toggleSemester(sem)}
                      className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${isCurrentSem ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900'} hover:bg-blue-50 dark:hover:bg-slate-800`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📁</span>
                        <span className="font-bold text-gray-900 dark:text-white">{modeLabel(sem)}</span>
                        {isCurrentSem && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-medium">Actual</span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">({grouped[sem].length} ramo{grouped[sem].length !== 1 ? 's' : ''})</span>
                      </div>
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    </button>

                    {/* Subjects grid */}
                    {isExpanded && (
                      <div className="p-4 bg-gray-50/50 dark:bg-slate-950 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {grouped[sem].map(subject => (
                          <Card
                            key={subject.id}
                            className="relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 dark:bg-slate-900 dark:border-slate-800 overflow-hidden"
                            data-testid="subject-card"
                          >
                            <div className="h-1.5 w-full" style={{ backgroundColor: subject.color }} />
                            <div
                              className="cursor-pointer p-1"
                              onClick={() => onSelectSubject(subject.id)}
                            >
                              <div className="px-4 pb-3 pt-3 flex items-center space-x-3">
                                <div
                                  className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-black/10 dark:border-white/10"
                                  style={{ backgroundColor: subject.color }}
                                />
                                <span className="text-base font-bold text-gray-900 dark:text-slate-100 truncate">{subject.name}</span>
                                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
                              </div>
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
                );
              })}
            </div>
          )}
        </div>
      </div>

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