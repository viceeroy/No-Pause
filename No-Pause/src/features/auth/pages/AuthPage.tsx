import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame, Mic, Sparkles, Target, TrendingUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/providers/AuthContext";

const AuthPage = () => {
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    const seen = localStorage.getItem("onboarding_seen") === "true";
    setOnboardingSeen(seen);
  }, []);

  useEffect(() => {
    if (step >= 4) {
      localStorage.setItem("onboarding_seen", "true");
    }
  }, [step]);

  const AuthCard = useMemo(() => (
    <div className="w-full">
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
            <Flame size={18} className="text-ember-500" />
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
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <span className="text-sm md:text-base text-foreground font-sans font-medium">Improve with every session</span>
        </div>
      </div>

    </div>
  ), []);

  const SignInBlock = (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          setAuthError(null);
          void signInWithGoogle().catch((error) => {
            console.error("Supabase Google sign-in failed:", error);
            setAuthError("Google sign-in failed. Please try again.");
          });
        }}
        className="w-full max-w-full border border-border bg-surface-base hover:bg-surface-card text-foreground rounded-full transition-all min-h-[48px] h-12 md:h-14 shadow-sm hover:shadow-md px-4 font-sans font-semibold text-base"
      >
        Continue with Google
      </button>
      {authError ? (
        <p className="text-center text-xs text-amber-200/90 mt-3 font-sans font-medium">
          {authError}
        </p>
      ) : null}
      <p className="text-center text-xs text-muted-foreground mt-4 font-sans font-medium">
        No Pause only supports Google sign-in
      </p>
    </div>
  );

  const ModeCard = ({ icon: Icon, title, description }: {
    icon: React.ElementType;
    title: string;
    description: string;
  }) => (
    <div className="rounded-2xl border border-border bg-surface-card/60 p-4 text-left shadow-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-primary">
        <Icon size={16} />
      </div>
      <p className="text-sm font-serif text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground font-sans leading-relaxed">{description}</p>
    </div>
  );

  if (onboardingSeen === null) return null;

  if (onboardingSeen) {
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

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" style={{ animation: 'slow-glow 6s ease-in-out infinite' }} />

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

        <div className="w-full max-w-md md:max-w-none md:w-[560px] relative z-10 px-4 md:px-0">
          <div className="rounded-[24px] border border-border bg-surface-elevated/80 p-6 md:p-8 shadow-card elevation-card overflow-hidden">
            {AuthCard}
            <hr className="border-border my-6 md:my-8" />
            {SignInBlock}
          </div>
        </div>
      </div>
    );
  }

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
        @keyframes mic-pulse {
          0% { transform: scale(0.92); opacity: 0.7; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.92); opacity: 0.7; }
        }
        @keyframes fade-rise {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
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

      <div className="w-full max-w-md md:max-w-none md:w-[560px] relative z-10 px-4 md:px-0">
        {/* Preload auth card so screen 4 is instant */}
        {step < 4 && <div className="hidden" aria-hidden>{AuthCard}</div>}

        <div className="flex items-center justify-between mb-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-2 text-sm font-sans text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="rounded-[24px] border border-border bg-surface-elevated/80 p-6 md:p-8 shadow-card elevation-card">
            <div className={cn(step === 4 ? "min-h-0" : "min-h-[360px] md:min-h-[420px]", "flex flex-col")}>
            <div className="flex-1">
              <div className={cn("transition-all duration-300", step === 1 ? "opacity-100" : "opacity-0 hidden")}>
                <div className="text-center mb-6">
                  <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground mb-3">
                    Speak more. Hesitate less.
                  </h1>
                  <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed">
                    No Pause tracks your speaking sessions in real time — measuring hesitations, flow, and consistency so you improve with every practice.
                  </p>
                </div>
                <div className="flex justify-center mb-8">
                  <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center" style={{ animation: 'mic-pulse 2.4s ease-in-out infinite' }}>
                    <Mic size={28} className="text-primary" />
                    <span className="absolute inset-0 rounded-full bg-primary/10 blur-md" />
                  </div>
                </div>
              </div>

              <div className={cn("transition-all duration-300", step === 2 ? "opacity-100" : "opacity-0 hidden")}>
                <h2 className="text-2xl md:text-3xl font-serif text-foreground mb-4">Choose how you practice</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <ModeCard
                    icon={Mic}
                    title="Free Speaking"
                    description="Talk freely, no prompts. Pure fluency training."
                  />
                  <ModeCard
                    icon={Target}
                    title="Topic Score"
                    description="Get a topic, speak, and receive a delivery score."
                  />
                  <ModeCard
                    icon={Flame}
                    title="Lemon Technique"
                    description="Structured hesitation-reduction drills."
                  />
                  <ModeCard
                    icon={Sparkles}
                    title="Reading Challenge"
                    description="Read aloud and improve spoken rhythm."
                  />
                </div>
              </div>

              <div className={cn("transition-all duration-300", step === 3 ? "opacity-100" : "opacity-0 hidden")}>
                <h2 className="text-2xl md:text-3xl font-serif text-foreground mb-6">Built for real improvement</h2>
                <div className="space-y-4 mb-8">
                  {[
                    { icon: Sparkles, text: "See every hesitation as it happens" },
                    { icon: Flame, text: "Build a daily speaking streak" },
                    { icon: TrendingUp, text: "Watch your fluency score rise over time" },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.text}
                        className="flex items-center gap-3 text-sm md:text-base text-foreground font-sans"
                        style={{ animation: `fade-rise 0.4s ease ${index * 0.1}s both` }}
                      >
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-card text-primary">
                          <Icon size={16} />
                        </div>
                        <span>{item.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cn("transition-all duration-300", step === 4 ? "opacity-100" : "opacity-0 hidden")}>
                {AuthCard}
              </div>
            </div>

            <div className="mt-auto">
              {step < 4 ? (
                <div className="w-full pb-2 md:pb-3 h-[72px] flex items-end justify-center">
                  <button
                    type="button"
                    onClick={() => setStep((prev) => Math.min(4, prev + 1))}
                    className="w-full px-6 py-3 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press transition-all duration-300"
                  >
                    {step === 1 ? "Get Started →" : "Next →"}
                  </button>
                </div>
              ) : (
                <div className="pt-2 md:pt-4">
                  <hr className="border-border my-6 md:my-8" />
                  {SignInBlock}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((dot) => (
              <span
                key={dot}
                className={cn(
                  "h-2 w-2 rounded-full",
                  dot === step ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <p className="text-xs font-sans text-muted-foreground">Step {step} of 4</p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
