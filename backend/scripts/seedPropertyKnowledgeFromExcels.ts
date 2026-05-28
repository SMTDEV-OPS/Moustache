import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import { config } from "../src/config/env";
import { UserModel } from "../src/models/user";
import {
  readSheetRowsFromPath,
  firstUpdatedForKey,
  updatedValuesWithoutKey,
  normalizeWhitespace,
  toPropertyCode,
  buildPropertyContent,
  buildFactSheetContent,
  buildTemplateContent,
  buildResourceContent,
  upsertKnowledgeItem,
} from "../src/services/knowledgeBaseImportService";
import { PropertyModel } from "../src/models/property";
import { KnowledgeBaseType } from "../src/models/knowledgeBase";

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
    const rows = readSheetRowsFromPath(filePath);
    const unlabeledUpdatedValues = updatedValuesWithoutKey(rows);

    const rawPropertyName = firstUpdatedForKey(rows, "Property Name List");
    const propertyName = normalizeWhitespace(rawPropertyName);
    const propertyCode = toPropertyCode(propertyName);

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

    const propertyContent = buildPropertyContent(propertyName, rows, unlabeledUpdatedValues);
    const factSheetContent = buildFactSheetContent(rows, unlabeledUpdatedValues);
    const templateContent = buildTemplateContent(rows, unlabeledUpdatedValues);
    const resourceContent = buildResourceContent(rows);

    const items = [
      {
        type: KnowledgeBaseType.PROPERTY,
        title: `${propertyName} - Property Card`,
        description: "Generated from property information Excel sample.",
        content: propertyContent,
      },
      {
        type: KnowledgeBaseType.FACTSHEET,
        title: `${propertyName} - Fact Sheet`,
        description: "Generated from property information Excel sample.",
        content: factSheetContent,
      },
      {
        type: KnowledgeBaseType.TEMPLATE,
        title: `${propertyName} - Template Links`,
        description: "Template references from the Excel sheet.",
        content: templateContent,
      },
      {
        type: KnowledgeBaseType.RESOURCE,
        title: `${propertyName} - Policy & Training`,
        description: "Policy and training resources from the Excel sheet.",
        content: resourceContent,
      },
    ];

    for (const item of items) {
      await upsertKnowledgeItem({
        propertyId: property._id,
        type: item.type,
        title: item.title,
        description: item.description,
        content: item.content,
        userId: user._id,
      });
      kbUpserts++;
    }
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
