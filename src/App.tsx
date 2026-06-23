import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSupabase } from './context/SupabaseContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import Login from './components/auth/Login';
import AthleteDashboard from './components/dashboard/AthleteDashboard';
import Historial from './components/dashboard/Historial';
import Analytics from './components/metrics/Analytics';

const TrainerDashboard = React.lazy(() => import('./components/trainer/TrainerDashboard'));
const PlanPlanner = React.lazy(() => import('./components/trainer/PlanPlanner'));
const ConfigRules = React.lazy(() => import('./components/trainer/ConfigRules'));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const TrainerBranding = React.lazy(() => import('./components/trainer/TrainerBranding'));
const QuickStartPlanner = React.lazy(() => import('./components/dashboard/QuickStartPlanner'));
const SoloConfigRules = React.lazy(() => import('./components/dashboard/SoloConfigRules'));
const ExerciseLibrary = React.lazy(() => import('./components/dashboard/ExerciseLibrary'));

const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0b0f19',
    color: 'white',
    fontFamily: "'Orbitron', sans-serif"
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid rgba(255, 255, 255, 0.05)',
      borderTopColor: '#00d4ff',
      borderRadius: '50%',
      animation: 'spinner 1s linear infinite',
      marginBottom: '15px'
    }} />
    <span style={{ fontSize: '11px', letterSpacing: '2px', opacity: 0.8, textTransform: 'uppercase' }}>Cargando Evolution Lab...</span>
    <style>{`
      @keyframes spinner {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const HomeDispatcher = () => {
  const { isAuthenticated, isTrainer, isAdmin, loading } = useSupabase();

  if (loading) return null; // ProtectedRoute ya se encarga de la pantalla de carga principal

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirigir según el rol de la base de datos
  if (isAdmin) return <Navigate to="/admin" replace />;
  return isTrainer ? <Navigate to="/trainer" replace /> : <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<Login />} />

          {/* Despachador de Inicio Automático (Maneja el ruteo por roles en la raíz) */}
          <Route path="/" element={<HomeDispatcher />} />

          {/* Rutas Protegidas de Atleta (Rol: cliente o entrenador) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['cliente', 'entrenador']}>
                <AthleteDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historial"
            element={
              <ProtectedRoute allowedRoles={['cliente', 'entrenador']}>
                <Historial />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['cliente', 'entrenador']}>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/biblioteca"
            element={
              <ProtectedRoute allowedRoles={['cliente', 'entrenador']}>
                <ExerciseLibrary />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Cliente Independiente (Solo Lifter) */}
          <Route
            path="/solo/planner"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <QuickStartPlanner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/solo/config"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <SoloConfigRules />
              </ProtectedRoute>
            }
          />

          {/* Rutas Protegidas de Entrenador (Rol: entrenador) */}
          <Route
            path="/trainer"
            element={
              <ProtectedRoute allowedRoles={['entrenador']}>
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer/plan/:clienteId"
            element={
              <ProtectedRoute allowedRoles={['entrenador']}>
                <PlanPlanner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer/config"
            element={
              <ProtectedRoute allowedRoles={['entrenador']}>
                <ConfigRules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer/branding"
            element={
              <ProtectedRoute allowedRoles={['entrenador']}>
                <TrainerBranding />
              </ProtectedRoute>
            }
          />

          {/* Ruta Protegida de Administrador (Rol: admin) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Redirección por defecto para cualquier ruta no mapeada */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
      <PWAInstallBanner />
    </BrowserRouter>
  );
};

export default App;
