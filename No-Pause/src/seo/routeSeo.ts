import { getBlogPostBySlug } from "@/data/blog";

const SITE_NAME = "No Pause";
const SITE_URL = "https://nopause.org";
const DEFAULT_IMAGE = `${SITE_URL}/preview.png`;

export interface RouteSeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  structuredData: Record<string, unknown>;
}

const buildWebSiteSchema = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

const buildWebPageSchema = (title: string, description: string, canonicalPath: string) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: title,
  url: `${SITE_URL}${canonicalPath}`,
  description,
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
});

const practiceSeoByMode = (mode: string): Pick<RouteSeoConfig, "title" | "description"> => {
  if (mode === "lemon") {
    return {
      title: "Lemon Technique Practice | No Pause",
      description:
        "Train fast-thinking speech with Lemon Technique prompts and improve fluency under pressure.",
    };
  }

  if (mode === "topic") {
    return {
      title: "Topic Score Practice | No Pause",
      description:
        "Practice topic-based speaking and track your fluency score to improve clarity and flow.",
    };
  }

  return {
    title: "Free Speaking Practice | No Pause",
    description:
      "Practice continuous speaking in free mode, reduce hesitation, and build stronger speaking flow.",
  };
};

export const getRouteSeoConfig = (pathname: string, search: string): RouteSeoConfig => {
  const searchParams = new URLSearchParams(search);

  if (pathname === "/") {
    const description =
      "No Pause is a real-time speaking analytics tool that helps you improve speaking fluency, reduce hesitations, and track your Flow Score.";
    const title = "No Pause - Real-time Speaking Analytics Tool";
    return {
      title,
      description,
      canonicalPath: "/",
      structuredData: buildWebSiteSchema(description),
    };
  }

  if (pathname === "/practice/free-speaking") {
    const title = "Free Speaking Mode | No Pause";
    const description =
      "Practice uninterrupted free speaking with No Pause and build confidence in real-time speech delivery.";
    return {
      title,
      description,
      canonicalPath: "/practice/free-speaking",
      structuredData: buildWebPageSchema(title, description, "/practice/free-speaking"),
    };
  }

  if (pathname === "/practice") {
    const mode = searchParams.get("mode") || "free";
    const { title, description } = practiceSeoByMode(mode);
    return {
      title,
      description,
      canonicalPath: "/practice",
      structuredData: buildWebPageSchema(title, description, "/practice"),
    };
  }

  if (pathname === "/prompts") {
    const title = "Speaking Prompts Library | No Pause";
    const description =
      "Browse speaking prompts by category and difficulty, then jump directly into timed practice sessions.";
    return {
      title,
      description,
      canonicalPath: "/prompts",
      structuredData: buildWebPageSchema(title, description, "/prompts"),
    };
  }

  if (pathname === "/stats" || pathname === "/history") {
    const title = "Fluency Stats & Progress | No Pause";
    const description =
      "Review Flow Score trends, session history, and speaking progress across your practice modes.";
    return {
      title,
      description,
      canonicalPath: "/stats",
      structuredData: buildWebPageSchema(title, description, "/stats"),
    };
  }

  if (pathname === "/blog") {
    const title = "No Pause Blog | Speaking Analytics and Fluency Tips";
    const description =
      "Read No Pause blog posts on speaking practice, fluency improvement, hesitation control, and real-time speaking analytics.";
    return {
      title,
      description,
      canonicalPath: "/blog",
      structuredData: buildWebPageSchema(title, description, "/blog"),
    };
  }

  if (pathname.startsWith("/blog/")) {
    const slug = decodeURIComponent(pathname.replace("/blog/", ""));
    const post = getBlogPostBySlug(slug);
    if (post) {
      return {
        title: `${post.title} | No Pause`,
        description: post.description,
        canonicalPath: `/blog/${post.slug}`,
        structuredData: buildWebPageSchema(
          `${post.title} | No Pause`,
          post.description,
          `/blog/${post.slug}`,
        ),
      };
    }

    return {
      title: "Blog Post Not Found | No Pause",
      description: "The blog post you requested was not found on No Pause.",
      canonicalPath: pathname,
      robots: "noindex, nofollow",
      structuredData: buildWebPageSchema(
        "Blog Post Not Found | No Pause",
        "The blog post you requested was not found on No Pause.",
        pathname,
      ),
    };
  }

  const title = "Page Not Found | No Pause";
  const description = "The page you requested was not found on No Pause.";
  return {
    title,
    description,
    canonicalPath: pathname || "/",
    robots: "noindex, nofollow",
    structuredData: buildWebPageSchema(title, description, pathname || "/"),
  };
};

export const seoDefaults = {
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
  defaultImage: DEFAULT_IMAGE,
};
