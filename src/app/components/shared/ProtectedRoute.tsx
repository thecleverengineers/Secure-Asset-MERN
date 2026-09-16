import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../services/types';

export default function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const effectiveRoles: UserRole[] = [
    user.role,
    ...(user.role === 'tenant' && user.landlordEnabled ? ['landlord' as UserRole] : []),
    ...(user.role === 'tenant' && user.surveyorEnabled ? ['surveyor' as UserRole] : []),
  ];
  if (roles && !effectiveRoles.some((role) => roles.includes(role))) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
