import { Types } from "mongoose";
import path from "path";
import {
  KnowledgeBaseModel,
  IKnowledgeBase,
  KnowledgeBaseType,
  IKnowledgeBaseFile,
  IFactSheetContent,
} from "../models/knowledgeBase";
import { PropertyModel } from "../models/property";
import {
  collectDirectoryMatchReasons,
  normalizeSearchQuery,
} from "../utils/directorySearch";
import { notFound } from "../utils/httpError";
import { logger } from "../config/logger";
import mongoose from "mongoose";
import { StorageService } from "./storageService";
import { toFactSheetContent } from "../utils/propertyDirectoryToFactSheet";

export interface CreateKnowledgeBaseInput {
  type: KnowledgeBaseType;
  propertyId: string;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateKnowledgeBaseInput {
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  isActive?: boolean;
  updatedBy: string;
}

export interface SearchFilters {
  propertyId?: string;
  type?: KnowledgeBaseType;
  search?: string;
  isActive?: boolean;
}

export interface DirectoryPropertyCard {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  kbId: string | null;
  tier: string;
  city: string;
  region: string;
  content: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface DirectorySearchResultDto {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  kbId: string | null;
  tier: string;
  city: string;
  region: string;
  matchedFields: string[];
}

export type GroupedDirectory = { regions: Record<string, DirectoryPropertyCard[]> };

/** Non-array object with at least one own key — otherwise treated as no factsheet data. */
function parseFactSheetContentFromDb(
  raw: unknown
): IFactSheetContent | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (Object.keys(raw as Record<string, unknown>).length === 0) {
    return null;
  }
  return raw as IFactSheetContent;
}

export class KnowledgeBaseService {
  private static async getLatestDirectoryLean(propertyId: string) {
    return KnowledgeBaseModel.findOne({
      propertyId: new Types.ObjectId(propertyId),
      type: KnowledgeBaseType.PROPERTY_DIRECTORY,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Active FACTSHEET for a property (latest by updatedAt), else mapped PROPERTY_DIRECTORY content.
   */
  static async getFactSheetForProperty(
    propertyId: string
  ): Promise<IFactSheetContent | null> {
    const item = await KnowledgeBaseModel.findOne({
      propertyId: new Types.ObjectId(propertyId),
      type: KnowledgeBaseType.FACTSHEET,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const fsContent = item?.content
      ? parseFactSheetContentFromDb(item.content)
      : null;
    if (fsContent) {
      return fsContent;
    }

    const dir = await this.getLatestDirectoryLean(propertyId);
    return dir?.content
      ? toFactSheetContent(dir.content)
      : null;
  }

  /**
   * KB document id + content for quotations: prefers FACTSHEET when it has usable body;
   * otherwise latest PROPERTY_DIRECTORY mapped to IFactSheetContent.
   */
  static async getFactSheetRecordForProperty(
    propertyId: string
  ): Promise<{
    kbFactsheetId: Types.ObjectId;
    content: IFactSheetContent | null;
  } | null> {
    const item = await KnowledgeBaseModel.findOne({
      propertyId: new Types.ObjectId(propertyId),
      type: KnowledgeBaseType.FACTSHEET,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const fsContent = item?.content
      ? parseFactSheetContentFromDb(item.content)
      : null;
    if (item?._id && fsContent) {
      return {
        kbFactsheetId: item._id as Types.ObjectId,
        content: fsContent,
      };
    }

    const dir = await this.getLatestDirectoryLean(propertyId);
    const dirContent = dir?.content
      ? toFactSheetContent(dir.content)
      : null;
    if (dir?._id && dirContent) {
      return {
        kbFactsheetId: dir._id as Types.ObjectId,
        content: dirContent,
      };
    }

    return null;
  }

  /**
   * Create a new knowledge base item
   */
  static async create(
    input: CreateKnowledgeBaseInput
  ): Promise<IKnowledgeBase> {
    const item = await KnowledgeBaseModel.create({
      ...input,
      propertyId: new Types.ObjectId(input.propertyId),
      createdBy: new Types.ObjectId(input.createdBy),
      updatedBy: new Types.ObjectId(input.createdBy),
      files: [],
    });

    return item;
  }

  /**
   * Get knowledge base items with filters
   */
  static async find(filters: SearchFilters = {}): Promise<IKnowledgeBase[]> {
    const query: Record<string, unknown> = {};

    if (filters.propertyId) {
      query.propertyId = new Types.ObjectId(filters.propertyId);
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    } else {
      // Default to active items only
      query.isActive = true;
    }

    // Text search
    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const items = await KnowledgeBaseModel.find(query)
      .populate("propertyId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort(filters.search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .lean();

    return items as unknown as IKnowledgeBase[];
  }

  /**
   * Get a single knowledge base item by ID
   */
  static async findById(id: string): Promise<IKnowledgeBase> {
    const item = await KnowledgeBaseModel.findById(id)
      .populate("propertyId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    return item as unknown as IKnowledgeBase;
  }

  /**
   * Update a knowledge base item
   */
  static async update(
    id: string,
    input: UpdateKnowledgeBaseInput
  ): Promise<IKnowledgeBase> {
    const updateData: Record<string, unknown> = {
      ...input,
      updatedBy: new Types.ObjectId(input.updatedBy),
    };

    const item = await KnowledgeBaseModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate("propertyId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    return item as unknown as IKnowledgeBase;
  }

  /**
   * Delete a knowledge base item
   */
  static async delete(id: string): Promise<void> {
    const item = await KnowledgeBaseModel.findById(id).lean();

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    // Delete associated files from respective storage providers
    if (item.files && item.files.length > 0) {
      for (const file of item.files) {
        await this.deleteFromStorage(file);
      }
    }

    await KnowledgeBaseModel.findByIdAndDelete(id);
  }

  /**
   * Helper to delete a file from its storage provider.
   * Schema allows `GCS` for legacy rows; new KB uploads use S3 only (`StorageService`).
   */
  private static async deleteFromStorage(file: IKnowledgeBaseFile): Promise<void> {
    if (file.storageType === "S3" && file.s3Key) {
      await StorageService.deleteFile(file.s3Key);
    } else if (file.storageType === "GRIDFS" && file.fileId) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!);
      try {
        await bucket.delete(new Types.ObjectId(file.fileId));
      } catch (error) {
        logger.error(`Failed to delete file ${file.fileId} from GridFS`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  /**
   * Add files to a knowledge base item (stores in S3).
   */
  static async addFiles(
    id: string,
    files: Express.Multer.File[],
    updatedBy: string
  ): Promise<IKnowledgeBase> {
    const item = await KnowledgeBaseModel.findById(id);

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    const fileMetadata: IKnowledgeBaseFile[] = [];

    for (const file of files) {
      // Upload to S3
      const s3Key = await StorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        `knowledge-base/${item.type.toLowerCase()}`
      );

      fileMetadata.push({
        filename: path.basename(s3Key),
        originalName: file.originalname,
        s3Key: s3Key,
        storageType: "S3",
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    logger.info(`Uploaded ${fileMetadata.length} file(s) to S3 for knowledge base item`, {
      itemId: id,
    });

    const updatedItem = await KnowledgeBaseModel.findByIdAndUpdate(
      id,
      {
        $push: { files: { $each: fileMetadata } },
        $set: { updatedBy: new Types.ObjectId(updatedBy) }
      },
      { new: true }
    ).populate("propertyId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!updatedItem) {
      throw notFound("Knowledge base item not found");
    }

    return updatedItem as unknown as IKnowledgeBase;
  }

  /**
   * Delete a file from a knowledge base item (and its storage)
   */
  static async deleteFile(
    id: string,
    fileIdInArray: string,
    updatedBy: string
  ): Promise<IKnowledgeBase> {
    const item = await KnowledgeBaseModel.findById(id);

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    const fileIndex = item.files.findIndex(
      (f) => f._id?.toString() === fileIdInArray
    );

    if (fileIndex === -1) {
      throw notFound("File not found");
    }

    const file = item.files[fileIndex];

    // Delete from its storage provider
    await this.deleteFromStorage(file);

    // Remove from array
    item.files.splice(fileIndex, 1);
    item.updatedBy = new Types.ObjectId(updatedBy);
    await item.save();

    return this.findById(id);
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(
    id: string,
    fileIdInArray: string
  ): Promise<{ file: IKnowledgeBaseFile }> {
    const item = await KnowledgeBaseModel.findById(id).lean();

    if (!item) {
      throw notFound("Knowledge base item not found");
    }

    const file = item.files.find((f) => f._id?.toString() === fileIdInArray);

    if (!file) {
      throw notFound("File not found");
    }

    return { file };
  }

  private static mergeDirectoryContent(
    existing: Record<string, unknown> | undefined,
    patch: Record<string, unknown>
  ): Record<string, unknown> {
    const base: Record<string, unknown> = { ...(existing ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (
        k === "amenities" &&
        typeof v === "object" &&
        v !== null &&
        !Array.isArray(v)
      ) {
        base.amenities = {
          ...((base.amenities as object) ?? {}),
          ...(v as object),
        };
      } else if (
        k === "cityInfo" &&
        typeof v === "object" &&
        v !== null &&
        !Array.isArray(v)
      ) {
        base.cityInfo = {
          ...((base.cityInfo as object) ?? {}),
          ...(v as object),
        };
      } else if (
        k === "contact" &&
        typeof v === "object" &&
        v !== null &&
        !Array.isArray(v)
      ) {
        base.contact = {
          ...((base.contact as object) ?? {}),
          ...(v as object),
        };
      } else {
        base[k] = v;
      }
    }
    return base;
  }

  /** Flat list of cards (all active properties). */
  static async buildDirectoryCards(): Promise<DirectoryPropertyCard[]> {
    const properties = await PropertyModel.find({ status: "ACTIVE" })
      .sort({ name: 1 })
      .lean();

    const dirDocs = await KnowledgeBaseModel.find({
      type: KnowledgeBaseType.PROPERTY_DIRECTORY,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const byPid = new Map<string, (typeof dirDocs)[0]>();
    for (const d of dirDocs) {
      const key = String(d.propertyId);
      if (!byPid.has(key)) {
        byPid.set(key, d);
      }
    }

    return properties.map((p) => {
      const doc = byPid.get(String(p._id));
      const contentFromDoc =
        doc?.content && typeof doc.content === "object" && !Array.isArray(doc.content)
          ? (doc.content as Record<string, unknown>)
          : null;

      const c = contentFromDoc?.contact as Record<string, unknown> | undefined;
      const regionV2 =
        typeof contentFromDoc?.region === "string"
          ? contentFromDoc.region.trim()
          : "";
      const cityV2 =
        typeof contentFromDoc?.city === "string"
          ? contentFromDoc.city.trim()
          : "";
      const contactState =
        c && typeof c.state === "string" ? String(c.state).trim() : "";
      const contactCity =
        c && typeof c.city === "string" ? String(c.city).trim() : "";

      const region =
        regionV2 ||
        (p.location?.state && String(p.location.state).trim()) ||
        contactState ||
        (p.location?.country && String(p.location.country).trim()) ||
        "Other";

      const city =
        cityV2 ||
        contactCity ||
        (p.location?.city && String(p.location.city).trim()) ||
        "";

      return {
        propertyId: p._id.toString(),
        propertyName: p.name,
        propertyCode: p.code != null ? String(p.code) : "",
        kbId: doc?._id ? String(doc._id) : null,
        tier: p.tier ?? "SELECT",
        city,
        region,
        content: contentFromDoc,
        updatedAt: doc?.updatedAt
          ? new Date(doc.updatedAt).toISOString()
          : null,
      };
    });
  }

  static async getDirectoryGroupedByRegion(): Promise<GroupedDirectory> {
    const cards = await this.buildDirectoryCards();
    const regions: Record<string, DirectoryPropertyCard[]> = {};
    for (const card of cards) {
      const r = card.region || "Other";
      if (!regions[r]) regions[r] = [];
      regions[r].push(card);
    }
    for (const k of Object.keys(regions)) {
      regions[k].sort((a, b) =>
        a.propertyName.localeCompare(b.propertyName, undefined, {
          sensitivity: "base",
        })
      );
    }
    return { regions };
  }

  /** @deprecated prefer buildDirectoryCards */
  static async getDirectoryEntries(): Promise<DirectoryPropertyCard[]> {
    return this.buildDirectoryCards();
  }

  static async getDirectoryByPropertyIds(
    propertyIds: string[]
  ): Promise<IKnowledgeBase[]> {
    const ids = propertyIds
      .slice(0, 3)
      .filter((id) => Types.ObjectId.isValid(id));
    const out: IKnowledgeBase[] = [];
    for (const pid of ids) {
      const doc = await KnowledgeBaseModel.findOne({
        propertyId: new Types.ObjectId(pid),
        type: KnowledgeBaseType.PROPERTY_DIRECTORY,
        isActive: true,
      })
        .sort({ updatedAt: -1 })
        .lean();
      if (doc?._id) {
        const full = await this.findById(doc._id.toString());
        out.push(full);
      }
    }
    return out;
  }

  static async upsertDirectoryEntry(
    propertyId: string,
    content: Record<string, unknown>,
    userId: string,
    source: "excel_import" | "manual",
    merge = false
  ): Promise<IKnowledgeBase> {
    const prop = await PropertyModel.findById(propertyId).lean();
    if (!prop) {
      throw notFound("Property not found");
    }

    const existing = await KnowledgeBaseModel.findOne({
      propertyId: new Types.ObjectId(propertyId),
      type: KnowledgeBaseType.PROPERTY_DIRECTORY,
    })
      .sort({ updatedAt: -1 })
      .lean();

    let nextContent: Record<string, unknown>;
    if (
      merge &&
      existing?.content &&
      typeof existing.content === "object" &&
      !Array.isArray(existing.content)
    ) {
      nextContent = this.mergeDirectoryContent(
        existing.content as Record<string, unknown>,
        content
      );
    } else {
      nextContent = { ...content };
    }
    nextContent.importSource = source;
    if (source === "excel_import") {
      nextContent.lastImportedAt = new Date().toISOString();
    }

    const updated = await KnowledgeBaseModel.findOneAndUpdate(
      {
        propertyId: new Types.ObjectId(propertyId),
        type: KnowledgeBaseType.PROPERTY_DIRECTORY,
      },
      {
        $set: {
          type: KnowledgeBaseType.PROPERTY_DIRECTORY,
          propertyId: new Types.ObjectId(propertyId),
          title: `${prop.name} — Hotel Directory`,
          description: "Structured directory card for CRM",
          content: nextContent,
          isActive: true,
          updatedBy: new Types.ObjectId(userId),
        },
        $setOnInsert: {
          files: [],
          createdBy: new Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true }
    )
      .populate("propertyId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!updated) {
      throw notFound("Failed to upsert directory entry");
    }
    return updated as unknown as IKnowledgeBase;
  }

  /** Deep search over directory content + property name/code. */
  static async searchDirectory(rawQuery: string): Promise<{
    results: DirectorySearchResultDto[];
  }> {
    const needle = normalizeSearchQuery(rawQuery);
    const trimmed = rawQuery.trim();
    const digitOnly = /^[\d\s\-+]+$/.test(trimmed);
    if (needle.length < 2 && !(digitOnly && trimmed.replace(/\D/g, "").length >= 7)) {
      return { results: [] };
    }

    const entries = await this.buildDirectoryCards();
    const results: DirectorySearchResultDto[] = [];

    for (const e of entries) {
      const matchedFields: string[] = [];
      const qDisplay = rawQuery.trim();

      if (normalizeSearchQuery(e.propertyName).includes(needle)) {
        matchedFields.push(`Property name matches "${qDisplay}"`);
      }
      if (
        e.propertyCode &&
        normalizeSearchQuery(e.propertyCode).includes(needle)
      ) {
        matchedFields.push(`Property code matches "${qDisplay}"`);
      }
      if (normalizeSearchQuery(e.city).includes(needle)) {
        matchedFields.push(`City matches "${qDisplay}"`);
      }
      if (normalizeSearchQuery(e.region).includes(needle)) {
        matchedFields.push(`Region matches "${qDisplay}"`);
      }
      if (e.content) {
        matchedFields.push(...collectDirectoryMatchReasons(e.content, needle));
      }

      const seen = new Set<string>();
      const deduped = matchedFields.filter((r) => {
        if (seen.has(r)) return false;
        seen.add(r);
        return true;
      });

      if (deduped.length > 0) {
        results.push({
          propertyId: e.propertyId,
          propertyName: e.propertyName,
          propertyCode: e.propertyCode,
          kbId: e.kbId,
          tier: e.tier,
          city: e.city,
          region: e.region,
          matchedFields: deduped,
        });
      }
    }

    return { results };
  }
}

