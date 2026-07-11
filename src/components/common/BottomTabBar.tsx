import React from 'react';

export type MobileTab = 'hoy' | 'plan' | 'progreso' | 'notificaciones';

interface BottomTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  notificationCount: number;
}

const TAB_ITEMS: {
  id: MobileTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: 'hoy',
    label: 'Hoy',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--theme-primary)' : 'rgba(255,255,255,0.45)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5c0-2.5 2-4.5 5.5-4.5s5.5 2 5.5 4.5v4l2 2v2H4v-2l2-2V6.5z"/>
        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z"/>
        <line x1="4" y1="2" x2="6.5" y2="6.5" strokeOpacity="0"/>
        {/* Dumbbell icon */}
        <path d="M6 4h2v16H6zM16 4h2v16h-2zM2 8h4v8H2zM18 8h4v8h-4z"/>
      </svg>
    ),
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--theme-primary)' : 'rgba(255,255,255,0.45)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
    ),
  },
  {
    id: 'progreso',
    label: 'Progreso',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--theme-primary)' : 'rgba(255,255,255,0.45)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'notificaciones',
    label: 'Alertas',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--theme-primary)' : 'rgba(255,255,255,0.45)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  notificationCount,
}) => {
  return (
    <nav className="mobile-bottom-tab-bar" role="navigation" aria-label="Navegación principal">
      {TAB_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const showBadge = item.id === 'notificaciones' && notificationCount > 0;

        return (
          <button
            key={item.id}
            className={`mobile-tab-btn${isActive ? ' mobile-tab-btn--active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            type="button"
          >
            <span className="mobile-tab-btn__icon-wrap">
              {item.icon(isActive)}
              {showBadge && (
                <span className="mobile-tab-btn__badge" aria-label={`${notificationCount} alertas`}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </span>
            <span className="mobile-tab-btn__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomTabBar;
