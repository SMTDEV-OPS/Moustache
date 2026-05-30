import "dotenv/config";
declare var process: any;
declare var require: any;
declare var module: any;
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";

function makePropertyCode(name: string): string {
  // Deterministic, human-readable, and stable across runs.
  // Example: "Moustache Select Udaipur" -> "MOUSTACHE_SELECT_UDAIPUR"
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `PROPERTY_${Date.now()}`;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROPERTIES = [
  { name: "Moustache Udaipur Luxuria", hotelCode: "26548", authCode: "06533707408ab183b1-58f7-11f1-8" },
  { name: "Moustache Rishikesh Luxuria", hotelCode: "28494", authCode: "29436756884a99293c-58f8-11f1-8" },
  { name: "Moustache Jaipur", hotelCode: "29072", authCode: "96869503704b3425e9-58f8-11f1-8" },
  { name: "Moustache Goa Luxuria", hotelCode: "29173", authCode: "96037250934bd2a9b3-58f8-11f1-8" },
  { name: "Moustache Pushkar", hotelCode: "29304", authCode: "89577746664c704821-58f8-11f1-8" },
  { name: "Moustache Udaipur", hotelCode: "29367", authCode: "59776983554d0b39b3-58f8-11f1-8" },
  { name: "Moustache Jodhpur", hotelCode: "29419", authCode: "30151680884da5b892-58f8-11f1-8" },
  { name: "Moustache Jaisalmer", hotelCode: "29420", authCode: "71427456824e402c58-58f8-11f1-8" },
  { name: "Moustache Varanasi", hotelCode: "29585", authCode: "66682244524edb5f3b-58f8-11f1-8" },
  { name: "Moustache Delhi", hotelCode: "29586", authCode: "19128855244f7785d7-58f8-11f1-8" },
  { name: "Moustache Khajuraho", hotelCode: "29680", authCode: "95597545705013c786-58f8-11f1-8" },
  { name: "Moustache Manali", hotelCode: "30078", authCode: "206011658750aeff5a-58f8-11f1-8" },
  { name: "Moustache Rishikesh Riverside Resort", hotelCode: "36817", authCode: "1621319532514abcd7-58f8-11f1-8" },
  { name: "Moustache Bhimtal Luxuria, Nainital", hotelCode: "41114", authCode: "192624820551e5ba30-58f8-11f1-8" },
  { name: "Moustache Koksar Luxuria", hotelCode: "41115", authCode: "47672827395281b265-58f8-11f1-8" },
  { name: "Moustache Udaipur Verandah", hotelCode: "41642", authCode: "8057669390531e750c-58f8-11f1-8" },
  { name: "Moustache Srinagar", hotelCode: "44201", authCode: "598649903753bb6056-58f8-11f1-8" },
  { name: "Moustache Ranthambore Luxuria", hotelCode: "44999", authCode: "57594873255459ecf3-58f8-11f1-8" },
  { name: "Moustache Coimbatore", hotelCode: "45282", authCode: "083793982054f5941f-58f8-11f1-8" },
  { name: "Moustache Shoja", hotelCode: "47068", authCode: "6911237432559047bc-58f8-11f1-8" },
  { name: "Moustache Daman", hotelCode: "48502", authCode: "2042368009562b065a-58f8-11f1-8" },
  { name: "Moustache Mussoorie", hotelCode: "51888", authCode: "947812805856c6308a-58f8-11f1-8" },
  { name: "Moustache Houseboat Srinagar", hotelCode: "52255", authCode: "12635365695763bb88-58f8-11f1-8" },
  { name: "Moustache Select Udaipur", hotelCode: "52629", authCode: "78832989815800ac1f-58f8-11f1-8" },
  { name: "Moustache Select Naukuchiatal", hotelCode: "53346", authCode: "5625885506589ba145-58f8-11f1-8" },
  { name: "Moustache Select Mukteshwar", hotelCode: "53431", authCode: "4479530895593681dc-58f8-11f1-8" },
  { name: "Moustache Select Rishikesh", hotelCode: "53443", authCode: "551999826459d15624-58f8-11f1-8" },
  { name: "Moustache Hostel Pahalgam", hotelCode: "53493", authCode: "41613989455a6c9db7-58f8-11f1-8" },
  { name: "Moustache Hostel Gangtok", hotelCode: "56028", authCode: "42470002405b07b10a-58f8-11f1-8" },
  { name: "Vallora Retreat Jawai Luxuria By Moustache", hotelCode: "56620", authCode: "87508046705ba2a76f-58f8-11f1-8" },
  { name: "Moustache Hostel Bir", hotelCode: "56783", authCode: "10130229415c3d8f98-58f8-11f1-8" },
  { name: "Moustache Select Manali", hotelCode: "58459", authCode: "88127010025cd96d66-58f8-11f1-8" },
  { name: "Moustache Select Mcleodganj", hotelCode: "58490", authCode: "10244364955d74b661-58f8-11f1-8" },
  { name: "Moustache Select Nainital", hotelCode: "58563", authCode: "86840797765e107c00-58f8-11f1-8" },
  { name: "Luxuria by Moustache Varanasi", hotelCode: "59269", authCode: "03470897025eab3fbc-58f8-11f1-8" },
  { name: "Moustache Hostel Nainital", hotelCode: "59836", authCode: "56832094915f45f5ee-58f8-11f1-8" },
  { name: "Moustache Select Rishikesh (Mohan Chatti)", hotelCode: "60611", authCode: "73747786575fe083cf-58f8-11f1-8" },
  { name: "Moustache Hostel Lonavala", hotelCode: "61329", authCode: "9824265120607c6a5e-58f8-11f1-8" },
];

export async function seedEzeeProperties() {

  let upserted = 0;
  let created = 0;

  for (const property of PROPERTIES) {
    // Use an anchored match to avoid collisions like "Udaipur" matching "Udaipur Luxuria"
    const exactNameRegex = new RegExp(`^${escapeRegex(property.name)}$`, "i");
    const existing = await PropertyModel.findOne({ name: { $regex: exactNameRegex } })
      .select("_id")
      .lean();

    const code = makePropertyCode(property.name);

    await PropertyModel.findOneAndUpdate(
      { name: { $regex: exactNameRegex } },
      {
        $set: {
          pmsProvider: "EZEE",
          "pmsConfig.hotelCode": property.hotelCode,
          "pmsConfig.authCode": property.authCode,
          name: property.name,
        },
        $setOnInsert: {
          code,
        },
      },
      { upsert: true, new: true }
    );

    upserted++;
    if (!existing) created++;
  }

  console.log(
    `Seeded ${PROPERTIES.length} properties, ${upserted} upserted, ${created} created`
  );
}

if (require.main === module) {
  mongoose.connect(config.mongoUri).then(async () => {
    await seedEzeeProperties();
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

