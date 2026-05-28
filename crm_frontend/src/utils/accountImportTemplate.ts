/** Column headers must match backend POST /accounts/import exactly */
export const ACCOUNT_IMPORT_HEADERS = [
  "Company Name",
  "Is it a Headquarter?",
  "Account Type",
  "Add Line 1",
  "Add Line 2",
  "ZIP",
  "City",
  "Sub-City",
  "State",
  "Country",
  "Zone",
  "Board Line",
  "Email",
  "Industry",
  "GSTIN",
  "PAN Number",
  "Contracting Type",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildAccountImportTemplateCsv(): string {
  const exampleRow = [
    "Example Travel Co",
    "yes",
    "ACQUISITION",
    "123 Business Park",
    "Suite 4",
    "400001",
    "Mumbai",
    "Andheri",
    "Maharashtra",
    "India",
    "West",
    "+91 22 1234 5678",
    "sales@example.com",
    "Travel",
    "27AAAAA0000A1Z5",
    "AAAAA0000A",
    "LOCAL_CONTRACTING",
  ];
  return [ACCOUNT_IMPORT_HEADERS.join(","), exampleRow.map(escapeCsvCell).join(",")].join("\n");
}

export function downloadAccountImportTemplate(filename = "account-import-template.csv"): void {
  const csv = buildAccountImportTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
