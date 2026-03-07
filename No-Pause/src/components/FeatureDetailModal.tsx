import { useNavigate } from 'react-router-dom';
import { X, Mic, BarChart3, TrendingUp, Layers, Shield, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEMON_MIN_SPEAKING_SECONDS,
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_SPEAKING_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/scoringConstants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type FeatureId = 'start' | 'scoring' | 'improve' | 'modes' | 'safe';

interface FeatureDetailModalProps {
  featureId: FeatureId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const FEATURE_DETAILS: Record<FeatureId, {
  icon: React.ElementType;
  title: string;
  description: string;
  points: { heading: string; text: string }[];
  cta: { label: string; route: string };
  accent: string;
}> = {
  start: {
    icon: Mic,
    title: 'Start Speaking',
    description: 'No scripts. No prep. Just your voice.',
    points: [
      { heading: 'Tap and talk', text: 'Hit Start Speaking and say whatever comes to mind. There are no wrong answers.' },
      { heading: 'Stay natural', text: 'Speak as you would in a real conversation. The app listens and learns your patterns.' },
      { heading: 'Finish when ready', text: 'Stop anytime. Your session is saved and scored automatically.' },
    ],
    cta: { label: 'Try Free Speaking', route: '/practice/free-speaking' },
    accent: 'primary',
  },
  scoring: {
    icon: BarChart3,
    title: 'How Scoring Works',
    description: 'Every session becomes real, actionable feedback.',
    points: [
      { heading: 'Flow Score', text: 'Completed sessions start at 100. The first 2 hesitations are forgiven, then each extra hesitation subtracts 10 points.' },
      { heading: 'Completion Rules', text: `Free requires 60s total session and at least 45s speaking. Lemon requires ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session + ${toMMSS(LEMON_MIN_SPEAKING_SECONDS)} speaking, and Topic requires ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session + ${toMMSS(TOPIC_MIN_SPEAKING_SECONDS)} speaking.` },
      { heading: 'Hesitations', text: 'Only hesitations after the first two affect score. Lower hesitation count means stronger flow.' },
    ],
    cta: { label: 'See Your Stats', route: '/stats' },
    accent: 'cyan',
  },
  improve: {
    icon: TrendingUp,
    title: 'Improve Every Session',
    description: 'Watch your confidence grow, one session at a time.',
    points: [
      { heading: 'Less hesitation', text: 'Each session trains your brain to speak more fluidly without filler words.' },
      { heading: 'Smoother delivery', text: 'Your speaking rhythm naturally improves as you practice consistently.' },
      { heading: 'Track your progress', text: 'Compare scores across sessions to see measurable improvement over time.' },
    ],
    cta: { label: 'Start Practicing', route: '/practice/free-speaking' },
    accent: 'green',
  },
  modes: {
    icon: Layers,
    title: 'Practice Modes',
    description: 'Choose how you want to train your flow.',
    points: [
      { heading: 'Free Speaking', text: 'Talk about anything with no time limit. Perfect for building comfort and confidence.' },
      { heading: 'Topic Practice', text: `Speak on a suggested topic for a ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session. Great for structured thinking under pressure.` },
      { heading: 'Lemon Technique', text: `${toMMSS(LEMON_MIN_TOTAL_SECONDS)} rapid speaking with a random word. Trains continuous flow without pauses.` },
    ],
    cta: { label: 'Pick a Mode', route: '/practice/free-speaking' },
    accent: 'ember',
  },
  safe: {
    icon: Shield,
    title: 'Safe & Pressure-Free',
    description: 'Your space to practice without judgment.',
    points: [
      { heading: 'Private by design', text: 'Your microphone is only active during recording. Audio never leaves your device.' },
      { heading: 'No wrong answers', text: 'There is no perfect score to chase. Every session is progress.' },
      { heading: 'Your pace, your rules', text: 'Speak for 30 seconds or 10 minutes. You decide when and how long.' },
    ],
    cta: { label: 'Start Speaking', route: '/practice/free-speaking' },
    accent: 'primary',
  },
};

const accentStyles: Record<string, { icon: string; bg: string; border: string }> = {
  primary: { icon: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-400/20' },
  green: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20' },
  ember: { icon: 'text-ember-600', bg: 'bg-ember-200/10', border: 'border-ember-500/20' },
};

export default function FeatureDetailModal({ featureId, open, onOpenChange }: FeatureDetailModalProps) {
  const navigate = useNavigate();
  if (!featureId) return null;

  const detail = FEATURE_DETAILS[featureId];
  const colors = accentStyles[detail.accent];
  const Icon = detail.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-card)] border-border/60 rounded-[20px] p-0 max-w-md mx-auto gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <DialogHeader className="gap-3">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center border', colors.bg, colors.border)}>
              <Icon size={22} className={colors.icon} />
            </div>
            <DialogTitle className="text-xl font-serif text-foreground">{detail.title}</DialogTitle>
            <DialogDescription className="text-sm font-sans text-muted-foreground leading-relaxed">
              {detail.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Points */}
        <div className="px-6 pb-2 space-y-3">
          {detail.points.map((point, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-xl bg-[var(--surface-elevated)] border border-border/40"
            >
              <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-sans font-bold shrink-0 mt-0.5', colors.bg, colors.icon)}>
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-sans font-semibold text-foreground">{point.heading}</p>
                <p className="text-xs font-sans text-muted-foreground leading-relaxed mt-0.5">{point.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="p-6 pt-4">
          <button
            onClick={() => {
              onOpenChange(false);
              navigate(detail.cta.route);
            }}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-sans text-sm font-semibold btn-press card-hover"
          >
            {detail.cta.label}
            <ArrowRight size={14} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
