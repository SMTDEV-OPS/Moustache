import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TRAINING_TRACKS,
  getArticle,
  getArticlesForTrack,
  getVisibleArticles,
  searchArticles,
  type TrainingArticle,
  type TrainingTrack,
} from "@/content/training";

interface TrainingHubProps {
  initialArticleId?: string;
  userRole: string;
  isAdmin?: boolean;
  onArticleChange?: (articleId: string) => void;
  onNavigateToView?: (view: string) => void;
}

function ArticleBodyWithNav({
  article,
  onNavigateToView,
}: {
  article: TrainingArticle;
  onNavigateToView?: (view: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-text-muted text-sm leading-relaxed">{article.summary}</p>
      {article.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          {section.heading && (
            <h3 className="text-sm font-semibold text-text">{section.heading}</h3>
          )}
          {section.body && (
            <p className="text-sm text-text-muted leading-relaxed">{section.body}</p>
          )}
          {section.steps && section.steps.length > 0 && (
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-text-muted">
              {section.steps.map((step, j) => (
                <li key={j} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          )}
          {section.tips && section.tips.length > 0 && (
            <ul className="space-y-1 text-sm text-text-muted border-l-2 border-primary/30 pl-3">
              {section.tips.map((tip, j) => (
                <li key={j}>{tip}</li>
              ))}
            </ul>
          )}
          {section.callout && (
            <p className="text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 text-amber-900 dark:text-amber-100">
              {section.callout}
            </p>
          )}
        </div>
      ))}
      {article.kbLinks && article.kbLinks.length > 0 && (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-faint">Related</p>
          {article.kbLinks.map((link) => (
            <button
              key={link.view}
              type="button"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              onClick={() => onNavigateToView?.(link.view)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {link.label}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrainingHub({
  initialArticleId,
  userRole,
  isAdmin = false,
  onArticleChange,
  onNavigateToView,
}: TrainingHubProps) {
  const [search, setSearch] = useState("");
  const [activeTrack, setActiveTrack] = useState<TrainingTrack>("getting-started");
  const [selectedId, setSelectedId] = useState<string>(
    initialArticleId ?? "getting-started"
  );

  useEffect(() => {
    if (initialArticleId) {
      setSelectedId(initialArticleId);
      const article = getArticle(initialArticleId);
      if (article) setActiveTrack(article.track);
    }
  }, [initialArticleId]);

  const visibleArticles = useMemo(
    () => getVisibleArticles(userRole, isAdmin),
    [userRole, isAdmin]
  );

  const trackArticles = useMemo(() => {
    if (search.trim()) {
      return searchArticles(search).filter((a) =>
        visibleArticles.some((v) => v.id === a.id)
      );
    }
    return getArticlesForTrack(activeTrack, userRole, isAdmin);
  }, [search, activeTrack, userRole, isAdmin, visibleArticles]);

  const selectedArticle = getArticle(selectedId) ?? getArticle("getting-started");

  const selectArticle = (id: string) => {
    setSelectedId(id);
    onArticleChange?.(id);
    const article = getArticle(id);
    if (article) setActiveTrack(article.track);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0" style={{ padding: 24, gap: 0 }}>
      <aside
        className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-4 mb-4 lg:mb-0"
      >
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-lg font-semibold text-text">Training</h1>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            placeholder="Search guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {!search.trim() && (
          <nav className="space-y-0.5 mb-4">
            {TRAINING_TRACKS.map((track) => {
              const count = getArticlesForTrack(track.id, userRole, isAdmin).length;
              if (count === 0) return null;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setActiveTrack(track.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors",
                    activeTrack === track.id
                      ? "bg-primary-light text-primary font-medium"
                      : "text-text-muted hover:bg-hover hover:text-text"
                  )}
                >
                  {track.label}
                </button>
              );
            })}
          </nav>
        )}
        <div className="space-y-0.5 max-h-[40vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto">
          {trackArticles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => selectArticle(article.id)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors truncate",
                selectedId === article.id
                  ? "bg-hover text-text font-medium"
                  : "text-text-muted hover:bg-hover hover:text-text"
              )}
            >
              {article.title}
            </button>
          ))}
          {trackArticles.length === 0 && (
            <p className="text-sm text-text-muted px-2">No guides found.</p>
          )}
        </div>
        <p className="text-xs text-text-faint mt-4 px-2 leading-relaxed hidden lg:block">
          Property PDFs and videos are in Knowledge Base → Resources.
        </p>
      </aside>

      <main className="flex-1 lg:pl-6 min-w-0 overflow-y-auto">
        {selectedArticle && (
          <>
            <h2 className="text-xl font-semibold text-text mb-4">{selectedArticle.title}</h2>
            <ArticleBodyWithNav article={selectedArticle} onNavigateToView={onNavigateToView} />
          </>
        )}
      </main>
    </div>
  );
}
