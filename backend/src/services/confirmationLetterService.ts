import { Types } from "mongoose";
import { sendEmail, getPrimaryEmailAccount } from "./emailService";
import { sendWhatsApp } from "./communicationService";
import { CommunicationModel } from "../models/communication";
import { LeadModel } from "../models/lead";
import { ReservationModel } from "../models/reservation";
import { PropertyModel } from "../models/property";
import { GuestModel } from "../models/guest";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import { logger } from "../config/logger";

/**
 * Generate HTML template for confirmation letter
 */
export function generateConfirmationLetterHtml(
  reservation: any,
  lead: any,
  property: any,
  guest: any
): string {
  const checkInDate = reservation.checkInDate
    ? new Date(reservation.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const checkOutDate = reservation.checkOutDate
    ? new Date(reservation.checkOutDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const propertyName = property?.name || "Our Property";
  const totalAmount = reservation.totalAmount
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(reservation.totalAmount)
    : "Confirmed";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - ${propertyName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header .confirmation-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; margin-top: 10px; font-size: 14px; }
    .content { padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #28a745; font-weight: bold; }
    .confirmation-box { background: #e8f5e9; border-radius: 10px; padding: 25px; margin: 20px 0; border-left: 4px solid #28a745; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; font-weight: 500; }
    .detail-value { font-weight: 600; color: #333; }
    .highlight-box { background: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
    .contact-info { background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .contact-info h3 { color: #1976d2; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${propertyName}</h1>
      <div class="confirmation-badge">✓ BOOKING CONFIRMED</div>
    </div>
    
    <div class="content">
      <p class="greeting">Dear ${guest?.name || "Valued Guest"},</p>
      
      <p>We are delighted to confirm your reservation with us! Your booking has been successfully confirmed and we look forward to welcoming you.</p>
      
      <div class="confirmation-box">
        <h2 style="margin-top: 0; color: #28a745;">Booking Confirmation Details</h2>
        
        <div class="detail-row">
          <span class="detail-label">Confirmation Number</span>
          <span class="detail-value">#${reservation.pmsReservationId || lead.leadNumber || "N/A"}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Check-in Date</span>
          <span class="detail-value">${checkInDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Check-out Date</span>
          <span class="detail-value">${checkOutDate}</span>
        </div>
        
        ${reservation.roomsBooked ? `
        <div class="detail-row">
          <span class="detail-label">Number of Rooms</span>
          <span class="detail-value">${reservation.roomsBooked}</span>
        </div>
        ` : ''}
        
        ${reservation.ratePlan ? `
        <div class="detail-row">
          <span class="detail-label">Rate Plan</span>
          <span class="detail-value">${reservation.ratePlan}</span>
        </div>
        ` : ''}
        
        <div class="detail-row">
          <span class="detail-label">Total Amount</span>
          <span class="detail-value" style="color: #28a745; font-size: 18px;">${totalAmount}</span>
        </div>
      </div>
      
      <div class="highlight-box">
        <h3 style="margin-top: 0; color: #856404;">Important Information</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Please arrive at the property on or after the check-in date</li>
          <li>Check-in time is typically 2:00 PM</li>
          <li>Check-out time is typically 11:00 AM</li>
          <li>Please carry a valid ID proof at the time of check-in</li>
        </ul>
      </div>
      
      <div class="contact-info">
        <h3>Need Assistance?</h3>
        <p>If you have any questions or need to make changes to your reservation, please don't hesitate to contact us. We're here to help make your stay memorable!</p>
      </div>
      
      <p>We are excited to host you and look forward to providing you with an exceptional experience.</p>
      
      <p>Warm regards,<br><strong>The ${propertyName} Team</strong></p>
    </div>
    
    <div class="footer">
      <p>This is an automated confirmation email. Please save this email for your records.</p>
      <p>Confirmation Reference: ${reservation.pmsReservationId || lead.leadNumber || "N/A"}</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send confirmation letter via preferred channel
 */
export async function sendConfirmationLetter(
  reservationId: string,
  userId: string,
  preferredChannel?: "EMAIL" | "WHATSAPP"
): Promise<void> {
  const reservation = await ReservationModel.findById(reservationId).lean();
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  const lead = await LeadModel.findById(reservation.leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  const guest = await GuestModel.findById(reservation.guestId).lean();
  if (!guest) {
    throw new Error("Guest not found");
  }

  const property = reservation.propertyId
    ? await PropertyModel.findById(reservation.propertyId).lean()
    : null;

  // Determine preferred channel (default to email if guest has email, otherwise WhatsApp)
  let channel: "EMAIL" | "WHATSAPP" = preferredChannel || "EMAIL";
  if (!preferredChannel) {
    if (guest.email) {
      channel = "EMAIL";
    } else if (guest.phone) {
      channel = "WHATSAPP";
    } else {
      throw new Error("No contact method available for guest");
    }
  }

  const htmlContent = generateConfirmationLetterHtml(
    reservation,
    lead,
    property,
    guest
  );
  const textContent = `Dear ${guest.name},\n\nYour booking has been confirmed!\n\nConfirmation Number: ${reservation.pmsReservationId || lead.leadNumber}\nCheck-in: ${reservation.checkInDate ? new Date(reservation.checkInDate).toLocaleDateString("en-IN") : "N/A"}\nCheck-out: ${reservation.checkOutDate ? new Date(reservation.checkOutDate).toLocaleDateString("en-IN") : "N/A"}\n\nWe look forward to welcoming you!\n\nWarm regards,\nThe ${property?.name || "Property"} Team`;

  try {
    if (channel === "EMAIL" && guest.email) {
      const primaryAccount = await getPrimaryEmailAccount(userId);
      if (!primaryAccount) {
        throw new Error("No primary email account found for user");
      }

      await sendEmail(primaryAccount._id.toString(), {
        to: [{ email: guest.email, name: guest.name }],
        subject: `Booking Confirmation - ${property?.name || "Your Reservation"}`,
        bodyHtml: htmlContent,
        bodyText: textContent,
      });

      // Create communication record
      await CommunicationModel.create({
        leadId: lead._id,
        guestId: guest._id,
        channel: CommunicationChannel.EMAIL,
        direction: CommunicationDirection.OUTBOUND,
        summary: "Confirmation letter sent",
        messageContent: textContent,
        performedByUserId: new Types.ObjectId(userId),
      });

      logger.info("Confirmation letter sent via email", {
        reservationId,
        leadId: lead._id,
        guestEmail: guest.email,
      });
    } else if (channel === "WHATSAPP" && guest.phone) {
      await sendWhatsApp(lead._id.toString(), {
        phone: guest.phone,
        message: textContent,
      });

      logger.info("Confirmation letter sent via WhatsApp", {
        reservationId,
        leadId: lead._id,
        guestPhone: guest.phone,
      });
    } else {
      throw new Error(`Cannot send confirmation letter: ${channel} channel not available for guest`);
    }
  } catch (error) {
    logger.error("Failed to send confirmation letter", {
      reservationId,
      leadId: lead._id,
      channel,
    }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

