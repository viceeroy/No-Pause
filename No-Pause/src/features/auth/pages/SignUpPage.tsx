import { useState } from "react";
import { Flame, Mic, TrendingUp } from "lucide-react";
import { useAuth } from "@/providers/AuthContext";

const SignUpPage = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4 md:p-6 pb-20 relative overflow-hidden">
      <style>{`
        @keyframes wave-pulse {
          0% { transform: scaleY(0.3); opacity: 0.1; }
          50% { transform: scaleY(1); opacity: 0.3; }
          100% { transform: scaleY(0.3); opacity: 0.1; }
        }
        @keyframes slow-glow {
          0% { opacity: 0.05; transform: scale(0.95); }
          50% { opacity: 0.15; transform: scale(1.05); }
          100% { opacity: 0.05; transform: scale(0.95); }
        }
      `}</style>

      {/* Subtle pulse background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" style={{ animation: 'slow-glow 6s ease-in-out infinite' }} />

      {/* Sound wave lines */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-3 md:gap-4 opacity-[0.03] pointer-events-none z-0">
        {[...Array(11)].map((_, i) => {
          const heights = [40, 80, 140, 220, 300, 380, 300, 220, 140, 80, 40];
          const delays = [0.1, 0.4, 0.2, 0.5, 0.3, 0.6, 0.3, 0.5, 0.2, 0.4, 0.1];
          return (
            <div
              key={i}
              className="w-3 md:w-4 rounded-full bg-primary"
              style={{
                height: `${heights[i]}px`,
                animation: `wave-pulse 2s ease-in-out infinite`,
                animationDelay: `${delays[i]}s`
              }}
            />
          );
        })}
      </div>

      <div className="w-full max-w-md md:max-w-none md:w-[480px] relative z-10 px-4 md:px-0">

        <div className="w-full bg-surface-elevated border border-border rounded-[24px] p-6 md:p-10 shadow-card elevation-card overflow-hidden">

          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground mb-2 tracking-tight drop-shadow-md">
              No Pause
            </h1>
            <h2 className="text-sm md:text-base font-serif font-semibold text-muted-foreground tracking-tight">
              Real-time speaking analytics tool.
            </h2>
          </div>

          <hr className="border-border my-6 md:my-8" />

          <div className="flex flex-col gap-4 mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-surface-card border border-border">
                <Flame size={18} className="text-primary" />
              </div>
              <span className="text-sm md:text-base text-foreground font-sans font-medium">Track your fluency streak</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-surface-card border border-border">
                <Mic size={18} className="text-primary" />
              </div>
              <span className="text-sm md:text-base text-foreground font-sans font-medium">Measure hesitations in real time</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-surface-card border border-border">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <span className="text-sm md:text-base text-foreground font-sans font-medium">Improve with every session</span>
            </div>
          </div>

          <hr className="border-border my-6 md:my-8" />

          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              void signInWithGoogle().catch((error) => {
                console.error("Supabase Google sign-up failed:", error);
                setAuthError("Google sign-in failed. Please try again.");
              });
            }}
	            className="w-full border border-border bg-surface-base hover:bg-surface-card text-foreground rounded-full transition-all min-h-[48px] h-12 md:h-14 shadow-sm hover:shadow-md px-4 font-sans font-semibold text-base"
          >
            Continue with Google
          </button>

          <p className="text-center text-xs text-muted-foreground mt-4 font-sans font-medium">
            No Pause only supports Google sign-up
          </p>
          {authError ? (
            <p className="text-center text-xs text-destructive mt-3 font-sans font-medium">
              {authError}
            </p>
          ) : null}

        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
