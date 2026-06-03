import "./instrument";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "@/services/posthog";

initPostHog();
import { ServiceWorkerUpdateProvider } from "@/providers/ServiceWorkerUpdateContext";
import { PWAInstallProvider } from "@/providers/PWAInstallContext";
import { AuthProvider } from "@/providers/AuthContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PWAInstallProvider>
      <ServiceWorkerUpdateProvider>
        <App />
      </ServiceWorkerUpdateProvider>
    </PWAInstallProvider>
  </AuthProvider>
);
