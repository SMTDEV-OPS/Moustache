import { z } from "zod";

const operatorSchema = z.enum([
    "is", "is_not", "in", "not_in", "contains", "starts_with",
    "greater_than", "less_than", "is_empty", "is_not_empty"
]);

const conditionSchema = z.object({
    field: z.string().min(1, "Field is required"),
    operator: operatorSchema,
    value: z.any()
});

export const assignmentRuleV2Schema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    module: z.enum(["leads", "tickets"]),
    isActive: z.boolean().optional(),
    priority: z.number().int().optional(),

    applyToAll: z.boolean().optional(),
    conditionLogic: z.enum(["AND", "OR"]).optional(),
    conditions: z.array(conditionSchema).optional(),

    assignTo: z.enum(["group", "user", "round_robin_group"]),
    employeeGroupId: z.string().optional(),
    specificUserId: z.string().optional(),
});
