import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../services/types';

export default function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/auth/login" replace />;
  const superAdminNeedsTwoFactor = user.role === 'super_admin'
    && user.superAdminSecurity?.twoFactorRequired !== false
    && !user.twoFactorEnabled;
  if (superAdminNeedsTwoFactor && location.pathname !== '/super-admin/security-setup') {
    return <Navigate to="/super-admin/security-setup" replace />;
  }
  const effectiveRoles: UserRole[] = [
    user.role,
    ...(user.role === 'super_admin' ? ['admin' as UserRole, 'manager' as UserRole] : []),
    ...(user.role === 'tenant' && user.landlordEnabled ? ['landlord' as UserRole] : []),
    ...(user.role === 'tenant' && user.surveyorEnabled ? ['surveyor' as UserRole] : []),
  ];
  if (roles && !effectiveRoles.some((role) => roles.includes(role))) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
