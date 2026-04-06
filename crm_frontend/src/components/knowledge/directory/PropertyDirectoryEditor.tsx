import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type HotelDirectoryEntry,
  type IPropertyDirectoryContent,
  type IPropertyDirectoryCityEntry,
  updateDirectoryEntry,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type EditorContent = IPropertyDirectoryContent;

function emptyCityInfo(): NonNullable<IPropertyDirectoryContent["cityInfo"]> {
  return {
    restaurants: [],
    shopping: [],
    nightlife: [],
    attractions: [],
    importantPlaces: [],
    streetFood: [],
  };
}

function emptyContent(): EditorContent {
  return {
    region: "",
    city: "",
    address: "",
    landmark: "",
    contact: {},
    buildingHighlights: [],
    rooms: [],
    amenities: { room: [], hotel: [], safety: [], frontOffice: [] },
    cityInfo: emptyCityInfo(),
    checkInTime: "",
    checkOutTime: "",
  };
}

function normalizeFromEntry(entry: HotelDirectoryEntry | null): EditorContent {
  if (!entry?.content) return emptyContent();
  const raw = entry.content as IPropertyDirectoryContent;
  const cg = raw.cityGuide;
  const ci = raw.cityInfo;
  const cityInfo: NonNullable<IPropertyDirectoryContent["cityInfo"]> = {
    restaurants: ci?.restaurants ?? cg?.restaurants ?? [],
    shopping: ci?.shopping ?? cg?.shopping ?? [],
    nightlife: ci?.nightlife ?? cg?.nightlife ?? [],
    attractions: ci?.attractions ?? cg?.attractions ?? [],
    importantPlaces: ci?.importantPlaces ?? cg?.importantPlaces ?? [],
    streetFood: ci?.streetFood ?? cg?.streetFood ?? [],
  };
  const c = raw.contact ?? {};
  const rooms = (raw.rooms ?? []).map((r) => ({
    category: (r.category ?? r.name ?? "").trim(),
    count: typeof r.count === "number" ? r.count : 0,
    isAC: Boolean(r.isAC ?? r.ac),
    isEnsuite: Boolean(r.isEnsuite ?? r.ensuite),
    notes: r.notes,
  }));
  const am = raw.amenities ?? {};
  return {
    ...emptyContent(),
    ...raw,
    tier: raw.tier,
    region: raw.region ?? (typeof c.state === "string" ? c.state : "") ?? "",
    city:
      raw.city ??
      (typeof c.city === "string" ? c.city : "") ??
      "",
    address:
      raw.address ??
      (typeof c.addressLine1 === "string" ? c.addressLine1 : "") ??
      "",
    landmark: raw.landmark ?? "",
    contact: {
      frontDesk:
        (typeof c.frontDesk === "string" ? c.frontDesk : undefined) ??
        (typeof c.frontDeskPhone === "string" ? c.frontDeskPhone : "") ??
        "",
      email:
        (typeof c.email === "string" ? c.email : undefined) ??
        (typeof c.frontDeskEmail === "string" ? c.frontDeskEmail : "") ??
        "",
      managerName:
        (typeof c.managerName === "string" ? c.managerName : undefined) ??
        (typeof c.gmName === "string" ? c.gmName : "") ??
        "",
      managerPhone:
        (typeof c.managerPhone === "string" ? c.managerPhone : undefined) ??
        (typeof c.gmPhone === "string" ? c.gmPhone : "") ??
        "",
      mapLink: typeof c.mapLink === "string" ? c.mapLink : "",
    },
    buildingHighlights: [...(raw.buildingHighlights ?? [])],
    rooms,
    amenities: {
      room: [...(am.room ?? [])],
      hotel: [...(am.hotel ?? [])],
      safety: [...(am.safety ?? am.safetySecurity ?? [])],
      frontOffice: [...(am.frontOffice ?? [])],
    },
    cityInfo,
    checkInTime: raw.checkInTime ?? "",
    checkOutTime: raw.checkOutTime ?? "",
  };
}

