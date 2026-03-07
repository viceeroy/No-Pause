import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Mic, BarChart3, TrendingUp, Layers, Shield, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import FeatureDetailModal from '@/components/FeatureDetailModal';
import { LEMON_MIN_TOTAL_SECONDS, TOPIC_MIN_TOTAL_SECONDS } from '@/lib/scoringConstants';

const toMinuteLabel = (seconds: number) => `${Math.floor(seconds / 60)} min`;

const CARDS = [
  {
    id: 'start',
    icon: Mic,
    title: 'Start speaking',
    tagline: 'Just tap and talk.',
    description: 'No scripts. No prep. Tap Start Speaking and say whatever comes to mind.',
    visual: 'waveform',
    accent: 'primary',
  },
  {
    id: 'scoring',
    icon: BarChart3,
    title: 'How scoring works',
    tagline: 'Your session turns into real feedback.',
    badges: ['Flow Score', 'Hesitations', 'Completion'],
    accent: 'cyan',
  },
  {
    id: 'improve',
    icon: TrendingUp,
    title: 'Improve every session',
    tagline: 'Practice → feedback → improvement.',
    bullets: ['Less hesitation', 'Smoother speech', 'Confidence growth'],
    accent: 'green',
  },
  {
    id: 'modes',
    icon: Layers,
    title: 'Practice modes',
    tagline: 'Different ways to train your flow.',
    modes: [
      { name: 'Free Speaking', desc: 'Talk about anything' },
      { name: 'Topic Practice', desc: `${toMinuteLabel(TOPIC_MIN_TOTAL_SECONDS)} guided topics` },
      { name: 'Lemon Technique', desc: `${toMinuteLabel(LEMON_MIN_TOTAL_SECONDS)} continuous flow` },
    ],
    accent: 'ember',
  },
  {
    id: 'safe',
    icon: Shield,
    title: 'Safe & pressure-free',
    tagline: 'Just practice. No pressure.',
    bullets: ['Mic used only during recording', 'No right or wrong answers', 'Speak at your own pace'],
    accent: 'primary',
  },
] as const;

const accentMap: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    badgeBg: 'bg-primary/15',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-400/20',
    badgeBg: 'bg-cyan-500/15',
  },
  green: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-400/20',
    badgeBg: 'bg-emerald-500/15',
  },
  ember: {
    bg: 'bg-ember-200/10',
    text: 'text-ember-600',
    border: 'border-ember-500/20',
    badgeBg: 'bg-ember-200/15',
  },
};

function WaveformVisual() {
  return (
    <div className="flex items-end gap-[3px] h-8 mt-3">
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 1, 0.7, 0.3, 0.6, 0.9, 0.5].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary/60"
          style={{
            height: `${h * 100}%`,
            animation: `waveBar 1.2s ease-in-out ${i * 0.08}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function ProgressBars() {
  return (
    <div className="space-y-2 mt-3 w-full">
      {[{ w: '85%', label: 'Flow' }, { w: '60%', label: 'Clarity' }, { w: '92%', label: 'Confidence' }].map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 font-sans w-14 text-right">{bar.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400/70 transition-all duration-1000"
              style={{ width: bar.w }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type FeatureId = 'start' | 'scoring' | 'improve' | 'modes' | 'safe';

export default function HowItWorksSlider() {
  const navigate = useNavigate();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [modalFeature, setModalFeature] = useState<FeatureId | null>(null);
  const totalSlides = CARDS.length + 1; // +1 for CTA

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl md:text-2xl font-serif text-foreground tracking-tight">How it works</h2>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
            className="p-2 rounded-xl bg-surface-elevated border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
            className="p-2 rounded-xl bg-surface-elevated border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3 md:gap-4">
          {CARDS.map((card) => {
            const colors = accentMap[card.accent];
            return (
              <div
                key={card.id}
                onClick={() => setModalFeature(card.id as FeatureId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setModalFeature(card.id as FeatureId)}
                className={cn(
                  'flex-none w-[75vw] md:w-[320px] rounded-[20px] p-5 md:p-6 cursor-pointer',
                  'bg-gradient-to-b from-surface-card to-surface-elevated',
                  'border border-border/60 shadow-card',
                  'flex flex-col min-h-[260px] md:min-h-[280px]',
                  'transition-all duration-300 hover:border-primary/30 hover:shadow-[0_22px_38px_-20px_rgba(0,0,0,0.82),0_0_0_1px_rgba(230,140,106,0.14)] active:scale-[0.97]'
                )}
              >
                {/* Icon */}
                <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center border', colors.bg, colors.border)}>
                  <card.icon size={18} className={colors.text} />
                </div>

                {/* Title */}
                <h3 className="text-lg md:text-xl font-serif text-foreground mt-4 leading-tight">{card.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground font-sans mt-1.5 leading-relaxed">{card.tagline}</p>

                {/* Visual content */}
                <div className="mt-auto pt-4">
                  {'visual' in card && card.visual === 'waveform' && <WaveformVisual />}

                  {'badges' in card && card.badges && (
                    <div className="flex flex-wrap gap-1.5">
                      {card.badges.map((b) => (
                        <span key={b} className={cn('px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold border', colors.badgeBg, colors.text, colors.border)}>
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  {'bullets' in card && card.bullets && (
                    card.id === 'improve' ? <ProgressBars /> : (
                      <ul className="space-y-1.5">
                        {card.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
                            <div className={cn('w-1.5 h-1.5 rounded-full', colors.text.replace('text-', 'bg-'))} />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )
                  )}

                  {'modes' in card && card.modes && (
                    <div className="space-y-2">
                      {card.modes.map((m) => (
                        <div key={m.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-elevated/60 border border-border/40">
                          <span className="text-xs font-sans font-semibold text-foreground">{m.name}</span>
                          <span className="text-[10px] font-sans text-muted-foreground/70 ml-auto">{m.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* CTA Card */}
          <div className="flex-none w-[75vw] md:w-[320px] rounded-[20px] p-5 md:p-6 bg-gradient-to-b from-primary/10 to-surface-card border border-primary/20 shadow-card flex flex-col items-center justify-center min-h-[260px] md:min-h-[280px] text-center">
            <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center mb-4 night-glow">
              <Mic size={24} className="text-primary" />
            </div>
            <h3 className="text-xl md:text-2xl font-serif text-foreground mb-1.5">Ready to try?</h3>
            <p className="text-xs text-muted-foreground font-sans mb-5">See your flow improve in minutes.</p>
            <button
              onClick={() => navigate('/practice/free-speaking')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-sans text-sm font-semibold btn-press card-hover"
            >
              Start Speaking
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === selectedIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
      {/* Feature Detail Modal */}
      <FeatureDetailModal
        featureId={modalFeature}
        open={!!modalFeature}
        onOpenChange={(open) => !open && setModalFeature(null)}
      />
    </div>
  );
}
