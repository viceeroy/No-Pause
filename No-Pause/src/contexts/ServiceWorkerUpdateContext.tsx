import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type ServiceWorkerUpdateContextValue = {
  hasPendingUpdate: boolean;
  applyUpdateIfAvailable: () => Promise<void>;
};

const ServiceWorkerUpdateContext = createContext<ServiceWorkerUpdateContextValue | null>(null);

export function ServiceWorkerUpdateProvider({ children }: { children: React.ReactNode }) {
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let isMounted = true;
    let registration: ServiceWorkerRegistration | null = null;
    let onUpdateFound: (() => void) | null = null;
    let onWindowLoad: (() => void) | null = null;

    const handleWaiting = (worker: ServiceWorker) => {
      if (!isMounted) return;
      setWaitingWorker(worker);
      setHasPendingUpdate(true);
    };

    const observeRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg;
      if (reg.waiting) {
        handleWaiting(reg.waiting);
      }

      onUpdateFound = () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            handleWaiting(installing);
          }
        });
      };

      reg.addEventListener("updatefound", onUpdateFound);
    };

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js")
        .then(observeRegistration)
        .catch((error) => {
          console.error("[PWA] Service worker registration failed:", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      onWindowLoad = () => registerServiceWorker();
      window.addEventListener("load", onWindowLoad);
    }

    return () => {
      isMounted = false;
      if (onWindowLoad) {
        window.removeEventListener("load", onWindowLoad);
      }
      if (registration && onUpdateFound) {
        registration.removeEventListener("updatefound", onUpdateFound);
      }
    };
  }, []);

  const applyUpdateIfAvailable = async () => {
    if (!waitingWorker || applyingRef.current) return;

    applyingRef.current = true;
    setHasPendingUpdate(false);
    setWaitingWorker(null);

    let completed = false;

    const onControllerChange = () => {
      if (completed) return;
      completed = true;
      applyingRef.current = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    try {
      waitingWorker.postMessage("SKIP_WAITING");
    } catch (error) {
      applyingRef.current = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      console.error("[PWA] Failed to send SKIP_WAITING:", error);
      return;
    }

    const fallbackTimeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      applyingRef.current = false;
      window.clearTimeout(fallbackTimeoutId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      console.warn("[PWA] Update activation timed out. Will retry when another update signal appears.");
    }, 5000);
  };

  const value = useMemo<ServiceWorkerUpdateContextValue>(() => ({
    hasPendingUpdate,
    applyUpdateIfAvailable,
  }), [hasPendingUpdate, waitingWorker]);

  return (
    <ServiceWorkerUpdateContext.Provider value={value}>
      {children}
    </ServiceWorkerUpdateContext.Provider>
  );
}

export function useServiceWorkerUpdate() {
  const context = useContext(ServiceWorkerUpdateContext);
  if (!context) {
    throw new Error("useServiceWorkerUpdate must be used within ServiceWorkerUpdateProvider.");
  }
  return context;
}
