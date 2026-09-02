import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage      from './pages/LandingPage';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import NotesPage        from './pages/NotesPage';
import NoteViewerPage   from './pages/NoteViewerPage';
import TutorPage        from './pages/TutorPage';
import UploadNotesPage  from './pages/UploadNotesPage';
import UnitTopicsPage   from './pages/UnitTopicsPage';
import QuizPage       from './pages/QuizPage';
import StudyPlanPage  from './pages/StudyPlanPage';
import ProfilePage    from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Protected routes ── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-notes"
            element={
              <ProtectedRoute>
                <UploadNotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes/unit/:unitCode"
            element={
              <ProtectedRoute>
                <UnitTopicsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes/:noteId"
            element={
              <ProtectedRoute>
                <NoteViewerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutor"
            element={
              <ProtectedRoute>
                <TutorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-plan"
            element={
              <ProtectedRoute>
                <StudyPlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
