import { useMutation } from "convex/react";
import { api } from "./_generated/api";

type SessionMetrics = {
  duration: number;
  pauses: number;
  words: number;
};

export function useOnSessionEnd(userId: string) {
  const saveSession = useMutation(api.sessions.saveSession);

  return async function onSessionEnd(metrics: SessionMetrics) {
    await saveSession({
      userId,
      duration: metrics.duration,
      pauses: metrics.pauses,
      words: metrics.words,
    });
  };
}
