import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, FileText, Mic, Play, Square, Volume2 } from 'lucide-react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import { cn } from '@/lib/utils';
import { createAudioAnalyzer } from '@/lib/audioRecording';
import { micService } from '@/lib/micService';
import type { AudioDataPayload } from '@/lib/speechAnalyzer';
import { VoicePlayer } from '@/components/VoicePlayer';
import { VoiceVisualizer } from '@/components/VoiceVisualizer';
import { shufflePassages, voiceActingPassages, type VoiceActingPassage } from '@/lib/readingTexts';

type ReadingPhase = 'idle' | 'recording' | 'done';

type ReadingChallengePanelProps = {
  onExit: () => void;
};

export function ReadingChallengePanel({ onExit }: ReadingChallengePanelProps) {
  const convex = useConvex();
  const [phase, setPhase] = useState<ReadingPhase>('idle');
  const [passages, setPassages] = useState<VoiceActingPassage[]>(() => shufflePassages(voiceActingPassages));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioDataPayload | null>(null);
  const [soundDetected, setSoundDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioMimeTypeRef = useRef<string | null>(null);

  const currentPassage = useMemo(() => passages[currentIndex], [passages, currentIndex]);

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const startSession = useCallback(async () => {
    setErrorMessage(null);
    setSoundDetected(false);
    setPhase('recording');
    setTranscript('');
    setTranscriptionError(null);
    setTranscriptionLoading(false);

    try {
      await micService.init();
      micService.setTracksEnabled(true);
      await micService.ensureAudioContextRunning();
      const analyzer = createAudioAnalyzer({
        enableTranscription: false,
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) setSoundDetected(true);
        },
      });
      analyzerRef.current = analyzer;
      await analyzer.start(micService.getStream() || undefined, micService.getAudioContext() || undefined);
    } catch (error) {
      console.error('Failed to start voice acting session:', error);
      setErrorMessage('Microphone error. Please try again.');
      setPhase('idle');
      return;
    }
  }, []);

  const finishSession = useCallback(async () => {
    setPhase('done');
    if (analyzerRef.current) {
      const results = await analyzerRef.current.stop();
      audioBlobRef.current = results.audioBlob || null;
      audioMimeTypeRef.current = results.audioMimeType || null;
      setAudioBlob(results.audioBlob || null);
      setAudioMimeType(results.audioMimeType || null);
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    micService.setTracksEnabled(false);
    setTranscriptionLoading(true);
    setTranscriptionError(null);
    if (audioBlobRef.current) {
      try {
        const base64Audio = arrayBufferToBase64(await audioBlobRef.current.arrayBuffer());
        const mimeType = audioMimeTypeRef.current || audioBlobRef.current.type || 'audio/webm';
        const text = await convex.action(api.transcribe.transcribeAudio, {
          audioBase64: base64Audio,
          mimeType,
          language: 'en',
        });
        setTranscript(text.trim());
      } catch (error) {
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message)
            : 'Unknown error';
        setTranscriptionError(`Transcription failed: ${message}`);
      } finally {
        setTranscriptionLoading(false);
      }
    } else {
      setTranscriptionError('No audio captured. Please try again.');
      setTranscriptionLoading(false);
    }
  }, [arrayBufferToBase64, convex]);

  const handleExit = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    micService.setTracksEnabled(false);
    onExit();
  }, [onExit]);

  const resetSession = useCallback(() => {
    setPhase('idle');
    setTranscript('');
    setAudioData(null);
    setSoundDetected(false);
    setAudioBlob(null);
    setAudioMimeType(null);
    setErrorMessage(null);
    setTranscriptionError(null);
    setTranscriptionLoading(false);
    setPassages(shufflePassages(voiceActingPassages));
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.destroy();
        analyzerRef.current = null;
      }
      micService.setTracksEnabled(false);
    };
  }, []);

  if (phase === 'done') {
    const transcriptReady =
      transcript.length > 0 &&
      transcript !== 'No speech detected.' &&
      !transcript.startsWith('Transcription failed');
    const passageText = currentPassage?.text || '';

    return (
      <div className="min-h-screen pb-28 pt-2 px-5 md:px-12 lg:px-20 max-w-4xl mx-auto">
        <button onClick={handleExit} className="flex items-center gap-1 text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors mb-8">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="text-center mt-16">
          <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-4">Voice Acting Complete</h2>
          <p className="text-muted-foreground font-sans mb-8">
            Your performance is ready for feedback.
          </p>
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <FileText size={20} className="text-primary" /> Your Passage
            </h3>
            <div className="p-8 night-panel rounded-3xl">
              <p className="text-foreground font-sans leading-relaxed text-left">
                {passageText}
              </p>
            </div>
          </div>

          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <FileText size={20} className="text-primary" /> Your Transcript
            </h3>
            <div className="p-8 night-panel rounded-3xl">
              {transcriptionLoading ? (
                <p className="text-foreground font-sans leading-relaxed text-left">Transcribing…</p>
              ) : transcriptionError ? (
                <p className="text-amber-200/90 font-sans leading-relaxed text-left">{transcriptionError}</p>
              ) : (
                <p className="text-foreground font-sans leading-relaxed text-left">
                  {transcriptReady ? transcript : 'No transcript available yet.'}
                </p>
              )}
            </div>
          </div>

          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <Volume2 size={20} className="text-primary" /> Voice Recording
            </h3>
            <div className="p-4 sm:p-8 night-panel rounded-3xl">
              {audioBlob ? (
                <VoicePlayer audioBlob={audioBlob} audioMimeType={audioMimeType || undefined} />
              ) : (
                <div className="text-center py-8">
                  <Volume2 size={48} className="text-muted-foreground/60 mx-auto mb-4" />
                  <p className="text-muted-foreground font-sans">Audio recording will be available here</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={resetSession}
            className="px-10 py-4 rounded-full bg-surface-card border border-border text-foreground font-sans font-black text-lg btn-press shadow-card"
          >
            Perform Another Passage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 pt-2 px-5 md:px-12 lg:px-20 max-w-4xl mx-auto">
      <button onClick={handleExit} className="flex items-center gap-1 text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors mb-8">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="flex flex-col items-center">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">Voice Acting</h1>
          <p className="text-sm md:text-base text-muted-foreground font-sans">Perform the passage with emotion and clarity.</p>
        </div>
        <div className="w-full text-center mb-6">
          <div className="p-6 md:p-8 bg-surface-card border-2 border-border/70 rounded-[32px] shadow-card">
            <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-2">Voice Acting Passage</p>
            <p className="text-xs text-muted-foreground font-sans mb-3">{currentPassage?.category}</p>
            <p className="text-lg md:text-2xl font-serif text-foreground leading-relaxed">
              {currentPassage?.text}
            </p>
          </div>
        </div>

        <div className="w-full flex-1 flex flex-col justify-center min-h-0 mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className={cn('w-2.5 h-2.5 rounded-full', soundDetected ? 'bg-primary animate-pulse shadow-[0_0_12px_rgba(230,140,106,0.65)]' : 'bg-muted-foreground/40')}></div>
            <p className="text-[10px] font-black text-muted-foreground font-sans uppercase tracking-[0.2em]">
              {soundDetected ? 'Voice Acting Active' : 'Waiting for sound'}
            </p>
          </div>
          <div className="relative h-32 md:h-44 flex items-center justify-center bg-surface-card border border-border/80 rounded-[40px] shadow-inner overflow-hidden">
            {audioData ? (
              <VoiceVisualizer frequencyData={audioData.frequencyData} volume={audioData.volume} isSilent={audioData.isSilent} isRecording={phase === 'recording'} />
            ) : (
              <Mic size={40} className="text-muted-foreground/50 animate-pulse" />
            )}
          </div>
        </div>

        {errorMessage && (
          <p className="text-sm text-amber-200/90 font-sans mb-4">{errorMessage}</p>
        )}

        <div className="shrink-0 pt-2">
          {phase === 'recording' ? (
            <button
              onClick={finishSession}
              className="w-full md:w-auto px-16 py-4 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black text-lg btn-press shadow-soft night-glow flex items-center justify-center gap-4"
            >
              <Square size={20} fill="white" className="rounded-sm" /> Finish
            </button>
          ) : (
            <button
              onClick={() => void startSession()}
              className="w-full md:w-auto px-16 py-4 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black text-lg btn-press shadow-soft night-glow flex items-center justify-center gap-4"
            >
              <Play size={20} fill="white" className="rounded-sm" /> Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
