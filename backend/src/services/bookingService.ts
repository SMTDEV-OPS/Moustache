import { Types } from "mongoose";
import { LeadModel } from "../models/lead";
import { ReservationModel } from "../models/reservation";
import { PropertyModel } from "../models/property";
import { GuestModel } from "../models/guest"; // Assuming GuestModel exists
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { PMSFactory } from "./pms/PMSFactory";
import { BookingRequest, BookingResponse } from "./pms/IPMSService";
import { badRequest, notFound } from "../utils/httpError"; // Assuming these exist
import { LeadStatus, LeadStage, PMSProvider } from "../models/common";

export class BookingService {
    /**
     * Create a booking for a specific lead.
     * 1. Validate Lead & Property
     * 2. Call PMS (if configured)
     * 3. Create Reservation record
     * 4. Update Lead status
     */
    static async createBookingFromLead(
        leadId: string,
        bookingDetails: {
            roomTypeId: string;
            ratePlanId: string;
            checkInDate: string;
            checkOutDate: string;
            occupancy: {
                adults: number;
                children: number;
            };
            price: number;
            guestDetails?: {
                firstName: string;
                lastName: string;
                email?: string;
                phone?: string;
                address?: string; // Added address
                city?: string;    // Added city
                country?: string; // Added country
            };
            comments?: string;
        }
    ): Promise<{ reservation: any; pmsResponse?: BookingResponse }> {
        const lead = await LeadModel.findById(leadId);
        if (!lead) {
            throw notFound("Lead not found");
        }

        if (!lead.propertyId) {
            throw badRequest("Lead is not associated with a property");
        }

        const property = await PropertyModel.findById(lead.propertyId);
        if (!property) {
            throw notFound("Property not found");
        }

        // 1. Prepare Guest Details
        let guestId = lead.guestId;
        // If guest details provided in request, update or create guest?
        // For simplicity, we use what's passed or fallback to lead's contact
        const guestNameParts = (bookingDetails.guestDetails?.firstName || lead.contactDetails?.name || "Guest").split(" ");
        const firstName = bookingDetails.guestDetails?.firstName || guestNameParts[0];
        const lastName = bookingDetails.guestDetails?.lastName || guestNameParts.slice(1).join(" ") || "Unknown";
        const email = bookingDetails.guestDetails?.email || lead.contactDetails?.email;
        const phone = bookingDetails.guestDetails?.phone || lead.contactDetails?.phone;

        // 2. Prepare PMS Request
        const pmsService = await PMSFactory.getPMS(property._id.toString());
        let pmsResponse: BookingResponse | undefined;

        if (pmsService) {
            const pmsRequest: BookingRequest = {
                checkInDate: bookingDetails.checkInDate,
                checkOutDate: bookingDetails.checkOutDate,
                guest: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    address: bookingDetails.guestDetails?.address,
                    city: bookingDetails.guestDetails?.city,
                    country: bookingDetails.guestDetails?.country,
                },
                rooms: [
                    {
                        roomTypeId: bookingDetails.roomTypeId,
                        ratePlanId: bookingDetails.ratePlanId,
                        occupancy: bookingDetails.occupancy,
                        price: bookingDetails.price,
                    },
                ],
                totalAmount: bookingDetails.price, // Assuming 1 room for MVP
                comments: bookingDetails.comments || lead.notes,
                leadId: lead._id.toString(),
            };

            try {
                pmsResponse = await pmsService.createBooking(pmsRequest);
                if (pmsResponse.status === "FAILED") {
                    throw new Error(`PMS Booking Failed: ${pmsResponse.message}`);
                }
            } catch (err) {
                console.error("PMS Booking Error", err);
                throw new Error(`Failed to create booking in PMS: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
        }

        // 3. Create Reservation Record
        const reservation = await ReservationModel.create({
            leadId: lead._id,
            guestId: guestId, // Might need to ensure guest exists if strictly required
            propertyId: property._id,
            pmsReservationId: pmsResponse?.pmsBookingId,
            checkInDate: new Date(bookingDetails.checkInDate),
            checkOutDate: new Date(bookingDetails.checkOutDate),
            roomsBooked: 1,
            ratePlan: bookingDetails.ratePlanId, // Storing ID for now
            totalAmount: bookingDetails.price,
            status: "CONFIRMED",
        });

        // 4. Update Lead
        lead.status = LeadStatus.CONFIRMED; // Or WON if using SOP?

        // Find default Booked stage
        const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
        if (pipeline) {
            const wonStage = await PipelineStageModel.findOne({
                pipelineId: pipeline._id,
                isTerminal: true,
                terminalType: "WON"
            }).exec();
            if (wonStage) {
                lead.stageId = wonStage._id as Types.ObjectId;
            }
        }

        lead.pmsReservationId = pmsResponse?.pmsBookingId;
        lead.closedAt = new Date();
        // lead.closedReason = ClosedReason.BOOKED; // If enum existed
        await lead.save();

        return { reservation, pmsResponse };
    }
}
