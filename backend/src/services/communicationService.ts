import { Types } from "mongoose";
import { CommunicationModel, ICommunication } from "../models/communication";
import { EmailMessageModel } from "../models/emailMessage";
import { LeadModel } from "../models/lead";
import { sendEmail, getPrimaryEmailAccount } from "./emailService";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import { logger } from "../config/logger";

export interface SendEmailOptions {
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  replyToMessageId?: string;
}

export interface SendSMSOptions {
  phone: string;
  message: string;
}

export interface SendWhatsAppOptions {
  phone: string;
  message: string;
}

/**
 * Send email from user's primary email account and log as communication
 */
export async function sendEmailFromUser(
  userId: string,
  leadId: string,
  options: SendEmailOptions
): Promise<{ emailMessage: any; communication: ICommunication }> {
  const primaryAccount = await getPrimaryEmailAccount(userId);
  if (!primaryAccount) {
    throw new Error("No primary email account found for user");
  }

  // Get lead to find guest email
  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Send email
  const emailMessage = await sendEmail(primaryAccount._id.toString(), {
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    bodyText: options.bodyText,
    bodyHtml: options.bodyHtml,
  });

  // Always link email to the specific lead we're sending from
  // This ensures emails sent from a lead detail page are properly linked
  emailMessage.linkedLeadId = new Types.ObjectId(leadId);
  if (lead.guestId) {
    emailMessage.linkedGuestId = lead.guestId;
  }
  await emailMessage.save();

  // Create communication record
  const communication = await CommunicationModel.create({
    leadId: new Types.ObjectId(leadId),
    guestId: lead.guestId,
    channel: CommunicationChannel.EMAIL,
    direction: CommunicationDirection.OUTBOUND,
    summary: options.subject,
    performedByUserId: new Types.ObjectId(userId),
    emailMessageId: emailMessage._id,
    messageContent: options.bodyText || options.bodyHtml,
  });

  logger.info("Email sent from user account", {
    userId,
    leadId,
    emailMessageId: emailMessage._id,
    to: options.to.map((t) => t.email),
  });

  return { emailMessage, communication };
}

/**
 * Placeholder for SMS sending - to be implemented with actual SMS provider
 */
export async function sendSMS(
  leadId: string,
  options: SendSMSOptions
): Promise<ICommunication> {
  // TODO: Implement actual SMS provider integration (Twilio, Msg91, etc.)
  // This is a placeholder that creates a communication record
  
  logger.info("SMS send called (placeholder)", {
    leadId,
    phone: options.phone,
  });

  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Example implementation structure:
  // const smsProvider = getSMSProvider(); // Get configured provider
  // const result = await smsProvider.send({
  //   to: options.phone,
  //   message: options.message,
  // });
  
  // Create communication record
  const communication = await CommunicationModel.create({
    leadId: new Types.ObjectId(leadId),
    guestId: lead.guestId,
    channel: CommunicationChannel.SMS,
    direction: CommunicationDirection.OUTBOUND,
    summary: `SMS sent to ${options.phone}`,
    messageContent: options.message,
    externalMessageId: `sms-placeholder-${Date.now()}`, // Replace with actual provider message ID
  });

  return communication;
}

/**
 * Placeholder for WhatsApp sending - to be implemented with actual WhatsApp provider
 */
export async function sendWhatsApp(
  leadId: string,
  options: SendWhatsAppOptions
): Promise<ICommunication> {
  // TODO: Implement actual WhatsApp provider integration (Twilio, Meta, etc.)
  // This is a placeholder that creates a communication record
  
  logger.info("WhatsApp send called (placeholder)", {
    leadId,
    phone: options.phone,
  });

  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Example implementation structure:
  // const whatsappProvider = getWhatsAppProvider(); // Get configured provider
  // const result = await whatsappProvider.send({
  //   to: options.phone,
  //   message: options.message,
  // });
  
  // Create communication record
  const communication = await CommunicationModel.create({
    leadId: new Types.ObjectId(leadId),
    guestId: lead.guestId,
    channel: CommunicationChannel.WHATSAPP,
    direction: CommunicationDirection.OUTBOUND,
    summary: `WhatsApp sent to ${options.phone}`,
    messageContent: options.message,
    externalMessageId: `whatsapp-placeholder-${Date.now()}`, // Replace with actual provider message ID
  });

  return communication;
}

/**
 * Link inbound email to lead and create communication record
 */
export async function linkInboundEmail(
  emailMessageId: string,
  leadId: string
): Promise<ICommunication> {
  const emailMessage = await EmailMessageModel.findById(emailMessageId);
  if (!emailMessage) {
    throw new Error("Email message not found");
  }

  // Link email to lead
  emailMessage.linkedLeadId = new Types.ObjectId(leadId);
  await emailMessage.save();

  // Get lead to find guest
  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Create communication record
  const communication = await CommunicationModel.create({
    leadId: new Types.ObjectId(leadId),
    guestId: lead.guestId,
    channel: CommunicationChannel.EMAIL,
    direction: CommunicationDirection.INBOUND,
    summary: emailMessage.subject,
    emailMessageId: emailMessage._id,
    messageContent: emailMessage.bodyText || emailMessage.bodyHtml,
  });

  return communication;
}

/**
 * Get unified communication timeline for a lead
 * Includes all communications: calls, emails, SMS, WhatsApp, and email messages
 */
export async function getCommunicationTimeline(leadId: string): Promise<any[]> {
  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Get all communication records
  const communications = await CommunicationModel.find({
    leadId: new Types.ObjectId(leadId),
  })
    .sort({ createdAt: -1 })
    .lean();

  // Get all email messages linked to this lead
  const emailMessages = await EmailMessageModel.find({
    linkedLeadId: new Types.ObjectId(leadId),
  })
    .sort({ receivedAt: -1, sentAt: -1 })
    .lean();

  // Combine and format timeline items
  const timeline: any[] = [];

  // Add communication records
  for (const comm of communications) {
    timeline.push({
      id: comm._id,
      type: "communication",
      channel: comm.channel,
      direction: comm.direction,
      summary: comm.summary,
      messageContent: comm.messageContent,
      disposition: comm.disposition,
      performedByUserId: comm.performedByUserId,
      createdAt: comm.createdAt,
      emailMessageId: comm.emailMessageId,
      metadata: (comm as any).metadata,
      threadId: (comm as any).metadata?.threadId,
    });
  }

  // Add email messages (avoid duplicates if already in communications)
  const emailMessageIdsInComm = new Set(
    communications
      .filter((c) => c.emailMessageId)
      .map((c) => c.emailMessageId?.toString())
  );

  for (const email of emailMessages) {
    if (!emailMessageIdsInComm.has(email._id.toString())) {
      timeline.push({
        id: email._id,
        type: "email",
        channel: CommunicationChannel.EMAIL,
        direction: email.folder === "SENT" 
          ? CommunicationDirection.OUTBOUND 
          : CommunicationDirection.INBOUND,
        summary: email.subject,
        messageContent: email.bodyText || email.bodyHtml,
        from: email.from,
        to: email.to,
        cc: email.cc,
        receivedAt: email.receivedAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
        inReplyTo: email.inReplyTo,
        threadId: email.threadId,
      });
    }
  }

  // Sort by date (newest first)
  timeline.sort((a, b) => {
    const dateA = a.createdAt || a.receivedAt || a.sentAt || new Date(0);
    const dateB = b.createdAt || b.receivedAt || b.sentAt || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  return timeline;
}

