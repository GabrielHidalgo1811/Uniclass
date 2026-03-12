import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LogOut, Calendar, BookOpen, ChevronDown, ChevronRight, Bell, PanelLeftClose, PanelLeftOpen, Moon, Sun } from 'lucide-react';
import RemindersSidebar from './RemindersSidebar';

const NewLayout = ({ children, currentView, onNavigate, onSelectExam, showReminders, setShowReminders }) => {
  const { signOut, user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [checklists, setChecklists] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedGrades, setExpandedGrades] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false); // New state for mobile sidebar

  useEffect(() => {
    // Check initial dark mode preference
    const isDark = localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

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
    <div className="flex h-screen h-[100dvh] bg-gray-50 dark:bg-gray-900 overflow-hidden relative selection:bg-primary/10">
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Navigation Sidebar */}
      <div
        className={`bg-gray-900 border-r border-gray-800 text-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out z-50 fixed lg:relative h-full
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${!isMobileOpen && isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}
        `}
      >
        {/* Header - Logo and Toggle */}
        <div className="h-20 border-b border-gray-800 flex items-center px-3 relative flex-shrink-0">
          <div className="flex items-center min-w-max absolute left-3">
            <div className="w-12 h-12 flex items-center justify-center bg-gray-800 rounded-xl flex-shrink-0">
              <img src="/uniclass-logo-new.png" alt="Uniclass" className="h-7 w-7 object-contain" />
            </div>
            <span className={`font-bold tracking-wide text-lg ml-3 transition-opacity duration-300 whitespace-nowrap ${(isCollapsed && !isMobileOpen) ? 'lg:opacity-0' : 'opacity-100'}`}>Uniclass</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden lg:flex absolute items-center justify-center h-8 w-8 bg-gray-800 border border-gray-700 rounded-full text-gray-400 hover:text-white transition-all duration-300 z-50 ${isCollapsed ? 'right-[-16px] top-1/2 -translate-y-1/2 opacity-0' : 'right-4 top-1/2 -translate-y-1/2'}`}>
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Small transparent overlay button for expanding when collapsed on Desktop */}
        {(isCollapsed && !isMobileOpen) && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="hidden lg:block absolute top-6 right-0 h-8 w-full bg-transparent z-40 cursor-pointer"
            title="Expandir menú"
          />
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2 overflow-x-hidden">
          <button onClick={() => { onNavigate('horario'); setIsMobileOpen(false); }} className={`w-full flex items-center h-12 rounded-lg transition-colors overflow-hidden group ${currentView === 'horario' ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Horario">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <Calendar className={`h-5 w-5 transition-colors ${currentView === 'horario' ? 'text-blue-500' : ''}`} />
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-300 ${(isCollapsed && !isMobileOpen) ? 'lg:opacity-0' : 'opacity-100'}`}>Horario</span>
          </button>

          <button onClick={() => { onNavigate('ramos'); setIsMobileOpen(false); }} className={`w-full flex items-center h-12 rounded-lg transition-colors overflow-hidden group ${currentView === 'ramos' ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Ramos">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <BookOpen className={`h-5 w-5 transition-colors ${currentView === 'ramos' ? 'text-blue-500' : ''}`} />
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-300 ${(isCollapsed && !isMobileOpen) ? 'lg:opacity-0' : 'opacity-100'}`}>Ramos</span>
          </button>

          <button onClick={() => { setShowReminders(!showReminders); setIsMobileOpen(false); }} className={`w-full flex items-center h-12 rounded-lg transition-colors overflow-hidden group ${showReminders ? 'bg-purple-900/50 text-purple-200 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Recordatorios">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <Bell className={`h-5 w-5 transition-colors ${showReminders ? 'text-purple-300' : ''}`} />
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-300 ${(isCollapsed && !isMobileOpen) ? 'lg:opacity-0' : 'opacity-100'}`}>Recordatorios</span>
          </button>

          {/* Temarios Section - Only show when expanded */}
          {(!isCollapsed || isMobileOpen) && (
            <div className="mt-4 pt-4 border-t border-gray-700 transition-opacity duration-300 opacity-100">
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
          )}
        </nav>

        {/* Footer - User Info, Dark Mode and Logout */}
        <div className={`p-4 border-t border-gray-700 flex flex-col ${(isCollapsed && !isMobileOpen) ? 'lg:items-center space-y-4' : 'space-y-4'}`}>
          {(!isCollapsed || isMobileOpen) && (
            <div className="px-1">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          )}

          <div className={`flex ${(isCollapsed && !isMobileOpen) ? 'lg:flex-col lg:space-y-2 lg:space-x-0' : 'space-x-2'}`}>
            <Button
              variant="ghost"
              className={`text-gray-300 hover:text-white hover:bg-gray-800 ${(isCollapsed && !isMobileOpen) ? 'lg:w-10 lg:h-10 lg:p-0 lg:rounded-full lg:flex lg:items-center lg:justify-center flex-1 justify-center' : 'flex-1 justify-center'}`}
              onClick={toggleDarkMode}
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {(!isCollapsed || isMobileOpen) && <span className="ml-2">{isDarkMode ? 'Claro' : 'Oscuro'}</span>}
            </Button>

            <Button
              variant="ghost"
              className={`text-gray-300 hover:text-white hover:bg-red-900/50 hover:text-red-400 ${(isCollapsed && !isMobileOpen) ? 'lg:w-10 lg:h-10 lg:p-0 lg:rounded-full lg:flex lg:items-center lg:justify-center flex-1 justify-center' : 'flex-1 justify-center'}`}
              onClick={signOut}
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5" />
              {(!isCollapsed || isMobileOpen) && <span className="ml-2">Salir</span>}
            </Button>
          </div>
        </div>
      </div>

      {/* Reminders Sidebar (Sliding between menu and content) */}
      <div className={`fixed lg:relative top-0 right-0 lg:left-0 h-full bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out z-40 lg:z-10 ${showReminders ? 'w-80 border-l lg:border-l-0 lg:border-r dark:border-slate-800 translate-x-0' : 'w-0 lg:border-r-0 translate-x-full lg:translate-x-0'}`}>
        <div className="w-80 h-full">
          <RemindersSidebar onClose={() => setShowReminders(false)} />
        </div>
      </div>

      {/* Mobile Header when sidebar is closed */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-16 border-b bg-white dark:bg-slate-950 dark:border-slate-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center">
          <div className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-lg flex-shrink-0">
            <img src="/uniclass-logo-new.png" alt="Uniclass" className="h-5 w-5 object-contain" />
          </div>
          <span className="font-bold tracking-wide text-lg ml-2 dark:text-white">Uniclass</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowReminders(!showReminders)}>
            <Bell className="h-5 w-5 dark:text-gray-300" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsMobileOpen(true)}>
            <span className="sr-only">Open menu</span>
            <svg className="w-6 h-6 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-white dark:bg-gray-900 transition-colors duration-300 z-0 pt-16 lg:pt-0">
        {children}
      </div>
    </div>
  );
};

export default NewLayout;