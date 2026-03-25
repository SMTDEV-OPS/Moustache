import React, { useEffect, useState } from "react";
import { getRoomCatalogue, syncRoomCatalogue, getLiveAvailability, RoomCatalogue, resolveRoomTypeDisplayName } from "../../services/pms";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

/** Kept broad for callers that still store rate/revenue on the lead; this block is availability-only. */
interface HotelBookingSectionProps {
  propertyId: string;
  value: {
    checkIn?: string;
    checkOut?: string;
    roomTypeId?: string;
    roomTypeName?: string;
    ratePlanId?: string;
    ratePlanName?: string;
    adults?: number;
    children?: number;
    estimatedRate?: number;
    estimatedRoomNights?: number;
    estimatedRevenue?: number;
  };
  onChange: (patch: Partial<HotelBookingSectionProps["value"]>) => void;
  readOnly?: boolean;
}

export const HotelBookingSection: React.FC<HotelBookingSectionProps> = ({
  propertyId,
  value,
  onChange,
  readOnly = false,
}) => {
  const [catalogue, setCatalogue] = useState<RoomCatalogue | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<"IDLE" | "LOADING" | "AVAILABLE" | "UNAVAILABLE">("IDLE");
  const [availableRooms, setAvailableRooms] = useState<number | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      getRoomCatalogue(propertyId).then(setCatalogue).catch(console.error);
    } else {
      setCatalogue(null);
    }
  }, [propertyId]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const newCat = await syncRoomCatalogue(propertyId);
      setCatalogue(newCat);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const checkAvailability = async () => {
    if (!value.checkIn || !value.checkOut) return;
    setAvailabilityStatus("LOADING");
    setAvailabilityError(null);
    try {
      const res = await getLiveAvailability(propertyId, value.checkIn, value.checkOut);
      if (res && "error" in res && res.error) {
        setAvailabilityStatus("UNAVAILABLE");
        setAvailabilityError(String(res.error));
        return;
      }

      const inventory = res as { roomTypeId: string; availableCount?: number }[];
      if (value.roomTypeId) {
        const room = inventory.find((r) => r.roomTypeId === value.roomTypeId);
        if (room && (room.availableCount ?? 0) > 0) {
          setAvailableRooms(room.availableCount ?? null);
          setAvailabilityStatus("AVAILABLE");
        } else {
          setAvailableRooms(0);
          setAvailabilityStatus("UNAVAILABLE");
        }
      } else {
        setAvailabilityStatus("IDLE");
      }
    } catch (err) {
      setAvailabilityStatus("UNAVAILABLE");
      setAvailabilityError("PMS unavailable");
    }
  };

  if (!propertyId) {
    return (
      <div className="p-4 border rounded-md text-sm text-gray-500 bg-gray-50 uppercase tracking-wide">
        Select a property first to check availability
      </div>
    );
  }

  return (
    <div className="border rounded-md shadow-sm mb-4 bg-white">
      <div className="flex flex-wrap justify-between items-center gap-2 p-4 border-b bg-gray-50 rounded-t-md">
        <div>
          <h3 className="font-semibold text-gray-800">PMS availability check</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Live inventory for the selected property (dates + room type).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {catalogue?.needsSync && !readOnly && (
            <span className="text-xs text-amber-700 font-medium">Catalogue may be stale — sync recommended.</span>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center text-sm px-2 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
              Sync catalogue
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {(!catalogue?.roomTypes?.length) ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>No room types loaded. Sync pulls names from your PMS (eZee RoomInfo).</span>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                Sync now
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in date</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={value.checkIn?.split("T")[0] || ""}
                  onChange={(e) => onChange({ checkIn: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out date</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={value.checkOut?.split("T")[0] || ""}
                  onChange={(e) => onChange({ checkOut: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room type</label>
              <select
                className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={value.roomTypeId || ""}
                onChange={(e) => {
                  const roomTypeId = e.target.value;
                  const roomTypeName = catalogue.roomTypes.find((r) => r.roomTypeId === roomTypeId)?.roomTypeName || "";
                  onChange({ roomTypeId, roomTypeName });
                  setAvailabilityStatus("IDLE");
                }}
                disabled={readOnly}
              >
                <option value="">Select room type…</option>
                {value.roomTypeId &&
                  !catalogue.roomTypes.some((r) => r.roomTypeId === value.roomTypeId) && (
                    <option key={`orphan-${value.roomTypeId}`} value={value.roomTypeId}>
                      {resolveRoomTypeDisplayName(value.roomTypeId, value.roomTypeName, catalogue.roomTypes)}
                    </option>
                  )}
                {catalogue.roomTypes.map((rt) => (
                  <option key={rt.roomTypeId} value={rt.roomTypeId}>
                    {resolveRoomTypeDisplayName(rt.roomTypeId, rt.roomTypeName, catalogue.roomTypes)}
                  </option>
                ))}
              </select>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={checkAvailability}
                  disabled={!value.checkIn || !value.checkOut || !value.roomTypeId || availabilityStatus === "LOADING"}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {availabilityStatus === "LOADING" ? "Checking…" : "Check availability"}
                </button>

                {availabilityStatus === "AVAILABLE" && (
                  <span className="flex items-center text-sm text-green-600 font-medium">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Available ({availableRooms} rooms)
                  </span>
                )}
                {availabilityStatus === "UNAVAILABLE" && (
                  <span className="flex items-center text-sm text-red-600 font-medium">
                    <XCircle className="w-4 h-4 mr-1" />
                    {availabilityError || "Unavailable"}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
