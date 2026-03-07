import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type PWAInstallContextValue = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  triggerInstall: () => Promise<boolean>;
};

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null);

export function PWAInstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone || iosStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome === "accepted";
    } catch (error) {
      console.error("[PWA] Failed to trigger install prompt:", error);
      return false;
    }
  };

  const value = useMemo<PWAInstallContextValue>(() => ({
    deferredPrompt,
    isInstallable: Boolean(deferredPrompt) && !isInstalled,
    triggerInstall,
  }), [deferredPrompt, isInstalled]);

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error("usePWAInstall must be used within PWAInstallProvider.");
  }
  return context;
}
