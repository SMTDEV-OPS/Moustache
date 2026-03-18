import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { IntegrationConfigModel } from "../models/integrationConfig";
import { WebhookFieldMappingModel } from "../models/webhookFieldMapping";
import { encryptConfig, decryptConfig } from "../services/integrationEncryption";
import { badRequest, notFound } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";
import axios from "axios";

export const adminIntegrationsRouter = Router();

adminIntegrationsRouter.use(requireAuth);
adminIntegrationsRouter.use(requirePermissions([PERMISSIONS.SETTINGS.MANAGE]));

function toSafeResponse(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj.config_json;
  return {
    ...obj,
    is_configured: !!doc.config_json,
  };
}

// GET /api/admin/integrations?orgId=  (orgId is optional; if omitted, returns all)
adminIntegrationsRouter.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.query;
    const filter: Record<string, any> = {};

    if (orgId && typeof orgId === "string" && orgId.trim() !== "") {
      if (!Types.ObjectId.isValid(orgId)) {
        throw badRequest("orgId must be a valid ObjectId");
      }
      filter.orgId = new Types.ObjectId(orgId);
    }

    const list = await IntegrationConfigModel.find(filter).lean();

    res.json(
      list.map((l) => {
        const { config_json, ...rest } = l as any;
        return { ...rest, is_configured: !!config_json };
      })
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/integrations
const createIntegrationSchema = z.object({
  orgId: z.string().optional(),
  provider: z.string(),
  config_json: z.record(z.any()),
  webhook_url: z.string().optional(),
  is_active: z.boolean().optional(),
});

adminIntegrationsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const { provider, config_json, webhook_url, is_active } = parsed.data;
    const orgId = parsed.data.orgId || "69ae144fae23030b62f901f5";

    const encrypted = encryptConfig(config_json);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const defaultWebhookUrl = `${baseUrl}/webhook/intake/${orgId}/${provider}`;

    const existing = await IntegrationConfigModel.findOne({
      orgId: new Types.ObjectId(orgId),
      provider,
    });

    if (existing) {
      existing.config_json = encrypted;
      existing.webhook_url = webhook_url ?? defaultWebhookUrl;
      existing.is_active = is_active ?? true;
      existing.status = "pending";
      await existing.save();
      return res.json(toSafeResponse(existing));
    }

    const doc = await IntegrationConfigModel.create({
      orgId: new Types.ObjectId(orgId),
      provider,
      config_json: encrypted,
      webhook_url: webhook_url ?? defaultWebhookUrl,
      is_active: is_active ?? true,
      status: "pending",
    });

    res.status(201).json(toSafeResponse(doc));
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/integrations/:id
const updateIntegrationSchema = z.object({
  config_json: z.record(z.any()).optional(),
  webhook_url: z.string().optional(),
  is_active: z.boolean().optional(),
});

adminIntegrationsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const doc = await IntegrationConfigModel.findById(req.params.id);
    if (!doc) throw notFound("Integration not found");

    if (parsed.data.config_json) {
      doc.config_json = encryptConfig(parsed.data.config_json);
    }
    if (parsed.data.webhook_url !== undefined) {
      doc.webhook_url = parsed.data.webhook_url;
    }
    if (parsed.data.is_active !== undefined) {
      doc.is_active = parsed.data.is_active;
    }
    await doc.save();

    res.json(toSafeResponse(doc));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/integrations/:id
adminIntegrationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const doc = await IntegrationConfigModel.findByIdAndDelete(req.params.id);
    if (!doc) throw notFound("Integration not found");
    await WebhookFieldMappingModel.deleteMany({
      integrationConfigId: doc._id,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/integrations/:id/verify
adminIntegrationsRouter.post("/:id/verify", async (req, res, next) => {
  try {
    const doc = await IntegrationConfigModel.findById(req.params.id);
    if (!doc) throw notFound("Integration not found");

    const config = decryptConfig(doc.config_json);

    let verified = false;
    if (doc.provider === "WATI" && config.api_key) {
      try {
        const resp = await axios.get(
          "https://live-server.wati.io/api/v1/health",
          {
            headers: { Authorization: `Bearer ${config.api_key}` },
            timeout: 5000,
          }
        );
        verified = resp.status === 200;
      } catch (e: any) {
        verified = false;
      }
    }
    // Other providers: stub
    else {
      verified = true;
    }

    doc.last_verified_at = new Date();
    doc.status = verified ? "connected" : "error";
    await doc.save();

    res.json({
      verified,
      status: doc.status,
      last_verified_at: doc.last_verified_at,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/integrations/:id/mappings
adminIntegrationsRouter.get("/:id/mappings", async (req, res, next) => {
  try {
    const config = await IntegrationConfigModel.findById(req.params.id);
    if (!config) throw notFound("Integration not found");

    const mappings = await WebhookFieldMappingModel.find({
      integrationConfigId: config._id,
    }).lean();

    res.json(mappings);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/integrations/:id/mappings
const createMappingSchema = z.object({
  source_field: z.string(),
  target_field_slug: z.string(),
  transform: z
    .enum(["none", "uppercase", "lowercase", "phone_normalize", "date_parse"])
    .optional(),
});

adminIntegrationsRouter.post("/:id/mappings", async (req, res, next) => {
  try {
    const config = await IntegrationConfigModel.findById(req.params.id);
    if (!config) throw notFound("Integration not found");

    const parsed = createMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const mapping = await WebhookFieldMappingModel.create({
      orgId: config.orgId,
      integrationConfigId: config._id,
      source_field: parsed.data.source_field,
      target_field_slug: parsed.data.target_field_slug,
      transform: parsed.data.transform ?? "none",
    });

    res.status(201).json(mapping);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/integrations/:id/mappings/:mid
adminIntegrationsRouter.put("/:id/mappings/:mid", async (req, res, next) => {
  try {
    const mapping = await WebhookFieldMappingModel.findOne({
      _id: req.params.mid,
      integrationConfigId: req.params.id,
    });

    if (!mapping) throw notFound("Mapping not found");

    const parsed = createMappingSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    if (parsed.data.source_field) mapping.source_field = parsed.data.source_field;
    if (parsed.data.target_field_slug)
      mapping.target_field_slug = parsed.data.target_field_slug;
    if (parsed.data.transform) mapping.transform = parsed.data.transform as any;
    await mapping.save();

    res.json(mapping);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/integrations/:id/mappings/:mid
adminIntegrationsRouter.delete("/:id/mappings/:mid", async (req, res, next) => {
  try {
    const result = await WebhookFieldMappingModel.deleteOne({
      _id: req.params.mid,
      integrationConfigId: req.params.id,
    });

    if (result.deletedCount === 0) throw notFound("Mapping not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
