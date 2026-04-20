import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export type QuotationFormat = "HOSTEL" | "SELECT" | "LUXURIA";

export interface QuotationPreviewRow {
  roomTypeName: string;
  mealPlanName: string;
  adults: number;
  children: number;
  baseRateNight: number;
  discountAmountTotal: number;
  discountedSubtotal: number;
  taxPercent: number;
  taxTotal: number;
  roomTotal: number;
  extraAdultRate?: number;
  extraChildRate?: number;
}

export interface QuotationPreviewProps {
  format: QuotationFormat;
  loading?: boolean;
  loadError?: string;
  hotelName: string;
  hotelAddress?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights: number;
  guestName?: string;
  guestAdults?: number;
  guestChildren?: number;
  details: Record<string, unknown>;
  rows: QuotationPreviewRow[];
  grandTotal: number;
  totalTax: number;
  gstNote: string;
  formatCurrency: (n: number) => string;
}

/** PMS sometimes returns HTML in text fields; strip for preview parity with email cleaning. */
function stripHtmlToPlain(text: string): string {
  if (!text || !text.includes("<")) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function str(details: Record<string, unknown>, key: string): string {
  const v = details[key];
  if (v === null || v === undefined) return "";
  return stripHtmlToPlain(String(v).trim());
}

function firstHeroImage(details: Record<string, unknown>): string | undefined {
  const imgs = details.HotelImages;
  if (!Array.isArray(imgs) || imgs.length === 0) return undefined;
  const first = imgs[0] as unknown;
  if (typeof first === "string" && first.trim()) return first.trim();
  if (first && typeof first === "object") {
    const o = first as Record<string, unknown>;
    const u = o.url ?? o.URL ?? o.Image_URL ?? o.image_url ?? o.ImageUrl;
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return undefined;
}

function facilitiesBullets(text: string, max: number): string[] {
  if (!text) return [];
  const parts = text
    .split(/\n|•|·|\||;/g)
    .map((s) => s.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean);
  const out = parts.length > 0 ? parts : text.split(/\.(?=\s)/).map((s) => s.trim()).filter(Boolean);
  return out.slice(0, max);
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : t.slice(0, 120)).trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}

function StarRow({ n }: { n: number }) {
  const capped = Math.min(5, Math.max(0, Math.round(n)));
  return (
    <span className="text-amber-500 tracking-tight" aria-label={`${capped} stars`}>
      {"★".repeat(capped)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - capped)}</span>
    </span>
  );
}

