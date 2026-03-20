import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Toaster } from 'sonner';
import { useState } from 'react';
import Auth from '@/components/Auth';
import NewLayout from '@/components/NewLayout';
import NewWeeklyCalendar from '@/components/NewWeeklyCalendar';
import SubjectsView from '@/components/SubjectsView';
import SubjectDetail from '@/components/SubjectDetail';
import TodosView from '@/components/TodosView';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentView = searchParams.get('view') || 'horario';
  const selectedSubject = searchParams.get('subject') || null;
  const selectedExam = searchParams.get('exam') || null;
  const showReminders = searchParams.get('reminders') === 'true';

  const handleNavigate = (view) => {
    setSearchParams({ view });
  };

  const handleSelectSubject = (subjectId) => {
    setSearchParams({ view: currentView, subject: subjectId });
  };

  const handleSelectExam = (subjectId, examId) => {
    setSearchParams({ view: currentView, subject: subjectId, exam: examId });
  };

  const handleBackFromSubject = () => {
    setSearchParams({ view: currentView });
  };

  const setShowReminders = (show) => {
    const nextParams = new URLSearchParams(searchParams);
    if (show) {
      nextParams.set('reminders', 'true');
    } else {
      nextParams.delete('reminders');
    }
    setSearchParams(nextParams);
  };

  return (
    <NewLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      onSelectExam={handleSelectExam}
      showReminders={showReminders}
      setShowReminders={setShowReminders}
    >
      {selectedSubject ? (
        <SubjectDetail
          subjectId={selectedSubject}
          onBack={handleBackFromSubject}
          initialExpandedExam={selectedExam}
        />
      ) : currentView === 'horario' ? (
        <NewWeeklyCalendar onSubjectClick={handleSelectSubject} />
      ) : currentView === 'ramos' ? (
        <SubjectsView onSelectSubject={handleSelectSubject} />
      ) : null}
    </NewLayout>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <Auth />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <AppContent />
    </AuthProvider>
  );
}

export default App;
