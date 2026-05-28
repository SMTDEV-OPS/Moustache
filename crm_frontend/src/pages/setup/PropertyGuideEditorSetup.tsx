import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import {
  fetchPropertyGuide,
  savePropertyGuide,
  uploadFiles,
  deleteFile,
  importPropertyKnowledge,
  type PropertyGuideContent,
} from "@/services/knowledgeBase";
interface Property {
  _id: string;
  name: string;
  code: string;
}

function tagsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function textFromTags(tags: string[]): string {
  return tags.join("\n");
}

const emptyContent = (): PropertyGuideContent => ({
  contact: {},
  rates: [],
  amenities: [],
  facilities: [],
  experiences: {},
  sellingStory: {},
  policies: [],
  gallery: [],
});

export function PropertyGuideEditorSetup() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [content, setContent] = useState<PropertyGuideContent>(emptyContent());
  const [guideId, setGuideId] = useState<string | undefined>();
  const [galleryUrls, setGalleryUrls] = useState<
    Array<{ fileId: string; url: string; caption?: string }>
  >([]);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amenitiesText, setAmenitiesText] = useState("");
  const [facilitiesText, setFacilitiesText] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);

  const loadProperties = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/properties`, { headers: withAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      setProperties(Array.isArray(data) ? data : []);
    }
  }, []);

  const loadGuide = useCallback(async (pid: string) => {
    if (!pid) return;
    try {
      setLoading(true);
      const payload = await fetchPropertyGuide(pid);
      setGuideId(payload.guideId);
      setContent(payload.content || emptyContent());
      setGalleryUrls(payload.galleryUrls || []);
      setShareEnabled(payload.shareEnabled);
      setAmenitiesText(textFromTags(payload.content?.amenities || []));
      setFacilitiesText(textFromTags(payload.content?.facilities || []));
    } catch {
      setGuideId(undefined);
      setContent(emptyContent());
      setGalleryUrls([]);
      setShareEnabled(false);
      setAmenitiesText("");
      setFacilitiesText("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (propertyId) void loadGuide(propertyId);
  }, [propertyId, loadGuide]);

  const handleSave = async () => {
    if (!propertyId) {
      toast({ title: "Select a property", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const toSave: PropertyGuideContent = {
        ...content,
        amenities: tagsFromText(amenitiesText),
        facilities: tagsFromText(facilitiesText),
      };
      const payload = await savePropertyGuide(propertyId, {
        content: toSave,
        shareEnabled,
      });
      setGuideId(payload.guideId);
      setGalleryUrls(payload.galleryUrls || []);
      toast({ title: "Property guide saved" });
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addRate = () => {
    setContent((c) => ({
      ...c,
      rates: [...(c.rates || []), { room: "", rate: "" }],
    }));
  };

  const updateRate = (i: number, field: "room" | "rate", value: string) => {
    setContent((c) => {
      const rates = [...(c.rates || [])];
      rates[i] = { ...rates[i], [field]: value };
      return { ...c, rates };
    });
  };

  const removeRate = (i: number) => {
    setContent((c) => ({
      ...c,
      rates: (c.rates || []).filter((_, idx) => idx !== i),
    }));
  };

  const addPolicy = () => {
    setContent((c) => ({
      ...c,
      policies: [...(c.policies || []), { title: "", body: "" }],
    }));
  };

  const updatePolicy = (i: number, field: "title" | "body", value: string) => {
    setContent((c) => {
      const policies = [...(c.policies || [])];
      policies[i] = { ...policies[i], [field]: value };
      return { ...c, policies };
    });
  };

  const removePolicy = (i: number) => {
    setContent((c) => ({
      ...c,
      policies: (c.policies || []).filter((_, idx) => idx !== i),
    }));
  };

  const onGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !propertyId) return;
    try {
      let id = guideId;
      if (!id) {
        const saved = await savePropertyGuide(propertyId, { content, shareEnabled });
        id = saved.guideId;
        setGuideId(id);
      }
      if (!id) throw new Error("Save guide before uploading photos");
      await uploadFiles(id, Array.from(files));
      await loadGuide(propertyId);
      toast({ title: "Photos uploaded" });
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
    e.target.value = "";
  };

  const removeGalleryImage = async (fileId: string) => {
    if (!guideId) return;
    try {
      await deleteFile(guideId, fileId);
      await loadGuide(propertyId);
      toast({ title: "Photo removed" });
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  const handleExcelImport = async () => {
    if (!excelFile) return;
    try {
      setSaving(true);
      await importPropertyKnowledge(excelFile, { propertyId: propertyId || undefined });
      if (propertyId) await loadGuide(propertyId);
      toast({ title: "Excel import complete" });
      setExcelFile(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const regenerateToken = async () => {
    if (!propertyId) return;
    try {
      const payload = await savePropertyGuide(propertyId, {
        content: { ...content, amenities: tagsFromText(amenitiesText), facilities: tagsFromText(facilitiesText) },
        shareEnabled,
        regenerateShareToken: true,
      });
      setGuideId(payload.guideId);
      toast({ title: "New share link generated" });
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Property guide editor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit section-by-section content and photo gallery for each hotel.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Property</Label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger>
            <SelectValue placeholder="Select hotel…" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.name} ({p.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && propertyId ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading guide…
        </div>
      ) : propertyId ? (
        <>
          <Accordion type="multiple" defaultValue={["contact", "gallery"]} className="w-full">
            <AccordionItem value="contact">
              <AccordionTrigger>Contact</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={content.contact?.phone || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        contact: { ...c.contact, phone: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={content.contact?.email || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        contact: { ...c.contact, email: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={content.contact?.website || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        contact: { ...c.contact, website: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Location label</Label>
                  <Input
                    value={content.location || ""}
                    onChange={(e) => setContent((c) => ({ ...c, location: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Property type</Label>
                  <Input
                    value={content.propertyType || ""}
                    onChange={(e) => setContent((c) => ({ ...c, propertyType: e.target.value }))}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rooms">
              <AccordionTrigger>Rooms & rates</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Room categories</Label>
                  <Textarea
                    value={content.roomCategories || ""}
                    onChange={(e) =>
                      setContent((c) => ({ ...c, roomCategories: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rack rates</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRate}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add row
                    </Button>
                  </div>
                  {(content.rates || []).map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Room type"
                        value={row.room}
                        onChange={(e) => updateRate(i, "room", e.target.value)}
                      />
                      <Input
                        placeholder="Rate"
                        value={row.rate}
                        onChange={(e) => updateRate(i, "rate", e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRate(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="amenities">
              <AccordionTrigger>Amenities & facilities</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Amenities (one per line)</Label>
                  <Textarea value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} rows={4} />
                </div>
                <div>
                  <Label>Facilities (one per line)</Label>
                  <Textarea value={facilitiesText} onChange={(e) => setFacilitiesText(e.target.value)} rows={4} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="experiences">
              <AccordionTrigger>Experiences</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Attractions</Label>
                  <Textarea
                    value={content.experiences?.attractions || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        experiences: { ...c.experiences, attractions: e.target.value },
                      }))
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Tours</Label>
                  <Textarea
                    value={content.experiences?.tours || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        experiences: { ...c.experiences, tours: e.target.value },
                      }))
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={content.experiences?.notes || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        experiences: { ...c.experiences, notes: e.target.value },
                      }))
                    }
                    rows={2}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="story">
              <AccordionTrigger>Selling story</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label>Speciality</Label>
                  <Textarea
                    value={content.sellingStory?.speciality || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        sellingStory: { ...c.sellingStory, speciality: e.target.value },
                      }))
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Marketing pitch</Label>
                  <Textarea
                    value={content.sellingStory?.marketingPitch || ""}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        sellingStory: { ...c.sellingStory, marketingPitch: e.target.value },
                      }))
                    }
                    rows={4}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="policies">
              <AccordionTrigger>Policies</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Button type="button" variant="outline" size="sm" onClick={addPolicy}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add policy
                </Button>
                {(content.policies || []).map((p, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <Input
                      placeholder="Title"
                      value={p.title}
                      onChange={(e) => updatePolicy(i, "title", e.target.value)}
                    />
                    <Textarea
                      placeholder="Body"
                      value={p.body}
                      onChange={(e) => updatePolicy(i, "body", e.target.value)}
                      rows={3}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePolicy(i)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gallery">
              <AccordionTrigger>Photo gallery</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  First image is used as the cover and hub thumbnail.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {galleryUrls.map((g) => (
                    <div key={g.fileId} className="relative aspect-video rounded-md overflow-hidden border">
                      <img src={g.url} alt="" className="h-full w-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => void removeGalleryImage(g.fileId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Label className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-4 py-2 hover:bg-muted">
                  <ImagePlus className="h-4 w-4" />
                  Upload photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => void onGalleryUpload(e)}
                  />
                </Label>
                <div>
                  <Label>Legacy Google Drive URL (optional)</Label>
                  <Input
                    value={content.legacyDriveUrl || ""}
                    onChange={(e) => setContent((c) => ({ ...c, legacyDriveUrl: e.target.value }))}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sharing">
              <AccordionTrigger>Public sharing</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="share-enabled">Enable public link</Label>
                  <Switch
                    id="share-enabled"
                    checked={shareEnabled}
                    onCheckedChange={setShareEnabled}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void regenerateToken()}>
                  Regenerate share token
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex gap-2">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save guide"}
            </Button>
          </div>

          <Collapsible open={excelOpen} onOpenChange={setExcelOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Upload className="h-4 w-4 mr-1" />
                Advanced: Import from Excel
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2 rounded-lg border p-4">
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!excelFile || saving}
                onClick={() => void handleExcelImport()}
              >
                Run import
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : null}
    </div>
  );
}