export function QuotationPreview({
  format,
  loading,
  loadError,
  hotelName,
  hotelAddress,
  checkInDate,
  checkOutDate,
  nights,
  guestName,
  guestAdults,
  guestChildren,
  details,
  rows,
  grandTotal,
  totalTax,
  gstNote,
  formatCurrency,
}: QuotationPreviewProps) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hero = firstHeroImage(details);
  const city = str(details, "City");
  const address = str(details, "Address");
  const phone = str(details, "Phone") || str(details, "Reservation_Phone");
  const email = str(details, "Email");
  const website = str(details, "Website");
  const checkInPol = str(details, "CheckIn_Policy");
  const facilitiesRaw = str(details, "Facilities_Attractions");
  const hotelPolicy = str(details, "Hotel_Policy");
  const cancelPol = str(details, "Cancellation_Policy");
  const parking = str(details, "Parking_Policy");
  const childrenExtra = str(details, "Children_ExtraGuest_Details");
  const description = str(details, "Hotel_Description");
  const thingsToDo = str(details, "ThingsToDo");
  const bookingCond = str(details, "Booking_Conditions");
  const travelDir = str(details, "Travel_Directions");
  const landmarks = str(details, "Landmarks_Nearby");
  const propType = str(details, "Property_Type");
  const gradeRaw = str(details, "grade");
  const gradeNum = Number.parseInt(gradeRaw, 10);
  const stars = Number.isFinite(gradeNum) ? gradeNum : null;

  const bullets = facilitiesBullets(facilitiesRaw, format === "HOSTEL" ? 10 : 14);

  const bookingBlock = (
    <section className="rounded-lg border bg-muted/20 p-4 space-y-1 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your booking</h3>
      {guestName ? <div>Guest: {guestName}</div> : null}
      <div>
        Check-in: {checkInDate || "—"} · Check-out: {checkOutDate || "—"} · {nights} night{nights === 1 ? "" : "s"}
      </div>
      {(guestAdults != null || guestChildren != null) && (
        <div>
          Adults: {guestAdults ?? "—"} · Children: {guestChildren ?? "—"}
        </div>
      )}
    </section>
  );

  const pricingTable = (opts: { showExtraCols: boolean; compact?: boolean }) => (
    <section className="overflow-x-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Room & pricing</h3>
      <table className="w-full text-sm border-collapse text-left">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-2">Room</th>
            <th className="py-2 pr-2">Meal</th>
            {!opts.compact ? <th className="py-2 pr-2 text-right">Beds</th> : null}
            <th className="py-2 pr-2 text-right">Base/night</th>
            <th className="py-2 pr-2 text-right">Discount</th>
            <th className="py-2 pr-2 text-right">Pre-tax</th>
            <th className="py-2 pr-2 text-right">Tax</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-2 pr-2 align-top">{r.roomTypeName || "—"}</td>
              <td className="py-2 pr-2 align-top">{r.mealPlanName || "—"}</td>
              {!opts.compact ? (
                <td className="py-2 pr-2 text-right align-top whitespace-nowrap">
                  {r.adults}A/{r.children}C
                </td>
              ) : null}
              <td className="py-2 pr-2 text-right align-top">{formatCurrency(r.baseRateNight)}</td>
              <td className="py-2 pr-2 text-right align-top">{formatCurrency(r.discountAmountTotal)}</td>
              <td className="py-2 pr-2 text-right align-top">{formatCurrency(r.discountedSubtotal)}</td>
              <td className="py-2 pr-2 text-right align-top whitespace-nowrap">
                {r.taxPercent}% · {formatCurrency(r.taxTotal)}
              </td>
              <td className="py-2 text-right align-top font-medium">{formatCurrency(r.roomTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {opts.showExtraCols && rows.some((r) => r.extraAdultRate != null || r.extraChildRate != null) ? (
        <p className="text-[11px] text-muted-foreground mt-2">
          PMS extra guest rates (reference):{" "}
          {rows
            .map((r, i) =>
              r.extraAdultRate != null || r.extraChildRate != null
                ? `#${i + 1} extra adult ${r.extraAdultRate != null ? formatCurrency(r.extraAdultRate) : "—"} / child ${r.extraChildRate != null ? formatCurrency(r.extraChildRate) : "—"}`
                : null
            )
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );

  const grandBox = (emphasis: "default" | "large") => (
    <section
      className={
        emphasis === "large"
          ? "rounded-xl border-2 border-foreground/10 bg-gradient-to-br from-muted/30 to-muted/5 p-6 space-y-1"
          : "rounded-lg border bg-muted/15 p-4 space-y-1"
      }
    >
      <div className="text-xs text-muted-foreground">Quotation grand total</div>
      <div className={emphasis === "large" ? "text-3xl font-semibold tracking-tight" : "text-2xl font-semibold"}>
        {formatCurrency(grandTotal)}
      </div>
      <div className="text-xs text-muted-foreground">Tax included: {formatCurrency(totalTax)}</div>
      <p className="text-[11px] text-muted-foreground pt-2 leading-snug">{gstNote}</p>
    </section>
  );

  const footerDisclaimer = (brand: string) => (
    <footer className="text-[11px] text-muted-foreground border-t pt-4 space-y-2">
      <p>This quotation is provisional and subject to availability at the time of confirmation.</p>
      <p>
        {brand} — for questions, contact {phone || email || "your reservations team"}.
      </p>
    </footer>
  );

  return (
    <div className="space-y-6 text-sm leading-relaxed max-w-3xl">
      {loadError ? (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hotel details</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {format === "HOSTEL" && (
        <>
          <header className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{hotelName}</h2>
            <p className="text-muted-foreground text-xs">Moustache Hostels · {city || hotelAddress || ""}</p>
            {(address || hotelAddress) && <p className="text-xs">{address || hotelAddress}</p>}
            {(phone || email) && (
              <p className="text-xs text-muted-foreground">
                {phone}
                {phone && email ? " · " : ""}
                {email}
              </p>
            )}
          </header>
          {hero ? (
            <img src={hero} alt="" className="w-full max-h-56 object-cover rounded-lg border" />
          ) : null}
          {bookingBlock}
          {pricingTable({ showExtraCols: false, compact: false })}
          {grandBox("default")}
          {checkInPol ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Check-in</h3>
              <p className="whitespace-pre-line text-sm">{checkInPol}</p>
            </section>
          ) : null}
          {bullets.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Facilities</h3>
              <ul className="list-disc pl-5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {hotelPolicy ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">House rules</h3>
              <p>{truncate(hotelPolicy, 400)}</p>
              {hotelPolicy.length > 400 ? <p className="text-xs text-muted-foreground mt-1">View full policy in confirmation.</p> : null}
            </section>
          ) : null}
          {cancelPol ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cancellation</h3>
              <p className="whitespace-pre-line">{cancelPol}</p>
            </section>
          ) : null}
          {footerDisclaimer("Moustache Hostels")}
        </>
      )}

      {format === "SELECT" && (
        <>
          <header className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{hotelName}</h2>
            {stars != null ? <StarRow n={stars} /> : null}
            <p className="text-muted-foreground">{city || ""}</p>
            {(address || hotelAddress) && <p className="text-xs">{address || hotelAddress}</p>}
            <p className="text-xs text-muted-foreground">
              {[phone, email, website].filter(Boolean).join(" · ")}
            </p>
          </header>
          {hero ? <img src={hero} alt="" className="w-full max-h-56 object-cover rounded-lg border" /> : null}
          {description ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">About the property</h3>
              <p>{truncate(description, 600)}</p>
            </section>
          ) : null}
          {bookingBlock}
          {pricingTable({ showExtraCols: true })}
          {grandBox("default")}
          {rows.some((r) => r.mealPlanName) ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Inclusions</h3>
              <ul className="list-disc pl-5 space-y-1">
                {rows.map((r, i) =>
                  r.mealPlanName ? (
                    <li key={i}>
                      {r.roomTypeName}: {r.mealPlanName}
                    </li>
                  ) : null
                )}
              </ul>
            </section>
          ) : null}
          {facilitiesRaw ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Facilities & amenities</h3>
              <p className="whitespace-pre-line">{facilitiesRaw}</p>
            </section>
          ) : null}
          {checkInPol ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Check-in policy</h3>
              <p className="whitespace-pre-line">{checkInPol}</p>
            </section>
          ) : null}
          {cancelPol ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cancellation policy</h3>
              <p className="whitespace-pre-line">{cancelPol}</p>
            </section>
          ) : null}
          {parking ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Parking</h3>
              <p className="whitespace-pre-line">{parking}</p>
            </section>
          ) : null}
          {childrenExtra ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Children & extra guests</h3>
              <p className="whitespace-pre-line">{childrenExtra}</p>
            </section>
          ) : null}
          {footerDisclaimer("Moustache Select")}
        </>
      )}

      {format === "LUXURIA" && (
        <>
          <header className="space-y-2 border-b pb-4">
            <h2 className="text-3xl font-light tracking-tight">{hotelName}</h2>
            {propType ? <p className="text-xs uppercase tracking-widest text-muted-foreground">{propType}</p> : null}
            {stars != null ? <StarRow n={stars} /> : null}
            {description ? <p className="text-sm text-muted-foreground italic">{firstSentence(description)}</p> : null}
          </header>
          {hero ? <img src={hero} alt="" className="w-full max-h-72 object-cover rounded-lg border" /> : null}
          {description ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">The experience</h3>
              <p className="whitespace-pre-line">{description}</p>
            </section>
          ) : null}
          <section className="rounded-xl border bg-muted/10 p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your exclusive booking</h3>
            {guestName ? <div className="font-medium">{guestName}</div> : null}
            <div className="text-sm">
              {checkInDate} → {checkOutDate} · {nights} night{nights === 1 ? "" : "s"}
            </div>
            {(guestAdults != null || guestChildren != null) && (
              <div className="text-sm text-muted-foreground">
                {guestAdults} adults · {guestChildren} children
              </div>
            )}
          </section>
          {pricingTable({ showExtraCols: true })}
          {grandBox("large")}
          {thingsToDo ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Dining & activities</h3>
              <p className="whitespace-pre-line">{thingsToDo}</p>
            </section>
          ) : null}
          {facilitiesRaw ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Facilities</h3>
              <p className="whitespace-pre-line">{facilitiesRaw}</p>
            </section>
          ) : null}
          {(checkInPol || travelDir) && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Arrival & departure</h3>
              {checkInPol ? <p className="whitespace-pre-line mb-2">{checkInPol}</p> : null}
              {travelDir ? <p className="whitespace-pre-line">{travelDir}</p> : null}
            </section>
          )}
          {landmarks ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Nearby landmarks</h3>
              <p className="whitespace-pre-line">{landmarks}</p>
            </section>
          ) : null}
          {cancelPol ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cancellation & refund</h3>
              <p className="whitespace-pre-line">{cancelPol}</p>
            </section>
          ) : null}
          {bookingCond ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Booking conditions</h3>
              <p className="whitespace-pre-line">{bookingCond}</p>
            </section>
          ) : null}
          {childrenExtra ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Children & extra guests</h3>
              <p className="whitespace-pre-line">{childrenExtra}</p>
            </section>
          ) : null}
          {footerDisclaimer("Moustache Luxuria")}
        </>
      )}
    </div>
  );
}
