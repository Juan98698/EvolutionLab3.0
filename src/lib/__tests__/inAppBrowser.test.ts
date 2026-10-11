// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  getInAppBrowserInfo,
  isInAppBrowser,
  getAndroidChromeIntentUrl,
  redirectToAndroidChrome,
  copyCurrentUrl
} from '../inAppBrowser';

describe('inAppBrowser utility', () => {
  const UA_INSTAGRAM_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 289.0.0.25.49 (iPhone14,2; iOS 16_5; es_ES; es; scale=3.00; 1170x2532; 478644508)';
  const UA_INSTAGRAM_ANDROID =
    'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 Instagram 289.0.0.25.49 Android (33/13; 450dpi; 1080x2340; samsung; SM-S908B; b0q; qcom; es_ES; 478644508)';
  const UA_FACEBOOK_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone13,2;FBMD/iPhone;FBSN/iOS;FBSV/15.4;FBSS/3;FBID/phone;FBLC/es_LA;FBOP/5]';
  const UA_TIKTOK_ANDROID =
    'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A.220705.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36 Bytelocale/es_ES App_version/25.1.3 musical_ly';
  const UA_SAFARI_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
  const UA_CHROME_ANDROID =
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

  describe('getInAppBrowserInfo', () => {
    it('detecta correctamente Instagram en iOS', () => {
      const info = getInAppBrowserInfo(UA_INSTAGRAM_IOS);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('Instagram');
      expect(info.isIOS).toBe(true);
      expect(info.isAndroid).toBe(false);
    });

    it('detecta correctamente Instagram en Android', () => {
      const info = getInAppBrowserInfo(UA_INSTAGRAM_ANDROID);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('Instagram');
      expect(info.isAndroid).toBe(true);
      expect(info.isIOS).toBe(false);
    });

    it('detecta Facebook en iOS', () => {
      const info = getInAppBrowserInfo(UA_FACEBOOK_IOS);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('Facebook');
      expect(info.isIOS).toBe(true);
    });

    it('detecta TikTok en Android', () => {
      const info = getInAppBrowserInfo(UA_TIKTOK_ANDROID);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('TikTok');
      expect(info.isAndroid).toBe(true);
    });

    it('identifica que Safari móvil no es In-App', () => {
      const info = getInAppBrowserInfo(UA_SAFARI_IOS);
      expect(info.isInApp).toBe(false);
      expect(info.appName).toBeNull();
      expect(info.isIOS).toBe(true);
    });

    it('identifica que Chrome móvil no es In-App', () => {
      const info = getInAppBrowserInfo(UA_CHROME_ANDROID);
      expect(info.isInApp).toBe(false);
      expect(info.appName).toBeNull();
      expect(info.isAndroid).toBe(true);
    });
  });

  describe('isInAppBrowser', () => {
    it('retorna true para Instagram y false para Safari', () => {
      expect(isInAppBrowser(UA_INSTAGRAM_IOS)).toBe(true);
      expect(isInAppBrowser(UA_SAFARI_IOS)).toBe(false);
    });
  });

  describe('getAndroidChromeIntentUrl', () => {
    it('genera la sintaxis adecuada de intent de Chrome eliminando https://', () => {
      const url = 'https://evolutionlab.app/login';
      const intentUrl = getAndroidChromeIntentUrl(url);
      expect(intentUrl).toBe('intent://evolutionlab.app/login#Intent;scheme=https;package=com.android.chrome;end');
    });
  });

  describe('redirectToAndroidChrome', () => {
    it('no redirige si no es Android', () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', { value: UA_INSTAGRAM_IOS, configurable: true });
      const redirected = redirectToAndroidChrome('https://evolutionlab.app');
      expect(redirected).toBe(false);
      Object.defineProperty(navigator, 'userAgent', { value: originalUa, configurable: true });
    });
  });

  describe('copyCurrentUrl', () => {
    it('copia usando navigator.clipboard si está disponible', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true
      });

      const success = await copyCurrentUrl();
      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalled();
    });
  });
});
