import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App.tsx";
import "./index.css";
import { ServiceWorkerUpdateProvider } from "@/providers/ServiceWorkerUpdateContext";
import { PWAInstallProvider } from "@/providers/PWAInstallContext";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <PWAInstallProvider>
        <ServiceWorkerUpdateProvider>
          <App />
        </ServiceWorkerUpdateProvider>
      </PWAInstallProvider>
    </ConvexProviderWithClerk>
  </ClerkProvider>
);
