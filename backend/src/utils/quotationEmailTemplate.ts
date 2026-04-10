import type { IFactSheetContent } from "../models/knowledgeBase";
import type { TierVisualPalette } from "../constants/quotationVisualBranding";
import type { QuotationStayContext } from "./quotationLeadContext";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip PMS-supplied HTML to plain text for safe quotation emails. */
export function pmsPolicyFieldToPlainText(raw: string): string {
  if (!raw?.trim()) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pmsPolicyFieldToEmailBodyHtml(raw: string): string {
  const plain = pmsPolicyFieldToPlainText(raw);
  return escapeHtml(plain).replace(/\n/g, "<br>");
}

function buildPocFooterHtml(factsheet: IFactSheetContent, accent: string): string {
  const p = factsheet.pocDetails;
  if (!p) return "";
  const lines: string[] = [];
  if (p.frontDeskPhone) lines.push(`Front desk: ${escapeHtml(p.frontDeskPhone)}`);
  if (p.frontDeskEmail) lines.push(escapeHtml(p.frontDeskEmail));
  if (p.gmName) lines.push(`GM: ${escapeHtml(p.gmName)}`);
  if (p.gmPhone) lines.push(`GM: ${escapeHtml(p.gmPhone)}`);
  if (lines.length === 0) return "";
  return `<p style="margin:12px 0 0 0;font-size:13px;color:${accent};">${lines.join(" · ")}</p>`;
}

function buildHighlightPillsHtml(
  factsheet: IFactSheetContent,
  palette: TierVisualPalette
): string {
  const items = [
    ...(factsheet.generalInfo ?? []).slice(0, 4),
    ...(factsheet.hotelAmenities ?? []).slice(0, 4),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  const unique = [...new Set(items)].slice(0, 8);
  const pills = unique
    .map(
      (t) =>
        `<span style="display:inline-block;border:1px solid ${palette.pillBorder};color:${palette.pillText};border-radius:999px;padding:6px 12px;margin:4px 6px 4px 0;font-size:12px;">${escapeHtml(t)}</span>`
    )
    .join("");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;">
  <tr>
    <td>
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${palette.accentDark};font-weight:600;">Property highlights</p>
      ${pills}
    </td>
  </tr>
</table>`;
}

function legacyHighlightsBlock(
  factsheet: IFactSheetContent,
  palette: TierVisualPalette
): string {
  const attractions = (factsheet.nearbyAttractions ?? []).slice(0, 3);
  const rules = (factsheet.inHouseRules ?? []).slice(0, 4);
  const parts: string[] = [];
  if (attractions.length > 0) {
    parts.push(
      `<p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:${palette.accentDark};">Nearby</p><ul style="margin:0;padding-left:18px;color:#333;">${attractions
        .map((a) => `<li style="padding:4px 0;">${escapeHtml(a)}</li>`)
        .join("")}</ul>`
    );
  }
  if (rules.length > 0) {
    parts.push(
      `<p style="margin:16px 0 8px 0;font-size:14px;font-weight:600;color:${palette.accentDark};">House rules</p><ul style="margin:0;padding-left:18px;color:#333;">${rules
        .map((r) => `<li style="padding:4px 0;">${escapeHtml(r)}</li>`)
        .join("")}</ul>`
    );
  }
  if (parts.length === 0) return "";
  return `<div style="background:${palette.contentBg};border:1px solid ${palette.borderColor};border-radius:8px;padding:16px;margin:16px 0;">${parts.join("")}</div>`;
}

export interface GenerateQuotationEmailOptions {
  quote: {
    rooms?: number;
    rate?: number;
    taxes?: number;
    nights?: number;
    rateLines?: {
      roomTypeName: string;
      quantity: number;
      ratePerNight: number;
      hotelName?: string;
    }[];
    hotelQuotes?: {
      hotelName?: string;
      hotelAddress?: string;
      checkInDate?: string | Date;
      checkOutDate?: string | Date;
      nights?: number;
      rows: {
        roomTypeName?: string;
        mealPlanName?: string;
        roomNo?: string;
        adults?: number;
        children?: number;
        baseRate: number;
        discountPercent: number;
        discountedRate: number;
        taxPercent: number;
        taxAmount: number;
        total: number;
      }[];
      subtotal?: number;
      totalTax?: number;
      grandTotal?: number;
    }[];
    inclusions?: string;
    specialPackages?: string;
    sentTo?: { name?: string; email?: string; phone?: string };
  };
  stay: QuotationStayContext;
  leadNumber: string;
  versionNumber: number;
  factsheet: IFactSheetContent | null;
  /** From eZee HotelList policy fields — titles plain, bodies escaped with &lt;br&gt; only */
  pmsPolicySections?: { title: string; bodyHtml: string }[];
  fontFaceCss: string;
  primaryFont: string;
  secondaryFont: string;
  palette: TierVisualPalette;
}

export function generateQuotationEmailHtml(o: GenerateQuotationEmailOptions): string {
  const rooms = o.quote.rooms || 1;
  const rate = o.quote.rate || 0;
  const taxes = o.quote.taxes || 0;
  const nights = o.quote.nights && o.quote.nights > 0 ? o.quote.nights : 1;
  const rateLines = (o.quote.rateLines ?? []).filter(
    (l) => (l.quantity ?? 0) > 0 && (l.ratePerNight ?? 0) >= 0 && (l.roomTypeName ?? "").trim()
  );
  const subtotalFromLines =
    rateLines.length > 0
      ? rateLines.reduce(
          (sum, l) => sum + (l.ratePerNight || 0) * (l.quantity || 1) * nights,
          0
        )
      : null;
  const subtotal = subtotalFromLines ?? rate * rooms * nights;

  const hotelQuotes = (o.quote.hotelQuotes ?? []).filter((h) => (h.rows?.length ?? 0) > 0);
  const totalsFromHotelQuotes =
    hotelQuotes.length > 0
      ? {
          subtotal: hotelQuotes.reduce((s, h) => s + (h.subtotal ?? 0), 0),
          tax: hotelQuotes.reduce((s, h) => s + (h.totalTax ?? 0), 0),
          total: hotelQuotes.reduce((s, h) => s + (h.grandTotal ?? 0), 0),
        }
      : null;

  const totalSubtotal = totalsFromHotelQuotes?.subtotal ?? subtotal;
  const totalTax = totalsFromHotelQuotes?.tax ?? taxes;
  const total = totalsFromHotelQuotes?.total ?? (totalSubtotal + totalTax);

  const p = o.palette;
  const stay = o.stay;
  const propName = escapeHtml(stay.propertyLabel);
  const addr = o.factsheet?.propertyAddress?.trim();
  const map = o.factsheet?.mapLocation?.trim();
  const addressLine =
    addr || map
      ? `<p style="margin:12px 0 0 0;font-size:13px;color:#555;line-height:1.5;">${addr ? `· ${escapeHtml(addr)}` : ""}${
          map
            ? `${addr ? " " : ""}· <a href="${escapeHtml(map)}" style="color:${p.primary};">View on Map</a>`
            : ""
        }</p>`
      : "";

  const inclusionsHtml = o.quote.inclusions
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.contentBg};border:1px solid ${p.borderColor};border-radius:8px;margin:20px 0;"><tr><td style="padding:18px;">
        <p style="margin:0 0 10px 0;font-size:15px;font-weight:600;color:${p.accentDark};">Inclusions</p>
        <ul style="margin:0;padding-left:18px;color:#333;font-family:${o.secondaryFont};">
          ${o.quote.inclusions
            .split("\n")
            .filter((line) => line.trim())
            .map((item) => `<li style="padding:4px 0;">${escapeHtml(item.trim())}</li>`)
            .join("")}
        </ul>
      </td></tr></table>`
    : "";

  const specialHtml = o.quote.specialPackages
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${p.borderColor};border-radius:8px;margin:16px 0;"><tr><td style="padding:18px;">
        <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:${p.accentDark};">Special packages</p>
        <p style="margin:0;color:#333;font-family:${o.secondaryFont};">${escapeHtml(o.quote.specialPackages).replace(/\n/g, "<br>")}</p>
      </td></tr></table>`
    : "";

  const hasPillContent =
    (o.factsheet?.generalInfo?.length ?? 0) > 0 ||
    (o.factsheet?.hotelAmenities?.length ?? 0) > 0;
  const pills = o.factsheet && hasPillContent ? buildHighlightPillsHtml(o.factsheet, p) : "";
  const legacyExtra =
    o.factsheet && !hasPillContent ? legacyHighlightsBlock(o.factsheet, p) : "";

  const pmsPoliciesBlock =
    o.pmsPolicySections && o.pmsPolicySections.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${p.borderColor};border-radius:8px;margin:24px 0 0 0;background:${p.contentBg};">
      <tr>
        <td style="padding:18px;">
          <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${p.accentDark};font-weight:700;">Hotel policies (from booking system)</p>
          <p style="margin:0 0 14px 0;font-size:12px;line-height:1.5;color:#666;">The following is provided by our property management system for this hotel. Please read before confirming.</p>
          ${o.pmsPolicySections
            .map(
              (s) => `<div style="margin-top:14px;">
            <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:${p.accentDark};font-family:${o.primaryFont};">${escapeHtml(s.title)}</p>
            <div style="margin:0;font-size:13px;line-height:1.55;color:#333;font-family:${o.secondaryFont};">${s.bodyHtml}</div>
          </div>`
            )
            .join("")}
        </td>
      </tr>
    </table>`
      : "";

  const pocFooter = o.factsheet ? buildPocFooterHtml(o.factsheet, "#666") : "";

  const headerBgStyle =
    stay.tier === "LUXURIA"
      ? `background:${p.headerBackgroundCss};`
      : `background-color:${p.headerBackgroundSolid};`;

  const rateLinesTable =
    rateLines.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0 0;border-top:1px solid ${p.borderColor};">
          <tr>
            <td style="padding:12px 0 0 0;">
              <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${p.accentDark};font-weight:700;font-family:${o.secondaryFont};">Room rates</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${o.secondaryFont};font-size:14px;">
                ${rateLines
                  .map((l) => {
                    const lineTotal = (l.ratePerNight || 0) * (l.quantity || 1) * nights;
                    const label = `${l.quantity} × ${escapeHtml(l.roomTypeName)}${
                      l.hotelName?.trim() ? ` · ${escapeHtml(l.hotelName.trim())}` : ""
                    }`;
                    return `<tr>
                      <td style="padding:8px 0;color:#333;">${label}</td>
                      <td align="right" style="padding:8px 0;color:#555;">${formatCurrency(
                        l.ratePerNight || 0
                      )}<span style="font-size:12px;color:#777;"> /night</span></td>
                      <td align="right" style="padding:8px 0;font-weight:600;color:#111;">${formatCurrency(
                        lineTotal
                      )}</td>
                    </tr>`;
                  })
                  .join("")}
              </table>
              <p style="margin:10px 0 0 0;font-size:12px;color:#666;">Nights: <strong>${nights}</strong></p>
            </td>
          </tr>
        </table>`
      : "";

  const hotelQuotesBlock =
    hotelQuotes.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0 0;">
          <tr>
            <td>
              <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${p.accentDark};font-weight:700;font-family:${o.secondaryFont};">Room breakdown</p>
              ${hotelQuotes
                .map((h) => {
                  const hName = escapeHtml(h.hotelName || propName);
                  const hAddr = h.hotelAddress?.trim() ? escapeHtml(h.hotelAddress.trim()) : "";
                  const head = `<div style="margin:14px 0 8px 0;">
                      <p style="margin:0;font-size:14px;font-weight:700;color:${p.accentDark};font-family:${o.primaryFont};">${hName}</p>
                      ${hAddr ? `<p style="margin:4px 0 0 0;font-size:12px;color:#666;">${hAddr}</p>` : ""}
                    </div>`;
                  const rows = (h.rows || [])
                    .map((r) => {
                      const rt = escapeHtml(r.roomTypeName || "Room");
                      const mp = r.mealPlanName ? escapeHtml(r.mealPlanName) : "—";
                      const occ = `${r.adults ?? "—"}A / ${r.children ?? "—"}C`;
                      const base = formatCurrency(r.baseRate || 0);
                      const disc = `${Math.round(r.discountPercent || 0)}%`;
                      const discRate = formatCurrency(r.discountedRate || 0);
                      const taxLine = `${Math.round(r.taxPercent || 0)}%`;
                      const taxAmt = formatCurrency(r.taxAmount || 0);
                      const rowTotal = formatCurrency(r.total || 0);
                      return `<tr>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};">${rt}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};">${mp}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:center;">${escapeHtml(occ)}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;">${base}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;">${disc}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;">${discRate}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;">${taxLine}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;">${taxAmt}</td>
                        <td style="padding:8px 10px;border-top:1px solid ${p.borderColor};text-align:right;font-weight:600;">${rowTotal}</td>
                      </tr>`;
                    })
                    .join("");

                  return `${head}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${p.borderColor};border-radius:8px;overflow:hidden;font-family:${o.secondaryFont};font-size:13px;">
                      <tr style="background:${p.contentBg};">
                        <th align="left" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Room Type</th>
                        <th align="left" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Meal Plan</th>
                        <th align="center" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Occ.</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Base</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Disc</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Disc. Rate</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Tax</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Tax Amt</th>
                        <th align="right" style="padding:10px;font-size:11px;color:${p.accentDark};letter-spacing:0.08em;text-transform:uppercase;">Total</th>
                      </tr>
                      ${rows}
                    </table>`;
                })
                .join("")}
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0 0;font-size:12px;color:#666;">This is a provisional quotation. Final rates are subject to availability at the time of booking.</p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation for ${propName}</title>
  <style type="text/css">
    ${o.fontFaceCss}
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; background-color:${p.background}; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${p.background};font-family:${o.secondaryFont};color:#000000;">
  <!--[if mso]>
  <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
  <![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${p.contentBg};">
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" ${stay.tier === "LUXURIA" ? `bgcolor="${p.headerBackgroundSolid.replace(/#/g, "")}"` : ""} style="${headerBgStyle}">
          <tr>
            <td style="padding:28px 24px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${p.headerSubtext};font-family:${o.secondaryFont};opacity:0.95;">MOUSTACHE ESCAPES</p>
              <h1 style="margin:0;font-size:26px;line-height:1.2;color:${p.headerText};font-family:${o.primaryFont};font-weight:700;">${propName}</h1>
              <p style="margin:10px 0 0 0;font-size:12px;letter-spacing:0.1em;color:${p.headerSubtext};font-family:${o.secondaryFont};">${escapeHtml(stay.locationSubtitle)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 24px 8px 24px;background:${p.contentBg};font-family:${o.secondaryFont};">
        <p style="margin:0 0 16px 0;font-size:17px;color:#000;">Dear ${escapeHtml(o.quote.sentTo?.name || "Valued Guest")},</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#222;">Thank you for your interest in ${propName}. Please find your personalised quotation below.</p>
        ${addressLine}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 24px 24px;background:${p.contentBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${p.borderColor};border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:16px 18px;border-bottom:1px solid ${p.borderColor};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${p.accentDark};font-weight:700;font-family:${o.secondaryFont};">Booking details</td>
                  <td align="right"><span style="display:inline-block;background:${p.primary};color:#fff;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;">VERSION ${o.versionNumber}</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 18px;font-family:${o.secondaryFont};font-size:14px;color:#333;line-height:1.6;">
              <ul style="margin:0;padding-left:20px;">
                <li style="margin-bottom:8px;"><strong>Property:</strong> ${propName}</li>
                <li style="margin-bottom:8px;"><strong>Check-in:</strong> ${escapeHtml(stay.checkInDisplay)}</li>
                <li style="margin-bottom:8px;"><strong>Check-out:</strong> ${escapeHtml(stay.checkOutDisplay)}</li>
                <li style="margin-bottom:8px;"><strong>Total rooms:</strong> ${escapeHtml(stay.roomsLine)}</li>
                <li style="margin-bottom:0;"><strong>Total guests:</strong> ${escapeHtml(stay.guestsLine)}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;border-top:1px solid ${p.borderColor};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${o.secondaryFont};font-size:14px;">
                ${
                  rateLines.length === 0
                    ? `<tr>
                  <td style="padding:8px 0;color:#555;">Rate per room / night</td>
                  <td align="right" style="font-weight:600;color:#111;">${formatCurrency(rate)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#555;">Nights</td>
                  <td align="right" style="font-weight:600;color:#111;">${escapeHtml(
                    String(nights)
                  )}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#555;">Subtotal</td>
                  <td align="right" style="font-weight:600;color:#111;">${formatCurrency(
                    subtotal
                  )}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding:8px 0;color:#555;">Taxes &amp; fees</td>
                  <td align="right" style="font-weight:600;color:#111;">${formatCurrency(totalTax)}</td>
                </tr>
              </table>
              ${hotelQuotesBlock}
              ${rateLinesTable}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 18px;background:${p.totalBarBg};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:17px;font-weight:700;color:${p.totalBarText};font-family:${o.primaryFont};">Total amount</td>
                  <td align="right" style="font-size:17px;font-weight:700;color:${p.totalBarText};font-family:${o.primaryFont};">${formatCurrency(total)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${inclusionsHtml}
        ${specialHtml}
        ${pills}
        ${legacyExtra}
        ${pmsPoliciesBlock}

        <p style="margin:20px 0 0 0;font-size:14px;line-height:1.6;color:#333;">This quotation is valid for 7 days. To confirm your booking or if you have any questions, please contact us.</p>
        <p style="margin:12px 0 0 0;font-size:14px;color:#333;">We look forward to welcoming you!</p>
        <p style="margin:16px 0 0 0;font-size:14px;color:#333;">Warm regards,<br><span style="font-weight:600;">The ${propName} Team</span></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 28px 24px;background:${p.background};border-top:1px solid ${p.borderColor};text-align:center;font-size:12px;color:#666;font-family:${o.secondaryFont};">
        <p style="margin:0 0 8px 0;">This is an automated quotation email.</p>
        <p style="margin:0;">Quotation reference: QT-${escapeHtml(String(o.leadNumber))}-V${o.versionNumber}</p>
        ${pocFooter}
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr></table>
  <![endif]-->
</body>
</html>`;
}

export function buildQuotationEmailSubject(
  propertyLabel: string,
  leadNumber: string,
  checkInDisplay: string,
  checkOutDisplay: string
): string {
  const datesKnown =
    checkInDisplay !== "To be confirmed" && checkOutDisplay !== "To be confirmed";
  if (datesKnown) {
    return `Quotation — ${propertyLabel} (${checkInDisplay.split(",")[0]?.trim() ?? ""}) · Ref ${leadNumber}`;
  }
  return `Quotation for ${propertyLabel} — Ref: ${leadNumber}`;
}
