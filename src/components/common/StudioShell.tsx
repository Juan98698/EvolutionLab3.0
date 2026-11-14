import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { useConfirm } from '../../context/ConfirmDialogContext';

const coachLinks = [
  ['/trainer', 'Mi equipo', 'team'], ['/trainer?view=auditoria', 'Seguimiento', 'progress'],
  ['/biblioteca', 'Biblioteca', 'library'], ['/trainer/config', 'Reglas de progresión', 'settings'],
  ['/trainer/branding', 'Mi marca', 'brand'], ['/dashboard', 'Mi entrenamiento', 'training'],
] as const;
const athleteLinks = [['/dashboard', 'Mi entrenamiento', 'training'], ['/historial', 'Historial', 'history'], ['/analytics', 'Métricas', 'progress'], ['/biblioteca', 'Biblioteca', 'library']] as const;

function NavSymbol({ kind }: { kind: string }) {
  // CSS geometry keeps the navigation quiet; labels carry the meaning.
  return <span className={`studio-nav-symbol studio-nav-symbol--${kind}`} aria-hidden="true" />;
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { profile, isTrainer, isAdmin, signOut } = useSupabase();
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const links = isAdmin ? [['/admin', 'Administración', 'team']] : isTrainer ? coachLinks : athleteLinks;
  const isActive = (to: string) => {
    const [pathname, query] = to.split('?');
    const view = new URLSearchParams(location.search).get('view');
    return location.pathname === pathname && (query ? view === new URLSearchParams(query).get('view') : pathname !== '/trainer' || !view);
  };
  const activeLink = links.find(([to]) => isActive(to));
  const title = activeLink?.[1] || (location.pathname.includes('/session') ? 'Sesión de entrenamiento' : location.pathname.includes('/plan') ? 'Planificación' : 'Mi espacio');
  const logout = async () => {
    if (await confirm('¿Seguro que deseas cerrar la sesión?', { title: 'Cerrar sesión', confirmText: 'Cerrar sesión' })) {
      await signOut(); navigate('/login');
    }
  };
  return <div className="studio-shell">
    <a className="studio-skip-link" href="#studio-main">Ir al contenido</a>
    <header className="studio-mobile-header">
      <Link className="studio-wordmark" to="/">evolution<span>lab</span></Link>
      <button className="studio-menu-button" type="button" aria-expanded={menuOpen} aria-controls="studio-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Cerrar menú' : 'Menú'}</button>
    </header>
    <aside className={`studio-sidebar${menuOpen ? ' studio-sidebar--open' : ''}`}>
      <Link className="studio-wordmark" to="/">evolution<span>lab</span><small>Espacio de entrenamiento</small></Link>
      <nav id="studio-navigation" aria-label="Navegación del espacio">
        {links.map(([to, label, kind]) => {
          const active = isActive(to);
          return <Link key={to} to={to} className={`studio-nav-link${active ? ' studio-nav-link--active' : ''}`} aria-current={active ? 'page' : undefined}><NavSymbol kind={kind} />{label}</Link>;
        })}
      </nav>
      <div className="studio-account">
        <span className="studio-account-avatar" aria-hidden="true">{profile?.nombre?.slice(0, 2).toUpperCase() || 'EL'}</span>
        <div><strong>{profile?.marca?.nombre_display || profile?.nombre || 'Mi cuenta'}</strong><small>{isAdmin ? 'Administrador' : isTrainer ? 'Entrenador' : 'Atleta'}</small></div>
        <button type="button" onClick={() => void logout()}>Salir</button>
      </div>
    </aside>
    <div className="studio-workspace">
      <header className="studio-topline"><span>Mi espacio <span aria-hidden="true">/</span> <strong>{title}</strong></span><span className="studio-topline-meta">Evolution Lab</span></header>
      <main id="studio-main" className="studio-main">{children}</main>
      <footer className="studio-footer">Evolution Lab <span>Planifica. Registra. Aprende de tu progreso.</span></footer>
    </div>
  </div>;
}
