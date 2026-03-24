import { Types } from "mongoose";
import { CommunicationModel, ICommunication } from "../models/communication";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import { EmailMessageModel, IEmailAddress } from "../models/emailMessage";
import { GuestModel } from "../models/guest";
import { LeadModel } from "../models/lead";
import { getIO } from "../websocket";

export interface ParsedInboundEmail {
  emailAccountId: Types.ObjectId | string;
  messageId: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  from?: IEmailAddress | string;
  to?: IEmailAddress[];
  receivedAt?: Date;
}

export interface MatchAndStoreResult {
  emailMessageId: Types.ObjectId;
  communicationId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  guestId?: Types.ObjectId;
  matched: boolean;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseFromAddress(from?: IEmailAddress | string): IEmailAddress | undefined {
  if (!from) return undefined;
  if (typeof from !== "string") {
    return from.email ? { name: from.name, email: normalizeEmail(from.email) } : undefined;
  }
  const normalized = normalizeEmail(from);
  return normalized ? { email: normalized } : undefined;
}

export async function matchAndStore(parsedEmail: ParsedInboundEmail): Promise<MatchAndStoreResult> {
  const fromAddress = parseFromAddress(parsedEmail.from);
  const senderEmail = fromAddress?.email;
  const threadId = parsedEmail.threadId || parsedEmail.inReplyTo || parsedEmail.messageId;
  const body = parsedEmail.bodyText || parsedEmail.bodyHtml || "";
  const subject = parsedEmail.subject || "(no subject)";
  const accountObjectId =
    typeof parsedEmail.emailAccountId === "string"
      ? new Types.ObjectId(parsedEmail.emailAccountId)
      : parsedEmail.emailAccountId;

  const emailDoc = await EmailMessageModel.findOneAndUpdate(
    { messageId: parsedEmail.messageId, emailAccountId: accountObjectId },
    {
      $set: {
        emailAccountId: accountObjectId,
        threadId,
        messageId: parsedEmail.messageId,
        inReplyTo: parsedEmail.inReplyTo,
        from: fromAddress,
        to: parsedEmail.to ?? [],
        subject,
        bodyText: parsedEmail.bodyText ?? "",
        bodyHtml: parsedEmail.bodyHtml ?? "",
        snippet: body.substring(0, 200),
        folder: "INBOX",
        isRead: false,
        isStarred: false,
        isDraft: false,
        isArchived: false,
        receivedAt: parsedEmail.receivedAt ?? new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  if (!senderEmail) {
    return { emailMessageId: emailDoc._id, matched: false };
  }

  const guest = await GuestModel.findOne({ email: { $regex: `^${senderEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).lean();
  if (!guest) {
    return { emailMessageId: emailDoc._id, matched: false };
  }

  const lead = await LeadModel.findOne({
    guestId: guest._id,
    status: { $nin: ["CONFIRMED", "LOST", "CLOSED_AUTO"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!lead) {
    return { emailMessageId: emailDoc._id, matched: false, guestId: guest._id as Types.ObjectId };
  }

  await EmailMessageModel.updateOne(
    { _id: emailDoc._id },
    { $set: { linkedLeadId: lead._id, linkedGuestId: guest._id, threadId } }
  ).exec();

  const communication = await CommunicationModel.create({
    leadId: lead._id,
    guestId: guest._id,
    channel: CommunicationChannel.EMAIL,
    direction: CommunicationDirection.INBOUND,
    summary: subject,
    messageContent: body,
    emailMessageId: emailDoc._id,
    metadata: {
      messageId: parsedEmail.messageId,
      threadId,
      from: senderEmail,
      subject,
    },
  });

  const io = getIO();
  if (io) {
    io.to(`lead:${String(lead._id)}`).emit("lead:email_received", communication.toObject());
  }

  return {
    emailMessageId: emailDoc._id,
    communicationId: communication._id as Types.ObjectId,
    leadId: lead._id as Types.ObjectId,
    guestId: guest._id as Types.ObjectId,
    matched: true,
  };
}
