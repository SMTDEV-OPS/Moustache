import "dotenv/config";
declare var process: any;
declare var require: any;
declare var module: any;
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";

function makePropertyCode(name: string): string {
  // Deterministic, human-readable, and stable across runs.
  // Example: "Postcard Select Udaipur" -> "MOUSTACHE_SELECT_UDAIPUR"
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
  { name: "Udaipur Luxuria", hotelCode: "26548", authCode: "5919466359ff7fde27-b6f5-11ec-9" },
  { name: "Rishikesh Luxuria", hotelCode: "28494", authCode: "55415729858c1c3040-d66e-11ec-9" },
  { name: "Jaipur", hotelCode: "29072", authCode: "8983152535ff8afc9f-b6f5-11ec-9" },
  { name: "Goa Luxuria", hotelCode: "29173", authCode: "7939132030b6ef0236-6bc2-11ed-8" },
  { name: "Pushkar", hotelCode: "29304", authCode: "6445797184fc5a1b3e-e8c1-11ed-b" },
  { name: "Udaipur", hotelCode: "29367", authCode: "433991927134ef4753-e8c2-11ed-b" },
  { name: "Jodhpur", hotelCode: "29419", authCode: "819903567267cccf9e-e8c2-11ed-b" },
  { name: "Varanasi", hotelCode: "29585", authCode: "7146393644837aef7d-e8c2-11ed-b" },
  { name: "Delhi", hotelCode: "29586", authCode: "2363368191a704caf9-e8c2-11ed-b" },
  { name: "Khajuraho", hotelCode: "29680", authCode: "1528939596ba9d7b72-e8c2-11ed-b" },
  { name: "Manali", hotelCode: "30078", authCode: "279130719802f06883-e8c3-11ed-b" },
  { name: "Rishikesh Riverside Resort", hotelCode: "36817", authCode: "6500830842680a1990-e8c3-11ed-b" },
  { name: "Jaisalmer", hotelCode: "29420", authCode: "9884662041390992c4-e8cd-11ed-b" },
  { name: "Koksar", hotelCode: "41115", authCode: "0144858881b818b1a1-7710-11ee-b" },
  { name: "Verandah", hotelCode: "41642", authCode: "741185090298a49b73-4303-11ee-b" },
  { name: "Bhimtal", hotelCode: "41114", authCode: "245197923142e32137-7c88-11ee-b" },
  { name: "Srinagar", hotelCode: "44201", authCode: "04518526510fb6786d-a91d-11ee-b" },
  { name: "Cowork", hotelCode: "30080", authCode: "264285454715a2315b-14b2-11ee-b" },
  { name: "Ranthambore", hotelCode: "44999", authCode: "211565806726ffa948-d200-11ee-b" },
  { name: "Postcard Coimbatore", hotelCode: "45282", authCode: "760229338641954c82-db75-11ee-b" },
  { name: "Postcard Shoja", hotelCode: "47068", authCode: "44747955487adfb631-383b-11ef-b" },
  { name: "Postcard Daman", hotelCode: "48502", authCode: "33726398953fec89d0-847b-11ef-a" },
  { name: "Postcard Agra", hotelCode: "48755", authCode: "7795144848b5d5ed9d-87a2-11ef-a" },
  { name: "Postcard Mussoorie", hotelCode: "51888", authCode: "4521043221712cf5b0-da51-11ef-a" },
  { name: "Postcard Select Udaipur", hotelCode: "52629", authCode: "2306602822a0d09718-fa51-11ef-a" },
  { name: "Postcard Srinagar Houseboat", hotelCode: "52255", authCode: "864357776896e256bc-16d7-11f0-a" },
  { name: "Postcard Naukuchiatal", hotelCode: "53346", authCode: "223864544392e0be3c-1765-11f0-a" },
  { name: "Postcard Mukteshwar", hotelCode: "53431", authCode: "36500162108e08728f-16d5-11f0-a" },
  { name: "Postcard Hostel Pahalgam", hotelCode: "53493", authCode: "665211062551811520-16d6-11f0-a" },
  { name: "Postcard Select Rishikesh", hotelCode: "53443", authCode: "53027294532063994e-16d3-11f0-a" },
  { name: "Postcard Rishikesh Hostel", hotelCode: "53669", authCode: "804295165271f44372-2b03-11f0-a" },
  { name: "Postcard Hostel Bir", hotelCode: "56783", authCode: "9155528041ee7eef90-8f04-11f0-9" },
  { name: "Postcard Hostel Gangtok", hotelCode: "56028", authCode: "3052637151375d6e30-7782-11f0-9" },
  { name: "Postcard Jawai", hotelCode: "56620", authCode: "3290282351e36d391c-8d73-11f0-9" },
  { name: "Nainital Select", hotelCode: "58563", authCode: "67886304739852e386-d0d9-11f0-9" },
  { name: "Varanasi Luxuria", hotelCode: "59269", authCode: "61140037017b500e06-fc65-11f0-9" },
  { name: "Select Manali", hotelCode: "58459", authCode: "44462169186e9eebc0-c9d0-11f0-9" },
  { name: "Select Mcleodganj", hotelCode: "58490", authCode: "1639552117af5ff45e-d0d9-11f0-9" },
  { name: "Hostel Nainital", hotelCode: "59836", authCode: "2736289121247b21fa-fcf5-11f0-9" },
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

