import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SetupCountdownPanel } from '@/pages/practice/SetupCountdownPanel';
import { RecordingPanel } from '@/pages/practice/RecordingPanel';
import { ResultPanel } from '@/pages/practice/ResultPanel';
import { usePracticeState } from '@/pages/practice/usePracticeState';
import { usePromptLoader } from '@/pages/practice/usePromptLoader';
import { useRecordingController } from '@/pages/practice/useRecordingController';

export default function PracticePage() {
  const navigate = useNavigate();
  const state = usePracticeState();
  const prompt = usePromptLoader(state);
  const recording = useRecordingController({
    mode: prompt.mode,
    navigate,
    state,
  });

  const canStart =
    prompt.mode === 'free' ||
    (prompt.mode === 'lemon' ? !!state.lemonPrompt : !!state.topicPrompt);

  return (
    <div className={cn(
      'px-5 md:px-12 lg:px-20 max-w-4xl mx-auto',
      state.isFixedScreen
        ? state.state === 'recording'
          ? 'h-[100dvh] flex flex-col overflow-hidden'
          : 'min-h-screen flex flex-col pb-28 pt-2'
        : 'min-h-screen pb-32 pt-8'
    )}>
      {state.isFixedScreen && <div className="shrink-0 pt-6" />}
      <button onClick={recording.handleBack} className={cn(
        'flex items-center gap-1 text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors shrink-0',
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
          topicDifficultyMode={state.topicDifficultyMode}
          handleTopicDifficultySelect={prompt.handleTopicDifficultySelect}
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
          copied={state.copied}
          setCopied={state.setCopied}
        />
      )}
    </div>
  );
}
