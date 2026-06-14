import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: ('admin' | 'entrenador' | 'cliente')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { isAuthenticated, profile, loading } = useSupabase();
  const location = useLocation();



  // Mientras se verifica la sesión en el inicio, retornar transparente (carga escalonada)
  if (loading) {
    return null;
  }

  // Si no está autenticado, redirigir al login y guardar el origen para posterior retorno
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si hay roles permitidos definidos y el perfil aún no ha cargado,
  // permitir el acceso en lugar de redirigir (el perfil se cargará en segundo plano).
  // Esto previene el flash a pantalla vacía cuando el perfil llega un instante después.
  if (allowedRoles && profile && !allowedRoles.includes(profile.rol)) {
    console.warn(`Acceso denegado a la ruta para el rol: ${profile.rol}`);
    // Redirigir a la raíz para que el despachador de App.tsx determine su panel correcto
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : null;
};
export default ProtectedRoute;
