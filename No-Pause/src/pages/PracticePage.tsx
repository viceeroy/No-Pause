import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { SetupCountdownPanel } from '@/features/practice/pages/SetupCountdownPanel';
import { RecordingPanel } from '@/features/practice/pages/RecordingPanel';
import { ResultPanel } from '@/features/practice/pages/ResultPanel';
import { usePracticeState } from '@/features/practice/pages/usePracticeState';
import { useRecordingController } from '@/features/practice/pages/useRecordingController';

const timerOptions = [
  { label: 'No timer', seconds: 0 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '4 min', seconds: 240 },
  { label: '5 min', seconds: 300 },
];

export default function PracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTimerSeconds, setSelectedTimerSeconds] = useState(0);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const state = usePracticeState();
  const mode = 'free' as const;
  const recording = useRecordingController({
    mode,
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
      id: 'free-speaking-topic',
      topicTitle: decodeURIComponent(promptTextParam),
      category: 'EXPERIENCE',
      difficulty: 'medium',
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
	      <button onClick={recording.handleBack} className={cn(
	        'min-h-11 -ml-2 px-2 inline-flex items-center gap-1 self-start text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors shrink-0',
        state.isFixedScreen ? 'mb-3' : 'mb-8'
      )}>
        <ChevronLeft size={16} /> Back
      </button>

      {state.state !== 'recording' && (
        <>
          <h1 className={cn('font-serif font-medium text-foreground shrink-0', state.isFixedScreen ? 'text-2xl md:text-5xl mb-1 md:mb-2' : 'text-4xl md:text-5xl mb-3')}>Free Speaking</h1>
          <p className={cn('text-muted-foreground font-sans shrink-0', state.isFixedScreen ? 'text-sm md:text-base mb-3 md:mb-6' : 'text-base mb-12')}>Talk about anything, no time limit</p>
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

      {state.state === 'done' && state.lastResults && (
        <ResultPanel
          mode={mode}
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
