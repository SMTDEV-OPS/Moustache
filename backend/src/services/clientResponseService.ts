import { Types } from "mongoose";
import { LeadModel } from "../models/lead";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { EmailMessageModel, IEmailMessage } from "../models/emailMessage";
import { QuotationModel } from "../models/quotation";
import { createNotification, NotificationType } from "./notificationService";
import { logger } from "../config/logger";

/**
 * Detect if an email is a client response (reply to a sent email or quotation)
 */
export async function handleClientResponse(email: IEmailMessage): Promise<void> {
  try {
    logger.info("[handleClientResponse] Fired for email", { id: email._id?.toString(), folder: email.folder, linked: email.linkedLeadId?.toString() });

    // Only process inbound emails (not in SENT folder) that are linked to a lead
    if (email.folder === "SENT" || !email.linkedLeadId) {
      logger.info("[handleClientResponse] Skipping: Either SENT folder or missing linkedLeadId");
      return;
    }

    const lead = await LeadModel.findById(email.linkedLeadId).lean();
    if (!lead) {
      logger.warn("Email linked to non-existent lead", {
        emailId: email._id.toString(),
        leadId: email.linkedLeadId.toString(),
      });
      return;
    }

    logger.info(`[handleClientResponse] Found Lead ${lead.leadNumber}`);

    // Check if this is a reply to a sent email (has inReplyTo)
    const isReply = !!email.inReplyTo;

    // Check if this is a response to a quotation by checking subject
    const isQuotationResponse = email.subject?.toLowerCase().includes("quotation") ||
      email.subject?.toLowerCase().includes("quote");

    // Determine response type
    let responseType = "Email";
    let responseNote = `Client responded via email: "${email.subject || "No subject"}"`;

    if (isQuotationResponse) {
      responseType = "Quotation";
      responseNote = `Client responded to quotation: "${email.subject || "No subject"}"`;

      // Try to find the quotation this might be responding to
      const quotations = await QuotationModel.find({
        leadId: lead._id,
      })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();

      if (quotations.length > 0) {
        const latestQuote = quotations[0];
        responseNote = `Client responded to Quotation V${latestQuote.versionNumber}: "${email.subject || "No subject"}"`;
      }
    } else if (isReply) {
      responseType = "Email Reply";
      responseNote = `Client replied to email: "${email.subject || "No subject"}"`;
    }

    // Check if we've already created an activity for this email
    const existingActivity = await LeadActivityModel.findOne({
      leadId: lead._id,
      type: LeadActivityType.CLIENT_RESPONSE,
      note: { $regex: email.messageId },
    }).lean();

    if (existingActivity) {
      logger.info("[handleClientResponse] Skipping: Activity already exists", { activityId: existingActivity._id.toString() });
      // Already processed this email
      return;
    }

    logger.info("[handleClientResponse] Creating new LeadActivity");

    // Create activity log
    await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.CLIENT_RESPONSE,
      note: `${responseNote}${email.snippet ? ` - ${email.snippet.substring(0, 100)}` : ""}`,
      performedAt: email.receivedAt || new Date(),
    });

    logger.info(`[handleClientResponse] Checking notify assigned to userid: ${lead.assignedToUserId}`);

    // Notify assigned user if lead has an assignee
    if (lead.assignedToUserId) {
      const assignedUserId = lead.assignedToUserId.toString();
      const leadNumber = lead.leadNumber || lead._id.toString().substring(0, 8);

      await createNotification({
        userId: assignedUserId,
        type: NotificationType.CLIENT_RESPONSE,
        title: `${responseType} Response Received`,
        message: `Lead ${leadNumber} has received a ${responseType.toLowerCase()} response from the client.`,
        metadata: {
          leadId: lead._id,
          leadNumber,
          emailId: email._id,
          responseType,
          subject: email.subject,
        },
      });

      logger.info("Client response detected and notification sent", {
        leadId: lead._id.toString(),
        leadNumber,
        assignedUserId,
        responseType,
        emailId: email._id.toString(),
      });
    } else {
      logger.info("Client response detected but no assignee to notify", {
        leadId: lead._id.toString(),
        responseType,
        emailId: email._id.toString(),
      });
    }

    // Update lead's firstResponseAt if this is the first response
    if (!lead.firstResponseAt && email.receivedAt) {
      await LeadModel.updateOne(
        { _id: lead._id },
        { $set: { firstResponseAt: email.receivedAt } }
      );
    }
  } catch (error) {
    logger.error("Error handling client response", {
      emailId: email._id?.toString(),
      leadId: email.linkedLeadId?.toString(),
    }, error instanceof Error ? error : new Error(String(error)));
    // Don't throw - we don't want to break email sync if response handling fails
  }
}

/**
 * Handle quotation status updates (when client accepts/rejects a quotation)
 * This can be called when a quotation status is manually updated or when detected from email
 */
export async function handleQuotationResponse(
  leadId: Types.ObjectId | string,
  quotationId: Types.ObjectId | string,
  status: "ACCEPTED" | "REJECTED",
  performedByUserId?: Types.ObjectId | string
): Promise<void> {
  try {
    const lead = await LeadModel.findById(leadId).lean();
    if (!lead) {
      logger.warn("Quotation response for non-existent lead", { leadId, quotationId });
      return;
    }

    const quotation = await QuotationModel.findById(quotationId).lean();
    if (!quotation) {
      logger.warn("Quotation response for non-existent quotation", { leadId, quotationId });
      return;
    }

    // Create activity log
    await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.CLIENT_RESPONSE,
      note: `Client ${status.toLowerCase()} Quotation V${quotation.versionNumber}`,
      performedAt: new Date(),
      performedByUserId: performedByUserId,
    });

    // Notify assigned user
    if (lead.assignedToUserId) {
      const assignedUserId = lead.assignedToUserId.toString();
      const leadNumber = lead.leadNumber || lead._id.toString().substring(0, 8);

      await createNotification({
        userId: assignedUserId,
        type: NotificationType.CLIENT_RESPONSE,
        title: `Quotation ${status}`,
        message: `Client has ${status.toLowerCase()} Quotation V${quotation.versionNumber} for Lead ${leadNumber}.`,
        metadata: {
          leadId: lead._id,
          leadNumber,
          quotationId: quotation._id,
          status,
        },
      });

      logger.info("Quotation response processed and notification sent", {
        leadId: lead._id.toString(),
        leadNumber,
        assignedUserId,
        quotationId: quotation._id.toString(),
        status,
      });
    }
  } catch (error) {
    logger.error("Error handling quotation response", {
      leadId: leadId.toString(),
      quotationId: quotationId.toString(),
    }, error instanceof Error ? error : new Error(String(error)));
  }
}

