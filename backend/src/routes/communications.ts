import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationDisposition,
} from "../models/common";
import { CommunicationModel } from "../models/communication";
import { LeadModel } from "../models/lead";
import { badRequest, notFound } from "../utils/httpError";
import { getCommunicationTimeline, sendEmailFromUser, sendSMS, sendWhatsApp } from "../services/communicationService";

export const communicationsRouter = Router();

communicationsRouter.use(requireAuth);

const communicationSchema = z.object({
  channel: z.nativeEnum(CommunicationChannel),
  direction: z.nativeEnum(CommunicationDirection),
  disposition: z.nativeEnum(CommunicationDisposition).optional(),
  summary: z.string().optional(),
});

communicationsRouter.post(
  "/:leadId/communications",
  async (req, res, next) => {
    try {
      const parsed = communicationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid communication payload");
      }

      const lead = await LeadModel.findById(req.params.leadId);
      if (!lead) {
        throw notFound("Lead not found");
      }

      const comm = await CommunicationModel.create({
        leadId: lead._id,
        guestId: lead.guestId,
        channel: parsed.data.channel,
        direction: parsed.data.direction,
        disposition: parsed.data.disposition,
        summary: parsed.data.summary,
        performedByUserId: req.user?.id,
      });

      res.status(201).json(comm);
    } catch (err) {
      next(err);
    }
  }
);

communicationsRouter.get(
  "/:leadId/communications",
  async (req, res, next) => {
    try {
      const comms = await CommunicationModel.find({
        leadId: req.params.leadId,
      })
        .sort({ createdAt: -1 })
        .lean();
      res.json(comms);
    } catch (err) {
      next(err);
    }
  }
);

// Get unified communication timeline (includes emails, SMS, WhatsApp, calls)
communicationsRouter.get(
  "/:leadId/communication-timeline",
  async (req, res, next) => {
    try {
      const timeline = await getCommunicationTimeline(req.params.leadId);
      res.json(timeline);
    } catch (err) {
      next(err);
    }
  }
);

// Send email from user's account
const sendEmailSchema = z.object({
  to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })),
  cc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
  bcc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
  subject: z.string(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
});

communicationsRouter.post(
  "/:leadId/send-email",
  async (req, res, next) => {
    try {
      const parsed = sendEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid email payload");
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        throw badRequest("User not authenticated");
      }

      const result = await sendEmailFromUser(userId, req.params.leadId, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Send SMS (placeholder)
const sendSMSSchema = z.object({
  phone: z.string(),
  message: z.string(),
});

communicationsRouter.post(
  "/:leadId/send-sms",
  async (req, res, next) => {
    try {
      const parsed = sendSMSSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid SMS payload");
      }

      const communication = await sendSMS(req.params.leadId, parsed.data);
      res.status(201).json(communication);
    } catch (err) {
      next(err);
    }
  }
);

// Send WhatsApp (placeholder)
const sendWhatsAppSchema = z.object({
  phone: z.string(),
  message: z.string(),
});

communicationsRouter.post(
  "/:leadId/send-whatsapp",
  async (req, res, next) => {
    try {
      const parsed = sendWhatsAppSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid WhatsApp payload");
      }

      const communication = await sendWhatsApp(req.params.leadId, parsed.data);
      res.status(201).json(communication);
    } catch (err) {
      next(err);
    }
  }
);



