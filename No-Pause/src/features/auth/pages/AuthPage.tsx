import { useState } from "react";
import { Flame, Mic, TrendingUp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthContext";

const AuthPage = () => {
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();
  const returnTo = new URLSearchParams(location.search).get("returnTo");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-base px-5 py-8">
      <section className="w-full max-w-md rounded-[28px] border border-border bg-surface-card p-6 text-center shadow-card md:max-w-xl md:p-8">
        <div className="mx-auto mb-8 flex h-36 w-36 items-center justify-center rounded-full border border-primary/20 bg-primary/10 md:h-44 md:w-44">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-card md:h-28 md:w-28">
            <Mic size={42} className="text-primary md:size-12" />
          </div>
        </div>

        <h1 className="mb-3 text-4xl font-serif font-medium tracking-tight text-foreground md:text-5xl">
          No Pause
        </h1>
        <p className="mx-auto mb-8 max-w-sm text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
          Sign in to save your Flow Score, transcripts, speaking time, and recent sessions.
        </p>

        <div className="mb-8 grid gap-3 text-left">
          {[
            { icon: Mic, label: "Start Speaking Mode" },
            { icon: TrendingUp, label: "Track Flow Score" },
            { icon: Flame, label: "Build speaking consistency" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-elevated p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-card text-primary">
                <Icon size={18} />
              </span>
              <span className="text-sm font-sans font-semibold text-foreground">{label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            void signInWithGoogle(returnTo ?? undefined).catch((error) => {
              console.error("Supabase Google sign-in failed:", error);
              setAuthError("Google sign-in failed. Please try again.");
            });
          }}
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-primary px-6 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110"
        >
          Continue with Google
        </button>

        {authError ? (
          <p className="mt-3 text-center text-xs font-sans font-medium text-destructive">
            {authError}
          </p>
        ) : null}
        <p className="mt-4 text-center text-xs font-sans font-medium text-muted-foreground">
          No Pause only supports Google sign-in
        </p>
      </section>
    </main>
  );
};

export default AuthPage;
