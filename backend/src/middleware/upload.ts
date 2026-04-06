import multer from "multer";
import { Request } from "express";

// Memory storage for database uploads (GridFS)
const storage = multer.memoryStorage();

// File filter to allow images, videos, PDFs, and documents
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Create multer instances for each type (though they all use memory storage now)
export const uploadProperty = upload;

export const uploadFactsheet = upload;

export const uploadTemplate = upload;

export const uploadResource = upload;

/**
 * Generic upload middleware that handles file uploads to memory
 */
export const uploadKnowledgeBase = (
  _type: "PROPERTY" | "FACTSHEET" | "TEMPLATE" | "RESOURCE" | "PROPERTY_DIRECTORY"
) => {
  return upload.array("files", 10);
};

/** Single .xlsx for hotel directory bulk import (field name: `file`). */
export const uploadDirectoryExcel = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname?.toLowerCase() ?? "";
    const ok =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      name.endsWith(".xlsx");
    if (ok) cb(null, true);
    else cb(new Error("Only .xlsx spreadsheets are allowed"));
  },
}).single("file");
