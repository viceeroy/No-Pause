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

const practiceSeo: Pick<RouteSeoConfig, "title" | "description"> = {
  title: "Speaking Mode | No Pause",
  description:
    "Practice continuous speaking, reduce hesitation, and build stronger speaking flow.",
};

export const getRouteSeoConfig = (pathname: string): RouteSeoConfig => {
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

  if (pathname === "/practice") {
    const { title, description } = practiceSeo;
    return {
      title,
      description,
      canonicalPath: "/practice",
      structuredData: buildWebPageSchema(title, description, "/practice"),
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

  if (pathname === "/help") {
    const title = "Help | No Pause";
    const description =
      "Learn how No Pause scoring, pauses, prompts, streaks, challenges, and Telegram practice work.";
    return {
      title,
      description,
      canonicalPath: "/help",
      structuredData: buildWebPageSchema(title, description, "/help"),
    };
  }

  if (pathname === "/connect") {
    const title = "Connect Telegram | No Pause";
    const description = "Connect your Telegram account to No Pause and get Flow Scores from voice notes.";
    return {
      title,
      description,
      canonicalPath: "/connect",
      robots: "noindex, nofollow",
      structuredData: buildWebPageSchema(title, description, "/connect"),
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
