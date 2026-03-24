import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { ScoringThresholdModel } from "../src/models/scoringThreshold";
import { FollowupRuleModel } from "../src/models/followupRule";
import { CallQualityDimensionModel } from "../src/models/callQualityDimension";
import { CustomFieldModel } from "../src/models/customField";
import { LeadModel } from "../src/models/lead";

const ORG_ID = process.argv[2] || "69ae144fae23030b62f901f5";

const scoringThresholds = [
    { orgId: ORG_ID, label: "Hot", min_score: 7, max_score: 10, color: "#ef4444", inactive_hours_warning: 48, inactive_hours_critical: 72, auto_action: "notify_tl" },
    { orgId: ORG_ID, label: "Warm", min_score: 4, max_score: 6, color: "#f59e0b", inactive_hours_warning: 72, inactive_hours_critical: 96, auto_action: "none" },
    { orgId: ORG_ID, label: "Cold", min_score: 0, max_score: 3, color: "#3b82f6", inactive_hours_warning: 120, inactive_hours_critical: 168, auto_action: "auto_lost" }
];

const followupRules = [
    { bucket: "Hot", followup_number: 1, offset_hours: 2, description: "First hot follow-up", display_order: 1, is_active: true },
    { bucket: "Hot", followup_number: 2, offset_hours: 5, description: "Second hot follow-up", display_order: 2, is_active: true },
    { bucket: "Warm", followup_number: 1, offset_hours: 24, description: "Warm follow-up day 1", display_order: 3, is_active: true },
    { bucket: "Warm", followup_number: 2, offset_hours: 48, description: "Warm follow-up day 2", display_order: 4, is_active: true },
    { bucket: "Cold", followup_number: 1, offset_days: 5, description: "Cold check-in", display_order: 5, is_active: true }
];

const callQualityDimensions = [
    { orgId: ORG_ID, name: "Warm Welcome & Greeting", weight_percent: 15, display_order: 1, is_active: true },
    { orgId: ORG_ID, name: "Understanding Guest Needs", weight_percent: 15, display_order: 2, is_active: true },
    { orgId: ORG_ID, name: "Building Rapport", weight_percent: 15, display_order: 3, is_active: true },
    { orgId: ORG_ID, name: "Product Knowledge", weight_percent: 15, display_order: 4, is_active: true },
    { orgId: ORG_ID, name: "Pitching Skills", weight_percent: 10, display_order: 5, is_active: true },
    { orgId: ORG_ID, name: "Objection Handling", weight_percent: 10, display_order: 6, is_active: true },
    { orgId: ORG_ID, name: "Closing", weight_percent: 10, display_order: 7, is_active: true },
    { orgId: ORG_ID, name: "Follow-up", weight_percent: 10, display_order: 8, is_active: true }
];

const customFields = [
    { orgId: ORG_ID, name: "Customer Type", slug: "customer_type", entity_type: "lead", type: "dropdown", options: ["B2C", "B2B", "Corporate", "Influencer", "NRI", "HNI", "Reference"], is_tag: true, is_active: true, display_order: 1 },
    { orgId: ORG_ID, name: "Booking Window", slug: "booking_window", entity_type: "lead", type: "dropdown", options: ["Within 5 hrs", "Within 24 hrs", "Yet to decide"], is_active: true, display_order: 2 },
    { orgId: ORG_ID, name: "Budget", slug: "budget", entity_type: "lead", type: "number", is_active: true, display_order: 3 },
    { orgId: ORG_ID, name: "Occasion", slug: "occasion", entity_type: "lead", type: "text", is_active: true, display_order: 4 },
    { orgId: ORG_ID, name: "Guest Type", slug: "guest_type", entity_type: "lead", type: "dropdown", options: ["First Time", "Repeat"], is_active: true, display_order: 5 }
];

const leads = [
    {
        orgId: ORG_ID,
        firstName: "Amit", lastName: "Sharma",
        phone: "+91 9876543210", email: "amit.sharma@example.com",
        source: "WHATSAPP", status: "NEW", value: 15000,
        hotelName: "Postcard Goa", checkInDate: new Date(Date.now() + 86400000 * 5), checkOutDate: new Date(Date.now() + 86400000 * 8),
        roomCategory: "Standard Room", numberOfRooms: 1,
        budget: 15000,
        customData: {
            "customer_type": "B2C",
            "booking_window": "Within 5 hrs",
            "budget": 15000,
            "occasion": "Vacation",
            "guest_type": "First Time"
        },
        temperature: "Hot", score: 8, interactions: 2, bucket: "HOT",
    },
    {
        orgId: ORG_ID,
        firstName: "Priya", lastName: "Mehta",
        phone: "+91 9876543211", email: "priya.mehta@example.com",
        source: "BRAND_WEBSITE", status: "IN_PROGRESS", value: 25000,
        hotelName: "Postcard Kerala", checkInDate: new Date(Date.now() + 86400000 * 15), checkOutDate: new Date(Date.now() + 86400000 * 20),
        roomCategory: "Backwater Suite", numberOfRooms: 2,
        budget: 25000,
        customData: {
            "customer_type": "Corporate",
            "booking_window": "Within 24 hrs",
            "budget": 25000,
            "occasion": "Team Outing",
            "guest_type": "Repeat"
        },
        temperature: "Warm", score: 5, interactions: 4, bucket: "WARM",
    },
    {
        orgId: ORG_ID,
        firstName: "Rahul", lastName: "Verma",
        phone: "+91 9876543212", email: "rahul.verma@example.com",
        source: "IVR_LIVE", status: "TENTATIVE", value: 45000,
        hotelName: "Postcard Rajasthan", checkInDate: new Date(Date.now() + 86400000 * 30), checkOutDate: new Date(Date.now() + 86400000 * 33),
        roomCategory: "Palace View", numberOfRooms: 1,
        budget: 45000,
        customData: {
            "customer_type": "HNI",
            "booking_window": "Yet to decide",
            "budget": 45000,
            "occasion": "Honeymoon",
            "guest_type": "First Time"
        },
        temperature: "Cold", score: 2, interactions: 1, bucket: "COLD",
    },
    {
        orgId: ORG_ID,
        firstName: "Sneha", lastName: "Patel",
        phone: "+91 9876543213", email: "sneha.patel@example.com",
        source: "SOCIAL", status: "NEW", value: 8000,
        hotelName: "Postcard Mumbai", checkInDate: new Date(Date.now() + 86400000 * 2), checkOutDate: new Date(Date.now() + 86400000 * 4),
        roomCategory: "City View", numberOfRooms: 1,
        budget: 8000,
        customData: {
            "customer_type": "B2C",
            "booking_window": "Within 5 hrs",
            "budget": 8000,
            "occasion": "Business",
            "guest_type": "First Time"
        },
        temperature: "Hot", score: 9, interactions: 3, bucket: "HOT",
    }
];

async function main() {
    await mongoose.connect(config.mongoUri);

    await ScoringThresholdModel.deleteMany({});
    await ScoringThresholdModel.insertMany(scoringThresholds);

    await FollowupRuleModel.deleteMany({});
    await FollowupRuleModel.insertMany(followupRules);

    await CallQualityDimensionModel.deleteMany({});
    await CallQualityDimensionModel.insertMany(callQualityDimensions);

    await CustomFieldModel.deleteMany({});
    await CustomFieldModel.insertMany(customFields);

    await LeadModel.insertMany(leads);

    console.log("Seeded successfully");
    process.exit(0);
}

main().catch(console.error);
