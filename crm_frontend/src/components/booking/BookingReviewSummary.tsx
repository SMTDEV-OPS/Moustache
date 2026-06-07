type RoomLine = {
  id: string;
  roomTypeName?: string;
  roomTypeId?: string;
  planName?: string;
  adults: number;
  children: number;
  ratePerNight: number;
};

type Pricing = {
  roomCharges: number;
  taxes: number;
  due: number;
  totalPromotionSavings: number;
  manualDiscountSavings: number;
};

type Props = {
  hotelName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rows: RoomLine[];
  guestTitle: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  guestEmail: string;
  guestCity: string;
  guestState: string;
  guestCountry: string;
  lockedPromoCode: string | null;
  bookingDiscountPercent: number;
  pricing: Pricing;
  formatMoney: (n: number) => string;
};

export function BookingReviewSummary({
  hotelName,
  checkIn,
  checkOut,
  nights,
  rows,
  guestTitle,
  guestFirstName,
  guestLastName,
  guestPhone,
  guestEmail,
  guestCity,
  guestState,
  guestCountry,
  lockedPromoCode,
  bookingDiscountPercent,
  pricing,
  formatMoney,
}: Props) {
  return (
    <div className="rounded-lg border bg-card divide-y text-sm">
      <section className="p-4 space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stay</h3>
        <p className="font-medium">{hotelName}</p>
        <p className="text-muted-foreground">
          {checkIn} → {checkOut} · {nights} night{nights === 1 ? "" : "s"}
        </p>
        {lockedPromoCode ? (
          <p className="text-xs text-green-600">Promotion: {lockedPromoCode}</p>
        ) : null}
      </section>

      <section className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rooms</h3>
        {rows.map((r, idx) => {
          const preTax = r.ratePerNight * nights;
          return (
            <div key={r.id} className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="font-medium break-words">
                Room {idx + 1}: {r.roomTypeName || r.roomTypeId || "—"}
              </div>
              {r.planName ? <div className="text-muted-foreground text-xs break-words">Meal plan: {r.planName}</div> : null}
              <div className="text-xs text-muted-foreground">
                {r.adults} adult{r.adults === 1 ? "" : "s"}, {r.children ?? 0} child{(r.children ?? 0) === 1 ? "" : "ren"}
              </div>
              <div className="flex justify-between items-start gap-2 pt-1">
                <span className="text-muted-foreground text-xs">
                  {formatMoney(r.ratePerNight)}/night × {nights} night{nights === 1 ? "" : "s"}
                </span>
                <span className="font-medium shrink-0">{formatMoney(preTax)}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Name</span>
            <p className="font-medium">
              {guestTitle} {guestFirstName} {guestLastName}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Contact</span>
            <p className="break-all">{[guestPhone, guestEmail].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground text-xs">Location</span>
            <p>{[guestCity, guestState, guestCountry].filter(Boolean).join(", ") || "—"}</p>
          </div>
        </div>
      </section>

      <section className="p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing</h3>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Room charges (pre-tax)</span>
          <span>{formatMoney(pricing.roomCharges)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxes (est.)</span>
          <span>{formatMoney(pricing.taxes)}</span>
        </div>
        {lockedPromoCode && pricing.totalPromotionSavings > 0 ? (
          <div className="flex justify-between text-green-600">
            <span>Est. savings (promo)</span>
            <span>−{formatMoney(pricing.totalPromotionSavings)}</span>
          </div>
        ) : null}
        {bookingDiscountPercent > 0 && pricing.manualDiscountSavings > 0 ? (
          <div className="flex justify-between text-green-600">
            <span>Est. savings ({bookingDiscountPercent}% discount)</span>
            <span>−{formatMoney(pricing.manualDiscountSavings)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-semibold text-base pt-2 border-t">
          <span>Grand total (est.)</span>
          <span>{formatMoney(pricing.due)}</span>
        </div>
      </section>
    </div>
  );
}
