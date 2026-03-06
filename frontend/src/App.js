import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  const [currentView, setCurrentView] = useState('horario');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);

  const handleNavigate = (view) => {
    setCurrentView(view);
    setSelectedSubject(null);
    setSelectedExam(null);
  };

  const handleSelectSubject = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedExam(null);
  };

  const handleSelectExam = (subjectId, examId) => {
    setSelectedSubject(subjectId);
    setSelectedExam(examId);
  };

  const handleBackFromSubject = () => {
    setSelectedSubject(null);
    setSelectedExam(null);
  };

  return (
    <NewLayout 
      currentView={currentView} 
      onNavigate={handleNavigate}
      onSelectExam={handleSelectExam}
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
