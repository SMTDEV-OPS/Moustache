import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, X } from "lucide-react";
import type { AvailableRoomRow } from "@/services/ezeeBooking";
import { buildRateFieldsFromPms, type EzeeRatesLookupMap } from "@/services/ezeeRates";
import type { EzeeSeparateSourceMapping } from "@/services/pms";

const NONE_PHYSICAL = "__none_physical__";

const selectTriggerClass =
  "h-auto min-h-9 py-2 w-full [&>span]:line-clamp-2 [&>span]:whitespace-normal [&>span]:text-left";

export type RoomBookingRow = {
  id: string;
  roomTypeId?: string;
  roomRateId?: string;
  rateTypeId?: string;
  roomTypeName?: string;
  planName?: string;
  adults: number;
  children: number;
  ratePerNight: number;
  baseAdultOccupancy: number;
  maxAdultOccupancy: number;
  maxChildOccupancy: number;
  physicalRoomId?: string;
  physicalRoomName?: string;
};

type PhysicalRoomSelectProps = {
  hotelId: string;
  roomTypeId: string;
  fromDate: string;
  toDate: string;
  value?: string;
  onChange: (roomId: string | undefined, roomName: string | undefined) => void;
  rooms: { roomId: string; roomName: string }[];
  loading: boolean;
};

function PhysicalRoomSelectInline({ value, onChange, rooms, loading }: PhysicalRoomSelectProps) {
  if (loading) return <span className="text-xs text-muted-foreground">Loading…</span>;
  if (rooms.length === 0) return <span className="text-xs text-muted-foreground">Not assigned</span>;
  return (
    <Select
      value={value && rooms.some((r) => r.roomId === value) ? value : NONE_PHYSICAL}
      onValueChange={(val) => {
        if (val === NONE_PHYSICAL) {
          onChange(undefined, undefined);
          return;
        }
        const hit = rooms.find((r) => r.roomId === val);
        if (hit) onChange(hit.roomId, hit.roomName);
      }}
    >
      <SelectTrigger className={selectTriggerClass}>
        <SelectValue placeholder="Room no." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_PHYSICAL}>Not specified</SelectItem>
        {rooms.map((r) => (
          <SelectItem key={r.roomId} value={r.roomId}>
            {r.roomName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Props = {
  row: RoomBookingRow;
  rowIndex: number;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  loadingRooms: boolean;
  canRemove: boolean;
  roomTypeOptions: { id: string; name: string; minAvail: number; anyUnavailable: boolean }[];
  plans: AvailableRoomRow[];
  checkAvailability: (entry: AvailableRoomRow, checkIn: string, checkOut: string) => boolean;
  lockedPromoCode: string | null;
  available: AvailableRoomRow[];
  ezeeMapping?: EzeeSeparateSourceMapping;
  ezeeRateMap?: EzeeRatesLookupMap;
  physicalRooms: { roomId: string; roomName: string }[];
  physicalRoomsLoading: boolean;
  onChooseRoomType: (roomTypeId: string) => void;
  onChoosePlan: (roomRateId: string) => void;
  onResetPms: () => void;
  onRemove: () => void;
  onAdultsChange: (n: number) => void;
  onChildrenChange: (n: number) => void;
  onRateChange: (n: number) => void;
  onPhysicalRoomChange: (roomId: string | undefined, roomName: string | undefined) => void;
};

export function RoomBookingCard({
  row,
  rowIndex,
  hotelId,
  checkIn,
  checkOut,
  loadingRooms,
  canRemove,
  roomTypeOptions,
  plans,
  checkAvailability,
  lockedPromoCode,
  available,
  ezeeMapping,
  ezeeRateMap,
  physicalRooms,
  physicalRoomsLoading,
  onChooseRoomType,
  onChoosePlan,
  onResetPms,
  onRemove,
  onAdultsChange,
  onChildrenChange,
  onRateChange,
  onPhysicalRoomChange,
}: Props) {
  const mealId = row.rateTypeId;
  const rateHints =
    mealId && row.roomTypeId && ezeeMapping && ezeeRateMap
      ? buildRateFieldsFromPms(ezeeMapping, ezeeRateMap, row.roomTypeId, row.roomTypeName, mealId)
      : null;

  const promoHint =
    lockedPromoCode && row.roomRateId
      ? available.find((a) => a.roomRateId === row.roomRateId)?.discount
      : undefined;

  const displayRoomTypeName =
    row.roomTypeName ||
    roomTypeOptions.find((o) => o.id === row.roomTypeId)?.name ||
    row.roomTypeId ||
    "";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Room {rowIndex + 1}</span>
        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove room">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Room type</Label>
          <Select value={row.roomTypeId || ""} onValueChange={onChooseRoomType}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder={loadingRooms ? "Loading…" : "Select room type"}>
                {displayRoomTypeName || undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
              {roomTypeOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="whitespace-normal">
                  <span className="flex flex-col gap-0.5 py-0.5">
                    <span>{opt.name}</span>
                    <span className="text-xs text-muted-foreground">{opt.minAvail} available</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Meal plan</Label>
          <Select value={row.roomRateId || ""} onValueChange={onChoosePlan} disabled={!row.roomTypeId}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder={!row.roomTypeId ? "Select room type first" : "Select meal plan"}>
                {row.planName || undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
              {plans.map((p) => {
                const ok = checkAvailability(p, checkIn, checkOut);
                return (
                  <SelectItem key={p.roomRateId} value={p.roomRateId} disabled={!ok} className="whitespace-normal">
                    {p.planName}
                    {!ok ? " (unavailable)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Adults</Label>
            <Select value={String(row.adults)} onValueChange={(v) => onAdultsChange(Number(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: row.maxAdultOccupancy || 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Children</Label>
            <Select
              value={String(row.children ?? 0)}
              onValueChange={(v) => onChildrenChange(Number(v))}
              disabled={!row.roomTypeId}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="0" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: (row.maxChildOccupancy ?? 5) + 1 }, (_, i) => i).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Rate per night (₹)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="h-9"
              value={String(row.ratePerNight || 0)}
              onChange={(e) => onRateChange(Number(e.target.value) || 0)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={!row.roomTypeId}
              onClick={onResetPms}
              title="Reset to PMS rate"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              PMS
            </Button>
          </div>
          {rateHints && (rateHints.extraAdultRate !== undefined || rateHints.extraChildRate !== undefined) ? (
            <p className="text-[11px] text-muted-foreground">
              {rateHints.extraAdultRate !== undefined && `Extra adult: ₹${rateHints.extraAdultRate}`}
              {rateHints.extraAdultRate !== undefined && rateHints.extraChildRate !== undefined && " · "}
              {rateHints.extraChildRate !== undefined && `Extra child: ₹${rateHints.extraChildRate}`}
            </p>
          ) : null}
          {promoHint ? (
            <p className="text-xs text-green-600">
              {promoHint.promotionName ? `${promoHint.promotionName} — ` : ""}
              {promoHint.discountPercentage > 0 ? `${promoHint.discountPercentage}% off` : "Promo applied"}
            </p>
          ) : null}
        </div>

        {row.roomTypeId && hotelId ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Room number (optional)</Label>
            <PhysicalRoomSelectInline
              hotelId={hotelId}
              roomTypeId={row.roomTypeId}
              fromDate={checkIn}
              toDate={checkOut}
              value={row.physicalRoomId}
              onChange={onPhysicalRoomChange}
              rooms={physicalRooms}
              loading={physicalRoomsLoading}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
