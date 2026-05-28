import { Router } from "express";
import { importAccountRow } from "../utils/accountImportRow";
import { z } from "zod";
import * as XLSX from "xlsx";
import { startOfWeek, endOfWeek } from "date-fns";
import { AccountModel } from "../models/account";
import { ApprovalRequestModel } from "../models/approvalRequest";
import { ContactActivityModel } from "../models/contactActivity";
import { LeadModel } from "../models/lead";
import { LeadActivityModel } from "../models/leadActivity";
import { CommunicationModel } from "../models/communication";
import { AccountNoteModel } from "../models/accountNote";
import { ActivityLogModel } from "../models/activityLog";
import { TaskModel } from "../models/task";
import { requireAuth, requirePermissions, requireAnyPermission, hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { uploadProperty as upload } from "../middleware/upload";

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

const accountSchema = z.object({
  // Step 1 & 2: Basic & Org Type
  name: z.string().min(1),
  organizationType: z.enum([
    "CORPORATE",
    "TRAVEL_AGENT",
    "EVENT_PLANNER",
    "WEDDING_PLANNER",
    "PCO",
    "AIRLINE",
    "GOVERNMENT",
    "EMBASSY_CONSULATE",
    "PSU",
    "CUSTOM",
    "EVENT_ORGANISER",
    "PROFESSIONAL_CONFERENCE_ORGANISER",
    "GOVERNMENT_BODIES",
    "EMBASSIES_AND_CONSULATES",
    "PUBLIC_SECTOR_UNIT",
  ]),
  customOrganizationType: z.string().optional(),
  customOrganizationTypes: z.array(z.string()).optional(),

  // Step 3: Conglomerate
  conglomerateId: z.string().optional().nullable(),
  conglomerateName: z.string().optional(),

  // Step 4 & 5: Hierarchy & HQ
  accountLevel: z.enum(["MASTER", "PARENT", "BRANCH", "SUBSIDIARY"]),
  profileStatus: z.union([z.enum(["ACTIVE", "NA"]), z.boolean()]).optional(),
  isHeadquarter: z.boolean().optional(),
  parentAccountId: z.string().optional().nullable(),
  hqAccountId: z.string().optional().nullable(),

  // Step 7: Account Type
  accountType: z.enum(["ACQUISITION", "DEVELOPMENT", "RETENTION"]).optional(),
  accountTypeOverride: z.boolean().optional(),

  // Step 8 & 13: Address & Identification
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  subCity: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  locality: z.string().optional(),
  gstin: z.string().regex(/^[0-9A-Z]{15}$|^[0-9]{13}$/).optional().or(z.literal("")), // Validates 13 digit or standard GSTIN
  panNumber: z.string().optional(),
  pmsProfileId: z.string().optional(),
  adr: z.number().optional().nullable(),

  // Account ↔ Property mapping (multi-property)
  propertyIds: z.array(z.string()).optional(),

  // Step 9: Sales Assignment
  primaryAccountManager: z.object({
    userId: z.string(),
    name: z.string(),
    city: z.string(),
  }).optional(),
  secondaryAccountManagers: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    city: z.string(),
  })).optional(),

  // Step 10 & 11: Industry
  industry: z.string().optional(),
  industrySubCategory: z.string().optional(),
  industryStatus: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),

  // Step 12: Contracting
  contractingTypes: z.array(z.object({
    type: z.enum(["LOCAL_CONTRACTING", "LOCAL_RFP", "GLOBAL_RFP", "ANNUAL_CONTRACT"]),
    year: z.number().optional(),
    fromYear: z.number().optional(),
    toYear: z.number().optional(),
    fromMonth: z.number().min(1).max(12),
    toMonth: z.number().min(1).max(12),
  }).refine((d) => d.toYear == null || d.fromYear == null || d.toYear >= d.fromYear, { message: "To year must be >= from year" })).optional(),

  // Contact & Legacy
  email: z.string().email().optional().or(z.literal("")),
  secondaryEmail: z.string().email().optional().or(z.literal("")),
  boardLine: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  marketSegment: z.string().optional(),
  creditAllowed: z.boolean().optional(),
  creditLimits: z.number().optional(),
  creditDays: z.number().optional(),
  billingInstruction: z.string().optional(),
  remarks: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "BLACKLISTED", "NA"]).optional(),

  followUpDate: z.coerce.date().optional().nullable(),
  followUpNote: z.string().optional(),
});

