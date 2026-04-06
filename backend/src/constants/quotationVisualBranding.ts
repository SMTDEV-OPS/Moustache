/**
 * Moustache Escapes quotation email visuals: tier palettes + per-property font pairs.
 * Colors follow brand table; fonts use @font-face when QUOTATION_FONT_CDN_BASE is set.
 */

export type QuotationTier = "HOSTEL" | "SELECT" | "LUXURIA";

export interface TierVisualPalette {
  primary: string;
  secondary: string;
  /** Outer page / email background */
  background: string;
  /** Main content card background (Luxuria cream) */
  contentBg: string;
  accentDark: string;
  /** CSS background for header (gradient or solid) */
  headerBackgroundCss: string;
  /** Solid header for Outlook / clients that ignore gradients */
  headerBackgroundSolid: string;
  headerText: string;
  headerSubtext: string;
  totalBarBg: string;
  totalBarText: string;
  borderColor: string;
  pillBorder: string;
  pillText: string;
  brandEyebrow: string;
}

const HOSTEL_PALETTE: TierVisualPalette = {
  primary: "#CA2F21",
  secondary: "#FFD662",
  background: "#ffffff",
  contentBg: "#ffffff",
  accentDark: "#000000",
  headerBackgroundCss: "#CA2F21",
  headerBackgroundSolid: "#CA2F21",
  headerText: "#ffffff",
  headerSubtext: "#FFD662",
  totalBarBg: "#CA2F21",
  totalBarText: "#ffffff",
  borderColor: "rgba(0,0,0,0.08)",
  pillBorder: "#CA2F21",
  pillText: "#CA2F21",
  brandEyebrow: "#666666",
};

const SELECT_PALETTE: TierVisualPalette = {
  primary: "#89957D",
  secondary: "#D2C7C1",
  background: "#ffffff",
  contentBg: "#ffffff",
  accentDark: "#2D3824",
  headerBackgroundCss: "#89957D",
  headerBackgroundSolid: "#89957D",
  headerText: "#ffffff",
  headerSubtext: "#D2C7C1",
  totalBarBg: "#2D3824",
  totalBarText: "#ffffff",
  borderColor: "rgba(45,56,36,0.15)",
  pillBorder: "#89957D",
  pillText: "#2D3824",
  brandEyebrow: "#5c6654",
};

const LUXURIA_PALETTE: TierVisualPalette = {
  primary: "#002055",
  secondary: "#B8A787",
  background: "#FFF8EB",
  contentBg: "#FFF8EB",
  accentDark: "#002055",
  headerBackgroundCss: "linear-gradient(135deg, #002055 0%, #000000 100%)",
  headerBackgroundSolid: "#002055",
  headerText: "#ffffff",
  headerSubtext: "#B8A787",
  totalBarBg: "#002055",
  totalBarText: "#ffffff",
  borderColor: "rgba(0,32,85,0.2)",
  pillBorder: "#002055",
  pillText: "#002055",
  brandEyebrow: "#5a5a5a",
};

export const TIER_VISUAL_PALETTE: Record<QuotationTier, TierVisualPalette> = {
  HOSTEL: HOSTEL_PALETTE,
  SELECT: SELECT_PALETTE,
  LUXURIA: LUXURIA_PALETTE,
};

/** Logical font ids for @font-face file resolution */
export interface QuotationFontPair {
  primaryId: "Miera" | "Blog" | "Nate Supe";
  secondaryId: "Kumbh Sans" | "Outfit";
}

/** CSS font-family stacks (webfont name + fallbacks per brand spec) */
export interface QuotationFontStacks {
  primaryStack: string;
  secondaryStack: string;
}

const FALLBACK_LUXURIA = "Georgia, 'Times New Roman', serif";
const FALLBACK_SELECT = "Georgia, 'Times New Roman', serif";
const FALLBACK_HOSTEL = "Arial, Helvetica, sans-serif";

