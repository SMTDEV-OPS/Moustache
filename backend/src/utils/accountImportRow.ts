import { AccountModel } from "../models/account";

export function mapImportRowToAccountDoc(row: Record<string, unknown>) {
  const name = row["Company Name"]?.toString().trim();
  if (!name) {
    throw new Error("Company Name is required");
  }
  return {
    name,
    isHeadquarter: row["Is it a Headquarter?"]?.toString().toLowerCase() === "yes",
    accountType: row["Account Type"] || undefined,
    addressLine1: row["Add Line 1"] || "",
    addressLine2: row["Add Line 2"] || "",
    zip: row["ZIP"]?.toString() || "",
    city: row["City "]?.toString().trim() || row["City"]?.toString().trim() || "",
    subCity: row["Sub-City"] || "",
    state: row["State"] || "",
    country: row["Country"] || "India",
    zone: row["Zone"] || "",
    boardLine: row["Board Line"] || "",
    email: row["Email"] || "",
    industry: row["Industry"] || "",
    gstin: row["GSTIN"]?.toString() || "",
    panNumber: row["PAN Number"]?.toString() || "",
    contractingType: row["Contracting Type"] || undefined,
    profileStatus: "ACTIVE" as const,
    status: "ACTIVE" as const,
    organizationType: "CUSTOM" as const,
    type: "OTHER" as const,
    accountLevel: "MASTER" as const,
  };
}

export async function importAccountRow(
  row: Record<string, unknown>,
  rowIndex: number
): Promise<{ ok: true } | { ok: false; row: number; reason: string }> {
  try {
    const name = row["Company Name"]?.toString().trim();
    if (!name) {
      return { ok: false, row: rowIndex, reason: "Company Name is required" };
    }
    const existing = await AccountModel.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing) {
      return { ok: false, row: rowIndex, reason: `Account "${name}" already exists` };
    }
    await AccountModel.create(mapImportRowToAccountDoc(row));
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, row: rowIndex, reason: message };
  }
}
