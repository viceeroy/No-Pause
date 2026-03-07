import { useEffect } from "react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Navbar } from "@/components/Navbar";
import { useServiceWorkerUpdate } from "@/contexts/ServiceWorkerUpdateContext";
import { getRouteSeoConfig, seoDefaults } from "@/seo/routeSeo";
import DashboardPage from "./pages/DashboardPage";
import PracticePage from "./pages/PracticePage";
import PromptsPage from "./pages/PromptsPage";
import StatsPage from "./pages/StatsPage";
import BlogListPage from "./pages/BlogListPage";
import BlogPostPage from "./pages/BlogPostPage";
import AuthPage from "./pages/AuthPage";
import SignUpPage from "./pages/SignUpPage";
import NotFound from "./pages/NotFound";

const upsertMetaTag = (selector: string, attributes: Record<string, string>) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    tag?.setAttribute(key, value);
  });
};

const upsertCanonicalTag = (href: string) => {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
};

const upsertStructuredData = (data: Record<string, unknown>) => {
  let script = document.head.querySelector<HTMLScriptElement>('script[data-route-seo="jsonld"]');
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-route-seo", "jsonld");
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
};

const RouteSeoManager = () => {
  const location = useLocation();

  useEffect(() => {
    const { title, description, canonicalPath, robots, structuredData } = getRouteSeoConfig(
      location.pathname,
      location.search,
    );
    const canonicalUrl = `${seoDefaults.siteUrl}${canonicalPath}`;

    document.title = title;
    upsertMetaTag('meta[name="description"]', { name: "description", content: description });
    upsertMetaTag('meta[name="robots"]', { name: "robots", content: robots || "index, follow" });

    upsertMetaTag('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMetaTag('meta[property="og:site_name"]', { property: "og:site_name", content: seoDefaults.siteName });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMetaTag('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMetaTag('meta[property="og:image"]', { property: "og:image", content: seoDefaults.defaultImage });

    upsertMetaTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image", content: seoDefaults.defaultImage });

    upsertCanonicalTag(canonicalUrl);
    upsertStructuredData(structuredData);
  }, [location.pathname, location.search]);

  return null;
};

const AppRoutes = () => {
  const location = useLocation();
  const isPractice = location.pathname.startsWith('/practice');
  const { hasPendingUpdate, applyUpdateIfAvailable } = useServiceWorkerUpdate();

  useEffect(() => {
    if (!hasPendingUpdate || isPractice) return;
    void applyUpdateIfAvailable();
  }, [hasPendingUpdate, isPractice, applyUpdateIfAvailable]);

  return (
    <>
      <RouteSeoManager />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/practice/free-speaking" element={<PracticePage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/history" element={<Navigate to="/stats" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isPractice && <Navbar />}
    </>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth/sign-up/*"
          element={(
            <>
              <SignedOut>
                <SignUpPage />
              </SignedOut>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
            </>
          )}
        />
        <Route
          path="/auth/*"
          element={(
            <>
              <SignedOut>
                <AuthPage />
              </SignedOut>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
            </>
          )}
        />
        <Route
          path="/*"
          element={(
            <>
              <SignedIn>
                <div className="relative min-h-screen bg-background">
                  <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
                    <UserButton />
                  </div>
                  <AppRoutes />
                </div>
              </SignedIn>
              <SignedOut>
                <Navigate to="/auth" replace />
              </SignedOut>
            </>
          )}
        />
      </Routes>
    </BrowserRouter>
    <Analytics />
    <SpeedInsights />
  </TooltipProvider>
);

export default App;