export function PropertyDirectoryEditor({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: HotelDirectoryEntry | null;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<EditorContent>(emptyContent());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setContent(normalizeFromEntry(entry));
    } else if (open) {
      setContent(emptyContent());
    }
  }, [open, entry]);

  const save = async () => {
    if (!entry?.propertyId) {
      toast.error("Missing property");
      return;
    }
    setSaving(true);
    try {
      await updateDirectoryEntry(
        entry.propertyId,
        content as Record<string, unknown>
      );
      toast.success("Directory saved");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save directory");
    } finally {
      setSaving(false);
    }
  };

  const c = content.contact ?? {};
  const setContact = (patch: Partial<NonNullable<EditorContent["contact"]>>) =>
    setContent((prev) => ({
      ...prev,
      contact: { ...prev.contact, ...patch },
    }));

  const am = content.amenities ?? {};
  const setAmList = (
    key: "room" | "hotel" | "safety" | "frontOffice",
    items: string[]
  ) =>
    setContent((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: items },
    }));

  const pushAm = (
    key: "room" | "hotel" | "safety" | "frontOffice",
    v: string
  ) => {
    const t = v.trim();
    if (!t) return;
    const cur = [...(am[key] ?? [])];
    cur.push(t);
    setAmList(key, cur);
  };

  const cg = content.cityInfo ?? emptyCityInfo();
  const setCg = (
    key: keyof NonNullable<IPropertyDirectoryContent["cityInfo"]>,
    items: IPropertyDirectoryCityEntry[]
  ) =>
    setContent((prev) => ({
      ...prev,
      cityInfo: { ...emptyCityInfo(), ...prev.cityInfo, [key]: items },
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm border border-border">
        <DialogHeader>
          <DialogTitle>Edit hotel directory</DialogTitle>
          {entry ? (
            <p className="text-sm text-muted-foreground">{entry.propertyName}</p>
          ) : null}
        </DialogHeader>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 rounded-sm">
            <TabsTrigger value="contact" className="text-xs">
              Location &amp; contact
            </TabsTrigger>
            <TabsTrigger value="highlights" className="text-xs">
              Highlights
            </TabsTrigger>
            <TabsTrigger value="rooms" className="text-xs">
              Rooms
            </TabsTrigger>
            <TabsTrigger value="amenities" className="text-xs">
              Amenities
            </TabsTrigger>
            <TabsTrigger value="city" className="text-xs">
              City
            </TabsTrigger>
            <TabsTrigger value="times" className="text-xs">
              Times
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-3 mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tier label (directory)</Label>
                <Input
                  value={typeof content.tier === "string" ? content.tier : ""}
                  onChange={(e) =>
                    setContent((p) => ({ ...p, tier: e.target.value }))
                  }
                  placeholder="Hostel, Select, Luxuria, Cowork"
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>Region</Label>
                <Input
                  value={content.region ?? ""}
                  onChange={(e) =>
                    setContent((p) => ({ ...p, region: e.target.value }))
                  }
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={content.city ?? ""}
                  onChange={(e) =>
                    setContent((p) => ({ ...p, city: e.target.value }))
                  }
                  className="rounded-sm mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={content.address ?? ""}
                  onChange={(e) =>
                    setContent((p) => ({ ...p, address: e.target.value }))
                  }
                  className="rounded-sm mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Landmark</Label>
                <Input
                  value={content.landmark ?? ""}
                  onChange={(e) =>
                    setContent((p) => ({ ...p, landmark: e.target.value }))
                  }
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>Front desk phone</Label>
                <Input
                  value={c.frontDesk ?? ""}
                  onChange={(e) => setContact({ frontDesk: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={c.email ?? ""}
                  onChange={(e) => setContact({ email: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>Manager name</Label>
                <Input
                  value={c.managerName ?? ""}
                  onChange={(e) => setContact({ managerName: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
              <div>
                <Label>Manager phone</Label>
                <Input
                  value={c.managerPhone ?? ""}
                  onChange={(e) => setContact({ managerPhone: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Map link</Label>
                <Input
                  value={c.mapLink ?? ""}
                  onChange={(e) => setContact({ mapLink: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="highlights" className="space-y-2 mt-4">
            {(content.buildingHighlights ?? []).map((tag, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={tag}
                  onChange={(e) => {
                    const next = [...(content.buildingHighlights ?? [])];
                    next[i] = e.target.value;
                    setContent((p) => ({ ...p, buildingHighlights: next }));
                  }}
                  className="rounded-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-sm"
                  onClick={() => {
                    const next = [...(content.buildingHighlights ?? [])];
                    next.splice(i, 1);
                    setContent((p) => ({ ...p, buildingHighlights: next }));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-sm"
              onClick={() =>
                setContent((p) => ({
                  ...p,
                  buildingHighlights: [...(p.buildingHighlights ?? []), ""],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add highlight
            </Button>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-3 mt-4">
            {(content.rooms ?? []).map((r, i) => (
              <div
                key={i}
                className="grid gap-2 sm:grid-cols-12 items-end border border-border p-3 rounded-sm"
              >
                <div className="sm:col-span-5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={r.category ?? ""}
                    onChange={(e) => {
                      const next = [...(content.rooms ?? [])];
                      next[i] = { ...next[i], category: e.target.value };
                      setContent((p) => ({ ...p, rooms: next }));
                    }}
                    className="rounded-sm mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={r.count}
                    onChange={(e) => {
                      const next = [...(content.rooms ?? [])];
                      next[i] = {
                        ...next[i],
                        count: Number(e.target.value) || 0,
                      };
                      setContent((p) => ({ ...p, rooms: next }));
                    }}
                    className="rounded-sm mt-1"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 pb-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.isAC}
                      onChange={(e) => {
                        const next = [...(content.rooms ?? [])];
                        next[i] = { ...next[i], isAC: e.target.checked };
                        setContent((p) => ({ ...p, rooms: next }));
                      }}
                    />
                    AC
                  </label>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 pb-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.isEnsuite}
                      onChange={(e) => {
                        const next = [...(content.rooms ?? [])];
                        next[i] = { ...next[i], isEnsuite: e.target.checked };
                        setContent((p) => ({ ...p, rooms: next }));
                      }}
                    />
                    Ensuite
                  </label>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-sm"
                    onClick={() => {
                      const next = [...(content.rooms ?? [])];
                      next.splice(i, 1);
                      setContent((p) => ({ ...p, rooms: next }));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="sm:col-span-12">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={r.notes ?? ""}
                    onChange={(e) => {
                      const next = [...(content.rooms ?? [])];
                      next[i] = { ...next[i], notes: e.target.value };
                      setContent((p) => ({ ...p, rooms: next }));
                    }}
                    className="rounded-sm mt-1"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-sm"
              onClick={() =>
                setContent((p) => ({
                  ...p,
                  rooms: [
                    ...(p.rooms ?? []),
                    {
                      category: "New room",
                      count: 1,
                      isAC: true,
                      isEnsuite: true,
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add room
            </Button>
          </TabsContent>

          <TabsContent value="amenities" className="space-y-4 mt-4">
            {(
              [
                ["room", "Room amenities"],
                ["hotel", "Hotel amenities"],
                ["safety", "Safety & security"],
                ["frontOffice", "Front office"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(am[key] ?? []).map((x, i) => (
                    <div key={`${x}-${i}`} className="flex items-center gap-1">
                      <Input
                        value={x}
                        className="h-8 w-40 rounded-sm"
                        onChange={(e) => {
                          const next = [...(am[key] ?? [])];
                          next[i] = e.target.value;
                          setAmList(key, next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const next = [...(am[key] ?? [])];
                          next.splice(i, 1);
                          setAmList(key, next);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={() => pushAm(key, "New item")}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="city" className="space-y-6 mt-4">
            {(
              [
                ["restaurants", "Restaurants & cafes"],
                ["shopping", "Shopping"],
                ["nightlife", "Nightlife"],
                ["attractions", "Attractions"],
                ["importantPlaces", "Important places"],
                ["streetFood", "Street food"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="space-y-2 border-b border-border pb-4 last:border-0"
              >
                <Label>{label}</Label>
                {(cg[key] ?? []).map((row, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      placeholder="Name"
                      value={row.name}
                      className="rounded-sm flex-1"
                      onChange={(e) => {
                        const list = [...(cg[key] ?? [])];
                        list[i] = { ...list[i], name: e.target.value };
                        setCg(key, list);
                      }}
                    />
                    <Input
                      placeholder="Distance / notes"
                      value={row.distanceOrNotes ?? ""}
                      className="rounded-sm flex-1"
                      onChange={(e) => {
                        const list = [...(cg[key] ?? [])];
                        list[i] = {
                          ...list[i],
                          distanceOrNotes: e.target.value,
                        };
                        setCg(key, list);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const list = [...(cg[key] ?? [])];
                        list.splice(i, 1);
                        setCg(key, list);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={() =>
                    setCg(key, [
                      ...(cg[key] ?? []),
                      { name: "", distanceOrNotes: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add entry
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="times" className="space-y-3 mt-4">
            <div>
              <Label>Check-in</Label>
              <Input
                value={content.checkInTime ?? ""}
                onChange={(e) =>
                  setContent((p) => ({ ...p, checkInTime: e.target.value }))
                }
                className="rounded-sm mt-1"
              />
            </div>
            <div>
              <Label>Check-out</Label>
              <Input
                value={content.checkOutTime ?? ""}
                onChange={(e) =>
                  setContent((p) => ({ ...p, checkOutTime: e.target.value }))
                }
                className="rounded-sm mt-1"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-sm"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
