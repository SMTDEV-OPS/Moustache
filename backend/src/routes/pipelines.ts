import { Router } from "express";
import { z } from "zod";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { LeadModel } from "../models/lead";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { logAudit } from "../utils/auditLog";

export const pipelinesRouter = Router();

// Protect all routes
pipelinesRouter.use(requireAuth);

// Get all pipelines for a module
pipelinesRouter.get("/", async (req, res, next) => {
    try {
        const { module = "leads" } = req.query;
        const pipelines = await PipelineModel.find({ module }).sort({ createdAt: -1 }).lean();
        
        const pipelinesWithStages = await Promise.all(
            pipelines.map(async (pipeline) => {
                const stages = await PipelineStageModel
                    .find({ pipelineId: pipeline._id })
                    .sort({ order: 1 })
                    .lean();
                return { ...pipeline, stages };
            })
        );
        
        res.json(pipelinesWithStages);
    } catch (err) {
        next(err);
    }
});

// Create a new pipeline
const pipelineSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    module: z.string().default("leads"),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
});

pipelinesRouter.post("/", async (req, res, next) => {
    try {
        const parsed = pipelineSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid payload: " + parsed.error.message);
        }
        const pipeline = await PipelineModel.create(parsed.data);
        logAudit("created", "pipeline", pipeline._id.toString(), null, { name: pipeline.name }, req);
        res.status(201).json(pipeline);
    } catch (err) {
        next(err);
    }
});

// Get a specific pipeline and its stages
pipelinesRouter.get("/:id", async (req, res, next) => {
    try {
        const pipeline = await PipelineModel.findById(req.params.id).lean();
        if (!pipeline) throw notFound("Pipeline not found");

        const stages = await PipelineStageModel.find({ pipelineId: pipeline._id }).sort({ order: 1 }).lean();

        res.json({ ...pipeline, stages });
    } catch (err) {
        next(err);
    }
});

// Get default pipeline and its stages for a module
pipelinesRouter.get("/default/:module", async (req, res, next) => {
    try {
        const { module } = req.params;
        let pipeline = await PipelineModel.findOne({ module, isDefault: true }).lean();

        // Fallback to any active one if no default
        if (!pipeline) {
            pipeline = await PipelineModel.findOne({ module, isActive: true }).lean();
        }

        if (!pipeline) throw notFound("No default pipeline found for module");

        const stages = await PipelineStageModel.find({ pipelineId: pipeline._id }).sort({ order: 1 }).lean();
        res.json({ ...pipeline, stages });
    } catch (err) {
        next(err);
    }
});

// Update pipeline
pipelinesRouter.patch("/:id", async (req, res, next) => {
    try {
        const parsed = pipelineSchema.partial().safeParse(req.body);
        if (!parsed.success) throw badRequest("Invalid payload");

        const pipeline = await PipelineModel.findById(req.params.id);
        if (!pipeline) throw notFound("Pipeline not found");

        const before = pipeline.toObject();
        Object.assign(pipeline, parsed.data);
        await pipeline.save();
        logAudit("updated", "pipeline", pipeline._id.toString(), before, pipeline.toObject(), req);
        res.json(pipeline);
    } catch (err) {
        next(err);
    }
});

// Define stages for a pipeline (bulk replace/update)
const stagesUpdateSchema = z.array(
    z.object({
        _id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
        probability: z.number().min(0).max(100).optional(),
        isTerminal: z.boolean().default(false),
        terminalType: z.enum(["WON", "LOST"]).nullable().optional(),
        mandatory_fields_json: z.array(z.string()).optional().default([]),
    })
);

