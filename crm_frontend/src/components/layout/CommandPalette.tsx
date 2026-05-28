import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Phone,
  Clock,
  Calendar,
  Settings2,
  Mail,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { cn } from "@/lib/utils";

const COMMANDS = [
  { label: "Dashboard", path: CRM_PATHS.dashboard, icon: LayoutDashboard },
  { label: "Leads", path: CRM_PATHS.leads, icon: Users },
  { label: "Call center", path: CRM_PATHS.calls, icon: Phone },
  { label: "Follow-ups", path: CRM_PATHS.followUps, icon: Clock },
  { label: "Accounts", path: CRM_PATHS.accounts, icon: Building2 },
  { label: "Email", path: CRM_PATHS.email, icon: Mail },
  { label: "Settings", path: CRM_PATHS.settings, icon: Settings2 },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const run = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 border-border">
        <div className="border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-2">
          {filtered.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <li key={cmd.path}>
                <button
                  type="button"
                  onClick={() => run(cmd.path)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text",
                    "hover:bg-hover transition-colors duration-fast"
                  )}
                >
                  <Icon className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                  {cmd.label}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-text-muted">
              No matches
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
