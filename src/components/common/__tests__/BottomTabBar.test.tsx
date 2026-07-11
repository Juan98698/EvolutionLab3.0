// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BottomTabBar, { MobileTab } from '../BottomTabBar';

afterEach(() => {
  cleanup();
});

const noop = () => {};

describe('BottomTabBar', () => {
  it('renderiza los 4 tabs con sus etiquetas', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={0} />);

    expect(screen.getByRole('button', { name: 'Hoy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Progreso' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alertas' })).toBeTruthy();
  });

  it('expone role="navigation" con aria-label para lectores de pantalla', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={0} />);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav).toBeTruthy();
  });

  it('marca aria-current="page" solo en el tab activo', () => {
    render(<BottomTabBar activeTab="progreso" onTabChange={noop} notificationCount={0} />);

    expect(screen.getByRole('button', { name: 'Progreso' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Alertas' }).getAttribute('aria-current')).toBeNull();
  });

  it('aplica la clase --active solo al botón del tab activo', () => {
    render(<BottomTabBar activeTab="plan" onTabChange={noop} notificationCount={0} />);

    expect(screen.getByRole('button', { name: 'Plan' }).className).toContain('mobile-tab-btn--active');
    expect(screen.getByRole('button', { name: 'Hoy' }).className).not.toContain('mobile-tab-btn--active');
  });

  it('llama a onTabChange con el id correcto al clickear un tab', () => {
    const onTabChange = vi.fn();
    render(<BottomTabBar activeTab="hoy" onTabChange={onTabChange} notificationCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Progreso' }));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('progreso' as MobileTab);
  });

  it('no muestra el badge de notificaciones cuando el conteo es 0', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={0} />);
    expect(screen.queryByLabelText(/^\d+ alertas$/i)).toBeNull();
  });

  it('muestra el conteo exacto en el badge cuando es 9 o menos', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={3} />);
    expect(screen.getByLabelText('3 alertas')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('muestra "9+" en el badge cuando el conteo supera 9', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={15} />);
    expect(screen.getByLabelText('15 alertas')).toBeTruthy();
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('el badge solo aparece en el tab de notificaciones, no en los demás aunque haya conteo', () => {
    render(<BottomTabBar activeTab="hoy" onTabChange={noop} notificationCount={5} />);

    const hoyBtn = screen.getByRole('button', { name: 'Hoy' });
    const planBtn = screen.getByRole('button', { name: 'Plan' });
    const progresoBtn = screen.getByRole('button', { name: 'Progreso' });

    expect(hoyBtn.querySelector('.mobile-tab-btn__badge')).toBeNull();
    expect(planBtn.querySelector('.mobile-tab-btn__badge')).toBeNull();
    expect(progresoBtn.querySelector('.mobile-tab-btn__badge')).toBeNull();
  });
});
