import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
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
import { Upload, Plus, ChevronDown, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type RateGridData,
  type RateGridRow,
  type RateGridValue,
  type InclusionNomenclature,
} from "@/models/contract";
import { getOrderedSlabs, rowsForSlab, uniqueRoomTypes } from "@/utils/contractRateSections";

interface RateGridProps {
  value: RateGridValue;
  onChange: (value: RateGridValue) => void;
  roomTypes?: string[];
  rateSlabs?: string[];
  /** Compact layout for contract wizard (no nested cards) */
  embedded?: boolean;
  /** Read-only display (e.g. contract view dialog) */
  readOnly?: boolean;
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function RateCell({
  value,
  onChange,
  embedded,
  readOnly,
}: {
  value: number;
  onChange: (v: number) => void;
  embedded?: boolean;
  readOnly?: boolean;
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
  if (readOnly) {
    return (
      <span className={cn("tabular-nums text-right block", embedded ? "text-xs" : "text-sm")}>
        {value ? value.toLocaleString("en-IN") : "—"}
      </span>
    );
  }
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={syncFromProp}
      onKeyDown={(e) => e.key === "Enter" && syncFromProp()}
      className={cn(
        "w-full min-w-[68px] px-2 text-right text-sm border border-border bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring/40 tabular-nums",
        embedded ? "h-8 text-xs" : "h-9"
      )}
    />
  );
}

function InclusionCell({
  value,
  options,
  onChange,
  embedded,
  readOnly,
}: {
  value: string[];
  options: InclusionNomenclature[];
  onChange: (v: string[]) => void;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (code: string) => {
    const next = value.includes(code)
      ? value.filter((c) => c !== code)
      : [...value, code];
    onChange(next);
  };
  const label = value.length > 0 ? value.join(", ") : "—";
  if (readOnly) {
    return <span className="text-xs text-muted-foreground">{label}</span>;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full min-w-[80px] px-2 text-left text-sm border border-border bg-background rounded-md flex items-center justify-between gap-1 hover:bg-muted/40",
            embedded ? "h-8 text-xs" : "h-9"
          )}
        >
          <span className="truncate text-muted-foreground">{value.length ? label : "Select"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt.code} className="flex items-center gap-2 text-sm cursor-pointer">
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

function CatRateSection({
  slab,
  rows,
  onUpdateRow,
  embedded,
  readOnly,
}: {
  slab: string;
  rows: RateGridRow[];
  onUpdateRow: (rowId: string, patch: Partial<RateGridRow>) => void;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const rowRevenue = (r: RateGridRow) => (r.double || 0) * (r.rn || 0);
  const sectionRn = rows.reduce((s, r) => s + (r.rn || 0), 0);
  const sectionRevenue = rows.reduce((s, r) => s + rowRevenue(r), 0);
  const thClass = cn(
    "font-medium text-text-muted uppercase tracking-wide",
    embedded ? "p-1.5 text-[10px]" : "p-2 text-xs"
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className={cn(
          "px-3 py-2 border-b border-border bg-muted/40 font-semibold text-foreground",
          embedded ? "text-xs" : "text-sm"
        )}
      >
        {slab}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className={cn(thClass, "text-left min-w-[120px]")}>Room type</th>
              <th className={cn(thClass, "text-center min-w-[68px]")}>Single (₹)</th>
              <th className={cn(thClass, "text-center min-w-[68px]")}>Double (₹)</th>
              <th className={cn(thClass, "text-center min-w-[68px]")}>Triple (₹)</th>
              <th className={cn(thClass, "text-center min-w-[56px]")}>RN</th>
              <th className={cn(thClass, "text-center min-w-[76px]")}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">
                  No room types for this category
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/80 hover:bg-muted/15">
                  <td className={cn("font-medium", embedded ? "p-1.5 text-xs" : "p-2")}>
                    {row.roomType}
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.single}
                      onChange={(v) => onUpdateRow(row.id, { single: v })}
                      embedded={embedded}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.double}
                      onChange={(v) => onUpdateRow(row.id, { double: v })}
                      embedded={embedded}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.triple}
                      onChange={(v) => onUpdateRow(row.id, { triple: v })}
                      embedded={embedded}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="p-1">
                    <RateCell
                      value={row.rn}
                      onChange={(v) => onUpdateRow(row.id, { rn: v })}
                      embedded={embedded}
                      readOnly={readOnly}
                    />
                  </td>
                  <td
                    className={cn(
                      "text-right text-text-muted tabular-nums",
                      embedded ? "p-1.5 text-xs" : "p-2"
                    )}
                  >
                    {formatCurrency(rowRevenue(row))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className={embedded ? "p-1.5 text-xs" : "p-2"}>Subtotal</td>
                <td colSpan={3} />
                <td className={cn("text-right tabular-nums", embedded ? "p-1.5 text-xs" : "p-2")}>
                  {sectionRn.toLocaleString()}
                </td>
                <td className={cn("text-right tabular-nums", embedded ? "p-1.5 text-xs" : "p-2")}>
                  {formatCurrency(sectionRevenue)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function RoomInclusionsMatrix({
  rows,
  slabs,
  inclusionOptions,
  onUpdateRow,
  embedded,
  readOnly,
}: {
  rows: RateGridRow[];
  slabs: string[];
  inclusionOptions: InclusionNomenclature[];
  onUpdateRow: (rowId: string, patch: Partial<RateGridRow>) => void;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const roomTypes = uniqueRoomTypes(rows);
  const findRow = (roomType: string, slab: string) =>
    rows.find((r) => r.roomType === roomType && r.rateSlab === slab);

  if (roomTypes.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className={embedded ? "text-xs" : undefined}>Room inclusions (by category)</Label>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left p-2 text-xs font-medium text-muted-foreground">Room</th>
              {slabs.map((slab) => (
                <th key={slab} className="text-left p-2 text-xs font-medium text-muted-foreground">
                  {slab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => (
              <tr key={rt} className="border-b border-border/80">
                <td className="p-2 font-medium text-xs">{rt}</td>
                {slabs.map((slab) => {
                  const row = findRow(rt, slab);
                  if (!row) {
                    return (
                      <td key={slab} className="p-1 text-muted-foreground text-xs">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={slab} className="p-1">
                      <InclusionCell
                        value={row.inclusions}
                        options={inclusionOptions}
                        onChange={(v) => onUpdateRow(row.id, { inclusions: v })}
                        embedded={embedded}
                        readOnly={readOnly}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomRemarksByCat({
  rows,
  slabs,
  onUpdateRow,
  embedded,
  readOnly,
}: {
  rows: RateGridRow[];
  slabs: string[];
  onUpdateRow: (rowId: string, patch: Partial<RateGridRow>) => void;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const roomTypes = uniqueRoomTypes(rows);
  const findRow = (roomType: string, slab: string) =>
    rows.find((r) => r.roomType === roomType && r.rateSlab === slab);

  if (roomTypes.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className={embedded ? "text-xs" : undefined}>Room-specific remarks</Label>
      <div className="space-y-3">
        {slabs.map((slab) => (
          <div key={slab} className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{slab}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {roomTypes.map((rt) => {
                const row = findRow(rt, slab);
                if (!row) return null;
                return (
                  <div key={`${rt}-${slab}`} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{rt}</span>
                    {readOnly ? (
                      <p className="text-sm">{row.remarks || "—"}</p>
                    ) : (
                      <Input
                        value={row.remarks}
                        onChange={(e) => onUpdateRow(row.id, { remarks: e.target.value })}
                        placeholder="Remarks"
                        className={embedded ? "h-8 text-xs" : "h-9"}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelRateEditor({
  data,
  onChange,
  inclusionOptions,
  onUpload,
  embedded,
  readOnly,
}: {
  data: RateGridData;
  onChange: (value: RateGridData) => void;
  inclusionOptions: InclusionNomenclature[];
  onUpload?: () => void;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const updateRow = (rowId: string, patch: Partial<RateGridRow>) => {
    const next = data.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
    onChange({ ...data, rows: next });
  };

  const slabs = getOrderedSlabs(data.rows);
  const grandTotalRn = data.rows.reduce((s, r) => s + (r.rn || 0), 0);
  const grandTotalRevenue = data.rows.reduce(
    (s, r) => s + (r.double || 0) * (r.rn || 0),
    0
  );

  return (
    <div className={cn(embedded ? "space-y-3" : "space-y-4")}>
      {!readOnly && onUpload && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
            className={embedded ? "h-8 text-xs" : undefined}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {slabs.map((slab) => (
          <CatRateSection
            key={slab}
            slab={slab}
            rows={rowsForSlab(data.rows, slab)}
            onUpdateRow={updateRow}
            embedded={embedded}
            readOnly={readOnly}
          />
        ))}
      </div>

      {data.rows.length > 0 && (
        <div
          className={cn(
            "flex justify-end gap-6 px-3 py-2 rounded-lg bg-muted/30 border border-border font-medium tabular-nums",
            embedded ? "text-xs" : "text-sm"
          )}
        >
          <span>
            Total RN: <span className="text-foreground">{grandTotalRn.toLocaleString()}</span>
          </span>
          <span>
            Total revenue: <span className="text-foreground">{formatCurrency(grandTotalRevenue)}</span>
          </span>
        </div>
      )}

      <RoomInclusionsMatrix
        rows={data.rows}
        slabs={slabs}
        inclusionOptions={inclusionOptions}
        onUpdateRow={updateRow}
        embedded={embedded}
        readOnly={readOnly}
      />

      <RoomRemarksByCat
        rows={data.rows}
        slabs={slabs}
        onUpdateRow={updateRow}
        embedded={embedded}
        readOnly={readOnly}
      />
    </div>
  );
}

function InclusionNomenclatureTable({
  items,
  onChange,
  onAdd,
  readOnly,
}: {
  items: InclusionNomenclature[];
  onChange: (items: InclusionNomenclature[]) => void;
  onAdd: () => void;
  readOnly?: boolean;
}) {
  const update = (idx: number, patch: Partial<InclusionNomenclature>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  if (readOnly) {
    return (
      <ul className="space-y-1 text-sm">
        {items.length === 0 ? (
          <li className="text-muted-foreground">—</li>
        ) : (
          items.map((item, idx) => (
            <li key={idx}>
              <span className="font-medium">{item.code}</span>
              {item.fullName ? ` — ${item.fullName}` : ""}
            </li>
          ))
        )}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Inclusion nomenclature</Label>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left font-medium p-2">Code</th>
            <th className="text-left font-medium p-2">Full name</th>
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
  embedded = false,
  readOnly = false,
}: RateGridProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<RateGridRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<"b2b" | "b2c">("b2b");

  const b2b = value.b2b;
  const b2c = value.b2c;

  const updateB2B = (v: RateGridData) => {
    if (readOnly) return;
    onChange({
      ...value,
      b2b: v,
      inclusionNomenclature: v.inclusionNomenclature,
      additionalRemarks: v.additionalRemarks,
    });
  };
  const updateB2C = (v: RateGridData) => {
    if (readOnly) return;
    onChange({
      ...value,
      b2c: v,
      inclusionNomenclature: v.inclusionNomenclature,
      additionalRemarks: v.additionalRemarks,
    });
  };
  const updateInclusions = (items: InclusionNomenclature[]) => {
    if (readOnly) return;
    onChange({
      ...value,
      inclusionNomenclature: items,
      b2b: { ...b2b, inclusionNomenclature: items },
      b2c: { ...b2c, inclusionNomenclature: items },
    });
  };
  const updateRemarks = (text: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      additionalRemarks: text,
      b2b: { ...b2b, additionalRemarks: text },
      b2c: { ...b2c, additionalRemarks: text },
    });
  };

  const inclusionOptions = value.inclusionNomenclature ?? b2b.inclusionNomenclature ?? [];

  const addInclusion = () => {
    updateInclusions([...inclusionOptions, { code: "", fullName: "" }]);
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
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const mapped = parsed
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
    if (isCsv) reader.readAsText(file, "UTF-8");
    else reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const confirmImport = () => {
    if (!previewData) return;
    const target = activeTab === "b2b" ? updateB2B : updateB2C;
    const current = activeTab === "b2b" ? b2b : b2c;
    target({ ...current, rows: previewData });
    setPreviewOpen(false);
    setPreviewData(null);
  };

  const channelToggle = (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border w-fit",
        readOnly && "pointer-events-none opacity-90"
      )}
    >
      {(["b2b", "b2c"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            activeTab === tab
              ? "bg-background text-foreground shadow-sm"
              : "text-text-muted hover:text-foreground"
          )}
        >
          {tab === "b2b" ? "B2B rates" : "B2C rates"}
        </button>
      ))}
    </div>
  );

  const renderChannel = (channel: "b2b" | "b2c") => (
    <ChannelRateEditor
      data={channel === "b2b" ? b2b : b2c}
      onChange={channel === "b2b" ? updateB2B : updateB2C}
      inclusionOptions={inclusionOptions}
      onUpload={readOnly ? undefined : () => uploadRef.current?.click()}
      embedded={embedded}
      readOnly={readOnly}
    />
  );

  const inclusionBlock = (
    <div
      className={cn(
        embedded
          ? "rounded-lg border border-border bg-muted/20 p-3 space-y-3"
          : "rounded-lg border border-border p-4 space-y-3"
      )}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
        Inclusion nomenclature
      </p>
      <InclusionNomenclatureTable
        items={inclusionOptions}
        onChange={updateInclusions}
        onAdd={addInclusion}
        readOnly={readOnly}
      />
    </div>
  );

  const remarksBlock = (
    <div className="space-y-2">
      <Label className={embedded ? "text-xs" : undefined}>
        Additional remarks / special conditions
      </Label>
      {readOnly ? (
        <p className="text-sm whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 min-h-[48px]">
          {value.additionalRemarks?.trim() || "—"}
        </p>
      ) : (
        <Textarea
          value={value.additionalRemarks ?? ""}
          onChange={(e) => updateRemarks(e.target.value)}
          placeholder="Add any special conditions or notes..."
          className={embedded ? "min-h-[64px] text-sm" : "min-h-[80px]"}
        />
      )}
    </div>
  );

  return (
    <div className={cn(embedded ? "space-y-4 p-3" : "space-y-6")}>
      {!readOnly && (
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
        />
      )}

      {embedded || readOnly ? (
        <div className="space-y-4">
          {channelToggle}
          {renderChannel(activeTab)}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "b2b" | "b2c")}>
          <TabsList>
            <TabsTrigger value="b2b">B2B Rates</TabsTrigger>
            <TabsTrigger value="b2c">B2C Rates</TabsTrigger>
          </TabsList>
          <TabsContent value="b2b" className="mt-4 space-y-4">
            {renderChannel("b2b")}
          </TabsContent>
          <TabsContent value="b2c" className="mt-4 space-y-4">
            {renderChannel("b2c")}
          </TabsContent>
        </Tabs>
      )}

      {inclusionBlock}
      {remarksBlock}

      {!readOnly && (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm text-muted-foreground mt-2">
                  {previewData.length} row(s) will replace the current {activeTab.toUpperCase()} grid.
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
      )}
    </div>
  );
}
