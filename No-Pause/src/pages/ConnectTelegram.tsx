import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthContext";

type ConnectState = "missing" | "signing-in" | "connecting" | "success" | "error";

const ConnectTelegram = () => {
  const location = useLocation();
  const { isLoading, session, user } = useAuth();
  const [state, setState] = useState<ConnectState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittedConnectionKeysRef = useRef<Set<string>>(new Set());
  const sessionAccessToken = session?.access_token;
  const userId = user?.id;

  const telegramId = useMemo(() => {
    const value = new URLSearchParams(location.search).get("tg");
    return value && /^\d+$/.test(value) ? value : null;
  }, [location.search]);

  useEffect(() => {
    if (!telegramId) {
      setState("missing");
      return;
    }

    if (isLoading) {
      return;
    }

    if (!sessionAccessToken || !userId) {
      setState("signing-in");
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/connect?tg=${telegramId}`,
      )}`;

      void supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      }).catch((error) => {
        console.error("Telegram connect sign-in failed:", error);
        setErrorMessage("Google sign-in failed. Please try again from Telegram.");
        setState("error");
      });
      return;
    }

    let isCancelled = false;
    const connectionKey = `${telegramId}:${userId}`;
    if (submittedConnectionKeysRef.current.has(connectionKey)) {
      return;
    }
    submittedConnectionKeysRef.current.add(connectionKey);
    setState("connecting");

    void fetch("/api/telegram/connect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegram_id: Number(telegramId),
        user_id: userId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Telegram connection failed");
        }
      })
      .then(() => {
        if (!isCancelled) setState("success");
      })
      .catch((error) => {
        console.error("Telegram connect failed:", error);
        submittedConnectionKeysRef.current.delete(connectionKey);
        if (!isCancelled) {
          setErrorMessage("Could not connect Telegram. Please try the link again.");
          setState("error");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isLoading, sessionAccessToken, telegramId, userId]);

  const content = {
    missing: {
      icon: ShieldAlert,
      title: "Telegram link missing",
      body: "Open the connect link from the No Pause Telegram bot so we can identify your Telegram account.",
    },
    "signing-in": {
      icon: Loader2,
      title: "Opening Google sign-in",
      body: "After sign-in, you will come right back here to finish connecting Telegram.",
    },
    connecting: {
      icon: Loader2,
      title: "Connecting Telegram",
      body: "We are securely linking your Telegram account to No Pause.",
    },
    success: {
      icon: CheckCircle2,
      title: "You're all set!",
      body: "Go to @NoPauseAI_bot and send a voice message to start practicing.",
    },
    error: {
      icon: ShieldAlert,
      title: "Connection failed",
      body: errorMessage ?? "Could not connect Telegram. Please try again.",
    },
  }[state];

  const Icon = content.icon;
  const isLoadingState = state === "signing-in" || state === "connecting";
  const connectedEmail = user?.email;

  return (
    <main className="min-h-screen bg-surface-base flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-[24px] border border-border bg-surface-elevated/90 p-7 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-card text-primary">
          {isLoadingState ? <Icon className="animate-spin" size={24} /> : <Icon size={24} />}
        </div>
        <div className="mb-5 flex items-center justify-center gap-2 text-sm font-sans font-semibold text-muted-foreground">
          <MessageCircle size={16} />
          Telegram
        </div>
        <h1 className="mb-3 text-3xl font-serif font-medium text-foreground">{content.title}</h1>
        {state === "success" ? (
          <>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">{content.body}</p>
            {connectedEmail && (
              <div className="mt-6 rounded-2xl border border-border bg-surface-card px-4 py-3">
                <p className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Connected as
                </p>
                <p className="mt-1 break-words font-sans text-sm font-semibold text-foreground">{connectedEmail}</p>
              </div>
            )}
            <div className="my-6 h-px bg-border" />
            <a
              href="https://t.me/NoPauseAI_bot"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 font-sans text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Open Telegram
            </a>
          </>
        ) : (
          <p className="font-sans text-sm leading-relaxed text-muted-foreground">{content.body}</p>
        )}
      </section>
    </main>
  );
};

export default ConnectTelegram;
