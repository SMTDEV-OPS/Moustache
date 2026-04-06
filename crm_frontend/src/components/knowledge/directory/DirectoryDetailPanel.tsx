import {
  type IPropertyDirectoryContent,
  type IPropertyDirectoryCityEntry,
} from "@/services/knowledgeBase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

function citySections(content: IPropertyDirectoryContent) {
  const ci = content.cityInfo;
  const cg = content.cityGuide;
  return {
    restaurants: ci?.restaurants ?? cg?.restaurants,
    shopping: ci?.shopping ?? cg?.shopping,
    nightlife: ci?.nightlife ?? cg?.nightlife,
    attractions: ci?.attractions ?? cg?.attractions,
    importantPlaces: ci?.importantPlaces ?? cg?.importantPlaces,
    streetFood: ci?.streetFood ?? cg?.streetFood,
  };
}

function roomCategory(r: NonNullable<IPropertyDirectoryContent["rooms"]>[0]) {
  return (r.category ?? r.name ?? "").trim();
}

function roomAC(r: NonNullable<IPropertyDirectoryContent["rooms"]>[0]) {
  return Boolean(r.isAC ?? r.ac);
}

function roomEnsuite(r: NonNullable<IPropertyDirectoryContent["rooms"]>[0]) {
  return Boolean(r.isEnsuite ?? r.ensuite);
}

function CityRow({
  entries,
  title,
  icon,
}: {
  entries?: IPropertyDirectoryCityEntry[];
  title: string;
  icon: string;
}) {
  if (!entries?.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        {title}
      </h4>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {entries.map((e, i) => (
          <Card
            key={`${e.name}-${i}`}
            className="rounded-md border border-border/80 shadow-none shrink-0 w-[140px]"
          >
            <CardContent className="p-3 text-sm">
              <p className="font-medium text-foreground line-clamp-2">{e.name}</p>
              {e.distanceOrNotes ? (
                <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                  {e.distanceOrNotes}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoomsSection({ content }: { content: IPropertyDirectoryContent | null }) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No directory content yet.
      </p>
    );
  }
  const rooms = content.rooms ?? [];
  const totalBeds = rooms.reduce((s, r) => s + (r.count || 0), 0);
  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">No room rows.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {totalBeds} beds across {rooms.length} room type
        {rooms.length === 1 ? "" : "s"}
      </p>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room category</TableHead>
              <TableHead className="text-center w-20">Count</TableHead>
              <TableHead className="text-center w-16">AC</TableHead>
              <TableHead className="text-center w-24">Ensuite</TableHead>
              <TableHead className="min-w-[100px]">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((r, i) => (
              <TableRow key={`${roomCategory(r)}-${i}`}>
                <TableCell className="font-medium">{roomCategory(r) || "—"}</TableCell>
                <TableCell className="text-center">{r.count}</TableCell>
                <TableCell className="text-center">
                  {roomAC(r) ? "✅" : "❌"}
                </TableCell>
                <TableCell className="text-center">
                  {roomEnsuite(r) ? "✅" : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.notes ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AmenitiesSection({
  content,
}: {
  content: IPropertyDirectoryContent | null;
}) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No directory content yet.
      </p>
    );
  }
  const am = content.amenities ?? {};
  const safety = am.safety ?? am.safetySecurity ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-md border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span>🛏</span> Room amenities
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(am.room ?? []).map((x) => (
            <Badge key={x} variant="secondary" className="font-normal rounded-sm">
              {x}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span>🏨</span> Hotel amenities
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(am.hotel ?? []).map((x) => (
            <Badge key={x} variant="secondary" className="font-normal rounded-sm">
              {x}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span>🔒</span> Safety &amp; security
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {safety.map((x) => (
            <Badge key={x} variant="secondary" className="font-normal rounded-sm">
              {x}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-border p-4 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span>🛎</span> Front office
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(am.frontOffice ?? []).map((x) => (
            <Badge key={x} variant="secondary" className="font-normal rounded-sm">
              {x}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function CitySection({ content }: { content: IPropertyDirectoryContent | null }) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No directory content yet.
      </p>
    );
  }
  const cg = citySections(content);
  return (
    <div className="space-y-6">
      <CityRow icon="🍽" title="Restaurants & Cafes" entries={cg.restaurants} />
      <CityRow icon="🛍" title="Shopping" entries={cg.shopping} />
      <CityRow icon="🌙" title="Nightlife" entries={cg.nightlife} />
      <CityRow icon="🏔" title="Attractions" entries={cg.attractions} />
      <CityRow
        icon="📍"
        title="Important places (transport)"
        entries={cg.importantPlaces}
      />
      <CityRow icon="🍢" title="Street food" entries={cg.streetFood} />
    </div>
  );
}

export function DirectoryDetailPanel({
  content,
  tabOnly,
}: {
  content: IPropertyDirectoryContent | null;
  tabOnly?: "rooms" | "amenities" | "city";
}) {
  if (tabOnly === "rooms") {
    return <RoomsSection content={content} />;
  }
  if (tabOnly === "amenities") {
    return <AmenitiesSection content={content} />;
  }
  if (tabOnly === "city") {
    return <CitySection content={content} />;
  }

  if (!content) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No directory content yet. Run the seed script, import Excel, or edit to add
        details.
      </p>
    );
  }

  return (
    <Tabs defaultValue="rooms" className="w-full">
      <TabsList className="rounded-none h-10 w-full justify-start gap-1 bg-muted/40 p-1">
        <TabsTrigger value="rooms" className="rounded-sm text-xs sm:text-sm">
          Rooms
        </TabsTrigger>
        <TabsTrigger value="amenities" className="rounded-sm text-xs sm:text-sm">
          Amenities
        </TabsTrigger>
        <TabsTrigger value="city" className="rounded-sm text-xs sm:text-sm">
          City guide
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rooms" className="mt-4">
        <RoomsSection content={content} />
      </TabsContent>

      <TabsContent value="amenities" className="mt-4">
        <AmenitiesSection content={content} />
      </TabsContent>

      <TabsContent value="city" className="mt-4">
        <CitySection content={content} />
      </TabsContent>
    </Tabs>
  );
}