// Define stages for a pipeline (bulk replace/update)
pipelinesRouter.put("/:id/stages", async (req, res, next) => {
    try {
        const parsed = stagesUpdateSchema.safeParse(req.body);
        if (!parsed.success) throw badRequest("Invalid stages payload");

        const pipeline = await PipelineModel.findById(req.params.id);
        if (!pipeline) throw notFound("Pipeline not found");

        // Validations
        const wonCount = parsed.data.filter(s => s.isTerminal && s.terminalType === "WON").length;
        if (wonCount > 1) {
            throw badRequest("Only one stage per pipeline can have terminalType = 'WON'");
        }

        const nonTerminalCount = parsed.data.filter(s => !s.isTerminal).length;
        if (nonTerminalCount === 0) {
            throw badRequest("A pipeline must have at least 1 non-terminal stage");
        }

        const existingStages = await PipelineStageModel.find({ pipelineId: pipeline._id });
        const existingStageMap = new Map(existingStages.map(s => [s._id.toString(), s]));

        const processedIds = new Set<string>();

        // Delete stages not in the payload - CHECK LEAD BLOCKERS FIRST
        const activeLeadStatuses = [
            "NEW",
            "IN_PROGRESS",
            "TENTATIVE",
            // Assuming CONTACTED, QUOTATION_SHARED, PAYMENT_PENDING, ON_HOLD might be active too if mapped directly, 
            // but standard workflow says leads with these stages shouldn't be deleted implicitly. 
            // The simplest check is whether a lead is in that specific stageId.
        ];

        for (let i = 0; i < parsed.data.length; i++) {
            const stageData = parsed.data[i];
            if (stageData._id && existingStageMap.has(stageData._id)) {
                processedIds.add(stageData._id.toString());
            }
        }

        const toDeleteIds = existingStages
            .filter(s => !processedIds.has(s._id.toString()))
            .map(s => s._id);

        if (toDeleteIds.length > 0) {
            // Check if any leads are in these stages
            for (const stageToDeleteId of toDeleteIds) {
                const count = await LeadModel.countDocuments({ stageId: stageToDeleteId });
                if (count > 0) {
                    const stageName = existingStageMap.get(stageToDeleteId.toString())?.name;
                    throw badRequest(`Cannot delete stage '${stageName}'. It has ${count} active leads in it.`);
                }
            }
            await PipelineStageModel.deleteMany({ _id: { $in: toDeleteIds } });
        }

        // Upsert provided stages
        const resultStages = [];
        for (let i = 0; i < parsed.data.length; i++) {
            const stageData = parsed.data[i];
            if (stageData._id && existingStageMap.has(stageData._id)) {
                // Update
                const stage = existingStageMap.get(stageData._id)!;
                stage.name = stageData.name;
                stage.description = stageData.description;
                stage.order = i;
                stage.color = stageData.color;
                stage.probability = stageData.probability;
                stage.isTerminal = stageData.isTerminal;
                stage.terminalType = stageData.terminalType as "WON" | "LOST" | undefined;
                stage.mandatory_fields_json = stageData.mandatory_fields_json || [];
                await stage.save();
                resultStages.push(stage);
            } else {
                // Create new
                const newStage = await PipelineStageModel.create({
                    ...stageData,
                    pipelineId: pipeline._id,
                    order: i,
                    mandatory_fields_json: stageData.mandatory_fields_json || [],
                });
                resultStages.push(newStage);
            }
        }

        logAudit("updated", "pipeline", pipeline._id.toString(), { stagesCount: existingStages.length }, { stagesCount: resultStages.length }, req);
        res.json(resultStages);
    } catch (err) {
        next(err);
    }
});

// Delete pipeline
pipelinesRouter.delete("/:id", async (req, res, next) => {
    try {
        const pipeline = await PipelineModel.findById(req.params.id);
        if (!pipeline) throw notFound("Pipeline not found");

        const existingStages = await PipelineStageModel.find({ pipelineId: pipeline._id });
        const stageIds = existingStages.map(s => s._id);

        const count = await LeadModel.countDocuments({ stageId: { $in: stageIds } });
        if (count > 0) {
            throw badRequest(`Cannot delete pipeline. It has ${count} active leads associated with its stages.`);
        }

        await PipelineStageModel.deleteMany({ pipelineId: pipeline._id });
        await PipelineModel.deleteOne({ _id: pipeline._id });

        logAudit("deleted", "pipeline", pipeline._id.toString(), { name: pipeline.name }, null, req);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

// Reorder stages bulk
const reorderSchema = z.array(z.object({
    _id: z.string(),
    order: z.number()
}));

pipelinesRouter.put("/:id/stages/reorder", async (req, res, next) => {
    try {
        const parsed = reorderSchema.safeParse(req.body);
        if (!parsed.success) throw badRequest("Invalid reorder payload");

        const pipeline = await PipelineModel.findById(req.params.id);
        if (!pipeline) throw notFound("Pipeline not found");

        for (const update of parsed.data) {
            await PipelineStageModel.updateOne(
                { _id: update._id, pipelineId: pipeline._id },
                { $set: { order: update.order } }
            );
        }

        const stages = await PipelineStageModel.find({ pipelineId: pipeline._id }).sort({ order: 1 }).lean();
        res.json(stages);
    } catch (err) {
        next(err);
    }
});
