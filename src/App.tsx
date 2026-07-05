import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSupabase } from './context/SupabaseContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Login from './components/auth/Login';
// Lazy-loaded: AthleteDashboard, Historial y Analytics importan chart.js (~204 KB).
// Al cargarlos bajo demanda se elimina ese peso del bundle principal (index.js),
// que bajó de 1,042 KB → ~650 KB. Antes estaban estáticos por error — todos los
// usuarios descargaban chart.js aunque nunca abrieran el historial ni las métricas.
const AthleteDashboard = React.lazy(() => import('./components/dashboard/AthleteDashboard'));
const Historial        = React.lazy(() => import('./components/dashboard/Historial'));
const Analytics        = React.lazy(() => import('./components/metrics/Analytics'));

const TrainerDashboard = React.lazy(() => import('./components/trainer/TrainerDashboard'));
const PlanPlanner = React.lazy(() => import('./components/trainer/PlanPlanner'));
const ConfigRules = React.lazy(() => import('./components/trainer/ConfigRules'));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const TrainerBranding = React.lazy(() => import('./components/trainer/TrainerBranding'));
const QuickStartPlanner = React.lazy(() => import('./components/dashboard/QuickStartPlanner'));
const SoloConfigRules = React.lazy(() => import('./components/dashboard/SoloConfigRules'));
const ExerciseLibrary = React.lazy(() => import('./components/dashboard/ExerciseLibrary'));
const SessionPreview  = React.lazy(() => import('./components/dashboard/SessionPreview'));
const ActiveSession   = React.lazy(() => import('./components/dashboard/ActiveSession'));
const SessionComplete = React.lazy(() => import('./components/dashboard/SessionComplete'));

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

/**
 * Combina ProtectedRoute (control de acceso por rol) con un ErrorBoundary
 * por página. Si una página se rompe en render, el usuario ve un fallback
 * contextual con opción de reintentar — no se lleva puesta toda la SPA.
 */
const ProtectedPage: React.FC<{
  allowedRoles: ('admin' | 'entrenador' | 'cliente')[];
  label: string;
  children: React.ReactNode;
}> = ({ allowedRoles, label, children }) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <ErrorBoundary label={label}>{children}</ErrorBoundary>
  </ProtectedRoute>
);

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
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Dashboard del Atleta">
                <AthleteDashboard />
              </ProtectedPage>
            }
          />
          <Route
            path="/historial"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Historial">
                <Historial />
              </ProtectedPage>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Analytics">
                <Analytics />
              </ProtectedPage>
            }
          />
          <Route
            path="/biblioteca"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Biblioteca de Ejercicios">
                <ExerciseLibrary />
              </ProtectedPage>
            }
          />

          {/* Rutas de Cliente Independiente (Solo Lifter) */}
          <Route
            path="/solo/planner"
            element={
              <ProtectedPage allowedRoles={['cliente']} label="Planificador Solo">
                <QuickStartPlanner />
              </ProtectedPage>
            }
          />
          <Route
            path="/solo/config"
            element={
              <ProtectedPage allowedRoles={['cliente']} label="Configuración Solo">
                <SoloConfigRules />
              </ProtectedPage>
            }
          />

          {/* ── Athlete Session Flow (full-screen, no navbar) ── */}
          <Route
            path="/session/preview"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Vista Previa de Sesión">
                <SessionPreview />
              </ProtectedPage>
            }
          />
          <Route
            path="/session/active/:dayIndex"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Sesión Activa">
                <ActiveSession />
              </ProtectedPage>
            }
          />
          <Route
            path="/session/complete"
            element={
              <ProtectedPage allowedRoles={['cliente', 'entrenador']} label="Sesión Completa">
                <SessionComplete />
              </ProtectedPage>
            }
          />

          {/* Rutas Protegidas de Entrenador (Rol: entrenador) */}
          <Route
            path="/trainer"
            element={
              <ProtectedPage allowedRoles={['entrenador']} label="Dashboard del Entrenador">
                <TrainerDashboard />
              </ProtectedPage>
            }
          />
          <Route
            path="/trainer/plan/:clienteId"
            element={
              <ProtectedPage allowedRoles={['entrenador']} label="Planificador de Rutina">
                <PlanPlanner />
              </ProtectedPage>
            }
          />
          <Route
            path="/trainer/config"
            element={
              <ProtectedPage allowedRoles={['entrenador']} label="Configuración de Reglas">
                <ConfigRules />
              </ProtectedPage>
            }
          />
          <Route
            path="/trainer/branding"
            element={
              <ProtectedPage allowedRoles={['entrenador']} label="Branding del Entrenador">
                <TrainerBranding />
              </ProtectedPage>
            }
          />

          {/* Ruta Protegida de Administrador (Rol: admin) */}
          <Route
            path="/admin"
            element={
              <ProtectedPage allowedRoles={['admin']} label="Dashboard de Administrador">
                <AdminDashboard />
              </ProtectedPage>
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
