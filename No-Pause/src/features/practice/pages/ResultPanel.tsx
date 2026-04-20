import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText, MessageSquare, Share2, Volume2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { VoicePlayer } from '../components/VoicePlayer';
import Confetti from '@/shared/components/Confetti';
import { cn } from '@/shared/lib/utils';
import {
  LEMON_MIN_SPEAKING_SECONDS,
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_SPEAKING_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '../lib/scoringConstants';
import type { SessionResult } from './types';
import { formatMMSS, toMMSS } from './time';

type ResultPanelProps = {
  mode: string;
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
  mode,
  lastResults,
  showResultsDebugExport,
  handleRetry,
  requestFeedback,
  requestTranscription,
  copied,
  setCopied,
}: ResultPanelProps) {
  const navigate = useNavigate();
  const showWordCount = typeof lastResults.wordCount === 'number' && lastResults.wordCount > 0;
  const renderDurationValue = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return (
      <>
        {mins}
        <span className="ml-1 text-xs md:text-sm font-sans font-semibold text-muted-foreground/80">m</span>
        <span className="ml-2">
          {secs}
          <span className="ml-1 text-xs md:text-sm font-sans font-semibold text-muted-foreground/80">s</span>
        </span>
      </>
    );
  };
  const getScoreHeadline = (score: number) => {
    if (score >= 100) return 'Flawless Flow!';
    if (score >= 95) return 'Near Perfect!';
    if (score >= 90) return 'Almost Flawless!';
    if (score >= 80) return 'Strong Performance!';
    if (score >= 70) return 'Good Momentum!';
    if (score >= 60) return 'Solid Effort!';
    if (score >= 50) return 'Building Consistency!';
    if (score >= 40) return 'Keep Practicing!';
    return 'Just Getting Started!';
  };

  const speakingTargetPercent = useMemo(() => {
    if (!lastResults.totalSessionTime || lastResults.totalSessionTime <= 0) return 0;
    const raw = (lastResults.totalSpeakingTime / lastResults.totalSessionTime) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [lastResults.totalSessionTime, lastResults.totalSpeakingTime]);

  const [animatedSpeakingPercent, setAnimatedSpeakingPercent] = useState(0);

  useEffect(() => {
    const durationMs = 800;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = progress * progress * progress; // ease-in
      setAnimatedSpeakingPercent(speakingTargetPercent * eased);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    setAnimatedSpeakingPercent(0);
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [speakingTargetPercent, lastResults.totalSessionTime, lastResults.totalSpeakingTime]);

  return (
    <div className="text-center">
      {lastResults.flowScore === 100 && <Confetti />}
      <div className="mb-12">
        <div className="w-20 h-20 bg-surface-card border border-border/80 rounded-full flex items-center justify-center mx-auto mb-6 night-glow">
          <Zap size={32} className="text-primary" />
        </div>
        <h2 className="text-3xl font-serif font-medium text-foreground mb-3">
          {getScoreHeadline(lastResults.flowScore)}
        </h2>
        <p className="text-muted-foreground font-sans">
          {lastResults.flowScore === 100
            ? 'Flawless performance — you nailed it!'
            : lastResults.flowScore >= 90
              ? `Spoke smoothly with just ${lastResults.hesitationCount} pause${lastResults.hesitationCount !== 1 ? 's' : ''} — nearly perfect!`
              : lastResults.flowScore >= 75
                ? `Solid flow with only ${lastResults.hesitationCount} hesitation${lastResults.hesitationCount !== 1 ? 's' : ''}.`
                : lastResults.flowScore >= 60
                  ? `${lastResults.hesitationCount} hesitation${lastResults.hesitationCount !== 1 ? 's' : ''} detected — you're getting there!`
                  : lastResults.flowScore >= 40
                    ? `Try to reduce pauses and keep your speech continuous.`
                    : `Focus on speaking continuously — ${lastResults.hesitationCount} hesitation${lastResults.hesitationCount !== 1 ? 's' : ''} slowed you down`}
        </p>
      </div>

      <div className="mb-12">
        <h3 className="text-lg font-serif font-medium text-foreground mb-4 text-left">Performance Stats</h3>
        {mode === 'lemon' && !lastResults.statusNote && (
          <p className="text-xs font-sans mb-3 text-left text-muted-foreground">
            Scoring rule: speak for at least {toMMSS(LEMON_MIN_SPEAKING_SECONDS)} with a {toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session.
          </p>
        )}
        {mode === 'topic' && !lastResults.statusNote && (
          <p className="text-xs font-sans mb-3 text-left text-muted-foreground">
            Scoring rule: speak for at least {toMMSS(TOPIC_MIN_SPEAKING_SECONDS)} with a {toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session.
          </p>
        )}
        <div
          className={cn(
            'grid gap-3',
            mode === 'free'
              ? showWordCount
                ? 'grid-cols-3'
                : 'grid-cols-2'
              : showWordCount
                ? 'grid-cols-4'
                : 'grid-cols-3',
          )}
        >
          <div className="p-4 md:p-6 night-panel rounded-2xl md:rounded-3xl flex flex-col items-center justify-center">
            <p className="text-xs text-muted-foreground font-sans mb-1.5">Duration</p>
            <p className="text-3xl md:text-4xl font-serif font-medium text-primary">
              {renderDurationValue(lastResults.totalSessionTime)}
            </p>
          </div>
          {mode !== 'free' && (
            <div className="p-4 md:p-6 night-panel rounded-2xl md:rounded-3xl flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground font-sans mb-1.5">Flow Score</p>
              <p className="text-3xl md:text-4xl font-serif font-medium text-primary">{lastResults.flowScore}</p>
            </div>
          )}
          <div className="p-4 md:p-6 night-panel rounded-2xl md:rounded-3xl flex flex-col items-center justify-center">
            <p className="text-xs text-muted-foreground font-sans mb-1.5">Hesitations</p>
            <p className="text-3xl md:text-4xl font-serif font-medium text-ember-600">{lastResults.hesitationCount}</p>
          </div>
          {showWordCount && (
            <div className="p-4 md:p-6 night-panel rounded-2xl md:rounded-3xl flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground font-sans mb-1.5">Words</p>
              <p className="text-3xl md:text-4xl font-serif font-medium text-primary">{lastResults.wordCount}</p>
            </div>
          )}
        </div>
        <div className="mt-4 p-4 md:p-5 night-panel rounded-2xl md:rounded-3xl text-left">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-sans mb-2">Speaking Time</p>
          <p className="text-sm md:text-base text-foreground font-sans mb-3">
            You spoke {Math.round(animatedSpeakingPercent)}% of the time
          </p>
          <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${animatedSpeakingPercent}%` }}
            />
          </div>
        </div>
        {showResultsDebugExport && (
          <div className="mt-2 md:mt-3 text-left">
            <button
              type="button"
              onClick={() => {
                const exportFn = (window as CustomWindow).__nopauseExportLogs;
                if (typeof exportFn === 'function') exportFn();
              }}
              className="text-xs font-sans text-muted-foreground/80 hover:underline underline-offset-2 transition-colors"
            >
              Having issues? Export debug file
            </button>
          </div>
        )}
        {mode === 'free' && (
          <p className="mt-3 text-xs text-muted-foreground font-sans text-left">
            💡 Free Speaking is practice only — no flow score is awarded in this mode.
          </p>
        )}
        {mode === 'lemon' && (!lastResults.isCompleted || lastResults.flowScore === 0) && (
          <p className="mt-3 text-xs text-muted-foreground font-sans text-left">
            💡 To earn a flow score, you need to complete the full 1:00 and speak for at least 30 seconds.
          </p>
        )}
        {mode === 'topic' && (!lastResults.isCompleted || lastResults.flowScore === 0) && (
          <p className="mt-3 text-xs text-muted-foreground font-sans text-left">
            💡 To earn a flow score, you need to complete the full 2:00 and speak for at least 60 seconds.
          </p>
        )}
      </div>

      <div className="mb-16">
        <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
          <Volume2 size={20} className="text-primary" /> Voice Recording
        </h3>
        <div className="p-4 sm:p-8 night-panel rounded-3xl">
          {lastResults.audioBlob ? (
            <VoicePlayer audioBlob={lastResults.audioBlob} audioMimeType={lastResults.audioMimeType} />
          ) : (
            <div className="text-center py-8">
              <Volume2 size={48} className="text-muted-foreground/60 mx-auto mb-4" />
              <p className="text-muted-foreground font-sans">Audio recording will be available here</p>
            </div>
          )}
        </div>

        {(() => {
          const transcript = (lastResults.transcript || '').trim();
          const transcriptReady =
            transcript.length > 0 &&
            transcript !== 'No speech detected.' &&
            !transcript.startsWith('Transcription failed');
          const showTranscribeButton = !!lastResults.audioBlob && !transcriptReady;

          if (!showTranscribeButton) return null;

          return (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => requestTranscription()}
                disabled={lastResults.transcriptionLoading}
                className="px-6 py-3 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-black btn-press transition-all duration-300 disabled:opacity-60"
              >
                {lastResults.transcriptionLoading ? 'Transcribing…' : (lastResults.transcriptionError ? 'Retry Transcription' : 'Transcribe')}
              </button>
              {lastResults.transcriptionError && (
                <p className="mt-2 text-sm text-amber-200/90 font-sans">
                  {lastResults.transcriptionError}
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {(() => {
        const transcript = (lastResults.transcript || '').trim();
        const transcriptReady =
          transcript.length > 0 &&
          transcript !== 'No speech detected.' &&
          !transcript.startsWith('Transcription failed');

        if (!transcriptReady) return null;

        return (
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <FileText size={20} className="text-primary" /> Speech Transcript
            </h3>
            <div className="p-8 night-panel rounded-3xl">
              <p className="text-foreground font-sans leading-relaxed text-left">{lastResults.transcript}</p>
            </div>
            {!lastResults.analysisFeedback && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => requestFeedback()}
                  disabled={lastResults.analysisFeedbackLoading}
                  className="px-6 py-3 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-black btn-press transition-all duration-300 disabled:opacity-60"
                >
                  {lastResults.analysisFeedbackLoading
                    ? 'Getting AI Feedback…'
                    : (lastResults.analysisFeedbackError ? 'Retry AI Feedback' : 'Get AI Feedback')}
                </button>
                {lastResults.analysisFeedbackError && (
                  <p className="mt-2 text-sm text-amber-200/90 font-sans">
                    {lastResults.analysisFeedbackError}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {(lastResults.analysisFeedback || lastResults.analysisFeedbackLoading) && (
        <div className="mb-16">
          <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" /> AI Feedback
          </h3>
          <div className="p-8 night-panel rounded-3xl">
            {lastResults.analysisFeedbackLoading ? (
              <p className="text-foreground font-sans leading-relaxed text-left">
                Generating feedback…
              </p>
            ) : (
              <div className="text-foreground font-sans leading-relaxed text-left">
                <ReactMarkdown>
                  {lastResults.analysisFeedback || 'AI feedback unavailable.'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}


      <div className="flex flex-wrap justify-center gap-4">
        <button onClick={handleRetry} className="px-8 py-4 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press night-glow">
          Practice Again
        </button>
        <button onClick={async () => {
          const transcript = lastResults.transcript || '';
          const shareText = mode === 'free'
            ? `I just practiced Free Speaking on No Pause 🎤\n\nSpeaking time: ${formatMMSS(lastResults.totalSpeakingTime)}\nHesitations: ${lastResults.hesitationCount}\n\nTranscript:\n"${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}"\n\nTrain your speaking No Pause`
            : `I just practiced speaking on No Pause 🎤\n\nFlow score: ${lastResults.flowScore}/100\nHesitations: ${lastResults.hesitationCount}\n\nTranscript:\n"${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}"\n\nTrain your speaking No Pause`;
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
        }} className="px-8 py-4 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-black btn-press flex items-center gap-2 justify-center transition-all duration-300">
          {copied ? (
            <span className="flex items-center gap-2 animate-scale-in">
              <Check size={18} className="text-green-400" /> Copied!
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Share2 size={18} /> Share Results
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-8 py-4 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-black btn-press transition-all duration-300"
        >
          Home
        </button>
      </div>
    </div>
  );
}
