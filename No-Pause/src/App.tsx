import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Navbar } from "@/shared/components/Navbar";
import { useServiceWorkerUpdate } from "@/providers/ServiceWorkerUpdateContext";
import { getRouteSeoConfig, seoDefaults } from "@/shared/seo/routeSeo";
import { getNavTabIndex, navTabs } from "@/shared/lib/navTabs";
import DashboardPage from "@/features/stats/pages/DashboardPage";
import PracticePage from "./pages/PracticePage";
import PromptsPage from "./pages/PromptsPage";
import StatsPage from "@/features/stats/pages/StatsPage";
import BlogListPage from "@/features/blog/pages/BlogListPage";
import BlogPostPage from "@/features/blog/pages/BlogPostPage";
import AuthPage from "@/features/auth/pages/AuthPage";
import SignUpPage from "@/features/auth/pages/SignUpPage";
import AuthCallbackPage from "@/features/auth/pages/AuthCallbackPage";
import ConnectTelegram from "./pages/ConnectTelegram";
import Sessions from "./pages/Sessions";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/providers/AuthContext";

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
  const navigate = useNavigate();
  const isPractice = location.pathname.startsWith('/practice');
  const { hasPendingUpdate, applyUpdateIfAvailable } = useServiceWorkerUpdate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);

  useEffect(() => {
    if (!hasPendingUpdate || isPractice) return;
    void applyUpdateIfAvailable();
  }, [hasPendingUpdate, isPractice, applyUpdateIfAvailable]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    if (document.body.dataset.recording === 'true') return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isSwipeAnimating) return;
    if (document.body.dataset.recording === 'true') return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 50) return;
    if (absY > absX) return;

    const direction = deltaX < 0 ? 'left' : 'right';
    const isMainTabRoute = navTabs.some((tab) => tab.path === location.pathname);

    if (!isMainTabRoute) {
      if (direction !== 'right') return;
      setIsSwipeAnimating(true);
      setSwipeDirection(direction);
      window.setTimeout(() => {
        navigate(-1);
      }, 90);
      window.setTimeout(() => {
        setSwipeDirection(null);
        setIsSwipeAnimating(false);
      }, 220);
      return;
    }

    const currentIndex = getNavTabIndex(location.pathname);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'left' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= navTabs.length) return;

    const nextPath = navTabs[nextIndex].path;
    if (nextPath === location.pathname) return;

    setIsSwipeAnimating(true);
    setSwipeDirection(direction);

    window.setTimeout(() => {
      navigate(nextPath);
    }, 90);

    window.setTimeout(() => {
      setSwipeDirection(null);
      setIsSwipeAnimating(false);
    }, 220);
  };

  return (
    <>
      <RouteSeoManager />
      <div
        className="page-swipe-container"
        data-swipe={swipeDirection ?? undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
      </div>
      {!isPractice && <Navbar />}
    </>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthAwareRoutes />
    </BrowserRouter>
    <Analytics />
    <SpeedInsights />
  </TooltipProvider>
);

const AuthAwareRoutes = () => {
  const { isLoading, session } = useAuth();
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get("returnTo");
  const safeReturnTo = returnTo?.startsWith("/") ? returnTo : "/";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/auth/callback"
        element={<AuthCallbackPage />}
      />
      <Route
        path="/auth/sign-up/*"
        element={session ? <Navigate to="/" replace /> : <SignUpPage />}
      />
      <Route
        path="/auth/*"
        element={session ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route
        path="/login/*"
        element={session ? <Navigate to={safeReturnTo} replace /> : <AuthPage />}
      />
      <Route
        path="/connect"
        element={<ConnectTelegram />}
      />
      <Route
        path="/sessions"
        element={<Sessions />}
      />
      <Route
        path="/*"
        element={
          session ? (
            <div className="relative min-h-screen bg-background overflow-x-hidden">
              <AppRoutes />
            </div>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
    </Routes>
  );
};

export default App;
