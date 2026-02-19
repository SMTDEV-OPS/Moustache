import { Types, mongo } from "mongoose";
import path from "path";
import {
  KnowledgeBaseModel,
  IKnowledgeBase,
  KnowledgeBaseType,
  IKnowledgeBaseFile,
} from "../models/knowledgeBase";
import { notFound } from "../utils/httpError";
import mongoose from "mongoose";
import { Readable } from "stream";
import { StorageService } from "./storageService";

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

export class KnowledgeBaseService {
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
   * Helper to delete a file from its storage provider
   */
  private static async deleteFromStorage(file: IKnowledgeBaseFile): Promise<void> {
    if (file.storageType === "S3" && file.s3Key) {
      await StorageService.deleteFile(file.s3Key);
    } else if (file.storageType === "GRIDFS" && file.fileId) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!);
      try {
        await bucket.delete(new Types.ObjectId(file.fileId));
      } catch (error) {
        console.error(`Failed to delete file ${file.fileId} from GridFS:`, error);
      }
    }
    // LOCAL files are handled separately if needed, but primarily we support GCS and GRIDFS now
  }

  /**
   * Add files to a knowledge base item (stores in GCS)
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

    console.log(`Adding ${fileMetadata.length} files to S3 for item ${id}`);

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

    console.log('Item updated successfully in DB with GCS files');
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
}

