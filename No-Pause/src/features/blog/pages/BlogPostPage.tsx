import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Brain, Clock3, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBlogPostBySlug } from '../data';

const statIcons = [Target, Clock3, TrendingUp, Sparkles, Brain, BookOpen];

export default function BlogPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!post) return;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight - viewportHeight;
      if (fullHeight <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.max(0, Math.min(100, (scrollTop / fullHeight) * 100)));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [post]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/blog');
  };

  if (!post) {
    return (
	    <main className="min-h-screen bg-surface-base pb-32 px-5 md:px-12 lg:px-20 pt-6 md:pt-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-3">Post not found</h1>
          <p className="text-sm md:text-base text-muted-foreground font-sans mb-6">
            This blog post does not exist or may have been removed.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors"
          >
            Back to Blogs
          </Link>
        </div>
      </main>
    );
  }

  return (
	    <main className="min-h-screen bg-surface-base pb-32 px-5 md:px-12 lg:px-20 pt-6 md:pt-8 max-w-4xl mx-auto">
      <div className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-surface-card/60">
        <div
          className="h-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
	      <article className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-sans mb-2">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h1 className="text-3xl md:text-5xl font-serif font-medium text-foreground mb-4">{post.title}</h1>
	        <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed mb-8">
          {post.description}
        </p>

        <section className="rounded-xl border border-border/70 bg-surface-card/40 p-4 md:p-5 mb-8">
          <h2 className="text-sm font-sans uppercase tracking-[0.14em] text-muted-foreground mb-2">Short Answer</h2>
          <p className="text-sm md:text-base text-foreground/90 font-sans leading-relaxed">{post.shortAnswer}</p>
        </section>

        <section className="space-y-6">
          {post.sections.map((section) => (
            <div key={section.heading} className="space-y-2">
              <h3 className="text-xl md:text-2xl font-serif text-foreground">{section.heading}</h3>
              <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed">
                {section.content}
              </p>
              {section.bullets && section.bullets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {section.bullets.map((bullet, index) => {
                    const BulletIcon = statIcons[index % statIcons.length];
                    return (
                      <div
                        key={bullet}
                        className="rounded-xl border border-border bg-surface-card/70 p-4 shadow-card"
                      >
                        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-elevated text-primary">
                          <BulletIcon size={15} />
                        </div>
                        <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed">{bullet}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-primary/30 bg-primary/10 p-4 md:p-5 mt-8">
          <h2 className="text-sm font-sans uppercase tracking-[0.14em] text-primary mb-2">Takeaway</h2>
          <p className="text-sm md:text-base text-foreground/95 font-sans leading-relaxed">{post.takeaway}</p>
        </section>

        <p className="mt-6 text-sm font-sans text-muted-foreground">
          By Bobur Karimov
        </p>

        <div className="mt-10">
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors"
          >
            Back to Blogs
          </Link>
        </div>
      </article>
    </main>
  );
}
