import { Link } from 'react-router-dom';
import { blogPosts } from '@/data/blog';

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
        {blogPosts.map((post) => (
          <Link key={post.slug} to={`/blog/${post.slug}`} className="block">
            <article className="rounded-2xl bg-surface-elevated border border-border shadow-card p-6 card-hover cursor-pointer">
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
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-sans mb-1.5">
                1-2 minute read
              </p>
              <p className="text-xs text-muted-foreground/85 font-sans">
                Includes short answer, key points, and a practical takeaway.
              </p>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}
