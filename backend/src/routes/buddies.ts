import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { UserModel } from "../models/user";
import { UserBuddyAssignmentModel } from "../models/userBuddyAssignment";
import { LeadModel } from "../models/lead";
import { badRequest, notFound } from "../utils/httpError";
import { notifyBuddyAssigned, notifyBuddyCancelled } from "../services/notificationService";
import { logger } from "../config/logger";
import { Types } from "mongoose";

export const buddiesRouter = Router();

buddiesRouter.use(requireAuth);

const buddySchema = z.object({
  buddyUserId: z.string(),
  effectiveFrom: z.string().transform((str) => new Date(str)),
  effectiveTo: z.string().transform((str) => new Date(str)).optional(),
  reason: z.string().optional(),
});

// POST /buddy - Assign buddy for the current user
buddiesRouter.post(
  "/buddy",
  requirePermissions(["buddies.assign"]),
  async (req, res, next) => {
    try {
      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const parsed = buddySchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid buddy payload");
      }

      const user = await UserModel.findById(req.user.id);
      const buddy = await UserModel.findById(parsed.data.buddyUserId);
      if (!user || !buddy) {
        throw notFound("User or buddy not found");
      }

      // Validate date range
      const effectiveFrom = parsed.data.effectiveFrom;
      const effectiveTo = parsed.data.effectiveTo;
      
      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw badRequest("End date must be after start date");
      }

      // Update user's current buddy reference
      user.buddyUserId = buddy._id;
      await user.save();

      // Create buddy assignment record
      const assignment = await UserBuddyAssignmentModel.create({
        userId: user._id,
        buddyUserId: buddy._id,
        effectiveFrom: effectiveFrom,
        effectiveTo: effectiveTo,
        reason: parsed.data.reason,
        createdByUserId: req.user?.id,
      });

      // Send notification to the buddy
      try {
        await notifyBuddyAssigned(
          buddy._id,
          req.user.id,
          user.name,
          effectiveFrom,
          effectiveTo,
          parsed.data.reason
        );
        logger.info("[Buddy Assignment] Notification sent to buddy", {
          userId: user._id.toString(),
          userName: user.name,
          buddyId: buddy._id.toString(),
          buddyName: buddy.name,
        });
      } catch (error) {
        logger.error("[Buddy Assignment] Failed to send notification to buddy", {
          userId: user._id.toString(),
          buddyId: buddy._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't fail the request if notification fails
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /buddies/history - Get buddy history for the current user
buddiesRouter.get("/history", requirePermissions(["buddies.view.history"]), async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw badRequest("User not authenticated");
    }

    const assignments = await UserBuddyAssignmentModel.find({
      userId: req.user.id,
    })
      .populate("buddyUserId", "name email")
      .populate("createdByUserId", "name email")
      .sort({ effectiveFrom: -1 })
      .lean();

    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// GET /buddies/active - Get active buddy assignment for the current user
buddiesRouter.get("/active", requirePermissions(["buddies.view.history"]), async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw badRequest("User not authenticated");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeAssignment = await UserBuddyAssignmentModel.findOne({
      userId: req.user.id,
      effectiveFrom: { $lte: today },
      $or: [
        { effectiveTo: { $gte: today } },
        { effectiveTo: null },
      ],
    })
      .populate("buddyUserId", "name email")
      .lean();

    res.json(activeAssignment || null);
  } catch (err) {
    next(err);
  }
});

// GET /buddies/all - Get all buddy assignments
buddiesRouter.get("/all", requirePermissions(["buddies.view.history"]), async (req, res, next) => {
  try {
    const assignments = await UserBuddyAssignmentModel.find({})
      .populate("userId", "name email teamType")
      .populate("buddyUserId", "name email teamType")
      .populate("createdByUserId", "name email")
      .sort({ effectiveFrom: -1 })
      .lean();

    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// GET /buddies/report?fromDate=&toDate= - Get buddy report for the current user
buddiesRouter.get("/report", requirePermissions(["buddies.view.reports"]), async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw badRequest("User not authenticated");
    }

    const { fromDate, toDate } = req.query;
    const userId = req.user.id;

    const from = fromDate ? new Date(String(fromDate)) : undefined;
    const to = toDate ? new Date(String(toDate)) : undefined;

    // Find buddy assignments for this user in the date range
    const assignmentQuery: any = { userId };
    if (from || to) {
      assignmentQuery.$or = [];
      if (from) {
        assignmentQuery.$or.push({ effectiveTo: { $gte: from } });
        assignmentQuery.$or.push({ effectiveTo: null });
      }
      if (to) {
        assignmentQuery.$or.push({ effectiveFrom: { $lte: to } });
      }
    }

    const assignments = await UserBuddyAssignmentModel.find(assignmentQuery).lean();
    const buddyIds = assignments.map((a) => a.buddyUserId);

    // Count leads assigned to buddies during these periods
    const leadQuery: any = {
      assignedToUserId: { $in: buddyIds },
    };

    if (from) {
      leadQuery.leadAssignedAt = { $gte: from };
    }
    if (to) {
      leadQuery.leadAssignedAt = { ...leadQuery.leadAssignedAt, $lte: to };
    }

    const assignedToBuddies = await LeadModel.countDocuments(leadQuery);

    // Count leads received as buddy (where this user is the buddy)
    const receivedQuery: any = {
      assignedToUserId: userId,
    };

    if (from) {
      receivedQuery.leadAssignedAt = { $gte: from };
    }
    if (to) {
      receivedQuery.leadAssignedAt = { ...receivedQuery.leadAssignedAt, $lte: to };
    }

    const receivedAsBuddy = await LeadModel.countDocuments(receivedQuery);

    res.json({
      userId,
      fromDate: from,
      toDate: to,
      assignmentsCount: assignments.length,
      assignedToBuddies,
      receivedAsBuddy,
      assignments: assignments.map((a) => ({
        buddyUserId: a.buddyUserId,
        effectiveFrom: a.effectiveFrom,
        effectiveTo: a.effectiveTo,
        reason: a.reason,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /buddies/assignment/:id - Cancel a specific buddy assignment
buddiesRouter.delete(
  "/assignment/:id",
  requirePermissions(["buddies.assign"]),
  async (req, res, next) => {
    try {
      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const assignmentId = req.params.id;
      if (!Types.ObjectId.isValid(assignmentId)) {
        throw badRequest("Invalid assignment ID");
      }

      const assignment = await UserBuddyAssignmentModel.findById(assignmentId)
        .populate("buddyUserId", "name email")
        .exec();

      if (!assignment) {
        throw notFound("Buddy assignment not found");
      }

      // Verify the assignment belongs to the current user
      // Handle both populated and non-populated userId
      const assignmentUserId = assignment.userId instanceof Types.ObjectId
        ? assignment.userId.toString()
        : (assignment.userId as any)?._id?.toString() || assignment.userId.toString();
      const currentUserId = req.user.id.toString();

      logger.info("[Buddy Cancellation] Ownership check", {
        assignmentId: assignmentId,
        assignmentUserId,
        currentUserId,
        match: assignmentUserId === currentUserId,
      });

      if (assignmentUserId !== currentUserId) {
        throw badRequest("You can only cancel your own buddy assignments");
      }

      const user = await UserModel.findById(req.user.id);
      if (!user) {
        throw notFound("User not found");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if this assignment is currently active
      const isActive = assignment.effectiveFrom <= today && 
        (!assignment.effectiveTo || assignment.effectiveTo >= today);

      // Deactivate the assignment
      assignment.effectiveTo = yesterday;
      await assignment.save();

      // If this was the active assignment, clear buddy reference from user model
      if (isActive) {
        // Check if there are any other active assignments
        const otherActiveAssignments = await UserBuddyAssignmentModel.countDocuments({
          userId: req.user.id,
          _id: { $ne: assignment._id },
          effectiveFrom: { $lte: today },
          $or: [
            { effectiveTo: { $gte: today } },
            { effectiveTo: null },
          ],
        });

        // Only clear buddy reference if no other active assignments exist
        if (otherActiveAssignments === 0) {
          user.buddyUserId = undefined;
          await user.save();
        }
      }

      // Send notification to buddy if assignment was active
      if (isActive) {
        const buddy = assignment.buddyUserId as any;
        if (buddy && buddy._id) {
          try {
            await notifyBuddyCancelled(
              buddy._id,
              req.user.id,
              user.name
            );
            logger.info("[Buddy Cancellation] Notification sent to buddy", {
              userId: user._id.toString(),
              userName: user.name,
              buddyId: buddy._id.toString(),
              buddyName: buddy.name,
              assignmentId: assignment._id.toString(),
            });
          } catch (error) {
            logger.error("[Buddy Cancellation] Failed to send notification to buddy", {
              userId: user._id.toString(),
              buddyId: buddy._id.toString(),
              assignmentId: assignment._id.toString(),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      logger.info("[Buddy Cancellation] Assignment cancelled", {
        userId: user._id.toString(),
        userName: user.name,
        assignmentId: assignment._id.toString(),
        wasActive: isActive,
      });

      res.json({ 
        ok: true, 
        message: "Buddy assignment cancelled successfully",
        assignment: {
          id: assignment._id.toString(),
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo,
          wasActive: isActive,
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /buddies/assignment/:id - Update a specific buddy assignment
buddiesRouter.patch(
  "/assignment/:id",
  requirePermissions(["buddies.assign"]),
  async (req, res, next) => {
    try {
      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const assignmentId = req.params.id;
      if (!Types.ObjectId.isValid(assignmentId)) {
        throw badRequest("Invalid assignment ID");
      }

      const updateSchema = z.object({
        effectiveFrom: z.string().transform((str) => new Date(str)).optional(),
        effectiveTo: z.string().transform((str) => new Date(str)).optional().nullable(),
        reason: z.string().optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid update payload");
      }

      const assignment = await UserBuddyAssignmentModel.findById(assignmentId)
        .populate("buddyUserId", "name email")
        .exec();

      if (!assignment) {
        throw notFound("Buddy assignment not found");
      }

      // Verify the assignment belongs to the current user
      // Handle both populated and non-populated userId
      const assignmentUserId = assignment.userId instanceof Types.ObjectId
        ? assignment.userId.toString()
        : (assignment.userId as any)?._id?.toString() || assignment.userId.toString();
      const currentUserId = req.user.id.toString();

      logger.info("[Buddy Update] Ownership check", {
        assignmentId: assignmentId,
        assignmentUserId,
        currentUserId,
        match: assignmentUserId === currentUserId,
      });

      if (assignmentUserId !== currentUserId) {
        throw badRequest("You can only update your own buddy assignments");
      }

      // Update fields
      if (parsed.data.effectiveFrom !== undefined) {
        assignment.effectiveFrom = parsed.data.effectiveFrom;
      }
      if (parsed.data.effectiveTo !== undefined) {
        assignment.effectiveTo = parsed.data.effectiveTo || undefined;
      }
      if (parsed.data.reason !== undefined) {
        assignment.reason = parsed.data.reason;
      }

      // Validate date range
      const effectiveFrom = assignment.effectiveFrom;
      const effectiveTo = assignment.effectiveTo;
      
      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw badRequest("End date must be after start date");
      }

      await assignment.save();

      logger.info("[Buddy Update] Assignment updated", {
        userId: req.user.id.toString(),
        assignmentId: assignment._id.toString(),
        updates: parsed.data,
      });

      res.json({ 
        ok: true, 
        message: "Buddy assignment updated successfully",
        assignment: {
          id: assignment._id.toString(),
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo,
          reason: assignment.reason,
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /buddies/active - Cancel/deactivate active buddy assignment for the current user
buddiesRouter.delete(
  "/active",
  requirePermissions(["buddies.assign"]),
  async (req, res, next) => {
    try {
      if (!req.user?.id) {
        throw badRequest("User not authenticated");
      }

      const user = await UserModel.findById(req.user.id);
      if (!user) {
        throw notFound("User not found");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find all active assignments for this user
      const activeAssignments = await UserBuddyAssignmentModel.find({
        userId: req.user.id,
        effectiveFrom: { $lte: today },
        $or: [
          { effectiveTo: { $gte: today } },
          { effectiveTo: null },
        ],
      })
        .populate("buddyUserId", "name email")
        .exec();

      if (activeAssignments.length === 0) {
        return res.json({ 
          ok: true, 
          message: "No active buddy assignments found",
          cancelledCount: 0 
        });
      }

      // Deactivate all active assignments by setting effectiveTo to yesterday
      const updateResult = await UserBuddyAssignmentModel.updateMany(
        {
          userId: req.user.id,
          effectiveFrom: { $lte: today },
          $or: [
            { effectiveTo: { $gte: today } },
            { effectiveTo: null },
          ],
        },
        {
          $set: { effectiveTo: yesterday },
        }
      );

      // Clear buddy reference from user model
      user.buddyUserId = undefined;
      await user.save();

      // Send notifications to all buddies
      const notificationPromises = activeAssignments.map(async (assignment) => {
        const buddy = assignment.buddyUserId as any;
        if (buddy && buddy._id) {
          try {
            await notifyBuddyCancelled(
              buddy._id,
              req.user!.id,
              user.name
            );
            logger.info("[Buddy Cancellation] Notification sent to buddy", {
              userId: user._id.toString(),
              userName: user.name,
              buddyId: buddy._id.toString(),
              buddyName: buddy.name,
            });
          } catch (error) {
            logger.error("[Buddy Cancellation] Failed to send notification to buddy", {
              userId: user._id.toString(),
              buddyId: buddy._id.toString(),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });

      await Promise.allSettled(notificationPromises);

      logger.info("[Buddy Cancellation] Active assignments cancelled", {
        userId: user._id.toString(),
        userName: user.name,
        cancelledCount: updateResult.modifiedCount,
      });

      res.json({ 
        ok: true, 
        message: `Cancelled ${updateResult.modifiedCount} active buddy assignment(s)`,
        cancelledCount: updateResult.modifiedCount 
      });
    } catch (err) {
      next(err);
    }
  }
);

