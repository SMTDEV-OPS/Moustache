import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getLeadBooking, type LeadBooking } from "@/services/leadBookings";

function money(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  bookingId: string | null;
};

export function BookingDetailDialog({ open, onOpenChange, leadId, bookingId }: Props) {
  const [booking, setBooking] = useState<LeadBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bookingId) {
      setBooking(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getLeadBooking(leadId, bookingId)
      .then(setBooking)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load booking"))
      .finally(() => setLoading(false));
  }, [open, leadId, bookingId]);

  const hotelName =
    booking && typeof booking.propertyId === "object"
      ? (booking.propertyId as { name?: string }).name
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Booking {booking?.ezeeBookingRef ? `#${booking.ezeeBookingRef}` : "details"}
            {booking ? (
              <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : booking ? (
          <div className="space-y-4 text-sm">
            {booking.processedInPms === false ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-xs">
                Pending PMS confirmation — reservation may need manual processing in eZee.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Hotel</div>
                <div className="font-medium">{hotelName || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Nights</div>
                <div className="font-medium">{booking.nights}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Check-in</div>
                <div>{fmtDate(booking.checkIn)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Check-out</div>
                <div>{fmtDate(booking.checkOut)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Guest</div>
              <div className="font-medium">{booking.guestName}</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {[booking.guestPhone, booking.guestEmail].filter(Boolean).join(" · ")}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rooms</div>
              {(booking.rooms || []).map((r, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-1">
                  <div className="font-medium break-words">{r.roomTypeName || r.roomTypeId}</div>
                  <div className="text-xs text-muted-foreground break-words">{r.planName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.adults} adult{r.adults === 1 ? "" : "s"}, {r.children ?? 0} child{(r.children ?? 0) === 1 ? "" : "ren"}
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span>{money(r.baseRate)}/night</span>
                    <span className="font-medium">Line total: {money(r.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-semibold text-base border-t pt-3">
              <span>Grand total</span>
              <span>{money(booking.grandTotal)}</span>
            </div>

            {booking.specialRequest?.trim() ? (
              <div>
                <div className="text-xs text-muted-foreground">Special request</div>
                <p className="mt-1">{booking.specialRequest}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
