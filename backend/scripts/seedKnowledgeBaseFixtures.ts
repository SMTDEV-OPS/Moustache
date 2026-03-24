import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";
import { UserModel } from "../src/models/user";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../src/models/knowledgeBase";

type SeedProperty = {
  name: string;
  code: string;
  legacyCode: string;
  city: string;
  state: string;
  country: string;
  timeZone: string;
};

const DUMMY_PROPERTIES: SeedProperty[] = [
  {
    name: "Postcard Jaipur Heritage",
    code: "POSTCARD_JAIPUR_HERITAGE",
    legacyCode: "MOUSTACHE_JAIPUR_HERITAGE",
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    timeZone: "Asia/Kolkata",
  },
  {
    name: "Postcard Udaipur Lakeview",
    code: "POSTCARD_UDAIPUR_LAKEVIEW",
    legacyCode: "MOUSTACHE_UDAIPUR_LAKEVIEW",
    city: "Udaipur",
    state: "Rajasthan",
    country: "India",
    timeZone: "Asia/Kolkata",
  },
  {
    name: "Postcard Goa Riverside",
    code: "POSTCARD_GOA_RIVERSIDE",
    legacyCode: "MOUSTACHE_GOA_RIVERSIDE",
    city: "Goa",
    state: "Goa",
    country: "India",
    timeZone: "Asia/Kolkata",
  },
];

function createFixtureItems(propertyName: string) {
  return [
    {
      type: KnowledgeBaseType.PROPERTY,
      title: `${propertyName} - Property Card`,
      description: `Quick overview for ${propertyName}.`,
      content: {
        location: "Prime location with easy access to transit hubs",
        type: "Boutique Hotel",
        rooms: 42,
        rating: 4.6,
        amenities: ["WiFi", "Cafe", "Parking", "Laundry"],
        rates: {
          deluxe: "INR 5,500 - 7,000",
          suite: "INR 8,000 - 10,500",
        },
        contact: {
          phone: "+91 99999 88888",
          email: "reservations@postcard.example",
          website: "https://postcard.example",
        },
      },
    },
    {
      type: KnowledgeBaseType.FACTSHEET,
      title: `${propertyName} - Fact Sheet`,
      description: "Frequently requested operational and guest information.",
      content: {
        "Total Rooms": "42",
        "Check-in": "2:00 PM",
        "Check-out": "11:00 AM",
        "Airport Distance": "18 km",
        "Railway Station": "6 km",
        "Dining Options": "All day cafe + rooftop dining",
      },
    },
    {
      type: KnowledgeBaseType.TEMPLATE,
      title: `${propertyName} - Proposal Template`,
      description: "Standard proposal content for sales and reservations follow-ups.",
      content: {
        category: "Proposals",
        note: "Upload final proposal files from the KB UI when required.",
      },
    },
    {
      type: KnowledgeBaseType.RESOURCE,
      title: `${propertyName} - Brand Kit`,
      description: "Brand and sales resources used for guest communication.",
      content: {
        iconType: "FileText",
        buttonText: "Download Brand Kit",
      },
    },
  ];
}

export async function seedKnowledgeBaseFixtures() {
  let propertiesCreated = 0;
  let propertiesUpdated = 0;
  let kbCreated = 0;
  let kbUpdated = 0;

  const user = await UserModel.findOne({ status: "ACTIVE" }).select("_id name").lean();
  if (!user?._id) {
    throw new Error("No active user found. Run seed:admin before seeding knowledge base fixtures.");
  }

  for (const property of DUMMY_PROPERTIES) {
    const existingProperty = await PropertyModel.findOne({
      code: { $in: [property.code, property.legacyCode] },
    })
      .select("_id")
      .lean();

    const savedProperty = await PropertyModel.findOneAndUpdate(
      { code: { $in: [property.code, property.legacyCode] } },
      {
        $set: {
          name: property.name,
          code: property.code,
          location: {
            city: property.city,
            state: property.state,
            country: property.country,
          },
          timeZone: property.timeZone,
          status: "ACTIVE",
          pmsProvider: "NONE",
        },
      },
      { upsert: true, new: true }
    ).lean();

    if (!savedProperty?._id) {
      throw new Error(`Failed to upsert property ${property.code}`);
    }

    if (existingProperty) propertiesUpdated++;
    else propertiesCreated++;

    const fixtures = createFixtureItems(property.name);
    for (const item of fixtures) {
      const legacyTitle = item.title.replace("Postcard", "Moustache");
      const existingKb = await KnowledgeBaseModel.findOne({
        propertyId: savedProperty._id,
        type: item.type,
        title: { $in: [item.title, legacyTitle] },
      })
        .select("_id")
        .lean();

      const kbFilter = existingKb?._id
        ? { _id: existingKb._id }
        : { propertyId: savedProperty._id, type: item.type, title: item.title };

      await KnowledgeBaseModel.findOneAndUpdate(
        kbFilter,
        {
          $set: {
            propertyId: savedProperty._id,
            type: item.type,
            title: item.title,
            description: item.description,
            content: item.content,
            isActive: true,
            updatedBy: user._id,
          },
          $setOnInsert: {
            createdBy: user._id,
            files: [],
          },
        },
        { upsert: true, new: true }
      );

      if (existingKb) kbUpdated++;
      else kbCreated++;
    }
  }

  console.log("Knowledge base fixtures seeded:");
  console.log(`- Properties created: ${propertiesCreated}`);
  console.log(`- Properties updated: ${propertiesUpdated}`);
  console.log(`- KB items created: ${kbCreated}`);
  console.log(`- KB items updated: ${kbUpdated}`);
}

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await seedKnowledgeBaseFixtures();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed knowledge base fixtures:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
