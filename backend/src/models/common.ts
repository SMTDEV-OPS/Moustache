import { Schema, Types } from "mongoose";

export type ObjectId = Types.ObjectId;

export enum TeamType {
  RESERVATIONS = "RESERVATIONS",
  SALES = "SALES",
  OPERATIONS = "OPERATIONS",
}

export enum SunshineTier {
  GOLD = "GOLD",
  PLATINUM = "PLATINUM",
  BLACK = "BLACK",
}

export enum LeadSource {
  DIRECT_CALL = "DIRECT_CALL",
  UNIT = "UNIT",
  EMAIL = "EMAIL",
  REPEAT_GUEST = "REPEAT_GUEST",
  REFERRAL = "REFERRAL",
  CORPORATE_OFFICE = "CORPORATE_OFFICE",
  BRAND_WEBSITE = "BRAND_WEBSITE",
  SOCIAL = "SOCIAL",
  VIP_MR_CHOPRA = "VIP_MR_CHOPRA",
  TRAVEL_AGENT = "TRAVEL_AGENT",
  WALK_IN = "WALK_IN",
  EVENT_MICE = "EVENT_MICE",
}

export enum LeadType {
  STAY = "STAY",
  DINING = "DINING",
  INFORMATION = "INFORMATION",
  MICE = "MICE",
  WEDDING = "WEDDING",
}

export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUOTATION_SHARED = "QUOTATION_SHARED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  ON_HOLD = "ON_HOLD",
  CONFIRMED = "CONFIRMED",
  LOST = "LOST",
  CLOSED_AUTO = "CLOSED_AUTO",
}

export enum HeatLevel {
  HOT = "HOT",
  WARM = "WARM",
  COLD = "COLD",
  NOT_INTERESTED = "NOT_INTERESTED",
}

export enum ClosedReason {
  PRICE = "PRICE",
  NO_AVAILABILITY = "NO_AVAILABILITY",
  GUEST_NOT_RESPONDING = "GUEST_NOT_RESPONDING",
  OTHER = "OTHER",
}

export enum CommunicationChannel {
  CALL = "CALL",
  EMAIL = "EMAIL",
  WHATSAPP = "WHATSAPP",
  SMS = "SMS",
}

export enum CommunicationDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum CommunicationDisposition {
  SHOPPING_CALL = "SHOPPING_CALL",
  SHOPPING_FOLLOW_UP = "SHOPPING_FOLLOW_UP",
  NO_FOLLOW_UP = "NO_FOLLOW_UP",
  INFORMATION_QUERY = "INFORMATION_QUERY",
  DINING_INQUIRY = "DINING_INQUIRY",
  RESERVATION_CONFIRMED = "RESERVATION_CONFIRMED",
  CANCELLATION_REQUEST = "CANCELLATION_REQUEST",
  AMENDMENT_REQUEST = "AMENDMENT_REQUEST",
}

export enum CallStatus {
  QUOTATION_SHARED = "QUOTATION_SHARED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  NOT_INTERESTED = "NOT_INTERESTED",
}

export enum TicketStatus {
  NEW = "NEW",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TicketCategory {
  TECHNICAL = "TECHNICAL",
  BILLING = "BILLING",
  GENERAL = "GENERAL",
  FEATURE_REQUEST = "FEATURE_REQUEST",
  BUG_REPORT = "BUG_REPORT",
}

export const GuestRef = { type: Schema.Types.ObjectId, ref: "Guest", index: true };
export const UserRef = { type: Schema.Types.ObjectId, ref: "User", index: true };
export const RoleRef = { type: Schema.Types.ObjectId, ref: "Role", index: true };
export const PropertyRef = { type: Schema.Types.ObjectId, ref: "Property", index: true };
export const LeadRef = { type: Schema.Types.ObjectId, ref: "Lead", index: true };
export const AccountRef = { type: Schema.Types.ObjectId, ref: "Account", index: true };
export const RegionRef = { type: Schema.Types.ObjectId, ref: "Region", index: true };
export const TicketRef = { type: Schema.Types.ObjectId, ref: "Ticket", index: true };



