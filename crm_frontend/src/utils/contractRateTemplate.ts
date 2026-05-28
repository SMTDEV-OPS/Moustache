import { DEFAULT_RATE_SLABS, DEFAULT_ROOM_TYPES } from "@/models/contract";

const HEADERS = [
  "Room Type",
  "CAT",
  "Single",
  "Double",
  "Triple",
  "RN",
  "Inclusion",
  "Remarks",
  "Channel",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build CSV rows for all default room types × CAT slabs (B2B sample). */
export function buildContractRateTemplateCsv(): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const roomType of DEFAULT_ROOM_TYPES) {
    for (const cat of DEFAULT_RATE_SLABS) {
      lines.push(
        [
          escapeCsvCell(roomType),
          escapeCsvCell(cat),
          "0",
          "0",
          "0",
          "0",
          "",
          "",
          "B2B",
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}

export function downloadContractRateTemplate(filename = "contract-rate-template.csv"): void {
  const csv = buildContractRateTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
