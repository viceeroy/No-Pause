import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Check, Copy, FileText, MessageSquare, Mic, Pause, Quote, Share2, Timer, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Confetti from '@/shared/components/Confetti';
import type { SessionResult } from './types';
import { formatMMSS } from './time';

type ResultPanelProps = {
  lastResults: SessionResult;
  showResultsDebugExport: boolean;
  handleRetry: () => void;
  requestFeedback: () => void;
  requestTranscription: () => void;
  copied: boolean;
  setCopied: React.Dispatch<React.SetStateAction<boolean>>;
};

interface CustomWindow extends Window {
  __nopauseExportLogs?: () => void;
}

export function ResultPanel({
  lastResults,
  showResultsDebugExport,
  handleRetry,
  requestFeedback,
  requestTranscription,
  copied,
  setCopied,
}: ResultPanelProps) {
  const navigate = useNavigate();
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const copyText = async (text: string, onCopied: (copied: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    onCopied(true);
    setTimeout(() => onCopied(false), 2000);
  };
  const renderDurationText = (seconds: number) => formatMMSS(seconds);

  const getCoachingNote = () => {
    if (lastResults.flowScore === 0) return '';
    if (lastResults.hesitationCount > 5) return 'Try to reduce pauses — aim for fewer silence gaps';
    if (speakingTargetPercent < 50) return 'Try to fill more of the session with speech';
    if (lastResults.flowScore > 80) return 'Great flow — keep it up';
    return 'Keep building steady, continuous speech';
  };
  const speakingTargetPercent = useMemo(() => {
    if (!lastResults.totalSessionTime || lastResults.totalSessionTime <= 0) return 0;
    const raw = (lastResults.totalSpeakingTime / lastResults.totalSessionTime) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [lastResults.totalSessionTime, lastResults.totalSpeakingTime]);
  const scoreWidth = Math.max(0, Math.min(100, (lastResults.flowScore / 500) * 100));
  const transcript = (lastResults.transcript || '').trim();
  const transcriptReady =
    transcript.length > 0 &&
    transcript !== 'No speech detected.' &&
    !transcript.startsWith('Transcription failed');
  const showTranscribeButton = !!lastResults.audioBlob && !transcriptReady;
  const feedbackAvailable = !!lastResults.analysisFeedback || lastResults.analysisFeedbackLoading;
  const speakingTime = Math.max(0, lastResults.totalSpeakingTime || 0);
  const sessionLength = Math.max(0, lastResults.totalSessionTime || 0);
  const pauseCount = Math.max(0, Math.round(Number(lastResults.pauseCount ?? lastResults.hesitationCount ?? 0)));
  const fillerCount = Math.max(0, Math.round(Number(lastResults.fillerCount ?? 0)));
  const coachingNote = getCoachingNote();
  const statusNote = speakingTime < 5
    ? 'Session was too short to score. Speak for at least 5 seconds.'
    : lastResults.statusNote;

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      {lastResults.flowScore >= 200 && <Confetti />}
      <div className="mb-8 text-left">
        <h2 className="mb-2 text-3xl font-serif font-medium text-foreground md:text-5xl">Results</h2>
        {coachingNote && (
          <p className="text-sm font-sans text-muted-foreground md:text-base">{coachingNote}</p>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-[28px] border border-border bg-surface-card p-6 text-left shadow-card md:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-sans font-black uppercase tracking-[0.14em] text-muted-foreground">Flow Score</p>
              <p className="font-serif text-7xl font-medium leading-none text-primary md:text-8xl">{lastResults.flowScore}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
              <TrendingUp size={22} />
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full rounded-full bg-primary" style={{ width: `${scoreWidth}%` }} />
          </div>
          {statusNote && (
            <p className="mt-3 text-sm font-sans text-muted-foreground">{statusNote}</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 md:gap-4">
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Timer size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Speaking time</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {renderDurationText(speakingTime)}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Activity size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Session length</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {renderDurationText(sessionLength)}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Pause size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Pauses</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">{pauseCount}</p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Quote size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Fillers</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">{fillerCount}</p>
          </article>
        </section>

        <section className="rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-serif font-medium text-foreground">
              <MessageSquare size={20} className="text-primary" /> Feedback
            </h3>
            {lastResults.analysisFeedback && !lastResults.analysisFeedbackLoading ? (
              <button
                type="button"
                onClick={() => copyText(lastResults.analysisFeedback || '', setCopiedFeedback)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 text-xs font-sans font-bold text-foreground transition-colors btn-press hover:bg-surface-interactive"
              >
                {copiedFeedback ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                {copiedFeedback ? 'Copied' : 'Copy'}
              </button>
            ) : null}
          </div>
          {feedbackAvailable ? (
            lastResults.analysisFeedbackLoading ? (
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">Generating feedback...</p>
            ) : (
              <div className="font-sans text-sm leading-relaxed text-foreground">
                <ReactMarkdown>{lastResults.analysisFeedback || 'AI feedback unavailable.'}</ReactMarkdown>
              </div>
            )
          ) : (
            <>
              <p className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
                {getCoachingNote()} You spoke for {Math.round(speakingTargetPercent)}% of the session.
              </p>
              <button
                type="button"
                onClick={() => requestFeedback()}
                disabled={lastResults.analysisFeedbackLoading}
                className="rounded-full border border-border bg-surface-elevated px-5 py-2.5 text-sm font-sans font-bold text-foreground btn-press hover:bg-surface-interactive disabled:opacity-60"
              >
                Get AI Feedback
              </button>
            </>
          )}
          {lastResults.analysisFeedbackError && (
            <p className="mt-3 text-sm font-sans text-destructive">{lastResults.analysisFeedbackError}</p>
          )}
        </section>

        <section className="rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-serif font-medium text-foreground">
              <FileText size={20} className="text-primary" /> Transcript
            </h3>
            {transcriptReady ? (
              <button
                type="button"
                onClick={() => copyText(transcript, setCopiedTranscript)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 text-xs font-sans font-bold text-foreground transition-colors btn-press hover:bg-surface-interactive"
              >
                {copiedTranscript ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                {copiedTranscript ? 'Copied' : 'Copy'}
              </button>
            ) : null}
          </div>
          {transcriptReady ? (
            <p className="font-sans text-sm leading-relaxed text-foreground">{lastResults.transcript}</p>
          ) : (
            <>
              <p className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
                {lastResults.transcriptionLoading ? 'Transcribing audio...' : 'Transcript is not ready yet.'}
              </p>
              {showTranscribeButton && (
                <button
                  type="button"
                  onClick={() => requestTranscription()}
                  disabled={lastResults.transcriptionLoading}
                  className="rounded-full border border-border bg-surface-elevated px-5 py-2.5 text-sm font-sans font-bold text-foreground btn-press hover:bg-surface-interactive disabled:opacity-60"
                >
                  {lastResults.transcriptionLoading ? 'Transcribing...' : (lastResults.transcriptionError ? 'Retry Transcription' : 'Transcribe')}
                </button>
              )}
              {lastResults.transcriptionError && (
                <p className="mt-3 text-sm font-sans text-destructive">{lastResults.transcriptionError}</p>
              )}
            </>
          )}
        </section>

        {showResultsDebugExport && (
          <button
            type="button"
            onClick={() => {
              const exportFn = (window as CustomWindow).__nopauseExportLogs;
              if (typeof exportFn === 'function') exportFn();
            }}
            className="text-left text-xs font-sans text-muted-foreground/80 underline-offset-2 hover:underline"
          >
            Having issues? Export debug file
          </button>
        )}

        <div className="grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <button
            onClick={handleRetry}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110"
          >
            <Mic size={18} /> Practice Again
          </button>
          <button
            onClick={async () => {
              const shareTranscript = lastResults.transcript || '';
              const shareText = `I just completed Speaking Mode on No Pause 🎤\n\nSpeaking time: ${formatMMSS(lastResults.totalSpeakingTime)}\nPause units: ${pauseCount}\nFillers: ${fillerCount}\n\nTranscript:\n"${shareTranscript.slice(0, 100)}${shareTranscript.length > 100 ? '...' : ''}"\n\nTrain your speaking No Pause`;
              const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
              if (isMobile && navigator.share) {
                try { await navigator.share({ text: shareText }); } catch (e) {
                  if (e instanceof Error && e.name !== 'AbortError') {
                    console.warn('Share failed:', e);
                  }
                }
              } else {
                try {
                  await navigator.clipboard.writeText(shareText);
                } catch {
                  const ta = document.createElement('textarea');
                  ta.value = shareText;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  document.body.removeChild(ta);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-border bg-surface-card px-6 text-base font-sans font-black text-foreground btn-press hover:bg-surface-elevated"
          >
            {copied ? (
              <>
                <Check size={18} className="text-primary" /> Copied
              </>
            ) : (
              <>
                <Share2 size={18} /> Share Results
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[56px] rounded-full border border-border bg-surface-card px-8 text-base font-sans font-black text-foreground btn-press hover:bg-surface-elevated"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
