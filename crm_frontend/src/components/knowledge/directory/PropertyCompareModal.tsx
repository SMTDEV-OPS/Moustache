import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HotelDirectoryEntry } from "@/services/knowledgeBase";
import { DirectoryDetailPanel } from "./DirectoryDetailPanel";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PropertyCompareModal({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: HotelDirectoryEntry[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col rounded-sm border border-border p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-border">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Compare properties
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 px-6 py-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(entries.length, 3)}, minmax(0, 1fr))`,
            }}
          >
            {entries.map((e) => (
              <div
                key={e.propertyId}
                className="min-w-0 rounded-md border border-border bg-card p-4 space-y-3"
              >
                <div>
                  <h3 className="font-semibold text-foreground leading-tight">
                    {e.propertyName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{e.propertyCode}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className="text-xs rounded-sm">
                      {e.tier}
                    </Badge>
                    <Badge variant="secondary" className="text-xs rounded-sm">
                      {e.region}
                    </Badge>
                  </div>
                </div>
                <DirectoryDetailPanel content={e.content} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
