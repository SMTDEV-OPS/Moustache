import { Router } from "express";
import { z } from "zod";
import { GuestModel } from "../models/guest";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { searchGuestByPhone, searchGuestByEmail } from "../services/guestSearchService";

export const guestsRouter = Router();

guestsRouter.use(requireAuth);

guestsRouter.get("/search", async (req, res, next) => {
  try {
    const { phone, email, name } = req.query;
    
    // Use enhanced search service for phone/email
    if (phone) {
      const result = await searchGuestByPhone(String(phone));
      return res.json(result);
    }
    
    if (email) {
      const result = await searchGuestByEmail(String(email));
      return res.json(result);
    }
    
    // Fallback to name search
    const filter: Record<string, unknown> = {};
    if (name) filter.name = { $regex: String(name), $options: "i" };

    const guests = await GuestModel.find(filter).limit(20).lean();
    res.json(guests);
  } catch (err) {
    next(err);
  }
});

// Enhanced search by phone for call page
guestsRouter.get("/search-by-phone/:phone", async (req, res, next) => {
  try {
    const { phone } = req.params;
    const result = await searchGuestByPhone(phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

guestsRouter.get("/:id", async (req, res, next) => {
  try {
    const guest = await GuestModel.findById(req.params.id).lean();
    if (!guest) {
      throw notFound("Guest not found");
    }
    res.json(guest);
  } catch (err) {
    next(err);
  }
});

const updateGuestSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isSunshineMember: z.boolean().optional(),
  sunshineTier: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

guestsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid guest update payload");
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (typeof updateData.email === "string") {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const guest = await GuestModel.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!guest) {
      throw notFound("Guest not found");
    }

    res.json(guest);
  } catch (err) {
    next(err);
  }
});



