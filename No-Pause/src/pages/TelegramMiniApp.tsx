import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, BarChart3, Clock, Flame, Loader2, MessageCircle, Mic, Send, Square } from "lucide-react";

const MIN_RECORDING_SECONDS = 5;

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

type MiniAppSession = {
  id: string;
  created_at: string | null;
  duration_seconds: number;
  flow_score: number | null;
  mode: string | null;
  speaking_time_seconds: number;
  hesitation_count: number;
};

type MiniAppData = {
  connected: boolean;
  connectUrl?: string;
  telegramUser?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  stats?: {
    currentStreak: number;
    longestStreak: number;
    totalSessions: number;
    totalPracticeTime: number;
    overallFlow: number | null;
    latestSession: MiniAppSession | null;
    recentSessions: MiniAppSession[];
  };
};

type RecordingState = "idle" | "recording" | "analyzing";

type AnalyzeResult = {
  session_id?: string;
  sessionId?: string;
  id?: string;
  transcript?: string;
  flow_score?: number | null;
  flowScore?: number | null;
  hesitation_count?: number;
  hesitationCount?: number;
  pauses?: number;
  speaking_time_seconds?: number;
  speakingTimeSec?: number;
  speaking_time?: number;
  duration_seconds?: number;
  duration?: number;
  words?: number;
  session?: Partial<MiniAppSession>;
  result?: Partial<AnalyzeResult>;
};

function getDurationParts(seconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  return {
    mins: Math.floor(safeSeconds / 60),
    secs: safeSeconds % 60,
  };
}

function formatDuration(seconds: number | null | undefined) {
  const { mins, secs } = getDurationParts(seconds);
  return `${mins}m ${secs}s`;
}

