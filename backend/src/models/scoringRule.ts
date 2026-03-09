import { Schema, model, Document } from "mongoose";

export interface IScoringCondition {
    field: string;
    operator: "is" | "is_not" | "contains" | "starts_with" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
    value: any;
}

export interface IScoringRule extends Document {
    name: string;
    description?: string;
    module: "leads" | "tickets";
    isActive: boolean;
    priority: number;
    conditionLogic: "AND" | "OR";
    conditions: IScoringCondition[];
    points: number; // Positive for addition, negative for subtraction
    createdAt: Date;
    updatedAt: Date;
}

const scoringConditionSchema = new Schema<IScoringCondition>({
    field: { type: String, required: true },
    operator: {
        type: String,
        enum: ["is", "is_not", "contains", "starts_with", "greater_than", "less_than", "is_empty", "is_not_empty"],
        required: true
    },
    value: { type: Schema.Types.Mixed }
});

const scoringRuleSchema = new Schema<IScoringRule>(
    {
        name: { type: String, required: true },
        description: String,
        module: { type: String, enum: ["leads", "tickets"], default: "leads", index: true },
        isActive: { type: Boolean, default: true },
        priority: { type: Number, default: 0, index: true },
        conditionLogic: { type: String, enum: ["AND", "OR"], default: "AND" },
        conditions: [scoringConditionSchema],
        points: { type: Number, required: true }
    },
    { timestamps: true }
);

export const ScoringRuleModel = model<IScoringRule>("ScoringRule", scoringRuleSchema);
