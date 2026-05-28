import { Schema, model, Document, Types } from "mongoose";

export interface IContact extends Document {
    accountId: Types.ObjectId;

    // Personal Information
    title?: string;
    name: string;
    designation?: string;

    // Key Personnel Flag
    isKeyPersonnel: boolean;
    keyPersonnelRole?: "ADMIN_HEAD" | "FINANCE_HEAD" | "SALES_HEAD" | "MARKETING_HEAD" | "COUNTRY_CITY_HEAD" | "ASSISTANT" | "HR_HEAD" | "TRAINING_HEAD" | "CITY_HEAD" | "CITY_HEAD_ASSISTANT";

    // Addresses
    officeAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };
    personalAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };

    // Important Dates
    dateOfBirth?: Date;
    weddingAnniversary?: Date;

    // Additional Details
    personnelDetails?: string;

    // Loyalty
    isLoyaltyMember: boolean;
    loyaltyProgramName?: string;
    loyaltyNumber?: string;

    /** Preferred communication channel(s) */
    preferenceOfCommunication?: string;

    // Contact Details
    boardNumber?: string;
    officeNumber?: string;
    mobileNumber1?: string;
    mobileNumber2?: string;
    email?: string;

    // Relationship
    clientStatus: "PROMOTER" | "NEUTRAL" | "DETRACTOR";

    /** Tags (any user can add/remove) */
    tags?: string[];

    /** User who created this contact (PAM/SAM); used for creator-only visibility */
    createdByUserId?: Types.ObjectId;

    /** Status: ACTIVE (default) or NA (hidden from active lists) */
    status?: "ACTIVE" | "NA";

    /** Scheduled follow-up for this contact */
    followUpDate?: Date | null;
    followUpNote?: string;

    createdAt: Date;
    updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },

        // Personal Information
        title: String,
        name: {
            type: String,
            required: true,
            trim: true,
        },
        designation: String,

        // Key Personnel Flag
        isKeyPersonnel: {
            type: Boolean,
            default: false,
            index: true,
        },
        keyPersonnelRole: {
            type: String,
            enum: ["ADMIN_HEAD", "FINANCE_HEAD", "SALES_HEAD", "MARKETING_HEAD", "COUNTRY_CITY_HEAD", "ASSISTANT", "HR_HEAD", "TRAINING_HEAD", "CITY_HEAD", "CITY_HEAD_ASSISTANT"],
        },

        // Addresses
        officeAddress: {
            addressLine1: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        personalAddress: {
            addressLine1: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },

        // Important Dates
        dateOfBirth: Date,
        weddingAnniversary: Date,

        // Additional Details
        personnelDetails: String,

        // Loyalty
        isLoyaltyMember: {
            type: Boolean,
            default: false,
        },
        loyaltyProgramName: String,
        loyaltyNumber: String,

        preferenceOfCommunication: String,

        // Contact Details
        boardNumber: String,
        officeNumber: String,
        mobileNumber1: String,
        mobileNumber2: String,
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },

        // Relationship
        clientStatus: {
            type: String,
            enum: ["PROMOTER", "NEUTRAL", "DETRACTOR"],
            required: true,
            default: "NEUTRAL",
            index: true,
        },

        tags: [String],

        createdByUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "NA"],
            default: "ACTIVE",
            index: true,
        },

        followUpDate: { type: Date, default: null },
        followUpNote: { type: String, default: "" },
    },
    { timestamps: true }
);

// Indexes for search and filtering
contactSchema.index({ accountId: 1, createdByUserId: 1 });
contactSchema.index({ accountId: 1, isKeyPersonnel: 1 });
contactSchema.index({ accountId: 1, keyPersonnelRole: 1 });
contactSchema.index({ name: 'text', email: 'text' });
contactSchema.index({ dateOfBirth: 1 }); // For birthday reminders
contactSchema.index({ weddingAnniversary: 1 }); // For anniversary reminders

export const ContactModel = model<IContact>("Contact", contactSchema);
