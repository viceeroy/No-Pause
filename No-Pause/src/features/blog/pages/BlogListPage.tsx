import { Link } from 'react-router-dom';
import { Activity, BookOpen, Brain, Clock3, MessageCircle, Mic, PauseCircle } from 'lucide-react';
import { blogPosts } from '../data';

const getPostIcon = (slug: string) => {
  if (slug.includes('um-and-uh')) return MessageCircle;
  if (slug.includes('pauses-hurt-fluency')) return PauseCircle;
  if (slug.includes('hesitation')) return Brain;
  if (slug.includes('how-long-should-i-practice-speaking')) return Clock3;
  if (slug.includes('reading-aloud')) return BookOpen;
  if (slug.includes('nervous')) return Activity;
  return Mic;
};

export default function BlogListPage() {
  return (
    <main className="min-h-screen bg-surface-base pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Blogs</h1>
        <p className="text-base text-muted-foreground font-sans">
          Insights on speaking practice, fluency improvement, and real-time speaking analytics.
        </p>
      </header>

      <section className="space-y-4" aria-label="Blog posts">
        {blogPosts.map((post) => {
          const Icon = getPostIcon(post.slug);
          return (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="block">
              <article className="rounded-2xl bg-surface-elevated border border-border shadow-card p-6 card-hover cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-card text-primary">
                    <Icon size={18} />
                  </div>
                </div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-sans mb-2">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h2 className="text-2xl md:text-3xl font-serif text-foreground mb-3">{post.title}</h2>
              <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed mb-5">
                {post.description}
              </p>
              </article>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
