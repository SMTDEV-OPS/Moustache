import { useState } from "react";
import { testAssignment, type TestAssignmentPayload, type TestAssignmentResult } from "@/services/leads";
import { useToast } from "@/hooks/use-toast";

const LEAD_SOURCES = [
  { value: "BRAND_WEBSITE", label: "Brand Website" },
  { value: "DIRECT_CALL", label: "Direct Call" },
  { value: "IVR", label: "IVR" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MANUAL", label: "Manual" },
];

const LEAD_TYPES = [
  { value: "STAY", label: "Stay" },
  { value: "WEDDING", label: "Wedding" },
  { value: "MICE", label: "MICE" },
  { value: "DINING", label: "Dining" },
];

export function LeadAllocationTest() {
  const { toast } = useToast();
  const [payload, setPayload] = useState<TestAssignmentPayload>({
    source: "BRAND_WEBSITE",
    leadType: "STAY",
    budget: 500000,
    bookingWindow: "Within 24 hrs",
    customerType: "B2C",
  });
  const [result, setResult] = useState<TestAssignmentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await testAssignment(payload);
      setResult(res);
    } catch (e) {
      toast({ title: "Test failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Simulate a lead and see which agent would be assigned. No lead is created.
      </p>

      <div className="border rounded-lg p-4 space-y-4 bg-card">
        <h3 className="text-sm font-medium">Sample lead</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Source</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={payload.source ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, source: e.target.value }))}
            >
              {LEAD_SOURCES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Lead type</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={payload.leadType ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, leadType: e.target.value }))}
            >
              {LEAD_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Budget</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="e.g. 500000"
              value={payload.budget ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, budget: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Booking window</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="e.g. Within 5 hrs"
              value={payload.bookingWindow ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, bookingWindow: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Customer type</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="e.g. B2C"
              value={payload.customerType ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, customerType: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={handleTest}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Testing..." : "Test assignment"}
        </button>
      </div>

      {result && (
        <div className="border rounded-lg p-4 bg-card space-y-2">
          <h3 className="text-sm font-medium">Result</h3>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Method:</dt>
              <dd className="font-medium">{result.assignment.assignmentSource ?? result.assignment.assignmentMethod ?? "—"}</dd>
            </div>
            {result.assignment.assignmentRuleName && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Rule:</dt>
                <dd>{result.assignment.assignmentRuleName}</dd>
              </div>
            )}
            {result.assignment.assignedToUserId && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Assigned to:</dt>
                <dd>{result.assignment.assignedToUserId}</dd>
              </div>
            )}
            {result.assignment.isOverflow && (
              <div className="text-amber-600">Overflow — no agents available</div>
            )}
            {result.assignment.reason && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Reason:</dt>
                <dd>{result.assignment.reason}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
