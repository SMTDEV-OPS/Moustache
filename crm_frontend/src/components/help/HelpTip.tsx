import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTraining } from "@/context/TrainingContext";

interface HelpTipProps {
  summary: string;
  articleId?: string;
  title?: string;
  className?: string;
}

export function HelpTip({ summary, articleId, title = "Help", className }: HelpTipProps) {
  const { openTraining } = useTraining();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-hover transition-colors",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 text-sm" side="right" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="font-medium text-sm mb-1.5">{title}</p>
        <p className="text-text-muted leading-relaxed text-sm">{summary}</p>
        {articleId && (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 mt-3 text-sm text-primary"
            onClick={() => openTraining(articleId)}
          >
            Open full guide →
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
