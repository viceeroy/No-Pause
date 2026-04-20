export interface BlogSection {
  heading: string;
  content: string;
  bullets?: string[];
}

export interface BlogPost {
  title: string;
  slug: string;
  date: string;
  description: string;
  readingTime: "1–2 min read";
  shortAnswer: string;
  sections: BlogSection[];
  takeaway: string;
  draft?: boolean;
}
