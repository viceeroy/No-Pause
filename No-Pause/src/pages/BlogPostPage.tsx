import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBlogPostBySlug } from '@/data/blog';

export default function BlogPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/blog');
  };

  if (!post) {
    return (
      <main className="min-h-screen bg-surface-base pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
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
    <main className="min-h-screen bg-surface-base pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <article className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8 shadow-card">
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
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-sans mb-1.5">1-2 minute read</p>
        <p className="text-xs text-muted-foreground/85 font-sans mb-6">
          Includes short answer, key points, and a practical takeaway.
        </p>
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
                <ul className="list-disc pl-5 space-y-1">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
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
