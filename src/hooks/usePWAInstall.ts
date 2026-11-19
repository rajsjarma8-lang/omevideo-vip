import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const APK_SESSION_KEY = 'vaultpay_apk_mode_v1';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as unknown as { standalone?: boolean };
  const ua = window.navigator.userAgent.toLowerCase();

  // Persist APK/WebView flag within the app session so navigations stay in app mode
  let persistedApk = false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'apk' || params.get('standalone') === '1') {
      window.sessionStorage.setItem(APK_SESSION_KEY, '1');
    }
    persistedApk = window.sessionStorage.getItem(APK_SESSION_KEY) === '1';
  } catch {
    // ignore storage errors
  }

  // Android native WebView APKs (e.g. SwiftAPK / WebIntoApp) include "; wv)" in UA;
  // exclude social media in-app browsers so shared referral links still open the Download page.
  const isSocialInAppBrowser =
    /fban|fbav|fb_iab|instagram|whatsapp|line|micromessenger|snapchat|twitter|tiktok|bytedance|telegram/.test(
      ua
    );
  const isAndroidApkWebView =
    /android/.test(ua) && /; wv\)/.test(ua) && !isSocialInAppBrowser;

  if (isAndroidApkWebView) {
    try {
      window.sessionStorage.setItem(APK_SESSION_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    persistedApk ||
    isAndroidApkWebView ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone);
  const [justInstalled, setJustInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setIsStandalone(detectStandalone());
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onDisplayChange);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setJustInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(detectStandalone());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', onDisplayChange);
      }
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setJustInstalled(true);
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isStandalone,
    justInstalled,
    isIOS,
    install,
  };
}
