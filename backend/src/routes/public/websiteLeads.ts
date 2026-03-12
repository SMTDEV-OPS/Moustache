import { Router } from "express";
import { z } from "zod";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType } from "../../models/common";
import { badRequest } from "../../utils/httpError";
import { logger } from "../../config/logger";

export const publicWebsiteLeadsRouter = Router();

const websiteLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  checkInDate: z.string().datetime().optional(),
  checkOutDate: z.string().datetime().optional(),
  roomsRequested: z.number().int().positive().optional(),
  guests: z
    .object({
      adults: z.number().int().positive().optional(),
      children: z.number().int().nonnegative().optional(),
    })
    .optional(),
  specialRequests: z.string().optional(),
  propertyId: z.string().optional(),
  occasion: z.string().optional(),
  leadType: z.nativeEnum(LeadType).optional(),
});

/**
 * Public endpoint for website form submissions
 * No authentication required - this is for public website forms
 */
publicWebsiteLeadsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = websiteLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        `Invalid form data: ${parsed.error.errors.map((e) => e.message).join(", ")}`
      );
    }

    const data = parsed.data;

    // Create lead with BRAND_WEBSITE source
    const lead = await createLead({
      guestContact: {
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
      source: LeadSource.BRAND_WEBSITE,
      leadType: data.leadType || LeadType.STAY,
      hotels: data.checkInDate || data.checkOutDate ? [{
        checkInDate: data.checkInDate ? new Date(data.checkInDate) : undefined,
        checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : undefined,
        numberOfGuests: data.guests ? `${data.guests.adults || 0} Adults` : undefined,
      }] : undefined,
      specialRequests: data.specialRequests,
      propertyId: data.propertyId,
      customData: data.occasion ? { occasion: data.occasion } : undefined,
      assignmentMode: "auto",
      // No createdByUserId for public submissions
    });

    logger.info("Website lead created", {
      leadId: lead._id.toString(),
      leadNumber: lead.leadNumber,
      guestEmail: data.email,
    });

    res.status(201).json({
      success: true,
      leadNumber: lead.leadNumber,
      message: "Thank you for your inquiry. We'll contact you soon.",
    });
  } catch (err) {
    logger.error("Failed to create website lead", {
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
});

