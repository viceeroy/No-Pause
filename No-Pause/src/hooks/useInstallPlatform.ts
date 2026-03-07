import { useEffect, useState } from "react";

type InstallPlatformState = {
  isIos: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isAndroidChrome: boolean;
  isInstallEligible: boolean;
  isInstalled: boolean;
};

export function useInstallPlatform(): InstallPlatformState {
  const [state, setState] = useState<InstallPlatformState>({
    isIos: false,
    isAndroid: false,
    isDesktop: false,
    isAndroidChrome: false,
    isInstallEligible: false,
    isInstalled: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isDesktop = !isAndroid && !isIos;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isChromeLike = /Chrome|CriOS/i.test(ua);
    const isAndroidChrome = isAndroid && isChromeLike && !/SamsungBrowser|EdgA|OPR|UCBrowser|YaBrowser|MiuiBrowser/i.test(ua);

    setState({
      isIos,
      isAndroid,
      isDesktop,
      isAndroidChrome,
      isInstallEligible: isAndroid || isIos || isDesktop,
      isInstalled: standalone,
    });

    const handleAppInstalled = () => {
      setState((prev) => ({ ...prev, isInstalled: true }));
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return state;
}
