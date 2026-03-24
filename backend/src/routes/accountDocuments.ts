import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { AccountDocumentModel } from "../models/accountDocument";
import { AccountModel } from "../models/account";
import { requireAuth, hasPermission } from "../middleware/auth";
import { uploadAccountDocument } from "../middleware/upload";
import { StorageService } from "../services/storageService";
import { badRequest, notFound, forbidden } from "../utils/httpError";

export const accountDocumentsRouter = Router();

accountDocumentsRouter.use(requireAuth);

const DOC_TYPES = ["CONTRACT", "CERTIFICATE", "AGREEMENT", "OTHER"] as const;

// POST /account-documents/upload - upload for account (multipart with accountId, type, and file) → S3
accountDocumentsRouter.post("/upload", (req: Request, res: Response, next: NextFunction) => {
  uploadAccountDocument(req, res, async (err) => {
    if (err) {
      return next(badRequest(`File upload error: ${err.message}`));
    }
    if (!req.file) {
      return next(badRequest("No file uploaded"));
    }
    try {
      const accountId = (req.body.accountId || req.body.account_id) as string | undefined;
      if (!accountId) {
        return next(badRequest("accountId is required"));
      }

      const account = await AccountModel.findById(accountId).lean();
      if (!account) return next(notFound("Account not found"));

      if (!hasPermission(req.user, "accounts.manage_documents")) {
        return next(forbidden("You do not have access to upload documents to this account"));
      }

      const docType = (req.body.type || "OTHER") as string;
      const safeType = DOC_TYPES.includes(docType as any) ? docType : "OTHER";

      const file = req.file as Express.Multer.File & { buffer?: Buffer };
      if (!file.buffer) {
        return next(badRequest("File upload failed - no buffer"));
      }

      const s3Key = await StorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        "account-documents"
      );

      const doc = await AccountDocumentModel.create({
        accountId,
        name: file.originalname,
        fileUrl: s3Key,
        storageType: "S3",
        mimeType: file.mimetype,
        size: file.size,
        type: safeType,
        uploadedByUserId: req.user!.id,
      });
      const populated = await AccountDocumentModel.findById(doc._id)
        .populate("uploadedByUserId", "name email")
        .lean();
      res.status(201).json(populated);
    } catch (e) {
      next(e);
    }
  });
});

// GET /account-documents?accountId=xxx - list documents for account
accountDocumentsRouter.get("/", async (req, res, next) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      throw badRequest("accountId is required");
    }

    const account = await AccountModel.findById(accountId).lean();
    if (!account) throw notFound("Account not found");

    if (!hasPermission(req.user, "accounts.manage_documents")) {
      throw forbidden("You do not have access to this account's documents");
    }

    const docs = await AccountDocumentModel.find({ accountId })
      .sort({ createdAt: -1 })
      .populate("uploadedByUserId", "name email")
      .lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// GET /account-documents/:id/download - download file (S3: redirect to signed URL; LOCAL: serve from disk)
accountDocumentsRouter.get("/:id/download", async (req, res, next) => {
  try {
    const doc = await AccountDocumentModel.findById(req.params.id).lean();
    if (!doc) throw notFound("Document not found");

    if (!hasPermission(req.user, "accounts.manage_documents")) {
      throw forbidden("You do not have access to this document");
    }

    const docAny = doc as any;

    if (docAny.storageType === "S3" && docAny.fileUrl) {
      const signedUrl = await StorageService.getSignedUrl(docAny.fileUrl);
      return res.redirect(signedUrl);
    }

    const filePath = path.join(process.cwd(), "uploads", docAny.fileUrl);
    if (!fs.existsSync(filePath)) {
      throw notFound("File not found");
    }

    res.setHeader("Content-Type", docAny.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(docAny.name)}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
});

// DELETE /account-documents/:id
accountDocumentsRouter.delete("/:id", async (req, res, next) => {
  try {
    // Only system admin can delete documents; others must keep records (NA/cancel not yet modeled here).
    if (!req.user?.isAdmin) {
      throw forbidden("Only admins can delete documents");
    }

    const doc = await AccountDocumentModel.findById(req.params.id).lean();
    if (!doc) throw notFound("Document not found");

    if (!hasPermission(req.user, "accounts.manage_documents")) {
      throw forbidden("You do not have access to delete this document");
    }

    const docAny = doc as any;
    if (docAny.storageType === "S3" && docAny.fileUrl) {
      await StorageService.deleteFile(docAny.fileUrl);
    } else {
      const filePath = path.join(process.cwd(), "uploads", docAny.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await AccountDocumentModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    next(err);
  }
});
