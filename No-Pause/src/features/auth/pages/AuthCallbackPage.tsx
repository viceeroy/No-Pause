import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthContext";

const AuthCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading, session } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  useEffect(() => {
    if (isLoading || authError) {
      return;
    }

    if (session) {
      navigate("/", { replace: true });
      return;
    }

    navigate("/auth", { replace: true });
  }, [authError, isLoading, navigate, session]);

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[24px] border border-border bg-surface-elevated/90 p-8 shadow-card text-center">
        <h1 className="text-2xl font-serif text-foreground mb-3">Google Sign-In</h1>
        {authError ? (
          <>
            <p className="text-sm font-sans text-muted-foreground leading-relaxed">
              {decodeURIComponent(authError)}
            </p>
            <Link
              to="/auth"
              className="inline-flex mt-6 items-center justify-center rounded-full border border-border bg-surface-base px-5 py-3 text-sm font-sans font-semibold text-foreground transition-colors hover:bg-surface-card"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-sm font-sans text-muted-foreground">
            Finishing your Google sign-in securely...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
