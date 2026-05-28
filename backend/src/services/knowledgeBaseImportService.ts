import * as XLSX from "xlsx";
import { Types } from "mongoose";
import { PropertyModel } from "../models/property";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../models/knowledgeBase";

export type SheetRow = { key: string; updated: string };

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function toPropertyCode(name: string): string {
  return normalizeWhitespace(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function readSheetRowsFromBuffer(buffer: Buffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
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

export function readSheetRowsFromPath(filePath: string): SheetRow[] {
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

export function firstUpdatedForKey(rows: SheetRow[], keyText: string): string {
  const lower = keyText.toLowerCase();
  const match = rows.find((r) => r.key.toLowerCase() === lower);
  if (match?.updated) return match.updated;
  const partial = rows.find((r) => r.key.toLowerCase().includes(lower));
  return partial?.updated ?? "";
}

export function updatedValuesWithoutKey(rows: SheetRow[]): string[] {
  return rows
    .filter((r) => !r.key && r.updated && r.updated.toLowerCase() !== "updated")
    .map((r) => r.updated);
}

export function buildRawRows(rows: SheetRow[]): Array<{ label: string; value: string }> {
  return rows
    .filter((r) => r.key || r.updated)
    .map((r) => ({
      label: r.key || "(detail)",
      value: r.updated,
    }));
}

function extractDriveUrl(...values: string[]): string {
  for (const v of values) {
    const trimmed = normalizeWhitespace(v);
    if (/drive\.google\.com|docs\.google\.com/i.test(trimmed)) {
      return trimmed;
    }
  }
  return "";
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((x) => normalizeWhitespace(x))
    .filter(Boolean);
}

export function buildPropertyContent(
  propertyName: string,
  rows: SheetRow[],
  unlabeledUpdatedValues: string[]
): Record<string, unknown> {
  const phone =
    firstUpdatedForKey(rows, "Phone no.") ||
    firstUpdatedForKey(rows, "Phone") ||
    unlabeledUpdatedValues[2] ||
    "";
  const email =
    firstUpdatedForKey(rows, "Email") || "book@postcardresorts.com";
  const website =
    firstUpdatedForKey(rows, "Website") || "https://www.postcardresorts.com";
  const highlights = unlabeledUpdatedValues[3] || "";
  const amenitiesText =
    firstUpdatedForKey(rows, "Amenities") || unlabeledUpdatedValues[4] || "";
  const facilitiesText = firstUpdatedForKey(rows, "Facilities");
  const roomCategoryBlock =
    firstUpdatedForKey(rows, "Room Category") || unlabeledUpdatedValues[1] || "";
  const speciality = firstUpdatedForKey(rows, "Speciality of the hotel");
  const marketingPitch = firstUpdatedForKey(rows, "Selling/Marketing Pitch");
  const rates: Record<string, string> = {};

  const rackRateLabeled = firstUpdatedForKey(rows, "Rack Rate");
  if (rackRateLabeled) {
    rates["rack_rate"] = rackRateLabeled;
  }

  for (let i = 5; i + 1 < unlabeledUpdatedValues.length; i += 2) {
    const roomName = unlabeledUpdatedValues[i];
    const roomRate = unlabeledUpdatedValues[i + 1];
    if (!roomName || !roomRate) break;
    if (/drive\.google|http/i.test(roomRate) || /drive\.google|http/i.test(roomName)) break;
    const key = normalizeWhitespace(roomName).toLowerCase();
    rates[key] = normalizeWhitespace(roomRate);
  }

  const photosDriveUrl =
    extractDriveUrl(
      firstUpdatedForKey(rows, "Pictures by property Labelled"),
      firstUpdatedForKey(rows, "Pictures by property"),
      ...unlabeledUpdatedValues
    ) || "";

  return {
    location: propertyName,
    type: "Luxury Resort",
    amenities: splitLines(amenitiesText),
    facilities: splitLines(facilitiesText),
    rates,
    highlights,
    speciality,
    marketingPitch,
    contact: { phone, email, website },
    roomCategory: roomCategoryBlock,
    mediaLinks: { photosDriveUrl },
    rawRows: buildRawRows(rows),
  };
}

export function buildFactSheetContent(
  rows: SheetRow[],
  unlabeledUpdatedValues: string[]
): Record<string, unknown> {
  return {
    "Property Name": firstUpdatedForKey(rows, "Property Name List"),
    "Booking Source": firstUpdatedForKey(rows, "Booking Source"),
    "Lead Status Flow": firstUpdatedForKey(rows, "Lead Status"),
    "Room Categories": unlabeledUpdatedValues[1] || firstUpdatedForKey(rows, "Room Category"),
    "Standard Inclusions": unlabeledUpdatedValues[3] || "",
    Amenities: unlabeledUpdatedValues[4] || firstUpdatedForKey(rows, "Amenities"),
    Facilities: firstUpdatedForKey(rows, "Facilities"),
    "Nearby Attractions":
      firstUpdatedForKey(rows, "Nearby Attractions") ||
      unlabeledUpdatedValues[13] ||
      unlabeledUpdatedValues[11] ||
      "",
    "Special Tours": firstUpdatedForKey(rows, "Special Tours"),
    "Experience Notes":
      firstUpdatedForKey(rows, "Experience Notes") ||
      unlabeledUpdatedValues[14] ||
      unlabeledUpdatedValues[12] ||
      "",
    "Speciality of the hotel": firstUpdatedForKey(rows, "Speciality of the hotel"),
    "Selling/Marketing Pitch": firstUpdatedForKey(rows, "Selling/Marketing Pitch"),
    rawRows: buildRawRows(rows),
  };
}

export function buildTemplateContent(
  rows: SheetRow[],
  unlabeledUpdatedValues: string[]
): Record<string, unknown> {
  const driveFromRows = extractDriveUrl(
    firstUpdatedForKey(rows, "Pictures by property Labelled"),
    firstUpdatedForKey(rows, "Pictures by property"),
    ...unlabeledUpdatedValues
  );

  return {
    brochure: unlabeledUpdatedValues[15] || firstUpdatedForKey(rows, "Brochure") || "Attached",
    salesDeck: unlabeledUpdatedValues[16] || "Attached",
    factSheet: unlabeledUpdatedValues[17] || "Factsheet attached",
    cancellationPolicy:
      unlabeledUpdatedValues[18] || firstUpdatedForKey(rows, "Cancellation Policy") || "Customized",
    driveLink: driveFromRows || unlabeledUpdatedValues[19] || "",
    rawRows: buildRawRows(rows),
  };
}

export function buildResourceContent(rows: SheetRow[]): Record<string, unknown> {
  return {
    iconType: "FileText",
    buttonText: "Open Resource",
    policyDocuments: firstUpdatedForKey(rows, "Policy documents"),
    trainingMaterial: firstUpdatedForKey(rows, "Training material"),
    brandGuideline: firstUpdatedForKey(rows, "Brand Guideline"),
    communicationGuidelines: firstUpdatedForKey(rows, "Communication Guidelines"),
    sopByDepartment: firstUpdatedForKey(rows, "SOP's by department / property"),
    rawRows: buildRawRows(rows),
  };
}

export async function upsertKnowledgeItem(params: {
  propertyId: Types.ObjectId;
  type: KnowledgeBaseType;
  title: string;
  description: string;
  content: Record<string, unknown>;
  userId: Types.ObjectId;
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

export interface ImportPropertyKnowledgeOptions {
  userId: string;
  propertyId?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ImportPropertyKnowledgeResult {
  propertyId: string;
  propertyName: string;
  propertyCreated: boolean;
  itemsUpserted: number;
  warnings: string[];
}

export async function importPropertyKnowledgeFromBuffer(
  buffer: Buffer,
  options: ImportPropertyKnowledgeOptions
): Promise<ImportPropertyKnowledgeResult> {
  const warnings: string[] = [];
  const rows = readSheetRowsFromBuffer(buffer);
  const unlabeledUpdatedValues = updatedValuesWithoutKey(rows);

  let propertyName = normalizeWhitespace(firstUpdatedForKey(rows, "Property Name List"));
  if (!propertyName) {
    throw new Error('Missing "Property Name List" in column A of the spreadsheet');
  }

  const userId = new Types.ObjectId(options.userId);
  let propertyCreated = false;

  let propertyDoc;
  if (options.propertyId && Types.ObjectId.isValid(options.propertyId)) {
    propertyDoc = await PropertyModel.findById(options.propertyId);
    if (!propertyDoc) {
      throw new Error("Property not found");
    }
    propertyName = propertyDoc.name;
  } else {
    const propertyCode = toPropertyCode(propertyName);
    const existing = await PropertyModel.findOne({ code: propertyCode }).select("_id").lean();
    propertyDoc = await PropertyModel.findOneAndUpdate(
      { code: propertyCode },
      {
        $set: {
          name: propertyName,
          code: propertyCode,
          location: {
            city: options.city || "Unknown",
            state: options.state || "",
            country: options.country || "India",
          },
          timeZone: "Asia/Kolkata",
          status: "ACTIVE",
          pmsProvider: "NONE",
        },
      },
      { upsert: true, new: true }
    );
    propertyCreated = !existing;
  }

  if (!propertyDoc?._id) {
    throw new Error("Failed to resolve property");
  }

  const propertyId = propertyDoc._id as Types.ObjectId;
  const propertyContent = buildPropertyContent(propertyName, rows, unlabeledUpdatedValues);
  const factSheetContent = buildFactSheetContent(rows, unlabeledUpdatedValues);
  const templateContent = buildTemplateContent(rows, unlabeledUpdatedValues);
  const resourceContent = buildResourceContent(rows);

  if (!templateContent.driveLink && !propertyContent.mediaLinks) {
    warnings.push("No Google Drive photo link detected in the sheet");
  }

  const upserts = [
    {
      type: KnowledgeBaseType.PROPERTY,
      title: `${propertyName} - Property Card`,
      description: "Imported from property information Excel.",
      content: propertyContent,
    },
    {
      type: KnowledgeBaseType.FACTSHEET,
      title: `${propertyName} - Fact Sheet`,
      description: "Imported from property information Excel.",
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

  for (const item of upserts) {
    await upsertKnowledgeItem({
      propertyId,
      type: item.type,
      title: item.title,
      description: item.description,
      content: item.content,
      userId,
    });
  }

  return {
    propertyId: String(propertyId),
    propertyName,
    propertyCreated,
    itemsUpserted: upserts.length,
    warnings,
  };
}
