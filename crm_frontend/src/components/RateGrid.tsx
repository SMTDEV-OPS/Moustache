import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Upload,
  Plus,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import type {
  RateGridData,
  RateGridRow,
  RateGridValue,
  InclusionNomenclature,
} from "@/models/contract";

const OCCUPANCY_COLS = ["single", "double", "triple"] as const;
const OCCUPANCY_LABELS: Record<(typeof OCCUPANCY_COLS)[number], string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
};

interface RateGridProps {
  value: RateGridValue;
  onChange: (value: RateGridValue) => void;
  roomTypes?: string[];
  rateSlabs?: string[];
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function RateCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value || ""));
  useEffect(() => {
    setLocal(String(value ?? ""));
  }, [value]);
  const syncFromProp = useCallback(() => {
    const v = parseFloat(local);
    if (!Number.isNaN(v) && v !== value) onChange(v);
    else setLocal(String(value ?? ""));
  }, [value, local, onChange]);
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={syncFromProp}
      onKeyDown={(e) => e.key === "Enter" && syncFromProp()}
      className="w-full min-w-[72px] h-9 px-2 text-right text-sm border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring/50"
    />
  );
}

function InclusionCell({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: InclusionNomenclature[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (code: string) => {
    const next = value.includes(code)
      ? value.filter((c) => c !== code)
      : [...value, code];
    onChange(next);
  };
  const label =
    value.length > 0 ? value.join(", ") : "Select";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-w-[100px] h-9 px-2 text-left text-sm border border-input bg-background rounded flex items-center justify-between gap-1 hover:bg-muted/50"
        >
          <span className="truncate text-muted-foreground">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt.code}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={value.includes(opt.code)}
                onCheckedChange={() => toggle(opt.code)}
              />
              <span>
                {opt.code} – {opt.fullName}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SingleRateGrid({
  data,
  onChange,
  inclusionOptions,
  onUpload,
}: {
  data: RateGridData;
  onChange: (value: RateGridData) => void;
  inclusionOptions: InclusionNomenclature[];
  onUpload: () => void;
}) {
  const updateRow = (rowId: string, patch: Partial<RateGridRow>) => {
    const next = data.rows.map((r) =>
      r.id === rowId ? { ...r, ...patch } : r
    );
    onChange({ ...data, rows: next });
  };

  const rowRevenue = (r: RateGridRow) => (r.double || 0) * (r.rn || 0);
  const grandTotalRn = data.rows.reduce((s, r) => s + (r.rn || 0), 0);
  const grandTotalRevenue = data.rows.reduce((s, r) => s + rowRevenue(r), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onUpload}>
          <Upload className="h-4 w-4 mr-2" />
          Upload from Excel
        </Button>
      </div>
      <ScrollArea className="w-full">
        <div className="min-w-[700px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left font-medium p-2 bg-muted/50 sticky left-0 z-10 min-w-[140px] border-r">
                  Room / CAT
                </th>
                <th className="text-center font-medium p-2 bg-muted/50 min-w-[72px]">
                  Single (₹)
                </th>
                <th className="text-center font-medium p-2 bg-muted/50 min-w-[72px]">
                  Double (₹)
                </th>
                <th className="text-center font-medium p-2 bg-muted/50 min-w-[72px]">
                  Triple (₹)
                </th>
                <th className="text-center font-medium p-2 bg-muted/50 min-w-[64px]">
                  RN
                </th>
                <th className="text-center font-medium p-2 bg-muted/50 min-w-[80px]">
                  Revenue
                </th>
                <th className="text-left font-medium p-2 bg-muted/50 min-w-[100px]">
                  Inclusion
                </th>
                <th className="text-left font-medium p-2 bg-muted/50 min-w-[120px]">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 sticky left-0 bg-background z-10 border-r font-medium">
                    {row.roomType} – {row.rateSlab}
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.single}
                      onChange={(v) => updateRow(row.id, { single: v })}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.double}
                      onChange={(v) => updateRow(row.id, { double: v })}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.triple}
                      onChange={(v) => updateRow(row.id, { triple: v })}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.rn}
                      onChange={(v) => updateRow(row.id, { rn: v })}
                    />
                  </td>
                  <td className="p-2 text-right text-muted-foreground tabular-nums">
                    {formatCurrency(rowRevenue(row))}
                  </td>
                  <td className="p-1">
                    <InclusionCell
                      value={row.inclusions}
                      options={inclusionOptions}
                      onChange={(v) => updateRow(row.id, { inclusions: v })}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) =>
                        updateRow(row.id, { remarks: e.target.value })
                      }
                      placeholder="Remarks"
                      className="w-full min-w-[100px] h-9 px-2 text-sm border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-medium">
                <td className="p-2 sticky left-0 bg-muted/50 z-10 border-r">
                  Total
                </td>
                <td colSpan={3} className="p-2" />
                <td className="p-2 text-right tabular-nums">
                  {grandTotalRn.toLocaleString()}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {formatCurrency(grandTotalRevenue)}
                </td>
                <td colSpan={2} className="p-2" />
              </tr>
            </tfoot>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function InclusionNomenclatureTable({
  items,
  onChange,
  onAdd,
}: {
  items: InclusionNomenclature[];
  onChange: (items: InclusionNomenclature[]) => void;
  onAdd: () => void;
}) {
  const update = (idx: number, patch: Partial<InclusionNomenclature>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Inclusion Nomenclature</Label>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left font-medium p-2">Code</th>
            <th className="text-left font-medium p-2">Full Name</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b">
              <td className="p-1">
                <Input
                  value={item.code}
                  onChange={(e) => update(idx, { code: e.target.value })}
                  placeholder="BF"
                  className="h-9 w-24"
                />
              </td>
              <td className="p-1">
                <Input
                  value={item.fullName}
                  onChange={(e) => update(idx, { fullName: e.target.value })}
                  placeholder="Inclusive of Breakfast"
                  className="h-9"
                />
              </td>
              <td className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(idx)}
                >
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RateGrid({
  value,
  onChange,
  roomTypes,
  rateSlabs,
}: RateGridProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<RateGridRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<"b2b" | "b2c">("b2b");

  const b2b = value.b2b;
  const b2c = value.b2c;

  const updateB2B = (v: RateGridData) => {
    onChange({
      ...value,
      b2b: v,
      inclusionNomenclature: v.inclusionNomenclature,
      additionalRemarks: v.additionalRemarks,
    });
  };
  const updateB2C = (v: RateGridData) => {
    onChange({
      ...value,
      b2c: v,
      inclusionNomenclature: v.inclusionNomenclature,
      additionalRemarks: v.additionalRemarks,
    });
  };
  const updateInclusions = (items: InclusionNomenclature[]) => {
    onChange({
      ...value,
      inclusionNomenclature: items,
      b2b: { ...b2b, inclusionNomenclature: items },
      b2c: { ...b2c, inclusionNomenclature: items },
    });
  };
  const updateRemarks = (text: string) => {
    onChange({
      ...value,
      additionalRemarks: text,
      b2b: { ...b2b, additionalRemarks: text },
      b2c: { ...b2c, additionalRemarks: text },
    });
  };

  const inclusionOptions = value.inclusionNomenclature ?? b2b.inclusionNomenclature ?? [];

  const addInclusion = () => {
    updateInclusions([
      ...inclusionOptions,
      { code: "", fullName: "" },
    ]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: isCsv ? "string" : "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        const mapped = rows
          .map((r) => {
            const roomType =
              (r.RoomType as string) ||
              (r["Room Type"] as string) ||
              (r.roomType as string) ||
              "";
            const cat =
              (r.CAT as string) ||
              (r.cat as string) ||
              (r.RateSlab as string) ||
              (r["Rate Slab"] as string) ||
              "";
            const single = Number(r.Single ?? r.single ?? r["Single (₹)"] ?? 0) || 0;
            const double = Number(r.Double ?? r.double ?? r["Double (₹)"] ?? 0) || 0;
            const triple = Number(r.Triple ?? r.triple ?? r["Triple (₹)"] ?? 0) || 0;
            const rn = Number(r.RN ?? r.rn ?? r["Room Nights"] ?? 0) || 0;
            const inc = (r.Inclusion ?? r.inclusion ?? r.Inclusions ?? "") as string;
            const inclusions = inc
              ? String(inc)
                  .split(/[,;|]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
            const remarks = String(r.Remarks ?? r.remarks ?? "");

            if (!roomType && !cat) return null;
            return {
              id: `${roomType}-${cat}`.replace(/\s+/g, "-"),
              roomType: roomType || "Unknown",
              rateSlab: cat || "Standard",
              single,
              double,
              triple,
              rn,
              inclusions,
              remarks,
            } as RateGridRow;
          })
          .filter(Boolean) as RateGridRow[];
        setPreviewData(mapped);
        setPreviewOpen(true);
      } catch (err) {
        console.error("Parse error:", err);
      }
    };
    if (isCsv) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsBinaryString(file);
    }
    e.target.value = "";
  };

  const confirmImport = () => {
    if (!previewData) return;
    const target = activeTab === "b2b" ? updateB2B : updateB2C;
    const current = activeTab === "b2b" ? b2b : b2c;
    target({
      ...current,
      rows: previewData,
    });
    setPreviewOpen(false);
    setPreviewData(null);
  };

  return (
    <div className="space-y-6">
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "b2b" | "b2c")}>
        <TabsList>
          <TabsTrigger value="b2b">B2B Rates</TabsTrigger>
          <TabsTrigger value="b2c">B2C Rates</TabsTrigger>
        </TabsList>
        <TabsContent value="b2b" className="mt-4">
          <SingleRateGrid
            data={b2b}
            onChange={updateB2B}
            inclusionOptions={inclusionOptions}
            onUpload={() => uploadRef.current?.click()}
          />
        </TabsContent>
        <TabsContent value="b2c" className="mt-4">
          <SingleRateGrid
            data={b2c}
            onChange={updateB2C}
            inclusionOptions={inclusionOptions}
            onUpload={() => uploadRef.current?.click()}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inclusion Nomenclature</CardTitle>
        </CardHeader>
        <CardContent>
          <InclusionNomenclatureTable
            items={inclusionOptions}
            onChange={updateInclusions}
            onAdd={addInclusion}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label>Additional Remarks / Special Conditions</Label>
        <Textarea
          value={value.additionalRemarks ?? ""}
          onChange={(e) => updateRemarks(e.target.value)}
          placeholder="Add any special conditions or notes..."
          className="min-h-[80px]"
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Preview import
            </DialogTitle>
          </DialogHeader>
          {previewData && previewData.length > 0 ? (
            <div className="overflow-auto max-h-[400px]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Room</th>
                    <th className="text-left p-2">CAT</th>
                    <th className="text-right p-2">Single</th>
                    <th className="text-right p-2">Double</th>
                    <th className="text-right p-2">Triple</th>
                    <th className="text-right p-2">RN</th>
                    <th className="text-left p-2">Inclusion</th>
                    <th className="text-left p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.roomType}</td>
                      <td className="p-2">{r.rateSlab}</td>
                      <td className="p-2 text-right">{r.single}</td>
                      <td className="p-2 text-right">{r.double}</td>
                      <td className="p-2 text-right">{r.triple}</td>
                      <td className="p-2 text-right">{r.rn}</td>
                      <td className="p-2">{r.inclusions?.join(", ")}</td>
                      <td className="p-2">{r.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-muted-foreground mt-2">
                {previewData.length} row(s) will replace the current{" "}
                {activeTab.toUpperCase()} grid.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No valid rows found in file.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={!previewData?.length}>
              Confirm import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
