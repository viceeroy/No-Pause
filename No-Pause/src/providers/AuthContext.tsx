import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { identifyUser, resetUser } from "@/services/posthog";

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PRODUCTION_ORIGIN = "https://nopause.org";

// Dev-only auth bypass. Lets local previews reach auth-gated routes without
// Google OAuth. Active ONLY in `vite` dev builds AND when the flag is set, so
// it can never run in a production bundle.
const DEV_FAKE_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_FAKE_AUTH === "1";

const FAKE_SESSION = {
  access_token: "dev-fake-access-token",
  refresh_token: "dev-fake-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    email: "dev@nopause.local",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Dev User", name: "Dev User" },
    created_at: new Date(0).toISOString(),
  },
} as unknown as Session;

const getAuthCallbackUrl = (nextPath?: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN;
  const url = new URL("/auth/callback", origin);
  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }
  return url.toString();
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(
    DEV_FAKE_AUTH ? FAKE_SESSION : null,
  );
  const [isLoading, setIsLoading] = useState(!DEV_FAKE_AUTH);

  useEffect(() => {
    if (DEV_FAKE_AUTH) return;

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Failed to load Supabase session:", error);
      }
      if (!isMounted) return;
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      if (nextSession?.user) {
        identifyUser(nextSession.user.id, nextSession.user.email);
      } else if (event === 'SIGNED_OUT') {
        resetUser();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
      signInWithGoogle: async (returnTo?: string) => {
        const nextPath = returnTo?.startsWith("/") ? returnTo : null;
        const redirectTo = getAuthCallbackUrl(nextPath ?? undefined);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