// POST /accounts/import — bulk import from Excel
accountsRouter.post(
  "/import",
  requireAuth,
  requirePermissions([PERMISSIONS.ACCOUNTS.CREATE]),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filename = (req.file.originalname || "").toLowerCase();
      const isCsv = filename.endsWith(".csv") || req.file.mimetype === "text/csv";
      const workbook = isCsv
        ? XLSX.read(req.file.buffer.toString("utf8"), { type: "string" })
        : XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

      let imported = 0;
      let skipped = 0;
      const errors: { row: number; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const result = await importAccountRow(rows[i], i + 2);
        if (result.ok) {
          imported++;
        } else {
          errors.push({ row: result.row, reason: result.reason });
          skipped++;
        }
      }

      res.json({ imported, skipped, errors });
    } catch (err) {
      next(err);
    }
  }
);

// Advanced Global Search
accountsRouter.get(
  "/search",
  requireAnyPermission(["accounts.read", "accounts.access"]),
  async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const accounts = await AccountModel.find({
      $or: [
        { name: { $regex: q as string, $options: "i" } },
        { gstin: { $regex: q as string, $options: "i" } },
        { panNumber: { $regex: q as string, $options: "i" } },
        { email: { $regex: q as string, $options: "i" } },
        { city: { $regex: q as string, $options: "i" } }
      ]
    }).limit(20).lean();

    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

accountsRouter.get("/check-hq", async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name || typeof name !== "string") {
      return res.json({ hasHq: false });
    }
    const existingHQ = await AccountModel.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      isHeadquarter: true
    }).lean();
    res.json({ hasHq: !!existingHQ });
  } catch (err) {
    next(err);
  }
});

accountsRouter.get(
  "/",
  requireAnyPermission(["accounts.read", "accounts.access"]),
  async (req, res, next) => {
  try {
    const { type, organizationTypes, city, accountType, accountLevel, myAccounts, tags, status, includeNa } = req.query;
    const filter: Record<string, unknown> = {};

    // Support multi-select organization types
    if (organizationTypes) {
      filter.organizationType = { $in: Array.isArray(organizationTypes) ? organizationTypes : [organizationTypes] };
    } else if (type) {
      filter.type = type;
    }

    if (city) filter.city = city;
    if (accountType) filter.accountType = accountType;
    if (accountLevel) filter.accountLevel = accountLevel;
    if (status && typeof status === "string") {
      filter.status = status;
    } else if (String(includeNa) !== "true") {
      // By default exclude NA accounts from the list
      filter.status = { $ne: "NA" };
    }
    if (tags) {
      const tagArr = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArr };
    }

    if (myAccounts === "true" && req.user) {
      filter.$or = [
        { "primaryAccountManager.userId": req.user.id },
        { "secondaryAccountManagers.userId": req.user.id }
      ];
    }

    const accounts = await AccountModel.find(filter).sort({ name: 1 }).lean();
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post(
  "/",
  requirePermissions([PERMISSIONS.ACCOUNTS.CREATE]),
  async (req, res, next) => {
    try {
      if (!req.user?.isAdmin) {
        return next(forbidden("Only admins can create accounts"));
      }
      const parsed = accountSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Validation error:", parsed.error);
        throw badRequest("Invalid account payload");
      }

      const data = parsed.data;

      const normalizedProfileStatus =
        data.profileStatus === "NA" || data.profileStatus === false ? "NA" : "ACTIVE";

      // Hierarchy validation
      if (data.parentAccountId) {
        const parent = await AccountModel.findById(data.parentAccountId);
        if (!parent) {
          throw badRequest("Parent account does not exist");
        }
      }

      // HQ Uniqueness Check (simplification: only one HQ per account name root)
      if (data.isHeadquarter) {
        const existingHQ = await AccountModel.findOne({
          name: { $regex: new RegExp(`^${data.name}$`, "i") },
          isHeadquarter: true,
        });
        if (existingHQ) {
          throw badRequest(`A Headquarter already exists for ${data.name}.`);
        }
      }

      // Duplicate Check
      const existingNameMatch = await AccountModel.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') }
      });

      if (existingNameMatch) {
        await ApprovalRequestModel.create({
          entityType: "ACCOUNT",
          entityName: data.name,
          payload: data,
          status: "PENDING",
          submittedBy: req.user?.id,
        });
        return res.status(409).json({
          message: `An account with the name "${data.name}" already exists. Your request has been submitted for Admin approval.`,
          pendingApproval: true
        });
      }

      // Normalize manager userIds: empty string cannot be cast to ObjectId; omit when blank
      const createPayload: Record<string, unknown> = {
        ...data,
        parentAccountId: data.parentAccountId || null,
        hqAccountId: data.hqAccountId || null,
        type: data.organizationType as any,
        profileStatus: normalizedProfileStatus,
        isHeadquarter: data.isHeadquarter ?? false,
        industryCategory: data.industry,
        industrySize: data.industryStatus,
      };
      if (data.primaryAccountManager) {
        const pam = data.primaryAccountManager;
        createPayload.primaryAccountManager = {
          name: pam.name,
          city: pam.city,
          ...(pam.userId?.trim() && { userId: pam.userId.trim() }),
        };
      }
      if (data.secondaryAccountManagers?.length) {
        createPayload.secondaryAccountManagers = data.secondaryAccountManagers.map((m) => ({
          name: m.name,
          city: m.city,
          ...(m.userId?.trim() && { userId: m.userId.trim() }),
        }));
      }

      const account = await AccountModel.create(createPayload);
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }
);


