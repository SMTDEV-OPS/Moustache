import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { importDirectoryFromExcel } from "@/services/knowledgeBase";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function ExcelImportButton({
  canManage,
  onImported,
}: {
  canManage: boolean;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canManage) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void (async () => {
            try {
              const r = await importDirectoryFromExcel(f);
              const failedMsg =
                r.failed.length > 0
                  ? ` ${r.failed.length} failed: ${r.failed.slice(0, 6).join("; ")}${r.failed.length > 6 ? "…" : ""}`
                  : "";
              toast.success(`Imported ${r.imported} propert${r.imported === 1 ? "y" : "ies"}.${failedMsg}`);
              if (r.skipped.length > 0) {
                toast.message(`${r.skipped.length} sheet(s) skipped`);
              }
              onImported();
            } catch (err) {
              console.error(err);
              toast.error(
                err instanceof Error ? err.message : "Excel import failed"
              );
            }
          })();
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-sm gap-1.5"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Import from Excel
      </Button>
    </>
  );
}
