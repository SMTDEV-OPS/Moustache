import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../config/logger";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest } from "../utils/httpError";
import { KnowledgeBaseService } from "../services/knowledgeBaseService";
import {
  KnowledgeBaseType,
  KnowledgeBaseModel,
} from "../models/knowledgeBase";
import { uploadKnowledgeBase } from "../middleware/upload";
import path from "path";
import fs from "fs";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { StorageService } from "../services/storageService";

export const knowledgeBaseRouter = Router();

knowledgeBaseRouter.use(requireAuth);

const createKnowledgeBaseSchema = z.object({
  type: z.enum(["PROPERTY", "FACTSHEET", "TEMPLATE", "RESOURCE"]),
  propertyId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
});

const updateKnowledgeBaseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// GET /knowledge-base - List items with filters
knowledgeBaseRouter.get("/", async (req, res, next) => {
  try {
    const { propertyId, type, search, isActive } = req.query;

    const filters: {
      propertyId?: string;
      type?: KnowledgeBaseType;
      search?: string;
      isActive?: boolean;
    } = {};

    if (propertyId && typeof propertyId === "string") {
      filters.propertyId = propertyId;
    }

    if (type && typeof type === "string") {
      if (Object.values(KnowledgeBaseType).includes(type as KnowledgeBaseType)) {
        filters.type = type as KnowledgeBaseType;
      }
    }

    if (search && typeof search === "string") {
      filters.search = search;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }

    const items = await KnowledgeBaseService.find(filters);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /knowledge-base/:id - Get single item
knowledgeBaseRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await KnowledgeBaseService.findById(req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /knowledge-base - Create item (admin only)
knowledgeBaseRouter.post(
  "/",
  requirePermissions(["knowledgebase.manage"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createKnowledgeBaseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid knowledge base payload");
      }

      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const item = await KnowledgeBaseService.create({
        ...parsed.data,
        type: parsed.data.type as KnowledgeBaseType,
        createdBy: req.user.id,
      });

      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /knowledge-base/:id - Update item (admin only)
knowledgeBaseRouter.patch(
  "/:id",
  requirePermissions(["knowledgebase.manage"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateKnowledgeBaseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid update payload");
      }

      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const item = await KnowledgeBaseService.update(req.params.id, {
        ...parsed.data,
        updatedBy: req.user.id,
      });

      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /knowledge-base/:id - Delete item (admin only)
knowledgeBaseRouter.delete(
  "/:id",
  requirePermissions(["knowledgebase.manage"]),
  async (req, res, next) => {
    try {
      await KnowledgeBaseService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /knowledge-base/:id/files - Upload files to item (admin only)
knowledgeBaseRouter.post(
  "/:id/files",
  requirePermissions(["knowledgebase.manage"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await KnowledgeBaseModel.findById(req.params.id).lean();
      if (!item) {
        throw badRequest("Knowledge base item not found");
      }

      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const upload = uploadKnowledgeBase(item.type);
      upload(req, res, async (err) => {
        if (err) {
          return next(badRequest(`File upload error: ${err.message}`));
        }

        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
          return next(badRequest("No files uploaded"));
        }

        try {
          let files: Express.Multer.File[] = [];
          if (Array.isArray(req.files)) {
            files = req.files;
          } else if (req.files && typeof req.files === 'object') {
            const fileArray = Object.values(req.files).flat();
            files = fileArray.filter((f): f is Express.Multer.File => f && typeof f === 'object' && 'fieldname' in f);
          }

          if (files.length === 0) {
            return next(badRequest("No valid files uploaded"));
          }

          if (!req.user?.id) {
            return next(badRequest("User not authenticated"));
          }

          const updatedItem = await KnowledgeBaseService.addFiles(
            req.params.id,
            files,
            req.user.id
          );
          res.json(updatedItem);
        } catch (error) {
          next(error);
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /knowledge-base/:id/files/:fileId - Delete file from item (admin only)
knowledgeBaseRouter.delete(
  "/:id/files/:fileId",
  requirePermissions(["knowledgebase.manage"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const item = await KnowledgeBaseService.deleteFile(
        req.params.id,
        req.params.fileId,
        req.user.id
      );
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

// GET /knowledge-base/files/:fileId - Download/serve file
knowledgeBaseRouter.get("/files/:fileId", async (req: Request, res: Response, next: NextFunction) => {
  logger.debug(`[DEBUG] GET /files/${req.params.fileId} hit`, { requestId: req.requestId });
  try {
    const item = await KnowledgeBaseModel.findOne({
      "files._id": req.params.fileId,
    }).lean();

    if (!item) {
      logger.warn(`[DEBUG] No knowledge base item found containing fileId: ${req.params.fileId}`);
      return res.status(404).json({ error: "File not found" });
    }

    const file = item.files.find(
      (f) => f._id?.toString() === req.params.fileId
    );

    if (!file) {
      logger.warn(`[DEBUG] File metadata not found in item files array for fileId: ${req.params.fileId}`);
      return res.status(404).json({ error: "File not found" });
    }

    // S3 Storage
    if (file.storageType === "S3" && file.s3Key) {
      try {
        const signedUrl = await StorageService.getSignedUrl(file.s3Key);
        return res.redirect(signedUrl);
      } catch (error: any) {
        logger.error(`Error generating signed URL for ${file.s3Key}`, { error: error.message });
        return res.status(500).json({ error: "Error accessing file storage" });
      }
    }

    // GridFS Storage (Legacy or Explicit)
    if (file.fileId || file.storageType === "GRIDFS") {
      return serveGridFSFile(file, res);
    }

    // Local Filesystem Storage (Legacy)
    const legacyFile = file as any;
    if (legacyFile.path || file.storageType === "LOCAL") {
      const filePath = legacyFile.path && (path.isAbsolute(legacyFile.path) ? legacyFile.path : path.join(process.cwd(), legacyFile.path));
      const logContext = { requestId: req.requestId, fileId: req.params.fileId, filePath, dbPath: legacyFile.path };

      if (filePath && fs.existsSync(filePath)) {
        logger.debug(`[DEBUG] Serving legacy file from disk`, logContext);
        return serveFile(filePath, file, res);
      }

      if (legacyFile.path && path.isAbsolute(legacyFile.path)) {
        const relativePart = legacyFile.path.split('uploads/')[1];
        if (relativePart) {
          const fallbackPath = path.join(process.cwd(), 'uploads', relativePart);
          if (fs.existsSync(fallbackPath)) {
            logger.info(`[DEBUG] Found legacy file using fallback path: ${fallbackPath}`, logContext);
            return serveFile(fallbackPath, file, res);
          }
        }
      }
    }

    return res.status(404).json({ error: "File not found" });
  } catch (err) {
    next(err);
  }
});

function serveGridFSFile(file: any, res: Response) {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!);

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.originalName}"`
  );

  const downloadStream = bucket.openDownloadStream(new Types.ObjectId(file.fileId));
  downloadStream.on('error', (err) => {
    logger.error(`GridFS download error for ${file.fileId}`, { error: err.message });
    if (!res.headersSent) {
      res.status(404).json({ error: "File not found in storage" });
    }
  });

  downloadStream.pipe(res);
}

function serveFile(filePath: string, file: any, res: Response) {
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.originalName}"`
  );

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}
