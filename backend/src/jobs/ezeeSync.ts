import { PropertyModel } from "../models/property";
import { ReservationModel } from "../models/reservation";
import { GuestModel } from "../models/guest";
import { logger } from "../config/logger";
import { EzeePMSService } from "../services/pms/adapters/EzeePMSService";

function toYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapEzeeStatusToCrm(statusRaw: string): "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" {
  const s = statusRaw.toLowerCase();
  if (s.includes("cancel") || s.includes("void")) return "CANCELLED";
  if (s.includes("arrived") || s.includes("checked in") || s.includes("checkin")) return "CHECKED_IN";
  if (s.includes("checked out") || s.includes("checkout")) return "CHECKED_OUT";
  return "CONFIRMED";
}

export async function syncEzeeReservations(propertyId?: string): Promise<{
  synced: number;
  created: number;
  updated: number;
  unchanged: number;
}> {
  const propertyQuery: Record<string, any> = {
    pmsProvider: "EZEE",
    "pmsConfig.hotelCode": { $exists: true, $ne: "" },
    "pmsConfig.authCode": { $exists: true, $ne: "" },
  };
  if (propertyId) propertyQuery._id = propertyId;

  const properties = await PropertyModel.find(propertyQuery).lean();

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 30);

  const fromDate = toYmd(from);
  const toDate = toYmd(to);

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalSynced = 0;

  for (const property of properties) {
    const hotelCode = property.pmsConfig?.hotelCode;
    const authCode = property.pmsConfig?.authCode;
    if (!hotelCode || !authCode) continue;

    let reservations: any[];
    try {
      const pms = new EzeePMSService({ hotelCode, authCode });
      reservations = await pms.getReservations(hotelCode, authCode, fromDate, toDate);
    } catch (err: any) {
      const errCode = err?.ErrorCode ?? err?.errorCode;
      const errMsg = err?.ErrorMessage ?? err?.message ?? "";
      if (
        errCode === 202 ||
        String(errCode) === "202" ||
        (typeof errMsg === "string" && errMsg.toLowerCase().includes("not active"))
      ) {
        logger.warn(`Property ${property.name}: Ezee hotel code not active — skipping`);
      } else {
        logger.error(`Property ${property.name}: Ezee sync error`, { err: err instanceof Error ? err.message : err });
      }
      continue;
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const r of reservations) {
      const status = mapEzeeStatusToCrm(r.status);

      const existing = await ReservationModel.findOne({
        propertyId: property._id,
        pmsReservationId: r.reservationId,
      });

      if (existing) {
        if (existing.status === status) {
          unchanged++;
          continue;
        }

        existing.amendmentHistory = existing.amendmentHistory ?? [];
        existing.amendmentHistory.push({
          field: "status",
          oldValue: existing.status,
          newValue: status,
          changedAt: new Date(),
        });
        existing.status = status;
        await existing.save();
        updated++;
        continue;
      }

      let guestId: any = undefined;
      const guestName = r.guestName?.trim() || "Guest";
      const guestPhone = r.guestPhone?.trim();

      if (guestPhone) {
        const found = await GuestModel.findOne({
          phone: guestPhone,
        }).lean();
        if (found) guestId = found._id;
      }

      if (!guestId) {
        const foundByName = await GuestModel.findOne({
          name: { $regex: new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
          ...(guestPhone ? { phone: guestPhone } : {}),
        }).lean();
        if (foundByName) guestId = foundByName._id;
      }

      if (!guestId) {
        const createdGuest = await GuestModel.create({
          name: guestName,
          phone: guestPhone,
          tags: [],
          isSunshineMember: false,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          totalLeadsCount: 0,
          totalReservationsCount: 0,
        });
        guestId = createdGuest._id;
      }

      await ReservationModel.create({
        guestId,
        propertyId: property._id,
        pmsReservationId: r.reservationId,
        checkInDate: new Date(r.checkIn),
        checkOutDate: new Date(r.checkOut),
        totalAmount: r.totalAmount,
        status,
        roomsBooked: r.rooms?.length ? r.rooms.length : undefined,
        ratePlan: r.rooms?.[0]?.ratePlanName || r.rooms?.[0]?.ratePlanCode,
      });

      created++;
    }

    logger.info(`Property ${property.name}: ${created} new, ${updated} updated, ${unchanged} unchanged`, {
      propertyId: property._id.toString(),
    });

    await PropertyModel.findByIdAndUpdate(property._id, { $set: { lastSyncedAt: new Date() } });

    totalCreated += created;
    totalUpdated += updated;
    totalUnchanged += unchanged;
    totalSynced += created + updated + unchanged;

    await sleep(1000);
  }

  logger.info("Ezee reservation sync completed", {
    propertiesCount: properties.length,
    totalCreated,
    totalUpdated,
    totalUnchanged,
    totalSynced,
  });

  return {
    synced: totalSynced,
    created: totalCreated,
    updated: totalUpdated,
    unchanged: totalUnchanged,
  };
}

