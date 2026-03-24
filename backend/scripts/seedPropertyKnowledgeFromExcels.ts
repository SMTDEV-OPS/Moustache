import "dotenv/config";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import path from "path";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";
import { UserModel } from "../src/models/user";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../src/models/knowledgeBase";

type SampleFileConfig = {
  fileName: string;
  city: string;
  state: string;
  country: string;
};

const SAMPLE_FILES: SampleFileConfig[] = [
  {
    fileName: "Sample_Arabian Sea  Property information.xlsx",
    city: "Udupi",
    state: "Karnataka",
    country: "India",
  },
  {
    fileName: "Sample_Cuelim  Property information.xlsx",
    city: "South Goa",
    state: "Goa",
    country: "India",
  },
  {
    fileName: "Sample_Dewa , Bhutan   Property information - Copy - Copy.xlsx",
    city: "Paro",
    state: "Paro",
    country: "Bhutan",
  },
  {
    fileName: "Sample_Durrung Tea Estate Assam  Property information - Copy.xlsx",
    city: "Tezpur",
    state: "Assam",
    country: "India",
  },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toCode(name: string): string {
  return normalizeWhitespace(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readSheetRows(filePath: string): Array<{ key: string; updated: string }> {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  return rows.map((row) => ({
    key: String(row[0] ?? "").trim(),
    updated: String(row[2] ?? "").trim(),
  }));
}

function firstUpdatedForKey(
  rows: Array<{ key: string; updated: string }>,
  keyText: string
): string {
  const match = rows.find((r) => r.key.toLowerCase() === keyText.toLowerCase());
  return match?.updated ?? "";
}

function updatedValuesWithoutKey(
  rows: Array<{ key: string; updated: string }>
): string[] {
  return rows
    .filter((r) => !r.key && r.updated && r.updated.toLowerCase() !== "updated")
    .map((r) => r.updated);
}

function buildPropertyContent(
  propertyName: string,
  unlabeledUpdatedValues: string[]
): Record<string, unknown> {
  const phone = unlabeledUpdatedValues[2] || "";
  const highlights = unlabeledUpdatedValues[3] || "";
  const amenities = unlabeledUpdatedValues[4] || "";
  const roomCategoryBlock = unlabeledUpdatedValues[1] || "";
  const rates: Record<string, string> = {};

  // Pairs like [Room Name, Rate, Room Name, Rate, ...]
  for (let i = 5; i + 1 < unlabeledUpdatedValues.length; i += 2) {
    const roomName = unlabeledUpdatedValues[i];
    const roomRate = unlabeledUpdatedValues[i + 1];
    if (!roomName || !roomRate) break;
    const key = normalizeWhitespace(roomName).toLowerCase();
    rates[key] = normalizeWhitespace(roomRate);
  }

  return {
    location: propertyName,
    type: "Luxury Resort",
    amenities: amenities
      .split(/\n+/)
      .map((x) => normalizeWhitespace(x))
      .filter(Boolean),
    rates,
    highlights,
    contact: {
      phone,
      email: "book@postcardresorts.com",
      website: "https://www.postcardresorts.com",
    },
    roomCategory: roomCategoryBlock,
  };
}

function buildFactSheetContent(
  rows: Array<{ key: string; updated: string }>,
  unlabeledUpdatedValues: string[]
): Record<string, unknown> {
  return {
    "Property Name": firstUpdatedForKey(rows, "Property Name List"),
    "Booking Source": firstUpdatedForKey(rows, "Booking Source"),
    "Lead Status Flow": firstUpdatedForKey(rows, "Lead Status"),
    "Room Categories": unlabeledUpdatedValues[1] || "",
    "Standard Inclusions": unlabeledUpdatedValues[3] || "",
    Amenities: unlabeledUpdatedValues[4] || "",
    "Nearby Attractions": unlabeledUpdatedValues[13] || unlabeledUpdatedValues[11] || "",
    "Experience Notes": unlabeledUpdatedValues[14] || unlabeledUpdatedValues[12] || "",
  };
}

async function upsertKnowledgeItem(params: {
  propertyId: mongoose.Types.ObjectId;
  type: KnowledgeBaseType;
  title: string;
  description: string;
  content: Record<string, unknown>;
  userId: mongoose.Types.ObjectId;
}) {
  const { propertyId, type, title, description, content, userId } = params;
  await KnowledgeBaseModel.findOneAndUpdate(
    { propertyId, type, title },
    {
      $set: {
        description,
        content,
        isActive: true,
        updatedBy: userId,
      },
      $setOnInsert: {
        createdBy: userId,
        files: [],
      },
    },
    { upsert: true, new: true }
  );
}

export async function seedPropertyKnowledgeFromExcels() {
  const rootDir = path.resolve(__dirname, "../..");
  const user = await UserModel.findOne({ status: "ACTIVE" }).select("_id").lean();
  if (!user?._id) {
    throw new Error("No active user found. Run seed:admin first.");
  }

  let propertiesCreated = 0;
  let propertiesUpdated = 0;
  let kbUpserts = 0;

  for (const sample of SAMPLE_FILES) {
    const filePath = path.join(rootDir, sample.fileName);
    const rows = readSheetRows(filePath);
    const unlabeledUpdatedValues = updatedValuesWithoutKey(rows);

    const rawPropertyName = firstUpdatedForKey(rows, "Property Name List");
    const propertyName = normalizeWhitespace(rawPropertyName);
    const propertyCode = toCode(propertyName);

    const existingProperty = await PropertyModel.findOne({ code: propertyCode }).select("_id").lean();
    const property = await PropertyModel.findOneAndUpdate(
      { code: propertyCode },
      {
        $set: {
          name: propertyName,
          code: propertyCode,
          location: {
            city: sample.city,
            state: sample.state,
            country: sample.country,
          },
          timeZone: "Asia/Kolkata",
          status: "ACTIVE",
          pmsProvider: "NONE",
        },
      },
      { upsert: true, new: true }
    ).lean();

    if (!property?._id) {
      throw new Error(`Failed to create property for ${sample.fileName}`);
    }

    if (existingProperty) propertiesUpdated++;
    else propertiesCreated++;

    const propertyContent = buildPropertyContent(propertyName, unlabeledUpdatedValues);
    const factSheetContent = buildFactSheetContent(rows, unlabeledUpdatedValues);

    await upsertKnowledgeItem({
      propertyId: property._id,
      type: KnowledgeBaseType.PROPERTY,
      title: `${propertyName} - Property Card`,
      description: "Generated from property information Excel sample.",
      content: propertyContent,
      userId: user._id,
    });
    kbUpserts++;

    await upsertKnowledgeItem({
      propertyId: property._id,
      type: KnowledgeBaseType.FACTSHEET,
      title: `${propertyName} - Fact Sheet`,
      description: "Generated from property information Excel sample.",
      content: factSheetContent,
      userId: user._id,
    });
    kbUpserts++;

    await upsertKnowledgeItem({
      propertyId: property._id,
      type: KnowledgeBaseType.TEMPLATE,
      title: `${propertyName} - Template Links`,
      description: "Template references from the Excel sheet.",
      content: {
        brochure: unlabeledUpdatedValues[15] || "Attached",
        salesDeck: unlabeledUpdatedValues[16] || "Attached",
        factSheet: unlabeledUpdatedValues[17] || "Factsheet attached",
        cancellationPolicy: unlabeledUpdatedValues[18] || "Customized",
        driveLink: unlabeledUpdatedValues[19] || "",
      },
      userId: user._id,
    });
    kbUpserts++;

    await upsertKnowledgeItem({
      propertyId: property._id,
      type: KnowledgeBaseType.RESOURCE,
      title: `${propertyName} - Policy & Training`,
      description: "Policy and training resources from the Excel sheet.",
      content: {
        iconType: "FileText",
        buttonText: "Open Resource",
        policyDocuments: firstUpdatedForKey(rows, "Policy documents"),
        trainingMaterial: firstUpdatedForKey(rows, "Training material"),
        brandGuideline: firstUpdatedForKey(rows, "Brand Guideline"),
        communicationGuidelines: firstUpdatedForKey(rows, "Communication Guidelines"),
        sopByDepartment: firstUpdatedForKey(rows, "SOP's by department / property"),
      },
      userId: user._id,
    });
    kbUpserts++;
  }

  console.log("Excel-based property + knowledge base seed complete:");
  console.log(`- Properties created: ${propertiesCreated}`);
  console.log(`- Properties updated: ${propertiesUpdated}`);
  console.log(`- Knowledge base upserts: ${kbUpserts}`);
}

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await seedPropertyKnowledgeFromExcels();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed property/knowledge from excels:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
