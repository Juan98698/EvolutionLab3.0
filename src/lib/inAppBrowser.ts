/**
 * inAppBrowser.ts
 *
 * Detección, diagnóstico y utilidades de escape para navegadores integrados
 * (In-App Browsers / WebViews) de redes sociales como Instagram, Facebook, TikTok y Twitter.
 *
 * Resuelve problemas críticos de WebViews:
 *  - Bloqueo de Google OAuth (Error 403: disallowed_useragent).
 *  - Imposibilidad de instalar PWA (sin evento beforeinstallprompt).
 *  - Pérdida de almacenamiento / sesiones efímeras al cerrar el sheet de la red social.
 *  - Conflictos de scripts inyectados por Meta (window.webkit.messageHandlers).
 */

export type InAppBrowserType = 'Instagram' | 'Facebook' | 'TikTok' | 'Twitter' | 'Otro';

export interface InAppBrowserInfo {
  /** Indica si la página se está ejecutando dentro de un WebView de una red social */
  isInApp: boolean;
  /** Nombre identificado de la aplicación anfitriona */
  appName: InAppBrowserType | null;
  /** Si el dispositivo es Android */
  isAndroid: boolean;
  /** Si el dispositivo es iOS (iPhone / iPad / iPod) */
  isIOS: boolean;
}

/**
 * Analiza el User-Agent para determinar si se está ejecutando en un navegador In-App.
 */
export function getInAppBrowserInfo(customUa?: string): InAppBrowserInfo {
  const ua = (customUa ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();

  const isAndroid = /android/i.test(ua);
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      (navigator.maxTouchPoints ?? 0) > 1);

  let appName: InAppBrowserType | null = null;

  if (/instagram/i.test(ua)) {
    appName = 'Instagram';
  } else if (/fban|fbav|fb_iab|fb4a/i.test(ua)) {
    appName = 'Facebook';
  } else if (/musical_ly|bytelocale|tiktok/i.test(ua)) {
    appName = 'TikTok';
  } else if (/twitter/i.test(ua)) {
    appName = 'Twitter';
  } else if (
    // WebViews genéricos en iOS y Android
    (isIOS && /applewebkit(?!.*safari)/i.test(ua)) ||
    (isAndroid && /; wv\)/i.test(ua)) ||
    /webview/i.test(ua)
  ) {
    appName = 'Otro';
  }

  return {
    isInApp: appName !== null,
    appName,
    isAndroid,
    isIOS,
  };
}

/**
 * Helper booleano rápido para saber si estamos en un navegador In-App.
 */
export function isInAppBrowser(customUa?: string): boolean {
  return getInAppBrowserInfo(customUa).isInApp;
}

/**
 * Genera la URL con esquema Intent de Android para abrir automáticamente en Google Chrome nativo.
 */
export function getAndroidChromeIntentUrl(targetUrl?: string): string {
  const current = targetUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const cleanUrl = current.replace(/^https?:\/\//i, '');
  return `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
}

/**
 * Intenta redirigir a Google Chrome en Android mediante esquema Intent.
 */
export function redirectToAndroidChrome(targetUrl?: string): boolean {
  if (typeof window === 'undefined') return false;
  const info = getInAppBrowserInfo();
  if (!info.isAndroid) return false;

  const intentUrl = getAndroidChromeIntentUrl(targetUrl);
  try {
    window.location.href = intentUrl;
    return true;
  } catch (e) {
    console.warn('No se pudo redirigir mediante Android Intent:', e);
    return false;
  }
}

/**
 * Copia la URL actual al portapapeles con fallback para entornos restringidos.
 */
export async function copyCurrentUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const url = window.location.href;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Si falla navigator.clipboard (típico en WebViews con permisos restringidos), intentar fallback execCommand
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Error al copiar enlace en fallback:', err);
    return false;
  }
}
