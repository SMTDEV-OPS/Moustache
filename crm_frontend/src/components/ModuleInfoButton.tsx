import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModuleInfoButtonProps {
  description: string;
  className?: string;
}

export function ModuleInfoButton({ description, className }: ModuleInfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "h-4 w-4 rounded-full p-0 hover:bg-sidebar-accent/50 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
            }
          }}
        >
          <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4 text-sm"
        side="right"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h4 className="font-semibold text-sm mb-2">Module Information</h4>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