function formatDate(isoString: string | null | undefined) {
  if (!isoString) return "Unknown";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFlow(score: number | null | undefined) {
  return score === null || score === undefined ? "N/A" : String(score);
}

function getTelegramWebApp() {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

function getTelegramInitData() {
  if (typeof window === "undefined") return "";

  const webAppInitData = window.Telegram?.WebApp?.initData;
  if (webAppInitData) return webAppInitData;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.get("tgWebAppData") ?? "";
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function normalizeAnalyzeResult(payload: AnalyzeResult): MiniAppSession & { transcript: string } {
  const result = payload.result ?? payload;
  const session = payload.session ?? {};
  const flowScore = result.flow_score ?? result.flowScore ?? session.flow_score ?? null;
  const pauses = result.hesitation_count ?? result.hesitationCount ?? result.pauses ?? session.hesitation_count ?? 0;
  const speakingTime =
    result.speaking_time_seconds ?? result.speakingTimeSec ?? result.speaking_time ?? session.speaking_time_seconds ?? 0;
  const duration = result.duration_seconds ?? result.duration ?? session.duration_seconds ?? speakingTime;

  return {
    id: String(result.session_id ?? result.sessionId ?? result.id ?? session.id ?? crypto.randomUUID()),
    created_at: session.created_at ?? new Date().toISOString(),
    duration_seconds: Number(duration || 0),
    flow_score: flowScore === null || flowScore === undefined ? null : Number(flowScore),
    mode: session.mode ?? "free_speaking",
    speaking_time_seconds: Number(speakingTime || duration || 0),
    hesitation_count: Number(pauses || 0),
    transcript: String(result.transcript ?? ""),
  };
}

export default function TelegramMiniApp() {
  const [data, setData] = useState<MiniAppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingResult, setRecordingResult] = useState<(MiniAppSession & { transcript: string }) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    webApp?.ready?.();
    webApp?.expand?.();

    const initData = getTelegramInitData();
    if (!initData) {
      setLoading(false);
      setError("Open this dashboard from @NoPauseAI_bot in Telegram.");
      return;
    }

    let cancelled = false;
    fetch("/api/telegram/miniapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load Telegram dashboard.");
        }
        return payload as MiniAppData;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const displayName = useMemo(() => {
    const user = data?.telegramUser;
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    return fullName || user?.username || "NoPause";
  }, [data?.telegramUser]);

  const openBot = () => {
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink("https://t.me/NoPauseAI_bot");
      return;
    }
    window.location.href = "https://t.me/NoPauseAI_bot";
  };

  const openConnect = () => {
    if (data?.connectUrl) {
      window.location.href = data.connectUrl;
    }
  };

  const closeToChat = () => {
    const webApp = getTelegramWebApp();
    if (webApp?.close) {
      webApp.close();
      return;
    }
    openBot();
  };

  const refreshStatsWithResult = (session: MiniAppSession) => {
    setData((current) => {
      if (!current?.stats) return current;

      const existingRecent = current.stats.recentSessions.filter((item) => item.id !== session.id);
      const recentSessions = [session, ...existingRecent].slice(0, 12);
      const previousTotalSessions = current.stats.recentSessions.some((item) => item.id === session.id)
        ? current.stats.totalSessions
        : current.stats.totalSessions + 1;
      const previousTotalPracticeTime = current.stats.recentSessions.some((item) => item.id === session.id)
        ? current.stats.totalPracticeTime
        : current.stats.totalPracticeTime + session.duration_seconds;
      const scoreValues = [
        ...recentSessions.map((item) => item.flow_score),
      ].filter((score): score is number => typeof score === "number" && score > 0);

      return {
        ...current,
        stats: {
          ...current.stats,
          totalSessions: previousTotalSessions,
          totalPracticeTime: previousTotalPracticeTime,
          latestSession: session,
          recentSessions,
          overallFlow: scoreValues.length
            ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
            : current.stats.overallFlow,
        },
      };
    });
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const analyzeRecording = async (audioBlob: Blob, durationSeconds: number) => {
    const telegramId = data?.telegramUser?.id;
    if (!telegramId) {
      throw new Error("Telegram user was not found. Reopen the Mini App from Telegram and try again.");
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, `nopause-${Date.now()}.webm`);
    formData.append("telegram_id", String(telegramId));
    formData.append("duration", String(durationSeconds));

    const initData = getTelegramInitData();
    if (initData) {
      formData.append("init_data", initData);
    }

    const response = await fetch("/api/telegram/analyze", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = String(payload?.error ?? "Could not analyze that recording. Please try again.");
      if (/transcript|speech|empty|hear/i.test(message)) {
        throw new Error("I could not hear enough speech in that recording. Try again a little closer to the mic.");
      }
      throw new Error(message);
    }

    const normalized = normalizeAnalyzeResult(payload as AnalyzeResult);
    if (!normalized.transcript.trim()) {
      throw new Error("I could not hear enough speech in that recording. Try again a little closer to the mic.");
    }

    setRecordingResult(normalized);
    refreshStatsWithResult(normalized);
  };

  const startRecording = async () => {
    setRecordingError(null);
    setRecordingResult(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Voice recording is not supported in this Telegram browser. Send a voice note in the bot chat instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecordingState("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });

        stopStream();
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (durationSeconds < MIN_RECORDING_SECONDS) {
          setRecordingState("idle");
          setRecordingError(`Record for at least ${MIN_RECORDING_SECONDS} seconds before submitting.`);
          return;
        }

        if (audioBlob.size === 0) {
          setRecordingState("idle");
          setRecordingError("The recording was empty. Check your microphone and try again.");
          return;
        }

        setRecordingState("analyzing");
        void analyzeRecording(audioBlob, durationSeconds)
          .catch((nextError) => {
            setRecordingError(nextError instanceof Error ? nextError.message : String(nextError));
          })
          .finally(() => {
            setRecordingState("idle");
          });
      };

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      recorder.start();
    } catch (nextError) {
      stopStream();
      const denied = nextError instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(nextError.name);
      setRecordingState("idle");
      setRecordingError(
        denied
          ? "Microphone permission was denied. Allow microphone access in Telegram or your browser settings, then try again."
          : "Could not start the microphone. Please try again.",
      );
    }
  };

  const stopRecording = () => {
    if (recordingState !== "recording") return;

    if (recordingSeconds < MIN_RECORDING_SECONDS) {
      setRecordingError(`Keep speaking for at least ${MIN_RECORDING_SECONDS} seconds.`);
      return;
    }

    recorderRef.current?.stop();
  };

  const StatCard = ({ icon: Icon, label, value }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="min-h-[102px] rounded-[18px] border border-white/10 bg-[#121A2B] p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-sans text-muted-foreground">{label}</p>
        <span className="rounded-lg border border-white/10 bg-[#182235] p-1.5 text-primary">
          <Icon size={15} />
        </span>
      </div>
      <p className="font-serif text-2xl leading-none text-foreground">{value}</p>
    </div>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center text-sm text-muted-foreground">
          Loading NoPause...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <section className="mx-auto max-w-md rounded-[20px] border border-white/10 bg-[#121A2B] p-6 text-center shadow-card">
          <h1 className="mb-3 font-serif text-3xl text-foreground">NoPause</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={openBot}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-sans text-sm font-bold text-primary-foreground"
          >
            <MessageCircle size={16} />
            Open bot
          </button>
        </section>
      </main>
    );
  }

  if (data && !data.connected) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <section className="mx-auto max-w-md rounded-[20px] border border-white/10 bg-[#121A2B] p-6 shadow-card">
          <p className="mb-2 text-sm font-sans text-primary">Telegram Mini App</p>
          <h1 className="mb-3 font-serif text-3xl text-foreground">Connect NoPause</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Link your NoPause account once, then this dashboard will show your streak, Flow Score, and recent voice sessions inside Telegram.
          </p>
          <button
            type="button"
            onClick={openConnect}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 font-sans text-sm font-bold text-primary-foreground"
          >
            Connect account
          </button>
        </section>
      </main>
    );
  }

  const stats = data?.stats;
  const latest = stats?.latestSession ?? null;
  const canStopRecording = recordingState === "recording" && recordingSeconds >= MIN_RECORDING_SECONDS;

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-5 text-foreground">
      <div className="mx-auto max-w-md">
        {latest ? (
          <section className="mb-4 rounded-[20px] border border-primary/25 bg-[#121A2B] p-5 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-sans text-muted-foreground">Latest result</p>
                <h1 className="mt-1 truncate font-serif text-2xl text-foreground">{displayName}</h1>
              </div>
              <div className="text-right">
                <p className="font-serif text-4xl leading-none text-primary">{formatFlow(latest.flow_score)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Flow</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#182235] p-3">
                <p className="text-xs text-muted-foreground">Pauses</p>
                <p className="mt-1 font-serif text-xl text-foreground">{latest.hesitation_count}</p>
              </div>
              <div className="rounded-2xl bg-[#182235] p-3">
                <p className="text-xs text-muted-foreground">Speaking time</p>
                <p className="mt-1 font-serif text-xl text-foreground">{formatDuration(latest.speaking_time_seconds || latest.duration_seconds)}</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-4 rounded-[20px] border border-white/10 bg-[#121A2B] p-5 text-center shadow-card">
            <h2 className="mb-2 font-serif text-2xl text-foreground">No sessions yet</h2>
            <p className="mb-5 text-sm text-muted-foreground">Send a voice note to get your first Flow Score.</p>
            <button
              type="button"
              onClick={closeToChat}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-sans text-sm font-bold text-primary-foreground"
            >
              <Send size={16} />
              Send voice note
            </button>
          </section>
        )}

        <section className="mb-4 rounded-[20px] border border-white/10 bg-[#121A2B] p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-sans text-muted-foreground">Practice now</p>
              <h2 className="mt-1 font-serif text-2xl text-foreground">Record in Mini App</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#182235] px-3 py-2 font-serif text-2xl text-primary">
              {formatDuration(recordingSeconds)}
            </div>
          </div>

          {recordingState === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              disabled={!canStopRecording}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-sans text-sm font-bold text-primary-foreground shadow-float disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square size={16} />
              {canStopRecording ? "Stop and analyze" : `Keep speaking ${MIN_RECORDING_SECONDS - recordingSeconds}s`}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={recordingState === "analyzing"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-sans text-sm font-bold text-primary-foreground shadow-float disabled:cursor-not-allowed disabled:opacity-60"
            >
              {recordingState === "analyzing" ? <Loader2 className="animate-spin" size={16} /> : <Mic size={16} />}
              {recordingState === "analyzing" ? "Analyzing..." : "Start recording"}
            </button>
          )}

          {recordingState === "recording" && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Minimum {MIN_RECORDING_SECONDS} seconds. Speak freely and stay close to the mic.
            </p>
          )}

          {recordingError && (
            <div className="mt-4 flex gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
              <AlertCircle className="mt-0.5 flex-shrink-0" size={16} />
              <p>{recordingError}</p>
            </div>
          )}

          {recordingResult && (
            <div className="mt-4 rounded-2xl border border-primary/25 bg-[#182235] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">New result</p>
                  <p className="mt-1 font-serif text-2xl text-foreground">{formatFlow(recordingResult.flow_score)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{formatDuration(recordingResult.speaking_time_seconds || recordingResult.duration_seconds)}</p>
                  <p>{recordingResult.hesitation_count} pauses</p>
                </div>
              </div>
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{recordingResult.transcript}</p>
            </div>
          )}
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3">
          <StatCard icon={Flame} label="Streak" value={`${stats?.currentStreak ?? 0}/${stats?.longestStreak ?? 0}`} />
          <StatCard icon={BarChart3} label="Overall Flow" value={formatFlow(stats?.overallFlow)} />
          <StatCard icon={Activity} label="Sessions" value={stats?.totalSessions ?? 0} />
          <StatCard icon={Clock} label="Practice Time" value={formatDuration(stats?.totalPracticeTime)} />
        </section>

        {(stats?.recentSessions?.length ?? 0) > 0 && (
          <section className="mb-5">
            <h2 className="mb-3 font-serif text-xl text-foreground">Recent</h2>
            <div className="space-y-2">
              {stats?.recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#121A2B] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{formatDate(session.created_at)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDuration(session.duration_seconds)}
                    </p>
                  </div>
                  <p className="flex-shrink-0 font-serif text-2xl text-primary">{formatFlow(session.flow_score)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={closeToChat}
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto inline-flex min-h-12 max-w-md items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-sans text-sm font-bold text-primary-foreground shadow-float"
        >
          <Send size={16} />
          Send another voice note
        </button>
      </div>
    </main>
  );
}
