import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { SetupCountdownPanel } from '@/features/practice/pages/SetupCountdownPanel';
import { RecordingPanel } from '@/features/practice/pages/RecordingPanel';
import { ResultPanel } from '@/features/practice/pages/ResultPanel';
import { usePracticeState } from '@/features/practice/pages/usePracticeState';
import { usePromptLoader } from '@/features/practice/pages/usePromptLoader';
import { useRecordingController } from '@/features/practice/pages/useRecordingController';
import { ReadingChallengePanel } from '@/features/practice/pages/ReadingChallengePanel';

export default function PracticePage() {
  const navigate = useNavigate();
  const state = usePracticeState();
  const prompt = usePromptLoader(state);
  const recording = useRecordingController({
    mode: prompt.mode,
    navigate,
    state,
  });
  const isPromptMode = prompt.mode === 'lemon' || prompt.mode === 'topic';

  const canStart =
    prompt.mode === 'free' ||
    prompt.mode === 'readingchallenge' ||
    (prompt.mode === 'lemon' ? !!state.lemonPrompt : !!state.topicPrompt);

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

  if (prompt.mode === 'readingchallenge') {
    return <ReadingChallengePanel onExit={() => navigate('/')} />;
  }

  return (
    <div className={cn(
      'px-5 md:px-12 lg:px-20 max-w-4xl mx-auto',
      state.isFixedScreen
        ? state.state === 'recording'
          ? 'h-[100dvh] flex flex-col overflow-hidden'
          : isPromptMode
	            ? 'h-[100dvh] flex flex-col overflow-hidden pt-2 pb-4'
            : 'min-h-screen flex flex-col pb-28 pt-2'
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
          <h1 className={cn('font-serif font-medium text-foreground shrink-0', state.isFixedScreen ? 'text-2xl md:text-4xl mb-1' : 'text-4xl md:text-5xl mb-3')}>{prompt.getModeTitle()}</h1>
          <p className={cn('text-muted-foreground font-sans shrink-0', state.isFixedScreen ? 'text-sm mb-4' : 'text-base mb-12')}>{prompt.getModeDescription()}</p>
        </>
      )}

      {(state.state === 'setup' || state.state === 'countdown') && (
        <SetupCountdownPanel
          mode={prompt.mode}
          state={state.state}
          transcriptError={state.transcriptError}
          showMicRetry={state.showMicRetry}
          handleRetryMicrophone={recording.handleRetryMicrophone}
          lemonPrompt={state.lemonPrompt}
          topicPrompt={state.topicPrompt}
          promptLoading={state.promptLoading}
          handleRandomPrompt={prompt.handleRandomPrompt}
          canStart={canStart}
          handleStart={() => recording.handleStart()}
          countdown={state.countdown}
        />
      )}

      {state.state === 'recording' && (
        <RecordingPanel
          mode={prompt.mode}
          timeLeft={state.timeLeft}
          elapsedTime={state.elapsedTime}
          lemonPrompt={state.lemonPrompt}
          topicPrompt={state.topicPrompt}
          audioData={state.audioData}
          soundDetected={recording.soundDetectedRef.current}
          stopRecording={recording.stopRecording}
        />
      )}

      {state.state === 'done' && state.lastResults && (
        <ResultPanel
          mode={prompt.mode}
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
