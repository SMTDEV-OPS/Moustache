import { HelpTip } from "@/components/help/HelpTip";
import { cn } from "@/lib/utils";

interface ModuleInfoButtonProps {
  description: string;
  articleId?: string;
  className?: string;
}

export function ModuleInfoButton({ description, articleId, className }: ModuleInfoButtonProps) {
  return (
    <HelpTip
      title="Module information"
      summary={description}
      articleId={articleId}
      className={cn(className)}
    />
  );
}
