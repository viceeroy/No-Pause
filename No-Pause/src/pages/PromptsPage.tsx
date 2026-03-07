import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import {
  getTopicPrompts,
  TOPIC_CATEGORIES,
  type TopicDifficulty,
  type TopicPrompt,
} from '@/lib/promptService';

export default function PromptsPage() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<TopicPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | (typeof TOPIC_CATEGORIES)[number]>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | TopicDifficulty>('all');

  useEffect(() => {
    let active = true;
    getTopicPrompts()
      .then((data) => {
        if (active) setPrompts(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const categoryMatch = selectedCategory === 'All' || prompt.category === selectedCategory;
      const difficultyMatch = selectedDifficulty === 'all' || prompt.difficulty === selectedDifficulty;
      return categoryMatch && difficultyMatch;
    });
  }, [prompts, selectedCategory, selectedDifficulty]);

  return (
    <div className="min-h-screen pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Speaking Prompts</h1>
        <p className="text-base text-muted-foreground font-sans">
          {loading ? 'Loading prompts...' : `${filteredPrompts.length} prompts available`}
        </p>
      </div>

      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-full text-xs font-sans font-semibold border ${selectedCategory === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface-card border-border text-muted-foreground'}`}
          >
            All
          </button>
          {TOPIC_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans font-semibold border ${selectedCategory === category ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface-card border-border text-muted-foreground'}`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'easy', 'medium'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setSelectedDifficulty(level)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans font-semibold border capitalize ${selectedDifficulty === level ? 'bg-cyan-500 text-slate-950 border-cyan-500' : 'bg-surface-card border-border text-muted-foreground'}`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger-children space-y-4">
        {filteredPrompts.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-surface-elevated border border-border shadow-card p-6 card-hover"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-base text-muted-foreground font-sans leading-relaxed">{item.topicTitle}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border bg-cyan-500/20 border-cyan-400/35 text-cyan-300">{item.category}</span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border bg-cyan-500/20 border-cyan-400/35 text-cyan-300">{item.difficulty}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate(`/practice?mode=topic&prompt=${encodeURIComponent(item.id)}`);
                }}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-interactive border border-border text-cyan-400 flex items-center justify-center btn-press hover:border-cyan-400/40 hover:text-cyan-300 transition-colors"
              >
                <Play size={16} fill="currentColor" />
              </button>
            </div>
          </div>
        ))}

        {!loading && filteredPrompts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-lg font-serif text-foreground mb-2">No prompts match this filter</p>
            <p className="text-sm text-muted-foreground font-sans">Try another category or difficulty.</p>
          </div>
        )}
      </div>
    </div>
  );
}