accountsRouter.patch(
  "/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const canUpdate = hasPermission(req.user, "accounts.update");
      if (!canUpdate) {
        return next(forbidden("Insufficient permissions to update account"));
      }

      const parsed = accountSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid account update payload");
      }

      const data = parsed.data;

      // Full update allowed, but ownership fields are restricted unless the user can assign managers.
      const canAssignManagers = hasPermission(req.user, "accounts.assign_managers");
      const updateData: Record<string, unknown> = { ...data };

      if (!canAssignManagers) {
        delete (updateData as any).primaryAccountManager;
        delete (updateData as any).secondaryAccountManagers;
      }

      // Validate parentAccountId if provided
      if (data.parentAccountId !== undefined) {
        if (data.parentAccountId === req.params.id) {
          throw badRequest("Account cannot be its own parent");
        }

        if (data.parentAccountId) {
          const parent = await AccountModel.findById(data.parentAccountId);
          if (!parent) {
            throw badRequest("Parent account does not exist");
          }

          const checkCircularReference = async (accountId: string, targetParentId: string): Promise<boolean> => {
            const account = await AccountModel.findById(accountId);
            if (!account || !account.parentAccountId) {
              return false;
            }
            if (account.parentAccountId.toString() === targetParentId) {
              return true;
            }
            return checkCircularReference(account.parentAccountId.toString(), targetParentId);
          };

          const isCircular = await checkCircularReference(data.parentAccountId, req.params.id);
          if (isCircular) {
            throw badRequest("Circular reference detected: cannot set parent that would create a cycle");
          }
        }
      }

      if (data.parentAccountId === null || data.parentAccountId === "") {
        updateData.parentAccountId = null;
      }

      if (data.profileStatus !== undefined) {
        updateData.profileStatus =
          data.profileStatus === "NA" || data.profileStatus === false ? "NA" : "ACTIVE";
      }

      if (data.isHeadquarter !== undefined) {
        updateData.isHeadquarter = data.isHeadquarter;
      }
      if (data.industry !== undefined) {
        updateData.industryCategory = data.industry;
      }
      if (data.industryStatus !== undefined) {
        updateData.industrySize = data.industryStatus;
      }

      const account = await AccountModel.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true }
      ).lean();
      if (!account) {
        throw notFound("Account not found");
      }
      res.json(account);
    } catch (err) {
      next(err);
    }
  }
);

// Get all root accounts (accounts without parents)
// NOTE: This route must come before /:id to avoid route conflicts
accountsRouter.get("/roots", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.view_hierarchy")) {
      throw forbidden("Insufficient permissions to view account hierarchy");
    }

    const rootAccounts = await AccountModel.find({
      parentAccountId: null
    }).lean();
    res.json(rootAccounts);
  } catch (err) {
    next(err);
  }
});

