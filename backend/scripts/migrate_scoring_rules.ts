import mongoose from "mongoose";
import dotenv from "dotenv";
import { ScoringRuleModel } from "../src/models/scoringRule";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/postcard";

const defaultRules = [
    {
        name: "Travel Date: High Urgency (0-10 days)",
        description: "Travel is within the next 10 days.",
        module: "leads",
        isActive: true,
        priority: 100,
        conditionLogic: "AND",
        conditions: [
            { field: "_daysUntil_checkInDate", operator: "greater_than", value: -1 },
            { field: "_daysUntil_checkInDate", operator: "less_than", value: 11 }
        ],
        points: 3
    },
    {
        name: "Travel Date: Medium Urgency (11-30 days)",
        description: "Travel is within the next month.",
        module: "leads",
        isActive: true,
        priority: 90,
        conditionLogic: "AND",
        conditions: [
            { field: "_daysUntil_checkInDate", operator: "greater_than", value: 10 },
            { field: "_daysUntil_checkInDate", operator: "less_than", value: 31 }
        ],
        points: 2
    },
    {
        name: "Travel Date: Low Urgency (>30 days)",
        description: "Travel is more than 30 days away.",
        module: "leads",
        isActive: true,
        priority: 80,
        conditionLogic: "AND",
        conditions: [
            { field: "_daysUntil_checkInDate", operator: "greater_than", value: 30 }
        ],
        points: 1
    },
    {
        name: "Budget Fit",
        description: "Lead has a defined budget.",
        module: "leads",
        isActive: true,
        priority: 70,
        conditionLogic: "AND",
        conditions: [
            { field: "budget", operator: "greater_than", value: 0 }
        ],
        points: 1
    },
    {
        name: "Engagement: Contact Info",
        description: "Lead has provided both phone and email.",
        module: "leads",
        isActive: true,
        priority: 60,
        conditionLogic: "AND",
        conditions: [
            { field: "contactDetails.phone", operator: "is_not_empty", value: "" },
            { field: "contactDetails.email", operator: "is_not_empty", value: "" }
        ],
        points: 1
    },
    {
        name: "Deal Size: Premium",
        description: "Estimated value is >= 50,000.",
        module: "leads",
        isActive: true,
        priority: 50,
        conditionLogic: "AND",
        conditions: [
            { field: "budget", operator: "greater_than", value: 49999 }
        ],
        points: 2
    }
];

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        for (const rule of defaultRules) {
            await ScoringRuleModel.findOneAndUpdate(
                { name: rule.name },
                rule,
                { upsert: true, new: true }
            );
            console.log(`Ensured rule: ${rule.name}`);
        }

        console.log("Migration completed successfully");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
