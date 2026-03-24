import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { LeadModel } from "../models/lead";
import { EmailAccountModel } from "../models/emailAccount";
import { assertLeadAccess } from "../utils/leadAccess";
import { sendEmail } from "../services/emailService";
import { CommunicationModel } from "../models/communication";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import { getIO } from "../websocket";

export const leadEmailRouter = Router();

leadEmailRouter.use(requireAuth);

const sendLeadEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  threadId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  references: z.string().optional(),
});

leadEmailRouter.post("/:id/email/send", async (req, res, next) => {
  try {
    const parsed = sendLeadEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid email payload");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    const account = await EmailAccountModel.findOne({
      userId: req.user.id,
      isActive: true,
    })
      .sort({ isPrimary: -1, createdAt: -1 })
      .exec();

    if (!account) {
      return res.status(409).json({
        code: "EMAIL_ACCOUNT_NOT_CONNECTED",
        message: "Connect your Gmail or Outlook to send emails from this lead",
      });
    }

    const sentEmail = await sendEmail(account._id.toString(), {
      to: [{ email: parsed.data.to }],
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      bodyText: parsed.data.bodyText,
      inReplyTo: parsed.data.replyToMessageId,
      references: parsed.data.references,
      threadId: parsed.data.threadId,
    });

    sentEmail.linkedLeadId = lead._id as Types.ObjectId;
    if (lead.guestId) {
      sentEmail.linkedGuestId = lead.guestId as Types.ObjectId;
    }
    await sentEmail.save();

    let communication;
    try {
      communication = await CommunicationModel.create({
      leadId: lead._id,
      guestId: lead.guestId,
      channel: CommunicationChannel.EMAIL,
      direction: CommunicationDirection.OUTBOUND,
      summary: parsed.data.subject,
      messageContent: parsed.data.bodyHtml,
      performedByUserId: new Types.ObjectId(req.user.id),
      emailMessageId: sentEmail._id,
      metadata: {
        messageId: sentEmail.messageId,
        threadId: parsed.data.threadId || sentEmail.threadId,
        from: account.email,
        to: parsed.data.to,
        subject: parsed.data.subject,
      },
      });
    } catch (createError) {
      const error = createError instanceof Error ? createError : new Error(String(createError));
      console.error("Failed to create outbound email communication", {
        leadId: lead._id.toString(),
        emailMessageId: sentEmail._id.toString(),
        message: error.message,
      });
      throw error;
    }

    const io = getIO();
    if (io) {
      io.to(`lead:${lead._id.toString()}`).emit("lead:email_sent", communication.toObject());
    }

    res.status(201).json({
      success: true,
      communication,
    });
  } catch (err) {
    next(err);
  }
});

leadEmailRouter.get("/:id/email/thread/:threadId", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    const threadItems = await CommunicationModel.find({
      leadId: lead._id,
      channel: CommunicationChannel.EMAIL,
      "metadata.threadId": req.params.threadId,
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(threadItems);
  } catch (err) {
    next(err);
  }
});