// Week planner payload for current salesperson
accountsRouter.get("/week-planner", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const from = req.query.from
      ? new Date(req.query.from as string)
      : startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = req.query.to
      ? new Date(req.query.to as string)
      : endOfWeek(new Date(), { weekStartsOn: 1 });

    const myAccounts = await AccountModel.find({
      $or: [
        { "primaryAccountManager.userId": userId },
        { "secondaryAccountManagers.userId": userId },
      ],
      profileStatus: "ACTIVE",
    })
      .select("_id name followUpDate followUpNote")
      .lean();

    const accountIds = myAccounts.map((a: any) => a._id);

    const activities = await ContactActivityModel.find({
      accountId: { $in: accountIds },
      startsAt: { $gte: from, $lte: to },
    })
      .populate("contactId", "name")
      .populate("accountId", "name")
      .lean();

    const tasks = await TaskModel.find({
      ownerUserId: userId,
      dueAt: { $gte: from, $lte: to },
      status: { $ne: "CANCELLED" },
      accountId: { $in: accountIds },
    })
      .populate("accountId", "name")
      .lean();

    const followUps = myAccounts.filter((a: any) => {
      if (!a.followUpDate) return false;
      const d = new Date(a.followUpDate);
      return d >= from && d <= to;
    });

    res.json({
      accounts: myAccounts,
      activities,
      tasks,
      followUps,
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

// Get unified timeline for account (contact activities, lead activities, communications, notes)
accountsRouter.get("/:id/timeline", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_activities")) {
      throw forbidden("Insufficient permissions to view account timeline");
    }

    const accountId = req.params.id;
    const account = await AccountModel.findById(accountId).lean();
    if (!account) {
      throw notFound("Account not found");
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

    // 1. Contact activities
    const contactActivities = await ContactActivityModel.find({ accountId })
      .sort({ performedAt: -1 })
      .limit(limit)
      .populate("contactId", "name")
      .populate("performedByUserId", "name email")
      .lean();

    // 2. Leads for this account
    const accountLeadIds = await LeadModel.find({ accountId }).select("_id").lean();
    const leadIds = accountLeadIds.map((l) => l._id);

    // 3. Lead activities for those leads
    let leadActivities: any[] = [];
    if (leadIds.length > 0) {
      leadActivities = await LeadActivityModel.find({ leadId: { $in: leadIds } })
        .sort({ performedAt: -1 })
        .limit(limit)
        .populate("performedByUserId", "name email")
        .lean();
    }

    // 4. Communications for those leads
    let communications: any[] = [];
    if (leadIds.length > 0) {
      communications = await CommunicationModel.find({ leadId: { $in: leadIds } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("performedByUserId", "name email")
        .lean();
    }

    // 5. Account notes
    const notes = await AccountNoteModel.find({ accountId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("createdByUserId", "name email")
      .lean();

    type TimelineItem = {
      id: string;
      source: "contact_activity" | "lead_activity" | "communication" | "note";
      date: Date;
      summary?: string;
      detail?: any;
    };

    const items: TimelineItem[] = [];

    for (const a of contactActivities) {
      items.push({
        id: (a as any)._id.toString(),
        source: "contact_activity",
        date: (a as any).performedAt,
        summary: `${(a as any).activityType?.replace(/_/g, " ")}${(a as any).contactId?.name ? ` · ${(a as any).contactId.name}` : ""}`,
        detail: a,
      });
    }
    for (const a of leadActivities) {
      items.push({
        id: (a as any)._id.toString(),
        source: "lead_activity",
        date: (a as any).performedAt,
        summary: (a as any).type?.replace(/_/g, " ") || "Activity",
        detail: a,
      });
    }
    for (const c of communications) {
      items.push({
        id: (c as any)._id.toString(),
        source: "communication",
        date: (c as any).createdAt,
        summary: `${(c as any).channel} · ${(c as any).direction}`,
        detail: c,
      });
    }
    for (const n of notes) {
      items.push({
        id: (n as any)._id.toString(),
        source: "note",
        date: (n as any).createdAt,
        summary: (n as any).content?.substring(0, 80) || "Note",
        detail: n,
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const sliced = items.slice(0, limit);
    res.json(sliced);
  } catch (err) {
    next(err);
  }
});

// Get a single account by ID
accountsRouter.get(
  "/:id",
  requireAnyPermission(["accounts.read", "accounts.access"]),
  async (req, res, next) => {
  try {
    const account = await AccountModel.findById(req.params.id).lean();
    if (!account) {
      throw notFound("Account not found");
    }
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// Get direct children of a specific account
accountsRouter.get("/:id/children", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.view_hierarchy")) {
      throw forbidden("Insufficient permissions to view account hierarchy");
    }

    const account = await AccountModel.findById(req.params.id).lean();
    if (!account) {
      throw notFound("Account not found");
    }

    const children = await AccountModel.find({
      parentAccountId: req.params.id
    }).lean();
    res.json(children);
  } catch (err) {
    next(err);
  }
});

// Get all descendants (children, grandchildren, etc.) of a specific account
accountsRouter.get("/:id/descendants", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.view_hierarchy")) {
      throw forbidden("Insufficient permissions to view account hierarchy");
    }

    const account = await AccountModel.findById(req.params.id).lean();
    if (!account) {
      throw notFound("Account not found");
    }

    const getAllDescendants = async (parentId: string): Promise<any[]> => {
      const directChildren = await AccountModel.find({
        parentAccountId: parentId
      }).lean();

      const allDescendants = [...directChildren];

      for (const child of directChildren) {
        const grandchildren = await getAllDescendants(child._id.toString());
        allDescendants.push(...grandchildren);
      }

      return allDescendants;
    };

    const descendants = await getAllDescendants(req.params.id);
    res.json(descendants);
  } catch (err) {
    next(err);
  }
});

// Get full hierarchy tree structure (nested children)
accountsRouter.get("/:id/hierarchy", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.view_hierarchy")) {
      throw forbidden("Insufficient permissions to view account hierarchy");
    }

    const buildTree = async (accountId: string): Promise<any> => {
      const account = await AccountModel.findById(accountId).lean();
      if (!account) {
        return null;
      }

      const children = await AccountModel.find({
        parentAccountId: accountId
      }).lean();

      const childrenWithSubtree = await Promise.all(
        children.map(child => buildTree(child._id.toString()))
      );

      return {
        ...account,
        children: childrenWithSubtree.filter(Boolean),
      };
    };

    const tree = await buildTree(req.params.id);
    if (!tree) {
      throw notFound("Account not found");
    }
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

// Get parent chain (all ancestors) of a specific account
accountsRouter.get("/:id/parents", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.view_hierarchy")) {
      throw forbidden("Insufficient permissions to view account hierarchy");
    }

    const account = await AccountModel.findById(req.params.id).lean();
    if (!account) {
      throw notFound("Account not found");
    }

    const getParentChain = async (accountId: string): Promise<any[]> => {
      const account = await AccountModel.findById(accountId).lean();
      if (!account || !account.parentAccountId) {
        return [];
      }

      const parent = await AccountModel.findById(account.parentAccountId).lean();
      if (!parent) {
        return [];
      }

      const ancestors = await getParentChain(parent._id.toString());
      return [parent, ...ancestors];
    };

    const parents = await getParentChain(req.params.id);
    res.json(parents);
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete(
  "/:id",
  requirePermissions([PERMISSIONS.ACCOUNTS.DELETE]),
  async (req, res, next) => {
    try {
      // Only SYSTEM_ADMIN can hard delete; others must use NA status
      if (!req.user?.isSystemAdmin) {
        return next(forbidden(
          "Only System Administrators can delete accounts. Use NA status instead."
        ));
      }

      // Check if account has children
      const childrenCount = await AccountModel.countDocuments({
        parentAccountId: req.params.id
      });

      if (childrenCount > 0) {
        throw badRequest(
          `Cannot delete account: it has ${childrenCount} child account(s). Please delete or reassign child accounts first.`
        );
      }

      const account = await AccountModel.findById(req.params.id).lean();
      if (!account) {
        throw notFound("Account not found");
      }

      const accountName = (account as any).name;
      await AccountModel.findByIdAndDelete(req.params.id);

      // Audit log: who deleted, when, accountName
      await ActivityLogModel.create({
        type: "ACCOUNT",
        entityId: req.params.id,
        userId: req.user.id,
        action: "DELETE",
        metadata: {
          accountName,
          deletedBy: req.user.id,
          deletedAt: new Date().toISOString(),
        },
      });

      res.json({ message: "Account deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);



