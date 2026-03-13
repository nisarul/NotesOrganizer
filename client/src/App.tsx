import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';
import PublicNotePage from './pages/PublicNotePage';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Public routes bypass auth loading
  if (location.pathname.startsWith('/public/')) {
    return (
      <Routes>
        <Route path="/public/:slug" element={<PublicNotePage />} />
      </Routes>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/public/:slug" element={<PublicNotePage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/note/:noteId"
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/*"
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;