function stacksForPair(pair: QuotationFontPair, tier: QuotationTier): QuotationFontStacks {
  const fb =
    tier === "LUXURIA"
      ? FALLBACK_LUXURIA
      : tier === "SELECT"
        ? FALLBACK_SELECT
        : FALLBACK_HOSTEL;
  const p = `'${pair.primaryId}', ${fb}`;
  const s = `'${pair.secondaryId}', ${fb}`;
  return { primaryStack: p, secondaryStack: s };
}

/** Per-property overrides (normalized keys). Tier for colors still comes from Property model. */
const PROPERTY_FONT_PAIR: Record<string, QuotationFontPair> = {
  "moustache bhimtal": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache bir": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache daman": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache delhi": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache gangtok": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache goa luxuria": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache jaipur": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache jaisalmer": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache jodhpur": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache khajuraho": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache koksar luxuria": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache manali": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache manali select": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache mcleodganj select": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache coimbatore": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache mussoorie": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache nainital select": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache pahalgam": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache pushkar": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache ranthambore luxuria": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache rishikesh luxuria": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache rishikesh riverside": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache rishikesh select": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache select mukteshwar": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache select naukuchiatal": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache select udaipur": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache shoja": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache srinagar": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache sringar houseboat": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache srinagar houseboat": { primaryId: "Blog", secondaryId: "Outfit" },
  "moustache udaipur hostel": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache udaipur luxuria": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache udaipur verandah": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache varanasi luxuria": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache nainital hostel": { primaryId: "Nate Supe", secondaryId: "Outfit" },
  "moustache vallora jawai": { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  "moustache varanasi": { primaryId: "Nate Supe", secondaryId: "Outfit" },
};

const TIER_DEFAULT_FONT: Record<QuotationTier, QuotationFontPair> = {
  LUXURIA: { primaryId: "Miera", secondaryId: "Kumbh Sans" },
  SELECT: { primaryId: "Blog", secondaryId: "Outfit" },
  HOSTEL: { primaryId: "Nate Supe", secondaryId: "Outfit" },
};

export function normalizePropertyKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveFontPairForProperty(
  propertyName: string,
  tier: QuotationTier
): QuotationFontPair {
  const norm = normalizePropertyKey(propertyName);
  if (PROPERTY_FONT_PAIR[norm]) {
    return PROPERTY_FONT_PAIR[norm];
  }
  const keys = Object.keys(PROPERTY_FONT_PAIR).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (norm.includes(k) || k.includes(norm)) {
      return PROPERTY_FONT_PAIR[k];
    }
  }
  return TIER_DEFAULT_FONT[tier];
}

export function resolveQuotationFontStacks(
  propertyName: string,
  tier: QuotationTier
): QuotationFontStacks {
  const pair = resolveFontPairForProperty(propertyName, tier);
  return stacksForPair(pair, tier);
}

/** Map logical font to woff2 filename under QUOTATION_FONT_CDN_BASE */
const FONT_WOFF2_FILES: Record<string, string> = {
  Miera: "Miera-Regular.woff2",
  Blog: "Blog-Regular.woff2",
  "Nate Supe": "NateSupe-Regular.woff2",
  "Kumbh Sans": "KumbhSans-Regular.woff2",
  Outfit: "Outfit-Regular.woff2",
};

/**
 * Optional @font-face block when `cdnBase` is set (no trailing slash).
 * Uses font-weight 400; add more faces later if needed.
 */
export function buildQuotationFontFaceCss(cdnBase: string | undefined): string {
  const base = (cdnBase ?? "").trim().replace(/\/$/, "");
  if (!base) return "";

  const uniqueFonts = Object.entries(FONT_WOFF2_FILES);
  const lines: string[] = [];
  for (const [family, file] of uniqueFonts) {
    const url = `${base}/${encodeURIComponent(file)}`;
    lines.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:400;src:url('${url}') format('woff2');}`);
  }
  return lines.join("\n");
}

export function coerceTier(tier: string | undefined | null): QuotationTier {
  if (tier === "HOSTEL" || tier === "SELECT" || tier === "LUXURIA") return tier;
  return "SELECT";
}
