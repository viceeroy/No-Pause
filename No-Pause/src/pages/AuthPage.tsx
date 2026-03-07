import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const AuthPage = () => {
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

      <div className="w-full max-w-sm md:max-w-md flex flex-col items-center gap-6 md:gap-8 relative z-10 px-1 md:px-0">
        <div className="text-center flex flex-col items-center">
          <h1 className="text-[2.25rem] leading-none md:text-5xl font-serif font-medium text-foreground mb-2 md:mb-4 tracking-tight drop-shadow-md">
            No Pause
          </h1>
          <h2 className="text-sm md:text-lg font-serif font-semibold text-foreground/95 tracking-tight px-1 md:px-4 text-center">
            Real-time speaking analytics tool.
          </h2>
        </div>

        <div className="w-full relative z-10 bg-surface-elevated border border-border rounded-[24px] p-2 md:p-3 shadow-card elevation-card overflow-hidden">
          <SignIn
            routing="path"
            path="/auth"
            signUpUrl="/auth/sign-up"
            appearance={{
              elements: {
                footer: "hidden",
                card: "shadow-none border-none rounded-none bg-transparent w-full m-0 p-3 md:p-4",
                rootBox: "w-full",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                formFieldRow: "hidden",
                formButtonPrimary: "hidden",
                dividerRow: "hidden",
                socialButtonsBlockButton:
                  "border border-border bg-surface-base hover:bg-surface-card text-foreground rounded-[16px] transition-all min-h-[52px] h-14 md:h-16 shadow-sm hover:shadow-md",
                socialButtonsBlockButtonText: "font-sans font-semibold text-base md:text-lg text-foreground",
              },
            }}
          />
        </div>

        <div className="text-center text-sm text-muted-foreground font-sans relative z-10">
          New to No Pause? <Link to="/auth/sign-up" className="text-foreground font-semibold hover:text-primary transition-colors">Create account</Link>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
