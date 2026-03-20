import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/googleCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const SubjectDetail = ({ subjectId, onBack, initialExpandedExam }) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const [grades, setGrades] = useState([]);
  const [draftGrades, setDraftGrades] = useState({});
  const [checklists, setChecklists] = useState({});
  const [expandedGrades, setExpandedGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [addingTopicForGrade, setAddingTopicForGrade] = useState(null);
  const [newTopicText, setNewTopicText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (user && subjectId) {
      loadSubjectData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, subjectId]);

  useEffect(() => {
    if (initialExpandedExam) {
      setExpandedGrades({ [initialExpandedExam]: true });
    }
  }, [initialExpandedExam]);

  useEffect(() => {
    if (addingTopicForGrade && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingTopicForGrade]);

  const loadSubjectData = async () => {
    try {
      setLoading(true);

      const { data: subjectData } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single();
      setSubject(subjectData);

      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id)
        .order('exam_number');
      setGrades(gradesData || []);

      const drafts = {};
      (gradesData || []).forEach(g => {
        drafts[g.id] = {
          score: g.score || '',
          weight: g.weight || '',
          exam_date: g.exam_date ? new Date(g.exam_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : ''
        };
      });
      setDraftGrades(drafts);

      const { data: checklistsData } = await supabase
        .from('study_checklists')
        .select('*')
        .in('grade_id', (gradesData || []).map(g => g.id))
        .eq('user_id', user.id);

      const organized = {};
      (checklistsData || []).forEach(item => {
        if (!organized[item.grade_id]) {
          organized[item.grade_id] = [];
        }
        organized[item.grade_id].push(item);
      });
      setChecklists(organized);

      if (gradesData && gradesData.length > 0) {
        setExpandedGrades({ [gradesData[0].id]: true });
      }
    } catch (error) {
      toast.error('Error al cargar datos del ramo');
    } finally {
      setLoading(false);
    }
  };

  const calculateWeightedAverage = () => {
    const validGrades = grades.filter(g => g.score > 0 && g.weight > 0);
    if (validGrades.length === 0) return 0;
    const totalWeight = validGrades.reduce((sum, g) => sum + parseFloat(g.weight), 0);
    if (totalWeight === 0) return 0;
    const weightedSum = validGrades.reduce((sum, g) => sum + (parseFloat(g.score) * parseFloat(g.weight)), 0);
    return (weightedSum / totalWeight).toFixed(2);
  };

  const handleDraftChange = (gradeId, field, value) => {
    setDraftGrades(prev => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        [field]: value
      }
    }));
  };

  const saveGradeDetails = async (gradeId) => {
    const draft = draftGrades[gradeId];
    if (!draft) return;

    let parsedDate = null;
    if (draft.exam_date && draft.exam_date.match(/^\d{1,2}\/\d{1,2}$/)) {
      const [day, month] = draft.exam_date.split('/');
      const year = new Date().getFullYear();
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      if (date < new Date()) {
        date.setFullYear(year + 1);
      }
      parsedDate = date.toISOString().split('T')[0];
    }

    // Smart parsing for score (e.g. "50" -> 5.0, "35" -> 3.5)
    let parsedScore = parseFloat(draft.score) || 0;
    if (parsedScore > 10 && parsedScore <= 70) {
      parsedScore = parsedScore / 10;
    }

    try {
      const { data: currentGrade } = await supabase.from('grades').select('google_event_id, title').eq('id', gradeId).single();

      const { error } = await supabase
        .from('grades')
        .update({
          score: parsedScore,
          weight: parseFloat(draft.weight) || 0,
          ...(parsedDate ? { exam_date: parsedDate } : {})
        })
        .eq('id', gradeId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (parsedDate) {
        try {
          const endDateObj = new Date(parsedDate + 'T00:00:00');
          endDateObj.setDate(endDateObj.getDate() + 1);
          const endParsedDate = endDateObj.toISOString().split('T')[0];

          const eventDetails = {
            summary: `[Uniclass] ${subject?.name || 'Asignatura'} - ${currentGrade?.title || 'Evaluación'}`,
            description: `Evaluación de ${subject?.name || 'Asignatura'} (Peso: ${draft.weight}%)`,
            start: { date: parsedDate },
            end: { date: endParsedDate }
          };

          if (currentGrade?.google_event_id) {
            await updateGoogleCalendarEvent(currentGrade.google_event_id, eventDetails);
          } else {
            const newGoogleId = await createGoogleCalendarEvent(eventDetails);
            const { error: gError } = await supabase.from('grades').update({ google_event_id: newGoogleId }).eq('id', gradeId);
            if (gError) console.warn("Uniclass: Debes añadir la columna google_event_id en la base de datos.");
          }
        } catch (gcalError) {
          console.error("Fallo al sincronizar con Google:", gcalError);
          toast.error("Error GCal: " + (gcalError.message || 'Desconocido'));
        }
      } else if (currentGrade?.google_event_id) {
        try {
          await deleteGoogleCalendarEvent(currentGrade.google_event_id);
          await supabase.from('grades').update({ google_event_id: null }).eq('id', gradeId);
        } catch (e) {
          console.error("Fallo al borrar de Google:", e);
          toast.error("Error GCal Borrado: " + (e.message || 'Desconocido'));
        }
      }

      toast.success('Cambios guardados correctamente');
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al guardar cambios');
    }
  };

  const addGrade = async () => {
    try {
      const maxNumber = Math.max(...grades.map(g => g.exam_number || 0), 0);
      const { error } = await supabase
        .from('grades')
        .insert([{
          user_id: user.id,
          subject_id: subjectId,
          title: `Prueba ${maxNumber + 1}`,
          score: 0,
          weight: 0,
          exam_number: maxNumber + 1,
          is_visible: true
        }]);

      if (error) throw error;
      toast.success('Prueba agregada');
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al agregar prueba');
    }
  };

  const deleteGrade = async (gradeId) => {
    try {
      const { data: currentGrade } = await supabase.from('grades').select('google_event_id').eq('id', gradeId).single();

      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', gradeId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (currentGrade?.google_event_id) {
        try {
          await deleteGoogleCalendarEvent(currentGrade.google_event_id);
        } catch (gcalError) {
          console.error("Error borrando de Google:", gcalError);
        }
      }

      toast.success('Prueba eliminada');
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al eliminar prueba');
    }
  };

  const startAddingTopic = (gradeId) => {
    setAddingTopicForGrade(gradeId);
    setNewTopicText('');
  };

  const saveNewTopic = async (gradeId) => {
    if (!newTopicText.trim()) {
      setAddingTopicForGrade(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('study_checklists')
        .insert([{
          user_id: user.id,
          grade_id: gradeId,
          topic: newTopicText.trim(),
          is_completed: false
        }]);

      if (error) throw error;
      toast.success('Tema agregado');
      setAddingTopicForGrade(null);
      setNewTopicText('');
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al agregar tema');
    }
  };

  const toggleTopic = async (topicId, isCompleted) => {
    try {
      const { error } = await supabase
        .from('study_checklists')
        .update({ is_completed: !isCompleted })
        .eq('id', topicId)
        .eq('user_id', user.id);

      if (error) throw error;
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al actualizar tema');
    }
  };

  const deleteTopic = async (topicId) => {
    try {
      const { error } = await supabase
        .from('study_checklists')
        .delete()
        .eq('id', topicId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Tema eliminado');
      loadSubjectData();
      window.dispatchEvent(new Event('refreshSidebar'));
    } catch (error) {
      toast.error('Error al eliminar tema');
    }
  };

  const toggleGradeExpansion = (gradeId) => {
    setExpandedGrades(prev => ({
      ...prev,
      [gradeId]: !prev[gradeId]
    }));
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  if (!subject) {
    return <div className="p-6">Ramo no encontrado</div>;
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 md:px-6 py-4 flex items-center gap-2 md:gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="dark:text-gray-300 dark:hover:text-white flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: subject.color }}></div>
          <h1 className="text-xl md:text-2xl font-bold dark:text-white truncate">{subject.name}</h1>
        </div>
        <div className="ml-auto text-sm md:text-lg font-semibold dark:text-gray-200">
          Promedio: {calculateWeightedAverage()}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {grades.map((grade) => {
          const isExpanded = expandedGrades[grade.id];
          const gradeChecklists = checklists[grade.id] || [];
          const isAddingTopic = addingTopicForGrade === grade.id;

          return (
            <Card key={grade.id} className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader className="cursor-pointer px-4 md:px-6 py-4" onClick={() => toggleGradeExpansion(grade.id)}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 md:h-5 md:w-5 dark:text-gray-400" /> : <ChevronRight className="h-4 w-4 md:h-5 md:w-5 dark:text-gray-400" />}
                    <CardTitle className="dark:text-gray-100 text-base md:text-lg">{grade.title}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2 md:space-x-4 w-full sm:w-auto justify-end">
                    {grade.exam_date && (
                      <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                        {new Date(grade.exam_date).toLocaleDateString('es-ES')}
                      </span>
                    )}
                    <span className="text-base md:text-lg font-bold dark:text-gray-200">
                      {grade.score > 0 ? `${grade.score} (${grade.weight}%)` : '-'}
                    </span>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <Label className="dark:text-gray-300">Nota</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={draftGrades[grade.id]?.score ?? ''}
                        onChange={(e) => handleDraftChange(grade.id, 'score', e.target.value)}
                        placeholder="1.0-7.0"
                        className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <Label className="dark:text-gray-300">Ponderación %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={draftGrades[grade.id]?.weight ?? ''}
                        onChange={(e) => handleDraftChange(grade.id, 'weight', e.target.value)}
                        placeholder="%"
                        className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <Label className="dark:text-gray-300">Fecha (dd/mm)</Label>
                      <Input
                        type="text"
                        value={draftGrades[grade.id]?.exam_date ?? ''}
                        onChange={(e) => handleDraftChange(grade.id, 'exam_date', e.target.value)}
                        placeholder="15/03"
                        className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <Button className="w-full" onClick={() => saveGradeDetails(grade.id)}>
                        Guardar
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="destructive" size="icon" onClick={() => deleteGrade(grade.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 border-t dark:border-slate-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold dark:text-gray-200">Temario</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startAddingTopic(grade.id)}
                        disabled={isAddingTopic}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar Tema
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {gradeChecklists.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800/50 rounded border dark:border-slate-800">
                          <div className="flex items-center space-x-2 flex-1">
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={() => toggleTopic(item.id, item.is_completed)}
                            />
                            <span className={item.is_completed ? 'line-through text-gray-500 dark:text-gray-600' : 'dark:text-gray-200'}>
                              {item.topic}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteTopic(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      {isAddingTopic && (
                        <div className="flex items-center p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded">
                          <Checkbox disabled className="opacity-50" />
                          <Input
                            ref={inputRef}
                            placeholder="Ingresa tema de estudio"
                            value={newTopicText}
                            onChange={(e) => setNewTopicText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveNewTopic(grade.id);
                              }
                            }}
                            onBlur={() => {
                              if (newTopicText.trim()) {
                                saveNewTopic(grade.id);
                              } else {
                                setAddingTopicForGrade(null);
                              }
                            }}
                            className="ml-2 border-none bg-transparent focus:ring-0 dark:text-gray-200 dark:placeholder-gray-500"
                          />
                        </div>
                      )}

                      {gradeChecklists.length === 0 && !isAddingTopic && (
                        <p className="text-sm text-gray-500 text-center py-4">No hay temas agregados</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        <Button onClick={addGrade} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Prueba
        </Button>
      </div>
    </div>
  );
};

export default SubjectDetail;
