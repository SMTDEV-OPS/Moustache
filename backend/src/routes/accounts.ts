import { Router } from "express";
import { z } from "zod";
import { AccountModel } from "../models/account";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { badRequest, notFound } from "../utils/httpError";

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

const accountSchema = z.object({
  // Step 1 & 2: Basic & Org Type
  name: z.string().min(1),
  organizationType: z.enum(["CORPORATE", "TRAVEL_AGENT", "EVENT_PLANNER", "PCO", "AIRLINE", "GOVERNMENT", "EMBASSY_CONSULATE", "PSU", "CUSTOM"]),
  customOrganizationType: z.string().optional(),

  // Step 3: Conglomerate
  conglomerateId: z.string().optional().nullable(),
  conglomerateName: z.string().optional(),

  // Step 4 & 5: Hierarchy & HQ
  accountLevel: z.enum(["MASTER", "PARENT", "BRANCH", "SUBSIDIARY"]),
  isHeadquarter: z.boolean(),
  headquarterName: z.string().optional(),
  parentAccountId: z.string().optional().nullable(),

  // Step 7: Account Type
  accountType: z.enum(["ACQUISITION", "DEVELOPMENT", "RETENTION"]).optional(),
  accountTypeOverride: z.enum(["ACQUISITION", "DEVELOPMENT", "RETENTION"]).optional(),

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
  industryCategory: z.string().optional(),
  industrySubCategory: z.string().optional(),
  industrySize: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),

  // Step 12: Contracting
  contractingTypes: z.array(z.object({
    type: z.enum(["LOCAL_CONTRACTING", "LOCAL_RFP", "GLOBAL_RFP", "ANNUAL_CONTRACT"]),
    fromMonth: z.number().min(1).max(12),
    toMonth: z.number().min(1).max(12),
  })).optional(),

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
});

// Advanced Global Search
accountsRouter.get("/search", async (req, res, next) => {
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

accountsRouter.get("/", requirePermissions([PERMISSIONS.ACCOUNTS.READ]), async (req, res, next) => {
  try {
    const { type, organizationTypes, city, accountType, accountLevel } = req.query;
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

    const accounts = await AccountModel.find(filter).sort({ name: 1 }).lean();
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post(
  "/",
  requirePermissions([PERMISSIONS.ACCOUNTS.MANAGE]),
  async (req, res, next) => {
    try {
      const parsed = accountSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Validation error:", parsed.error);
        throw badRequest("Invalid account payload");
      }

      const data = parsed.data;

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
          name: data.name,
          isHeadquarter: true
        });
        if (existingHQ) {
          throw badRequest(`A Headquarter already exists for ${data.name}.`);
        }
      }

      const account = await AccountModel.create({
        ...data,
        parentAccountId: data.parentAccountId || null,
        // Map legacy type if needed
        type: data.organizationType as any
      });
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }
);


accountsRouter.patch(
  "/:id",
  requirePermissions([PERMISSIONS.ACCOUNTS.MANAGE]),
  async (req, res, next) => {
    try {
      const parsed = accountSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid account update payload");
      }

      const data = parsed.data;

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

          // Check for circular reference
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

      const updateData: Record<string, unknown> = { ...data };
      if (data.parentAccountId === null || data.parentAccountId === "") {
        updateData.parentAccountId = null;
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
    const rootAccounts = await AccountModel.find({
      parentAccountId: null
    }).lean();
    res.json(rootAccounts);
  } catch (err) {
    next(err);
  }
});

// Get a single account by ID
accountsRouter.get("/:id", async (req, res, next) => {
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
  requirePermissions([PERMISSIONS.ACCOUNTS.MANAGE]),
  async (req, res, next) => {
    try {
      // Check if account has children
      const childrenCount = await AccountModel.countDocuments({
        parentAccountId: req.params.id
      });

      if (childrenCount > 0) {
        throw badRequest(
          `Cannot delete account: it has ${childrenCount} child account(s). Please delete or reassign child accounts first.`
        );
      }

      const account = await AccountModel.findByIdAndDelete(req.params.id).lean();
      if (!account) {
        throw notFound("Account not found");
      }
      res.json({ message: "Account deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);



