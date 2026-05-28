import { ExternalLink, Copy, Mail, Phone, Globe, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { KnowledgeRateRow } from "@/lib/propertyKnowledge";

const URL_RE = /^(https?:\/\/|mailto:|tel:)/i;
const DRIVE_RE = /drive\.google\.com|docs\.google\.com/i;

export function isUrlLike(value: string): boolean {
  const v = value.trim();
  return URL_RE.test(v) || DRIVE_RE.test(v) || v.startsWith("www.");
}

export function normalizeHref(value: string): string {
  const v = value.trim();
  if (URL_RE.test(v)) return v;
  if (DRIVE_RE.test(v) || v.startsWith("www.")) {
    return v.startsWith("http") ? v : `https://${v.replace(/^www\./, "www.")}`;
  }
  return v;
}

export function KnowledgeLink({
  href,
  label,
  className,
  variant = "link",
}: {
  href: string;
  label?: string;
  className?: string;
  variant?: "link" | "button";
}) {
  const url = normalizeHref(href);
  const display = label || href;
  const isDrive = DRIVE_RE.test(url);

  if (variant === "button") {
    return (
      <Button variant="outline" size="sm" className={cn("gap-2", className)} asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {isDrive ? <FolderOpen className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          {display}
        </a>
      </Button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-primary hover:underline break-all",
        className
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      {display}
    </a>
  );
}

export function KnowledgeDriveCard({
  url,
  title = "Property photos",
}: {
  url: string;
  title?: string;
}) {
  const copyUrl = () => {
    void navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{url}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <KnowledgeLink href={url} label="Open photo folder" variant="button" />
        <Button type="button" variant="ghost" size="sm" onClick={copyUrl} className="gap-1">
          <Copy className="h-3.5 w-3.5" />
          Copy link
        </Button>
      </div>
    </div>
  );
}

export function KnowledgeProse({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  if (isUrlLike(text)) {
    return <KnowledgeLink href={text} className={className} />;
  }
  return (
    <p className={cn("text-sm text-foreground leading-relaxed whitespace-pre-wrap", className)}>
      {text}
    </p>
  );
}

export function KnowledgeList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatInrRate(rate: string): string {
  const trimmed = rate.trim();
  const num = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0 || /[^\d.]/.test(trimmed.replace(/,/g, ""))) {
    return trimmed;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function KnowledgeRateTable({ rates }: { rates: KnowledgeRateRow[] }) {
  if (!rates.length) return null;
  return (
    <Card className="overflow-hidden border-border shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Room</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rack rate</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-border last:border-0",
                  i % 2 === 1 && "bg-muted/20"
                )}
              >
                <td className="px-4 py-3 font-medium">{row.room}</td>
                <td className="px-4 py-3 text-foreground tabular-nums">
                  {formatInrRate(row.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function KnowledgeContactCards({
  phone,
  email,
  website,
}: {
  phone?: string;
  email?: string;
  website?: string;
}) {
  const cards = [
    phone && {
      icon: Phone,
      label: "Phone",
      href: `tel:${phone.replace(/\s/g, "")}`,
      display: phone,
    },
    email && {
      icon: Mail,
      label: "Email",
      href: `mailto:${email}`,
      display: email,
    },
    website && {
      icon: Globe,
      label: "Website",
      href: normalizeHref(website),
      display: website,
    },
  ].filter(Boolean) as Array<{
    icon: typeof Phone;
    label: string;
    href: string;
    display: string;
  }>;

  if (!cards.length) return null;

  const iconColors = [
    "bg-blue-500/10 text-blue-600",
    "bg-emerald-500/10 text-emerald-600",
    "bg-violet-500/10 text-violet-600",
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ icon: Icon, label, href, display }, i) => (
        <a
          key={label}
          href={href}
          target={label === "Website" ? "_blank" : undefined}
          rel={label === "Website" ? "noopener noreferrer" : undefined}
          className="rounded-xl border border-border bg-muted/30 p-5 hover:bg-muted/50 transition-colors min-h-[100px]"
        >
          <div
            className={cn(
              "mb-3 flex h-10 w-10 items-center justify-center rounded-full",
              iconColors[i % iconColors.length]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-semibold mt-1 break-all">{display}</p>
        </a>
      ))}
    </div>
  );
}

export function KnowledgeFieldGrid({
  fields,
}: {
  fields: Array<{ label: string; value: string }>;
}) {
  const visible = fields.filter((f) => f.value.trim());
  if (!visible.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map((f, i) => (
        <div key={i} className="rounded-md border border-border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {f.label}
          </p>
          <div className="mt-1">
            {isUrlLike(f.value) ? (
              <KnowledgeLink href={f.value} />
            ) : (
              <KnowledgeProse text={f.value} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
