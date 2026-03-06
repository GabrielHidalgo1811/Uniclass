import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LogOut, Calendar, BookOpen, ChevronDown, ChevronRight, Bell } from 'lucide-react';

const NewLayout = ({ children, currentView, onNavigate, onSelectExam, showReminders, setShowReminders }) => {
  const { signOut, user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [checklists, setChecklists] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedGrades, setExpandedGrades] = useState({});

  useEffect(() => {
    if (user) {
      loadSidebarData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSidebarData = async () => {
    try {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setSubjects(subjectsData || []);

      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .eq('user_id', user.id)
        .order('exam_number');

      // Filter grades to only show those with dates that are today or in the future
      const todayDateStr = new Date().toISOString().split('T')[0];
      const filteredGrades = (gradesData || []).filter(g =>
        g.exam_date && g.exam_date >= todayDateStr
      );

      setGrades(filteredGrades);

      if (filteredGrades && filteredGrades.length > 0) {
        const { data: checklistsData } = await supabase
          .from('study_checklists')
          .select('*')
          .in('grade_id', filteredGrades.map(g => g.id))
          .eq('user_id', user.id);

        const organized = {};
        (checklistsData || []).forEach(item => {
          if (!organized[item.grade_id]) {
            organized[item.grade_id] = [];
          }
          organized[item.grade_id].push(item);
        });
        setChecklists(organized);
      }
    } catch (error) {
      console.error('Error loading sidebar data:', error);
    }
  };

  const toggleSubjectExpansion = (subjectId) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const toggleGradeExpansion = (gradeId) => {
    setExpandedGrades(prev => ({ ...prev, [gradeId]: !prev[gradeId] }));
  };

  const toggleChecklistItem = async (itemId, currentStatus) => {
    try {
      await supabase
        .from('study_checklists')
        .update({ is_completed: !currentStatus })
        .eq('id', itemId)
        .eq('user_id', user.id);
      loadSidebarData();
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const getGradesForSubject = (subjectId) => grades.filter(g => g.subject_id === subjectId);
  const getChecklistsForGrade = (gradeId) => checklists[gradeId] || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-gray-900 text-white flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex flex-col items-center space-y-2">
            <img src="/uniclass-logo-new.png" alt="Uniclass" className="h-[50px] w-[50px] object-contain" />
            <div className="text-center w-full">
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <button onClick={() => onNavigate('horario')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'horario' ? 'bg-gray-800 text-white font-medium' : 'text-gray-300 hover:bg-gray-800'}`}>
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <span>Horario</span>
          </button>

          <button onClick={() => onNavigate('ramos')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${currentView === 'ramos' ? 'bg-gray-800 text-white font-medium' : 'text-gray-300 hover:bg-gray-800'}`}>
            <BookOpen className="h-5 w-5 flex-shrink-0" />
            <span>Ramos</span>
          </button>

          <button onClick={() => setShowReminders && setShowReminders(true)} className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-gray-300 hover:bg-gray-800">
            <Bell className="h-5 w-5 flex-shrink-0" />
            <span>Recordatorios</span>
          </button>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="px-3 py-2 text-xs uppercase text-gray-500 font-semibold">Temarios</div>
            {subjects.map(subject => {
              const subjectGrades = getGradesForSubject(subject.id);
              const isSubjectExpanded = expandedSubjects[subject.id];
              if (subjectGrades.length === 0) return null;

              return (
                <div key={subject.id} className="mb-1">
                  <button onClick={() => toggleSubjectExpansion(subject.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="truncate">{subject.name}</span>
                    </div>
                    {isSubjectExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isSubjectExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {subjectGrades.map(grade => {
                        const isGradeExpanded = expandedGrades[grade.id];
                        const gradeChecklists = getChecklistsForGrade(grade.id);

                        return (
                          <div key={grade.id}>
                            <button onClick={() => toggleGradeExpansion(grade.id)} className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded">
                              <div className="flex items-center space-x-1 flex-1 min-w-0">
                                {isGradeExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="truncate">{grade.title}</span>
                              </div>
                              {grade.exam_date && (
                                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-semibold text-[11px] ml-1">
                                  {new Date(grade.exam_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )}
                            </button>

                            {isGradeExpanded && gradeChecklists.length > 0 && (
                              <div className="ml-4 mt-1 space-y-1">
                                {gradeChecklists.map(item => (
                                  <div key={item.id} className="flex items-start space-x-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer" onClick={() => toggleChecklistItem(item.id, item.is_completed)}>
                                    <Checkbox checked={item.is_completed} className="mt-0.5 h-3 w-3" />
                                    <span className={`text-xs ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-300'}`}>{item.topic}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />Cerrar Sesión
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
};

export default NewLayout;