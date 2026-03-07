import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";
import { ServiceWorkerUpdateProvider } from "@/contexts/ServiceWorkerUpdateContext";
import { PWAInstallProvider } from "@/contexts/PWAInstallContext";

// 🔴 GLOBAL getUserMedia INTERCEPTOR — traces every call with stack (DEV only)
if (import.meta.env.DEV && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  let callCount = 0;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (...args: any[]) {
    callCount++;
    const stack = new Error().stack || '';
    console.error(`🔴 getUserMedia() CALL #${callCount}`, {
      timestamp: Date.now(),
      elapsed: `${(performance.now() / 1000).toFixed(1)}s since page load`,
      constraints: args[0],
      stack: stack.split('\n').slice(1, 6).map(l => l.trim()),
    });
    return original(...args);
  };
  console.log('[MicDebug] 🎯 getUserMedia interceptor installed');
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <PWAInstallProvider>
      <ServiceWorkerUpdateProvider>
        <App />
      </ServiceWorkerUpdateProvider>
    </PWAInstallProvider>
  </ClerkProvider>
);
