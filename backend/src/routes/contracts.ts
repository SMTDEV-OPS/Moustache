import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../utils/httpError";
import { ContractModel } from "../models/contract";
import { ContactModel } from "../models/contact";
import { AccountModel } from "../models/account";
import { getPrimaryEmailAccount, sendEmail } from "../services/emailService";
import { buildApprovalChain } from "../services/contractApprovalService";
import { createNotification } from "../services/notificationService";
import { importContractSpreadsheet } from "../utils/contractRateImport";

export const contractsRouter = Router();

contractsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const pricingRowSchema = z.object({
  roomCategory: z.string().min(1),
  rate: z.number(),
  inclusions: z.string().optional(),
  rn: z.number().optional(),
  remarks: z.string().optional(),
});

const contractCreateSchema = z.object({
  accountId: z.string().min(1),
  propertyIds: z.array(z.string()).default([]),
  companyName: z.string().min(1),
  contactId: z.string().optional(),
  contactEmail: z.string().email().optional(),
  channel: z.enum(["B2B", "B2C"]),
  pricingGrid: z.array(pricingRowSchema).optional(),
});

contractsRouter.get("/", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.read")) {
      throw forbidden("Insufficient permissions to view contracts");
    }
    const { accountId } = req.query;
    const filter: Record<string, unknown> = {};
    if (accountId && typeof accountId === "string") filter.accountId = accountId;
    const list = await ContractModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

contractsRouter.post("/", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage")) {
      throw forbidden("Insufficient permissions to create contracts");
    }
    const parsed = contractCreateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid contract payload");

    const account = await AccountModel.findById(parsed.data.accountId)
      .select("accountType organizationType")
      .lean();

    let contactEmail = parsed.data.contactEmail;
    if (!contactEmail && parsed.data.contactId) {
      const c = await ContactModel.findById(parsed.data.contactId).lean();
      contactEmail = (c as any)?.email;
    }

    const chain = await buildApprovalChain(
      {
        propertyIds: parsed.data.propertyIds,
        channel: parsed.data.channel,
        accountType: (account as any)?.accountType,
        organisationType: (account as any)?.organizationType,
      },
      req.user!.id
    );

    const approvals = chain.map((step) => ({
      step: step.step,
      approverUserId: step.approverUserId,
      approverName: step.approverName,
      label: step.label,
      status: "PENDING" as const,
    }));

    const contractStatus = approvals.length === 0 ? "APPROVED" : "PENDING_APPROVAL";

    const contract = await ContractModel.create({
      ...parsed.data,
      contactEmail,
      submittedByUserId: req.user?.id,
      status: contractStatus,
      approvals,
    });

    if (chain.length > 0) {
      await createNotification({
        userId: chain[0].approverUserId,
        type: "GENERAL" as any,
        title: "Contract Approval Required",
        message: `A new contract for ${parsed.data.companyName} requires your approval.`,
        metadata: { contractId: contract._id.toString(), step: 1 },
      });
    }

    // Send contract email to selected contact if email service is configured
    if (contactEmail && req.user?.id) {
      try {
        const primary = await getPrimaryEmailAccount(req.user.id);
        if (primary) {
          await sendEmail(primary._id.toString(), {
            to: [{ email: contactEmail }],
            subject: `Contract for ${parsed.data.companyName} (${parsed.data.channel})`,
            bodyText: `Dear Partner,\n\nPlease find your contract details in the CRM.\n\nCompany: ${parsed.data.companyName}\nChannel: ${parsed.data.channel}\n\nRegards,\nThe Sales Team`,
          });
        }
      } catch (emailErr) {
        // Email failure should not block contract creation
        console.warn("Contract email notification failed", emailErr);
      }
    }

    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
});

contractsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage")) {
      throw forbidden("Insufficient permissions to approve contracts");
    }
    const schema = z.object({ note: z.string().optional() });
    const { note } = schema.parse(req.body);

    const contract = await ContractModel.findById(req.params.id);
    if (!contract) throw notFound("Contract not found");

    const approvals = (contract as any).approvals as any[];
    const currentStep = approvals.find(
      (a) => a.status === "PENDING" && a.approverUserId?.toString() === req.user!.id
    );
    if (!currentStep) {
      throw forbidden("You are not the current approver for this contract");
    }

    currentStep.status = "APPROVED";
    currentStep.actedAt = new Date();
    currentStep.note = note;

    const nextStep = approvals
      .filter((a) => a.status === "PENDING")
      .sort((a, b) => a.step - b.step)[0];

    if (nextStep) {
      contract.status = "PENDING_APPROVAL";
      await createNotification({
        userId: nextStep.approverUserId.toString(),
        type: "GENERAL" as any,
        title: "Contract Approval Required",
        message: `A contract for step ${nextStep.step} requires your approval.`,
        metadata: { contractId: contract._id.toString(), step: nextStep.step },
      });
    } else {
      contract.status = "APPROVED";
      if ((contract as any).submittedByUserId) {
        await createNotification({
          userId: (contract as any).submittedByUserId.toString(),
          type: "GENERAL" as any,
          title: "Contract Approved",
          message: "Your contract has been fully approved.",
          metadata: { contractId: contract._id.toString() },
        });
      }
    }

    await contract.save();
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

