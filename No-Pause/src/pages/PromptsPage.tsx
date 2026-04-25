import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import {
  getTopicPrompts,
  type TopicPrompt,
} from '@/features/practice/lib/promptService';

const arguePrompts = [
  'Is it ever okay to lie to protect someone?',
  'Should social media have a minimum age?',
  'Is ambition more important than talent?',
  'Would you take a job you hate for 3x the salary?',
  'Should everyone go to university?',
  'Is cancel culture good or bad for society?',
  'Does money buy happiness?',
  'Should voting be mandatory?',
  'Is remote work better than office work?',
  'Should animals be kept in zoos?',
  'Should free speech have limits?',
  'Is failure necessary for success?',
  'Should schools ban phones?',
  'Is privacy more important than security?',
  'Should people be judged by intentions or outcomes?',
  'Is competition healthy?',
  'Should AI replace repetitive jobs?',
  'Is honesty always the best policy?',
  'Should the wealthy pay much higher taxes?',
  'Is it better to be respected or liked?',
];

export default function PromptsPage() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<TopicPrompt[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
	    <div className="min-h-screen pb-32 px-5 md:px-12 lg:px-20 pt-6 md:pt-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground">Speaking Prompts</h1>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mb-4">Argue This</h2>
	        <div className="-mx-5 md:-mx-12 lg:-mx-20 px-5 md:px-12 lg:px-20 overflow-x-auto pb-3">
	          <div className="flex gap-3 md:gap-4 min-w-max">
            {arguePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  navigate(`/practice/free-speaking?prompt_text=${encodeURIComponent(prompt)}`);
                }}
	                className="w-60 md:w-80 min-h-32 md:min-h-40 rounded-2xl bg-surface-elevated border border-border shadow-card p-4 md:p-5 text-left card-hover btn-press flex flex-col justify-between"
	              >
	                <span className="text-lg md:text-2xl font-serif font-medium text-foreground leading-snug">{prompt}</span>
	                <span className="mt-4 md:mt-5 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft">
                  <Play size={16} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stagger-children space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground font-sans">Loading prompts...</p>
        )}

        {prompts.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-surface-elevated border border-border shadow-card p-4 md:p-5 card-hover"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-base text-muted-foreground font-sans leading-relaxed">{item.topicTitle}</p>
              </div>
              <button
                onClick={() => {
                  navigate(`/practice?mode=topic&prompt=${encodeURIComponent(item.id)}`);
                }}
	                className="flex-shrink-0 w-11 h-11 rounded-full bg-surface-interactive border border-border text-cyan-400 flex items-center justify-center btn-press hover:border-cyan-400/40 hover:text-cyan-300 transition-colors"
              >
                <Play size={16} fill="currentColor" />
              </button>
            </div>
          </div>
        ))}

        {!loading && prompts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-lg font-serif text-foreground mb-2">No prompts available</p>
            <p className="text-sm text-muted-foreground font-sans">Please try again later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
