import { Router } from "express";
import { z } from "zod";
import { AccountNoteModel } from "../models/accountNote";
import { AccountModel } from "../models/account";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, notFound, forbidden } from "../utils/httpError";

export const accountNotesRouter = Router();

accountNotesRouter.use(requireAuth);

const createSchema = z.object({
  accountId: z.string().min(1),
  content: z.string().min(1),
});

const updateSchema = z.object({
  content: z.string().min(1),
});

// List notes by account
accountNotesRouter.get("/", async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (!accountId || typeof accountId !== "string") {
      throw badRequest("accountId is required");
    }

    if (!hasPermission(req.user, "accounts.manage_notes")) {
      throw forbidden("Insufficient permissions to view account notes");
    }
    const account = await AccountModel.findById(accountId).lean();
    if (!account) throw notFound("Account not found");

    const notes = await AccountNoteModel.find({ accountId })
      .sort({ createdAt: -1 })
      .populate("createdByUserId", "name email")
      .lean();
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// Create note
accountNotesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid payload");
    }
    const { accountId, content } = parsed.data;

    if (!hasPermission(req.user, "accounts.manage_notes")) {
      throw forbidden("Insufficient permissions to create account notes");
    }
    const account = await AccountModel.findById(accountId).lean();
    if (!account) throw notFound("Account not found");

    const note = await AccountNoteModel.create({
      accountId,
      content,
      createdByUserId: req.user!.id,
    });
    const populated = await AccountNoteModel.findById(note._id)
      .populate("createdByUserId", "name email")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// Get one
accountNotesRouter.get("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_notes")) {
      throw forbidden("Insufficient permissions to view account notes");
    }

    const note = await AccountNoteModel.findById(req.params.id)
      .populate("createdByUserId", "name email")
      .lean();
    if (!note) throw notFound("Note not found");

    res.json(note);
  } catch (err) {
    next(err);
  }
});

// Update
accountNotesRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_notes")) {
      throw forbidden("Insufficient permissions to edit account notes");
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload");
    }

    const note = await AccountNoteModel.findById(req.params.id).lean();
    if (!note) throw notFound("Note not found");

    // Permission-based access: PAM/SAM/Admin roles should have accounts.manage_notes.

    const updated = await AccountNoteModel.findByIdAndUpdate(
      req.params.id,
      { $set: { content: parsed.data.content } },
      { new: true }
    )
      .populate("createdByUserId", "name email")
      .lean();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete
accountNotesRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_notes")) {
      throw forbidden("Insufficient permissions to delete account notes");
    }

    const note = await AccountNoteModel.findById(req.params.id).lean();
    if (!note) throw notFound("Note not found");

    await AccountNoteModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    next(err);
  }
});
