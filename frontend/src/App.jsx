import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineBanner from './components/OfflineBanner';
import PomodoroTimer from './components/PomodoroTimer';

import LandingPage      from './pages/LandingPage';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import NotesPage        from './pages/NotesPage';
import NoteViewerPage   from './pages/NoteViewerPage';
import SummaryPage      from './pages/SummaryPage';
import TutorPage        from './pages/TutorPage';
import UploadNotesPage  from './pages/UploadNotesPage';
import UnitTopicsPage   from './pages/UnitTopicsPage';
import QuizPage       from './pages/QuizPage';
import StudyPlanPage  from './pages/StudyPlanPage';
import ProfilePage    from './pages/ProfilePage';

function GlobalStudyTimer() {
  const { user } = useAuth();
  const location = useLocation();
  const publicPaths = ['/', '/login', '/register'];
  if (!user || publicPaths.includes(location.pathname)) return null;
  return <PomodoroTimer />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <OfflineBanner />
          <GlobalStudyTimer />
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
            path="/notes/upload"
            element={
              <ProtectedRoute>
                <UploadNotesPage />
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
            path="/summary/:noteId"
            element={
              <ProtectedRoute>
                <SummaryPage />
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
    </ThemeProvider>
  );
}
