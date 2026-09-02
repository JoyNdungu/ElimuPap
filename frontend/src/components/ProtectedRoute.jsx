import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProtectedRoute — wraps routes that require authentication.
 *
 * Behaviour:
 *  - While auth state is loading → show spinner (prevents flash-of-redirect).
 *  - If not authenticated → redirect to /login, preserving intended destination.
 *  - If authenticated → render children.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Verifying your session…" />;
  }

  if (!isAuthenticated) {
    // Save where the user was trying to go so we can redirect them back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