const rateGridUpdateSchema = z.object({
  rateGrid: z
    .object({
      b2b: z.object({
        rows: z.array(
          z.object({
            id: z.string(),
            roomType: z.string(),
            rateSlab: z.string(),
            single: z.number(),
            double: z.number(),
            triple: z.number(),
            rn: z.number(),
            inclusions: z.array(z.string()),
            remarks: z.string(),
          })
        ),
        inclusionNomenclature: z
          .array(z.object({ code: z.string(), fullName: z.string() }))
          .optional(),
        additionalRemarks: z.string().optional(),
      }),
      b2c: z.object({
        rows: z.array(
          z.object({
            id: z.string(),
            roomType: z.string(),
            rateSlab: z.string(),
            single: z.number(),
            double: z.number(),
            triple: z.number(),
            rn: z.number(),
            inclusions: z.array(z.string()),
            remarks: z.string(),
          })
        ),
        inclusionNomenclature: z
          .array(z.object({ code: z.string(), fullName: z.string() }))
          .optional(),
        additionalRemarks: z.string().optional(),
      }),
      inclusionNomenclature: z
        .array(z.object({ code: z.string(), fullName: z.string() }))
        .optional(),
      additionalRemarks: z.string().optional(),
    })
    .optional(),
});

contractsRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage")) {
      throw forbidden("Insufficient permissions to update contracts");
    }
    const parsed = rateGridUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid update payload");

    const contract = await ContractModel.findById(req.params.id);
    if (!contract) throw notFound("Contract not found");

    if (parsed.data.rateGrid) {
      (contract as any).rateGrid = parsed.data.rateGrid;
    }
    await contract.save();
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

contractsRouter.post("/:id/reject", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage")) {
      throw forbidden("Insufficient permissions to reject contracts");
    }
    const schema = z.object({ note: z.string().min(1, "Rejection reason is required") });
    const { note } = schema.parse(req.body);

    const contract = await ContractModel.findById(req.params.id);
    if (!contract) throw notFound("Contract not found");

    const approvals = (contract as any).approvals as any[];
    const currentStep = approvals.find(
      (a) => a.status === "PENDING" && a.approverUserId?.toString() === req.user!.id
    );
    if (!currentStep) {
      throw forbidden("You are not the current approver for this contract");
    }

    currentStep.status = "REJECTED";
    currentStep.actedAt = new Date();
    currentStep.note = note;
    contract.status = "REJECTED";
    await contract.save();

    if ((contract as any).submittedByUserId) {
      await createNotification({
        userId: (contract as any).submittedByUserId.toString(),
        type: "GENERAL" as any,
        title: "Contract Rejected",
        message: `Your contract was rejected. Reason: ${note}`,
        metadata: { contractId: contract._id.toString(), reason: note },
      });
    }

    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// Upload rate grid from Excel/CSV (.xlsx, .xls, .csv)
contractsRouter.post(
  "/:id/upload-excel",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!hasPermission(req.user, "accounts.manage")) {
        throw forbidden("Insufficient permissions to upload pricing grid");
      }
      const contract = await ContractModel.findById(req.params.id);
      if (!contract) throw notFound("Contract not found");
      if (!req.file) throw badRequest("file is required");

      const isCsv = req.file.originalname.toLowerCase().endsWith(".csv");
      const wb = isCsv
        ? XLSX.read(req.file.buffer.toString("utf-8"), { type: "string", raw: false })
        : XLSX.read(req.file.buffer, { type: "buffer", raw: false });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw badRequest("Spreadsheet has no sheets");
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

      const result = importContractSpreadsheet(rows);
      if (result.format === "error") {
        throw badRequest(result.message);
      }
      if (result.format === "rateGrid") {
        (contract as any).rateGrid = result.rateGrid;
      } else {
        (contract as any).pricingGrid = result.pricingGrid;
      }
      await contract.save();
      res.json(contract);
    } catch (err) {
      next(err);
    }
  }
);
