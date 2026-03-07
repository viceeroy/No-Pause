import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const AuthPage = () => {
  return (
    <div
      className="auth-layout"
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.08fr 0.92fr",
        background: "#eef1f6",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes floatOrb {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-18px) translateX(10px); }
          100% { transform: translateY(0px) translateX(0px); }
        }

        @keyframes waveGlow {
          0% { opacity: 0.42; transform: translateX(0); }
          50% { opacity: 0.7; transform: translateX(10px); }
          100% { opacity: 0.42; transform: translateX(0); }
        }

        @media (max-width: 1024px) {
          .auth-layout {
            grid-template-columns: 1fr !important;
          }
          .auth-divider {
            display: none !important;
          }
          .auth-brand {
            min-height: 40vh;
            padding: 34px !important;
          }
          .auth-panel {
            padding: 26px !important;
          }
        }
      `}</style>

      <div
        className="auth-divider"
        style={{
          position: "absolute",
          top: 0,
          left: "54%",
          width: 120,
          height: "100%",
          background: "linear-gradient(90deg, rgba(14,26,53,0.36) 0%, rgba(14,26,53,0.0) 100%)",
          transform: "skewX(-13deg)",
          transformOrigin: "top",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      <section
        className="auth-brand"
        style={{
          position: "relative",
          background: "radial-gradient(circle at 14% 24%, #203a78 0%, #0f1c39 46%, #0a1329 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0) 68%)",
            top: "12%",
            left: "8%",
            animation: "floatOrb 8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,212,191,0.2) 0%, rgba(45,212,191,0) 68%)",
            bottom: "2%",
            right: "8%",
            animation: "floatOrb 10s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "auto 0 12% 0",
            height: 90,
            background: "repeating-linear-gradient(90deg, rgba(56,189,248,0.1) 0 8px, rgba(56,189,248,0) 8px 22px)",
            filter: "blur(0.2px)",
            animation: "waveGlow 6s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 560, position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 13px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.14)",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 22,
            }}
          >
            No Pause
          </div>
          <h1
            style={{
              fontSize: "clamp(42px, 5.3vw, 72px)",
              margin: "0 0 16px 0",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              background: "linear-gradient(180deg, #ffffff 0%, #cae2ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 8px 32px rgba(59,130,246,0.25)",
            }}
          >
            Speak smoother. Track progress. Build fluency.
          </h1>
          <p style={{ margin: 0, color: "rgba(227,236,255,0.9)", fontSize: 21, lineHeight: 1.48, maxWidth: 500 }}>
            Practice speaking with real-time pause detection and measurable sessions that move your fluency forward.
          </p>
        </div>
      </section>

      <section
        className="auth-panel"
        style={{
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "36px 46px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", color: "#0f172a" }}>NO PAUSE</div>
            <div style={{ marginTop: 7, fontSize: 14, color: "#475569" }}>Welcome back. Sign in to continue.</div>
          </div>

          <SignIn
            routing="path"
            path="/auth"
            appearance={{
              elements: {
                footer: "hidden",
                card: "shadow-none border-none rounded-none bg-transparent",
                rootBox: "w-full",
                socialButtonsBlockButton:
                  "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all",
                socialButtonsBlockButtonText: "font-medium",
                formButtonPrimary:
                  "bg-[#0f766e] hover:bg-[#115e59] text-white rounded-xl font-semibold transition-all",
              },
            }}
          />

          <div style={{ textAlign: "center", padding: "10px 0 4px", fontSize: 14, color: "#475569" }}>
            New to No Pause? <Link to="/auth/sign-up" style={{ color: "#0f172a", fontWeight: 700 }}>Create account</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AuthPage;
