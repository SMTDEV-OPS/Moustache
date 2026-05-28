import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/patterns";
import { EnhancedCallInterface } from "@/components/EnhancedCallInterface";
import { searchGuestByPhone } from "@/services/calls";
import { Phone } from "lucide-react";

const emptyGuest = {
  id: "",
  name: "Guest",
  phone: "",
  email: "",
  loyaltyStatus: "—",
  totalStays: 0,
  lastStay: "—",
  preferences: [] as string[],
  property: "—",
  interactionHistory: [] as Array<{
    date: string;
    type: string;
    channel: string;
    agent: string;
    summary: string;
  }>,
};

interface CallCenterViewProps {
  agentName: string;
  incomingCall?: boolean;
  onOpenLeadForm?: () => void;
}

export function CallCenterView({
  agentName,
  incomingCall = false,
  onOpenLeadForm,
}: CallCenterViewProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(emptyGuest);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const trimmed = phone.replace(/\D/g, "");
    if (trimmed.length < 10) {
      setError("Enter a valid phone number (10+ digits)");
      return;
    }
    setError(null);
    setLoading(true);
    setHasSearched(true);
    try {
      const result = await searchGuestByPhone(phone.trim());
      const g = result.guest;
      if (g) {
        setGuest({
          id: g._id,
          name: g.name || "Unknown",
          phone: g.phone || phone,
          email: g.email || "",
          loyaltyStatus: g.sunshineTier || (g.isSunshineMember ? "Member" : "—"),
          totalStays: g.totalReservationsCount ?? 0,
          lastStay: g.lastSeenAt ? new Date(g.lastSeenAt).toLocaleDateString() : "—",
          preferences: g.tags || [],
          property: "—",
          interactionHistory: (result.communicationHistory || []).map((c: { createdAt?: string; channel?: string; summary?: string }) => ({
            date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—",
            type: c.channel || "Contact",
            channel: c.channel || "—",
            agent: agentName,
            summary: c.summary || "",
          })),
        });
      } else {
        setGuest({
          ...emptyGuest,
          phone: phone.trim(),
          name: "New caller",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setGuest({ ...emptyGuest, phone: phone.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call center"
        subtitle="Search by phone to load guest history and create leads"
      />

      <div className="flex max-w-xl gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="h-10 border-border bg-surface pl-9"
            onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
          />
        </div>
        <Button variant="primary" onClick={() => void handleSearch()} loading={loading}>
          Look up
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!hasSearched ? (
        <EmptyState
          icon={Phone}
          title="Enter a phone number"
          description="Guest profile, past leads, and communication history will appear here."
        />
      ) : loading ? (
        <div className="flex items-center gap-2 py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading guest…
        </div>
      ) : (
        <EnhancedCallInterface
          guest={guest}
          incomingCall={incomingCall}
          onCallEnd={() => {}}
          agentName={agentName}
          onOpenLeadForm={onOpenLeadForm}
        />
      )}
    </div>
  );
}
