import { useCallback, useEffect, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import {
  importPropertyKnowledge,
  type ImportPropertyKnowledgeResult,
} from "@/services/knowledgeBase";

interface Property {
  _id: string;
  name: string;
  code: string;
}

export function KnowledgeImportSetup() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState<string>("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportPropertyKnowledgeResult | null>(null);

  const loadProperties = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/properties`, { headers: withAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: "Select a file", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const res = await importPropertyKnowledge(file, {
        propertyId: propertyId || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
      });
      setResult(res);
      toast({
        title: "Import complete",
        description: `${res.propertyName}: ${res.itemsUpserted} knowledge items updated`,
      });
      void loadProperties();
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload a property information workbook (.xlsx). Use column A for field labels and column C
        for values (same layout as your property factsheet Excel). The importer creates or updates
        the hotel and four knowledge base entries (property card, fact sheet, templates, policies).
      </p>

      <div
        className="rounded-lg border border-dashed border-border p-8 text-center space-y-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
        <div>
          <Label htmlFor="kb-xls" className="cursor-pointer">
            <span className="text-sm font-medium text-primary hover:underline">
              Choose Excel file
            </span>
            <Input
              id="kb-xls"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />
          </Label>
          {file && <p className="text-sm text-muted-foreground mt-2">{file.name}</p>}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Optional overrides</p>
        <div>
          <Label>Map to existing property (optional)</Label>
          <Select value={propertyId || "__new__"} onValueChange={(v) => setPropertyId(v === "__new__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Create from sheet name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">Create from sheet — Property Name List</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. South Goa" />
          </div>
          <div>
            <Label>State</Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Goa" />
          </div>
          <div>
            <Label>Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
      </div>

      <Button onClick={() => void handleImport()} disabled={!file || loading} className="gap-2">
        <Upload className="h-4 w-4" />
        {loading ? "Importing…" : "Import knowledge base"}
      </Button>

      {result && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Import successful
          </div>
          <p>Property: {result.propertyName}</p>
          <p>Items updated: {result.itemsUpserted}</p>
          <p>{result.propertyCreated ? "New property created" : "Existing property updated"}</p>
          {result.warnings?.length > 0 && (
            <ul className="text-amber-700 list-disc pl-5">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
