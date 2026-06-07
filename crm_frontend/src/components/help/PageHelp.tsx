import { HelpTip } from "./HelpTip";
import { getArticle, getArticleIdForView } from "@/content/training";

interface PageHelpProps {
  title: string;
  summary?: string;
  articleId?: string;
  relatedView?: string;
}

export function PageHelp({ title, summary, articleId, relatedView }: PageHelpProps) {
  const resolvedId = articleId ?? (relatedView ? getArticleIdForView(relatedView) : undefined);
  const resolvedSummary = summary ?? (resolvedId ? getArticle(resolvedId)?.summary : undefined);
  if (!resolvedSummary) return null;

  return <HelpTip title={title} summary={resolvedSummary} articleId={resolvedId} />;
}
