import { TRAINING_ARTICLES } from "./articles";
import type { TrainingArticle, TrainingTrack, TrainingTrackMeta } from "./types";

export * from "./types";
export { TRAINING_ARTICLES };

export const TRAINING_TRACKS: TrainingTrackMeta[] = [
  { id: "getting-started", label: "Getting started", description: "Navigation and daily workflow" },
  { id: "leads", label: "Lead management", description: "Create, edit, and work leads" },
  { id: "sales", label: "Sales & PMS", description: "Quotations and room booking" },
  { id: "followups", label: "Follow-ups", description: "Tasks and calendar" },
  { id: "email", label: "Email", description: "Inbox and account setup" },
  { id: "knowledge", label: "Knowledge Base", description: "Property facts and resources" },
  { id: "reports", label: "Reports & Buddy", description: "Analytics and coverage" },
  { id: "admin", label: "Admin & Setup", description: "Configuration and users" },
  { id: "integrations", label: "Integrations", description: "WATI, Exotel, Gmail, eZee" },
];

const articleMap = new Map(TRAINING_ARTICLES.map((a) => [a.id, a]));

export function getArticle(id: string): TrainingArticle | undefined {
  return articleMap.get(id);
}

export function getArticleByView(view: string): TrainingArticle | undefined {
  return TRAINING_ARTICLES.find((a) => a.relatedView === view);
}

export function searchArticles(query: string): TrainingArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRAINING_ARTICLES;
  return TRAINING_ARTICLES.filter((a) => {
    const haystack = [
      a.title,
      a.summary,
      ...a.sections.flatMap((s) => [s.heading, s.body, ...(s.steps ?? []), ...(s.tips ?? [])]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function audienceMatches(article: TrainingArticle, role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (article.audience.includes("all")) return true;
  if (role === "admin" || role === "management") {
    return article.audience.some((a) => a === "admin" || a === "supervisor" || a === "all");
  }
  if (role === "ccmanager" || role === "saleshead") {
    return article.audience.some((a) => a === "supervisor" || a === "agent" || a === "all");
  }
  return article.audience.some((a) => a === "agent" || a === "all");
}

export function getArticlesForTrack(
  track: TrainingTrack,
  userRole: string,
  isAdmin: boolean
): TrainingArticle[] {
  return TRAINING_ARTICLES.filter((a) => a.track === track && audienceMatches(a, userRole, isAdmin));
}

export function getVisibleArticles(userRole: string, isAdmin: boolean): TrainingArticle[] {
  return TRAINING_ARTICLES.filter((a) => audienceMatches(a, userRole, isAdmin));
}

export function getSummaryForView(view: string): string | undefined {
  return getArticleByView(view)?.summary;
}

export function getArticleIdForView(view: string): string | undefined {
  return getArticleByView(view)?.id;
}

export const SETUP_ARTICLE_MAP: Record<string, string> = {
  "setup/roles": "setup-roles",
  "setup/profiles": "setup-roles",
  "setup/pipelines": "setup-pipelines",
  "setup/allocation": "setup-allocation",
  "setup/workflows": "setup-workflows",
  "setup/integrations": "integrations-overview",
  "setup/email-provider": "email-setup",
};
