import { useParams } from "react-router-dom";
import { PropertyGuideView } from "@/components/knowledge/PropertyGuideView";

/** Public read-only property guide (no CRM chrome). */
export default function PropertyGuidePublic() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-destructive text-center">Invalid link</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 text-center">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Postcard Hotels · Property Guide
        </span>
      </header>
      <PropertyGuideView shareToken={token} mode="public" />
    </div>
  );
}
