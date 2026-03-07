import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const SignUpPage = () => {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-full max-w-sm md:max-w-md flex flex-col items-center gap-8">
        <div className="text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-4 tracking-tight">
            No Pause
          </h1>
          <h2 className="text-base md:text-lg font-serif font-semibold text-foreground/95 tracking-tight px-4 text-center">
            Real-time speaking analytics tool.
          </h2>
        </div>

        <div className="w-full relative z-10 bg-surface-elevated border border-border rounded-[24px] p-2 shadow-card elevation-card overflow-hidden">
          <SignUp
            routing="path"
            path="/auth/sign-up"
            signInUrl="/auth"
            appearance={{
              elements: {
                footer: "hidden",
                card: "shadow-none border-none rounded-none bg-transparent w-full m-0 p-4 md:p-6",
                rootBox: "w-full",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-border bg-surface-base hover:bg-surface-card text-foreground rounded-2xl transition-colors h-11",
                socialButtonsBlockButtonText: "font-sans font-medium text-foreground",
                formButtonPrimary:
                  "bg-primary hover:brightness-110 text-primary-foreground rounded-2xl font-semibold transition-all h-11",
                formFieldInput:
                  "bg-surface-base border border-border text-foreground rounded-xl h-11 px-4 focus:ring-1 focus:ring-primary focus:border-primary transition-colors",
                formFieldLabel: "text-muted-foreground font-sans text-xs mb-1.5",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground font-sans text-xs",
                identityPreviewText: "text-foreground font-sans",
                identityPreviewEditButton: "text-primary hover:text-primary/80",
                formFieldWarningText: "text-amber-500 text-xs mt-1",
                formFieldErrorText: "text-rose-500 text-xs mt-1",
              },
            }}
          />
        </div>

        <div className="text-center text-sm text-muted-foreground font-sans">
          Already have an account? <Link to="/auth" className="text-foreground font-semibold hover:text-primary transition-colors">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
