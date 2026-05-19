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

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PRODUCTION_ORIGIN = "https://nopause.org";

const getAuthCallbackUrl = (nextPath?: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN;
  const url = new URL("/auth/callback", origin);
  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }
  return url.toString();
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
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
