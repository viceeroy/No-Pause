const SITE_NAME = "No Pause";
const SITE_URL = "https://www.nopause.org";
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
    "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.",
};

export const getRouteSeoConfig = (pathname: string): RouteSeoConfig => {
  if (pathname === "/") {
    const description =
      "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.";
    const title = "NoPause – Speak with Confidence";
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
      "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.";
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
      "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.";
    return {
      title,
      description,
      canonicalPath: "/help",
      structuredData: buildWebPageSchema(title, description, "/help"),
    };
  }

  if (pathname === "/connect") {
    const title = "Connect Telegram | No Pause";
    const description = "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.";
    return {
      title,
      description,
      canonicalPath: "/connect",
      robots: "noindex, nofollow",
      structuredData: buildWebPageSchema(title, description, "/connect"),
    };
  }

  const title = "Page Not Found | No Pause";
  const description = "NoPause helps you speak with confidence. Record yourself, get a real-time Flow Score, reduce hesitations, and track your fluency over time.";
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
