import { RoomRateFields } from "@/components/leads/RoomRateFields";
import { useEzeeRatesForProperty, type RoomRateFieldsValue } from "@/services/ezeeRates";

type Props = {
  propertyId: string;
  fromDate: string;
  toDate: string;
  roomTypeId?: string;
  roomTypeName?: string;
  value: RoomRateFieldsValue;
  onChange: (patch: Partial<RoomRateFieldsValue>) => void;
  disabled?: boolean;
  compact?: boolean;
};

/** Room rate fields with built-in eZee room-info + rates fetch. */
export function RoomRateFieldsWithFetch({
  propertyId,
  fromDate,
  toDate,
  roomTypeId,
  roomTypeName,
  value,
  onChange,
  disabled,
  compact,
}: Props) {
  const { mapping, rateMap, loading } = useEzeeRatesForProperty(
    propertyId || undefined,
    fromDate || undefined,
    toDate || undefined
  );

  return (
    <RoomRateFields
      propertyId={propertyId}
      fromDate={fromDate}
      toDate={toDate}
      roomTypeId={roomTypeId}
      roomTypeName={roomTypeName}
      value={value}
      onChange={onChange}
      mapping={mapping}
      rateMap={rateMap}
      ratesLoading={loading}
      disabled={disabled}
      compact={compact}
    />
  );
}
