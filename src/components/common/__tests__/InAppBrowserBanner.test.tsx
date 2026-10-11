// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { InAppBrowserBanner } from '../InAppBrowserBanner';
import * as inAppBrowserModule from '../../../lib/inAppBrowser';

describe('InAppBrowserBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('no se renderiza si el navegador no es In-App', () => {
    vi.spyOn(inAppBrowserModule, 'getInAppBrowserInfo').mockReturnValue({
      isInApp: false,
      appName: null,
      isAndroid: false,
      isIOS: false,
    });

    const { container } = render(<InAppBrowserBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('se renderiza con instrucciones para iOS cuando está en Instagram iOS', () => {
    vi.spyOn(inAppBrowserModule, 'getInAppBrowserInfo').mockReturnValue({
      isInApp: true,
      appName: 'Instagram',
      isAndroid: false,
      isIOS: true,
    });

    render(<InAppBrowserBanner />);

    expect(screen.getByText(/Navegador de Instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/Toca los tres puntos/i)).toBeInTheDocument();
    expect(screen.getByText(/COPIAR ENLACE PARA SAFARI/i)).toBeInTheDocument();
  });

  it('se renderiza con enlace de intent para Android cuando está en Instagram Android', () => {
    vi.spyOn(inAppBrowserModule, 'getInAppBrowserInfo').mockReturnValue({
      isInApp: true,
      appName: 'Instagram',
      isAndroid: true,
      isIOS: false,
    });
    vi.spyOn(inAppBrowserModule, 'getAndroidChromeIntentUrl').mockReturnValue(
      'intent://evolutionlab.app/#Intent;scheme=https;package=com.android.chrome;end'
    );

    render(<InAppBrowserBanner />);

    expect(screen.getByText(/Navegador de Instagram/i)).toBeInTheDocument();
    const chromeLink = screen.getByRole('link', { name: /ABRIR EN GOOGLE CHROME/i });
    expect(chromeLink).toBeInTheDocument();
    expect(chromeLink).toHaveAttribute('href', 'intent://evolutionlab.app/#Intent;scheme=https;package=com.android.chrome;end');
  });

  it('permite copiar el enlace y actualiza el texto de retroalimentación', async () => {
    vi.spyOn(inAppBrowserModule, 'getInAppBrowserInfo').mockReturnValue({
      isInApp: true,
      appName: 'Instagram',
      isAndroid: false,
      isIOS: true,
    });
    const copySpy = vi.spyOn(inAppBrowserModule, 'copyCurrentUrl').mockResolvedValue(true);

    render(<InAppBrowserBanner />);

    const copyBtn = screen.getByRole('button', { name: /COPIAR ENLACE PARA SAFARI/i });
    fireEvent.click(copyBtn);

    expect(copySpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText(/ENLACE COPIADO! PÉGALO EN SAFARI/i)).toBeInTheDocument();
    });
  });

  it('se oculta y guarda en sessionStorage al pulsar el botón de cerrar', () => {
    vi.spyOn(inAppBrowserModule, 'getInAppBrowserInfo').mockReturnValue({
      isInApp: true,
      appName: 'Instagram',
      isAndroid: false,
      isIOS: true,
    });

    render(<InAppBrowserBanner />);

    const closeBtn = screen.getByRole('button', { name: /Cerrar aviso/i });
    fireEvent.click(closeBtn);

    expect(sessionStorage.getItem('evolab_dismiss_iab')).toBe('true');
    expect(screen.queryByText(/Navegador de Instagram/i)).not.toBeInTheDocument();
  });
});
