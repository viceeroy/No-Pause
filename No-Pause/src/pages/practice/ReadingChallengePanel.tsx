import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Mic, Square, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { micService } from '@/lib/micService';
import { AudioAnalyzer, type AudioDataPayload } from '@/lib/speechAnalyzer';
import { VoiceVisualizer } from '@/components/VoiceVisualizer';
import { readingSentences, shuffleSentences } from '@/lib/readingSentences';

type ReadingPhase = 'idle' | 'reading' | 'done';

type ReadingChallengePanelProps = {
  onExit: () => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function ReadingChallengePanel({ onExit }: ReadingChallengePanelProps) {
  const [phase, setPhase] = useState<ReadingPhase>('idle');
  const [sentences, setSentences] = useState<string[]>(() => shuffleSentences(readingSentences));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioData, setAudioData] = useState<AudioDataPayload | null>(null);
  const [soundDetected, setSoundDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const currentSentenceRef = useRef('');
  const phaseRef = useRef<ReadingPhase>('idle');

  const currentSentence = sentences[currentIndex] || '';
  useEffect(() => {
    currentSentenceRef.current = currentSentence;
  }, [currentSentence]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const normalizeWords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const shouldAdvance = useCallback((spoken: string, target: string) => {
    const spokenWords = new Set(normalizeWords(spoken));
    const targetWords = normalizeWords(target);
    if (targetWords.length === 0) return false;
    let matched = 0;
    for (const word of targetWords) {
      if (spokenWords.has(word)) matched += 1;
    }
    const ratio = matched / targetWords.length;
    return ratio >= 0.6;
  }, []);

  const setupRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return null;
    }
    const recognition = new (SpeechRecognition as SpeechRecognitionConstructor)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = `${final}${interim}`.trim();
      setLiveTranscript(combined);
      const targetSentence = currentSentenceRef.current;
      if (shouldAdvance(combined, targetSentence)) {
        setCompletedCount((count) => count + 1);
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= sentences.length) {
            setPhase('done');
            return prev;
          }
          return next;
        });
        setLiveTranscript('');
      }
    };
    recognition.onerror = () => {
      setErrorMessage('Speech recognition error. Try again.');
    };
    recognition.onend = () => {
      if (phaseRef.current === 'reading') {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };
    return recognition;
  }, [currentSentence, phase, sentences.length, shouldAdvance]);

  const startSession = useCallback(async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    setSoundDetected(false);
    setPhase('reading');
    setCompletedCount(0);
    setCurrentIndex(0);
    setSentences(shuffleSentences(readingSentences));

    try {
      await micService.init();
      micService.setTracksEnabled(true);
      await micService.ensureAudioContextRunning();
      const analyzer = new AudioAnalyzer({
        enableTranscription: false,
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) setSoundDetected(true);
        },
      });
      analyzerRef.current = analyzer;
      await analyzer.start(micService.getStream() || undefined, micService.getAudioContext() || undefined);
    } catch (error) {
      console.error('Failed to start reading session:', error);
      setErrorMessage('Microphone error. Please try again.');
      setPhase('idle');
      return;
    }

    const recognition = setupRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setErrorMessage('Speech recognition could not start.');
      }
    }
  }, [setupRecognition]);

  const finishSession = useCallback(() => {
    setPhase('done');
    try { recognitionRef.current?.stop(); } catch { }
    recognitionRef.current = null;
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    micService.setTracksEnabled(false);
  }, []);

  const handleExit = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { }
    recognitionRef.current = null;
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    micService.setTracksEnabled(false);
    onExit();
  }, [onExit]);

  const resetSession = useCallback(() => {
    setPhase('idle');
    setLiveTranscript('');
    setCompletedCount(0);
    setCurrentIndex(0);
    setAudioData(null);
    setSoundDetected(false);
    setErrorMessage(null);
    setSentences(shuffleSentences(readingSentences));
  }, []);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { }
      recognitionRef.current = null;
      if (analyzerRef.current) {
        analyzerRef.current.destroy();
        analyzerRef.current = null;
      }
      micService.setTracksEnabled(false);
    };
  }, []);

  if (phase === 'done') {
    return (
      <div className="min-h-screen pb-28 pt-2 px-5 md:px-12 lg:px-20 max-w-4xl mx-auto">
        <button onClick={handleExit} className="flex items-center gap-1 text-muted-foreground font-sans text-sm hover:text-foreground btn-press transition-colors mb-8">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="text-center mt-16">
          <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-4">Reading Complete</h2>
          <p className="text-muted-foreground font-sans mb-10">
            You completed {completedCount} sentence{completedCount === 1 ? '' : 's'}.
          </p>
          <button
            onClick={resetSession}
            className="px-10 py-4 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black text-lg btn-press shadow-soft night-glow"
          >
            Try Again
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
        <div className="w-full text-center mb-6">
          <div className="p-6 md:p-8 bg-surface-card border-2 border-border/70 rounded-[32px] shadow-card">
            <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-3">Read this sentence</p>
            <p className="text-2xl md:text-3xl font-serif text-foreground">{currentSentence}</p>
          </div>
        </div>

        <div className="w-full text-center mb-6">
          <p className="text-sm md:text-base text-muted-foreground font-sans">{liveTranscript || 'Waiting for your voice...'}</p>
        </div>

        <div className="w-full flex-1 flex flex-col justify-center min-h-0 mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className={cn('w-2.5 h-2.5 rounded-full', soundDetected ? 'bg-primary animate-pulse shadow-[0_0_12px_rgba(230,140,106,0.65)]' : 'bg-muted-foreground/40')}></div>
            <p className="text-[10px] font-black text-muted-foreground font-sans uppercase tracking-[0.2em]">
              {soundDetected ? 'Reading Active' : 'Waiting for sound'}
            </p>
          </div>
          <div className="relative h-32 md:h-44 flex items-center justify-center bg-surface-card border border-border/80 rounded-[40px] shadow-inner overflow-hidden">
            {audioData ? (
              <VoiceVisualizer frequencyData={audioData.frequencyData} volume={audioData.volume} isSilent={audioData.isSilent} isRecording={phase === 'reading'} />
            ) : (
              <Mic size={40} className="text-muted-foreground/50 animate-pulse" />
            )}
          </div>
        </div>

        {errorMessage && (
          <p className="text-sm text-amber-200/90 font-sans mb-4">{errorMessage}</p>
        )}

        <div className="shrink-0 pt-2">
          {phase === 'reading' ? (
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
