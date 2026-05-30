/**
 * Idempotent seed: upsert properties by `code` and ensure one FACTSHEET KB per property.
 * Run from backend/: `npm run seed:properties`
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { PropertyModel, PropertyTier } from "../models/property";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../models/knowledgeBase";
import { UserModel } from "../models/user";

const TIER_COLORS: Record<
  PropertyTier,
  { primary: string; accent: string; background: string; text: string }
> = {
  LUXURIA: {
    primary: "#C9A84C",
    accent: "#C9A84C",
    background: "#F5F0E8",
    text: "#2C1810",
  },
  SELECT: {
    primary: "#2C4A6E",
    accent: "#4A7BAB",
    background: "#F8F6F2",
    text: "#1A2E42",
  },
  HOSTEL: {
    primary: "#1B4332",
    accent: "#52B788",
    background: "#F9F7F4",
    text: "#0A1F15",
  },
};

const TIER_FONTS: Record<
  PropertyTier,
  { primaryFont: string; secondaryFont: string }
> = {
  LUXURIA: { primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  SELECT: { primaryFont: "Blog", secondaryFont: "Outfit" },
  HOSTEL: { primaryFont: "Nate Supe", secondaryFont: "Outfit" },
};

type SeedRow = {
  name: string;
  code: string;
  tier: PropertyTier;
  email: string;
  phone: string;
  mapUrl: string;
  primaryFont: string;
  secondaryFont: string;
};

const PROPERTIES: SeedRow[] = [
  { name: "Moustache Bhimtal Luxuria, Nainital", code: "BHIMTAL", tier: "LUXURIA", email: "bhimtal@moustachescapes.com", phone: "7078800566", mapUrl: "https://maps.app.goo.gl/YbD4VpAjeVjnRMv98", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Ranthambore Luxuria", code: "RANTHAMBORE", tier: "LUXURIA", email: "ranthambore@moustachescapes.com", phone: "8890110991", mapUrl: "https://maps.app.goo.gl/gYhVP1EcczSvJTSz9", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Udaipur Luxuria", code: "UDAIPUR-LUX", tier: "LUXURIA", email: "udaipurluxuria@moustachehostel.com", phone: "7976962722", mapUrl: "https://maps.app.goo.gl/qfPKKTytWVgf5Exx6", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Udaipur Verandah", code: "UDAIPUR-VER", tier: "LUXURIA", email: "verandah@moustachescapes.com", phone: "6378814419", mapUrl: "https://maps.app.goo.gl/PwJFL9bfUoqK9wsR6", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Luxuria by Moustache Varanasi", code: "VARANASI-LUX", tier: "LUXURIA", email: "varanasi@moustacheluxuria.com", phone: "7518500347", mapUrl: "https://maps.app.goo.gl/sFpCrSvyd5LmjrnN7", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Vallora Retreat Jawai Luxuria By Moustache", code: "JAWAI", tier: "LUXURIA", email: "jawai@moustachescapes.com", phone: "8852936500", mapUrl: "https://maps.app.goo.gl/QYnTaniXiUAArLcK6", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Koksar Luxuria", code: "KOKSAR", tier: "LUXURIA", email: "koksar@moustachescapes.com", phone: "8091421283", mapUrl: "https://maps.app.goo.gl/Rb7R3KeaSTqSDvETA", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Goa Luxuria", code: "GOA-LUX", tier: "LUXURIA", email: "goa@moustachescapes.com", phone: "8329136438", mapUrl: "https://maps.app.goo.gl/sHPxPYreRemazjoWA", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },

  { name: "Moustache Select Manali", code: "MANALI-SEL", tier: "SELECT", email: "manali@moustacheselect.com", phone: "8091989896", mapUrl: "https://maps.app.goo.gl/MoyaSEp3wKutTpfp8", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Mcleodganj", code: "MCLEOD-SEL", tier: "SELECT", email: "mcleodganj@moustacheselect.com", phone: "9001952659", mapUrl: "https://maps.app.goo.gl/X6x6GPMgWYMRTmmE7", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Mussoorie", code: "MUSSOORIE", tier: "SELECT", email: "mussoorie@moustachescapes.com", phone: "7017166692", mapUrl: "https://maps.app.goo.gl/EH5K1Y7rY2xpsJ947", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Nainital", code: "NAINITAL-SEL", tier: "SELECT", email: "nainital@moustacheselect.com", phone: "9001952784", mapUrl: "https://maps.app.goo.gl/HFBSVdC4FefM7a8N9", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Mukteshwar", code: "MUKTESHWAR", tier: "SELECT", email: "mukhteshwar@moustacheselect.com", phone: "9548670012", mapUrl: "https://maps.app.goo.gl/Wh2L4XoaQbZdZc587", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Naukuchiatal", code: "NAUKUCHIATAL", tier: "SELECT", email: "naukuchiatal@moustacheselect.com", phone: "7579038235", mapUrl: "https://maps.app.goo.gl/r9qXRKP8LFXF1uhz9", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Udaipur", code: "UDAIPUR-SEL", tier: "SELECT", email: "udaipur@moustacheselect.com", phone: "7878743724", mapUrl: "https://maps.app.goo.gl/gNKMDCZYbYa4Je7W8", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Rishikesh Riverside Resort", code: "RISHI-RIVER", tier: "SELECT", email: "rishikeshresort@moustachescapes.com", phone: "9528679987", mapUrl: "https://maps.app.goo.gl/eKN6ccTRbQxFykPe8", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Rishikesh", code: "RISHI-SEL", tier: "SELECT", email: "rishikesh@moustacheselect.com", phone: "9634320828", mapUrl: "https://maps.app.goo.gl/FbbcqSfQy4i6iBJT9", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Houseboat Srinagar", code: "SRI-HBOAT", tier: "SELECT", email: "srihouseboat@moustachescapes.com", phone: "8899113372", mapUrl: "https://maps.app.goo.gl/v8P25j2qSt5BPYCK9", primaryFont: "Blog", secondaryFont: "Outfit" },
  { name: "Moustache Select Rishikesh (Mohan Chatti)", code: "RISHI-MOHAN", tier: "SELECT", email: "rishikesh.mohan@moustachescapes.com", phone: "7374778657", mapUrl: "https://maps.app.goo.gl/FbbcqSfQy4i6iBJT9", primaryFont: "Blog", secondaryFont: "Outfit" },

  { name: "Moustache Delhi", code: "DELHI", tier: "HOSTEL", email: "delhi@moustachehostel.com", phone: "9560933721", mapUrl: "https://maps.app.goo.gl/Jiq4n4upiEc8vfCV6", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Jaipur", code: "JAIPUR", tier: "HOSTEL", email: "jaipur@moustachehostel.com", phone: "9358658890", mapUrl: "https://maps.app.goo.gl/ULhLP5tgx52P9u2Y6", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Jaisalmer", code: "JAISALMER", tier: "HOSTEL", email: "jaisalmer@moustachehostel.com", phone: "7976180712", mapUrl: "https://maps.app.goo.gl/1LJTMiq2yVYe3gsa9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Jodhpur", code: "JODHPUR", tier: "HOSTEL", email: "jodhpur@moustachehostel.com", phone: "7737772897", mapUrl: "https://maps.app.goo.gl/1LyPxfFGiKn3Z5VWA", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Manali", code: "MANALI", tier: "HOSTEL", email: "manali@moustachehostel.com", phone: "7807289896", mapUrl: "https://maps.app.goo.gl/WRsmjULDfsvGrWPE9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Rishikesh Luxuria", code: "RISHI-HOST", tier: "LUXURIA", email: "rishikesh@moustachehostel.com", phone: "9027120828", mapUrl: "https://maps.app.goo.gl/FbbcqSfQy4i6iBJT9", primaryFont: "Miera", secondaryFont: "Kumbh Sans" },
  { name: "Moustache Varanasi", code: "VARANASI", tier: "HOSTEL", email: "varanasi@moustachehostel.com", phone: "9005500347", mapUrl: "https://maps.app.goo.gl/4b8A9GxtkUpPhM3YA", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Srinagar", code: "SRINAGAR", tier: "HOSTEL", email: "srinagar@moustachescapes.com", phone: "9622453566", mapUrl: "https://maps.app.goo.gl/WCURAB3WoQvWLmHf7", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Hostel Pahalgam", code: "PAHALGAM", tier: "HOSTEL", email: "pahalgam@moustachehostel.com", phone: "9103382450", mapUrl: "https://maps.app.goo.gl/GdwCsyoXRrCPmaYP9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Pushkar", code: "PUSHKAR", tier: "HOSTEL", email: "pushkar@moustachehostel.com", phone: "6367048037", mapUrl: "https://maps.app.goo.gl/MM3vXMrifqAVwn1V9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Khajuraho", code: "KHAJURAHO", tier: "HOSTEL", email: "khajuraho@moustachehostel.com", phone: "8827152884", mapUrl: "https://maps.app.goo.gl/WqZzSz61xujcwuX67", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Hostel Bir", code: "BIR", tier: "HOSTEL", email: "bir@moustachehostel.com", phone: "9816846555", mapUrl: "https://maps.app.goo.gl/in3E8wLytRXSYdbB9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Shoja", code: "SHOJA", tier: "HOSTEL", email: "shoja@moustachescapes.com", phone: "9317439536", mapUrl: "https://maps.app.goo.gl/7jxkLwL5ZAL8H5km7", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Hostel Gangtok", code: "GANGTOK", tier: "HOSTEL", email: "gangtok@moustachehostel.com", phone: "8945095659", mapUrl: "https://maps.app.goo.gl/v92z4yRvZ3A4yyuD8", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Hostel Nainital", code: "NAINITAL-HOST", tier: "HOSTEL", email: "nainital@moustachehostel.com", phone: "8368977616", mapUrl: "https://maps.app.goo.gl/Xfgu3vZphLMnkDYf9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Udaipur", code: "UDAIPUR-HOST", tier: "HOSTEL", email: "udaipur@moustachehostel.com", phone: "7976909551", mapUrl: "https://maps.app.goo.gl/L3McbQgAxTLAKhp19", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Coimbatore", code: "COIMBATORE", tier: "HOSTEL", email: "coimbatore@moustachescapes.com", phone: "9842249478", mapUrl: "https://maps.app.goo.gl/t7kSEbYQd3gMRKGZ9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Daman", code: "DAMAN", tier: "HOSTEL", email: "daman@moustachescapes.com", phone: "6359425918", mapUrl: "https://maps.app.goo.gl/4tJxudHHzTJjzGEF8", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
  { name: "Moustache Hostel Lonavala", code: "LONAVALA", tier: "HOSTEL", email: "lonavala@moustachescapes.com", phone: "9824265120", mapUrl: "https://maps.app.goo.gl/t7kSEbYQd3gMRKGZ9", primaryFont: "Nate Supe", secondaryFont: "Outfit" },
];

async function resolveSystemUserId(): Promise<Types.ObjectId> {
  const envId = process.env.SEED_SYSTEM_USER_ID?.trim();
  if (envId && Types.ObjectId.isValid(envId)) {
    return new Types.ObjectId(envId);
  }

  const admin = await UserModel.findOne({
    email: "admin@moustachecrm.local",
  })
    .select("_id")
    .lean();

  if (admin?._id) {
    return admin._id as Types.ObjectId;
  }

  const anyUser = await UserModel.findOne().sort({ createdAt: 1 }).select("_id").lean();
  if (anyUser?._id) {
    logger.warn(
      "SEED_SYSTEM_USER_ID not set and admin@moustachecrm.local missing; using first user in DB for KB createdBy"
    );
    return anyUser._id as Types.ObjectId;
  }

  throw new Error(
    "No user found. Run seed:admin first or set SEED_SYSTEM_USER_ID to a valid User ObjectId."
  );
}

async function main() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for seedMoustacheProperties");

  const systemUserId = await resolveSystemUserId();

  let ok = 0;
  let fail = 0;

  for (const p of PROPERTIES) {
    try {
      const colors = TIER_COLORS[p.tier];
      const fonts = TIER_FONTS[p.tier];

      const property = await PropertyModel.findOneAndUpdate(
        { code: p.code },
        {
          $set: {
            name: p.name,
            code: p.code,
            tier: p.tier,
            branding: {
              primaryFont: p.primaryFont || fonts.primaryFont,
              secondaryFont: p.secondaryFont || fonts.secondaryFont,
              colorScheme: colors,
            },
            contactEmail: p.email,
            contactPhone: p.phone,
            mapLocation: p.mapUrl,
            status: "ACTIVE",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (!property?._id) {
        throw new Error("Property upsert returned no document");
      }

      await KnowledgeBaseModel.findOneAndUpdate(
        {
          propertyId: property._id,
          type: KnowledgeBaseType.FACTSHEET,
        },
        {
          $setOnInsert: {
            type: KnowledgeBaseType.FACTSHEET,
            propertyId: property._id,
            title: `${p.name} — Fact Sheet`,
            content: {},
            files: [],
            isActive: true,
            createdBy: systemUserId,
            updatedBy: systemUserId,
          },
        },
        { upsert: true }
      );

      logger.info(`OK: ${p.code} — ${p.name}`);
      ok += 1;
    } catch (e) {
      fail += 1;
      logger.error(`FAIL: ${p.code}`, {
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  logger.info(`seedMoustacheProperties finished: ${ok} ok, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  logger.error("seedMoustacheProperties fatal", { error: e instanceof Error ? e.message : e });
  process.exit(1);
});
