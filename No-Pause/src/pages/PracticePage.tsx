import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, CircleHelp } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { SetupCountdownPanel } from '@/features/practice/pages/SetupCountdownPanel';
import { RecordingPanel } from '@/features/practice/pages/RecordingPanel';
import { ResultPanel } from '@/features/practice/pages/ResultPanel';
import { ResultSkeletonPanel } from '@/features/practice/pages/ResultSkeletonPanel';
import { usePracticeState } from '@/features/practice/pages/usePracticeState';
import { useRecordingController } from '@/features/practice/pages/useRecordingController';
import { getRandomPrompt } from '@/lib/core/prompts';
import { formatDuration } from '@/lib/core/time';

const timerOptions = [
  { label: 'No timer', seconds: 0 },
  { label: formatDuration(60), seconds: 60 },
  { label: formatDuration(120), seconds: 120 },
  { label: formatDuration(180), seconds: 180 },
  { label: formatDuration(240), seconds: 240 },
  { label: formatDuration(300), seconds: 300 },
];

export default function PracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState(0);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const state = usePracticeState();
  const recording = useRecordingController({
    navigate,
    state,
    selectedTimerSeconds,
  });
  const promptTextParam = searchParams.get('prompt_text');
  const promptText = state.topicPrompt?.topicTitle || promptTextParam || '';
  const timerLabel = useMemo(
    () => timerOptions.find((option) => option.seconds === selectedTimerSeconds)?.label ?? 'No timer',
    [selectedTimerSeconds],
  );

  useEffect(() => {
    state.setTimeLeft(0);
    state.setTopicPrompt(promptTextParam ? {
      id: 'speaking-practice-topic',
      topicTitle: promptTextParam,
      category: 'EXPERIENCE',
      cueCard: [],
    } : null);
  }, [promptTextParam, state.setTimeLeft, state.setTopicPrompt]);

  useEffect(() => {
    if (state.state === 'recording') {
      document.body.dataset.recording = 'true';
    } else {
      delete document.body.dataset.recording;
    }
    return () => {
      delete document.body.dataset.recording;
    };
  }, [state.state]);

  const applyPrompt = (topicTitle: string) => {
    state.setTopicPrompt({
      id: `speaking-practice-${topicTitle}`,
      topicTitle,
      category: 'SPEAKING_PRACTICE',
      cueCard: [],
    });
  };

  const handleOpenPrompts = () => {
    navigate('/prompts');
  };

  const handleRandomPrompt = () => {
    applyPrompt(getRandomPrompt(promptText || undefined));
  };

  return (
    <div className={cn(
      'px-5 md:px-12 lg:px-20 max-w-5xl mx-auto',
      state.isFixedScreen
        ? state.state === 'recording'
          ? 'h-[100dvh] flex flex-col overflow-hidden'
          : 'min-h-screen flex flex-col pb-10 md:pb-16 pt-2'
        : 'min-h-screen pb-32 pt-8'
    )}>
      {state.isFixedScreen && <div className="shrink-0 pt-6" />}
      <div className={cn(
        'flex w-full items-center justify-between shrink-0',
        state.isFixedScreen ? 'mb-3' : 'mb-8'
      )}>
        <button onClick={recording.handleBack} className="min-h-11 -ml-2 px-2 inline-flex items-center gap-1 self-start text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors shrink-0">
          <ChevronLeft size={16} /> Back
        </button>
        {state.state === 'setup' && (
          <button
            type="button"
            onClick={() => navigate('/help')}
            aria-label="Help"
            title="Help"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-muted-foreground shadow-card transition-colors btn-press hover:bg-surface-elevated hover:text-foreground"
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {state.state !== 'recording' && (
        <>
          <h1 className={cn('font-serif font-medium text-foreground shrink-0', state.isFixedScreen ? 'text-2xl md:text-5xl mb-3 md:mb-6' : 'text-4xl md:text-5xl mb-12')}>Speaking Mode</h1>
        </>
      )}

      {(state.state === 'setup' || state.state === 'countdown') && (
        <SetupCountdownPanel
          state={state.state}
          transcriptError={state.transcriptError}
          showMicRetry={state.showMicRetry}
          handleRetryMicrophone={recording.handleRetryMicrophone}
          timerLabel={timerLabel}
          timerMenuOpen={timerMenuOpen}
          setTimerMenuOpen={setTimerMenuOpen}
          selectedTimerSeconds={selectedTimerSeconds}
          setSelectedTimerSeconds={setSelectedTimerSeconds}
          timerOptions={timerOptions}
          promptText={promptText}
          handleOpenPrompts={handleOpenPrompts}
          handleRandomPrompt={handleRandomPrompt}
          handleStart={() => recording.handleStart()}
          countdown={state.countdown}
        />
      )}

      {state.state === 'recording' && (
        <RecordingPanel
          timeLeft={state.timeLeft}
          elapsedTime={state.elapsedTime}
          selectedTimerSeconds={selectedTimerSeconds}
          promptText={promptText}
          audioData={state.audioData}
          soundDetected={recording.soundDetectedRef.current}
          stopRecording={recording.stopRecording}
        />
      )}

      {state.state === 'finishing' && (
        <ResultSkeletonPanel />
      )}

      {state.state === 'done' && state.lastResults && (
        <ResultPanel
          lastResults={state.lastResults}
          showResultsDebugExport={state.showResultsDebugExport}
          handleRetry={recording.handleRetry}
          requestFeedback={recording.requestFeedback}
          requestTranscription={recording.requestTranscription}
          copied={state.copied}
          setCopied={state.setCopied}
        />
      )}
    </div>
  );
}
