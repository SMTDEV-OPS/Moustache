import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import {
  buildRateFieldsFromPms,
  mealPlanOptionsForRoomType,
  type EzeeRatesLookupMap,
  type RoomRateFieldsValue,
} from "@/services/ezeeRates";
import type { EzeeSeparateSourceMapping } from "@/services/pms";

export type { RoomRateFieldsValue };

type Props = {
  propertyId: string;
  fromDate: string;
  toDate: string;
  roomTypeId?: string;
  roomTypeName?: string;
  value: RoomRateFieldsValue;
  onChange: (patch: Partial<RoomRateFieldsValue>) => void;
  mapping?: EzeeSeparateSourceMapping;
  rateMap?: EzeeRatesLookupMap;
  ratesLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function RoomRateFields({
  propertyId,
  fromDate,
  toDate,
  roomTypeId,
  roomTypeName,
  value,
  onChange,
  mapping,
  rateMap,
  ratesLoading,
  disabled,
  compact,
}: Props) {
  const mealPlans = mealPlanOptionsForRoomType(mapping, roomTypeId, roomTypeName);
  const prevRoomRef = useRef<string>("");

  useEffect(() => {
    const key = `${propertyId}::${roomTypeId}::${fromDate}::${toDate}`;
    if (!propertyId || !roomTypeId || !fromDate || !toDate || !mapping || !rateMap) return;
    if (prevRoomRef.current === key && value.mealPlanId) return;
    prevRoomRef.current = key;

    const defaultMeal = value.mealPlanId || mealPlans[0]?.id;
    if (!defaultMeal) return;
    if (value.rateSource === "manual" && value.mealPlanId) return;

    const patch = buildRateFieldsFromPms(mapping, rateMap, roomTypeId, roomTypeName, defaultMeal);
    onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, roomTypeId, roomTypeName, fromDate, toDate, mapping, rateMap]);

  const handleMealPlanChange = (mealPlanId: string) => {
    if (!mapping || !rateMap) {
      onChange({ mealPlanId, rateSource: "manual" });
      return;
    }
    onChange(buildRateFieldsFromPms(mapping, rateMap, roomTypeId, roomTypeName, mealPlanId));
  };

  const handleResetToPms = () => {
    if (!mapping || !rateMap || !value.mealPlanId) return;
    onChange(buildRateFieldsFromPms(mapping, rateMap, roomTypeId, roomTypeName, value.mealPlanId));
  };

  if (!roomTypeId) return null;

  return (
    <div className={`grid gap-2 ${compact ? "col-span-12 grid-cols-2 md:grid-cols-4" : "col-span-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
      <div className="space-y-1">
        <Label className="text-xs">Meal plan</Label>
        <Select
          value={value.mealPlanId || ""}
          onValueChange={handleMealPlanChange}
          disabled={disabled || ratesLoading || mealPlans.length === 0}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={ratesLoading ? "Loading…" : mealPlans.length ? "Select plan" : "Sync PMS first"} />
          </SelectTrigger>
          <SelectContent>
            {mealPlans.map((mp) => (
              <SelectItem key={mp.id} value={mp.id}>
                {mp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <Label className="text-xs">Rate / night (₹)</Label>
          {value.rateSource === "manual" ? (
            <Badge variant="outline" className="text-[10px] h-5">
              Manual
            </Badge>
          ) : value.estimatedRate !== undefined ? (
            <Badge variant="secondary" className="text-[10px] h-5">
              PMS
            </Badge>
          ) : null}
        </div>
        <Input
          type="number"
          min={0}
          step={0.01}
          className="h-9"
          disabled={disabled}
          value={value.estimatedRate ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? undefined : Number(e.target.value);
            onChange({ estimatedRate: n, rateSource: "manual" });
          }}
          placeholder={ratesLoading ? "…" : "Enter rate"}
        />
      </div>

      {(value.extraAdultRate !== undefined || value.extraChildRate !== undefined) && (
        <div className="space-y-1 text-xs text-muted-foreground self-end pb-2">
          {value.extraAdultRate !== undefined && <div>Extra adult: ₹{value.extraAdultRate}</div>}
          {value.extraChildRate !== undefined && <div>Extra child: ₹{value.extraChildRate}</div>}
        </div>
      )}

      <div className="flex items-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-xs"
          disabled={disabled || !mapping || !value.mealPlanId}
          onClick={handleResetToPms}
          title="Reset to PMS rate"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Reset PMS
        </Button>
      </div>
    </div>
  );
}
