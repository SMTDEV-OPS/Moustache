import { Request, Response } from "express";
import { ProfileModel } from "../models/profile";
import { UserModel } from "../models/user";
import { logger } from "../config/logger";
import { isValidObjectId } from "mongoose";

export const getProfiles = async (req: Request, res: Response) => {
    try {
        const profiles = await ProfileModel.find()
            .populate('clonedFrom', 'name')
            .lean();
        res.json(profiles);
    } catch (error) {
        logger.error("Error fetching profiles:", { error });
        res.status(500).json({ error: { message: "Failed to fetch profiles" } });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid profile ID format" } });
        }

        const profile = await ProfileModel.findById(id).lean();
        if (!profile) {
            return res.status(404).json({ error: { message: "Profile not found" } });
        }

        res.json(profile);
    } catch (error) {
        logger.error(`Error fetching profile ${req.params.id}:`, { error });
        res.status(500).json({ error: { message: "Failed to fetch profile" } });
    }
};

export const createProfile = async (req: Request, res: Response) => {
    try {
        const { name, description, modulePermissions, setupPermissions } = req.body;

        if (!name) {
            return res.status(400).json({ error: { message: "Profile name is required" } });
        }

        const newProfile = await ProfileModel.create({
            name,
            description,
            modulePermissions: modulePermissions || [],
            setupPermissions: setupPermissions || [],
            isSystemProfile: false
        });

        res.status(201).json(newProfile);
    } catch (error) {
        logger.error("Error creating profile:", { error });
        res.status(500).json({ error: { message: "Failed to create profile" } });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid profile ID format" } });
        }

        const { name, description, modulePermissions, setupPermissions } = req.body;

        const profile = await ProfileModel.findById(id);
        if (!profile) {
            return res.status(404).json({ error: { message: "Profile not found" } });
        }

        if (profile.isSystemProfile) {
            return res.status(403).json({ error: { message: "Cannot modify system profiles" } });
        }

        if (name) profile.name = name;
        if (description !== undefined) profile.description = description;
        if (modulePermissions) profile.modulePermissions = modulePermissions;
        if (setupPermissions) profile.setupPermissions = setupPermissions;

        await profile.save();

        res.json(profile);
    } catch (error) {
        logger.error(`Error updating profile ${req.params.id}:`, { error });
        res.status(500).json({ error: { message: "Failed to update profile" } });
    }
};

export const deleteProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid profile ID format" } });
        }

        const profile = await ProfileModel.findById(id);
        if (!profile) {
            return res.status(404).json({ error: { message: "Profile not found" } });
        }

        if (profile.isSystemProfile) {
            return res.status(403).json({ error: { message: "Cannot delete system profiles" } });
        }

        const assignedUserCount = await UserModel.countDocuments({ profileId: id });
        if (assignedUserCount > 0) {
            return res.status(400).json({
                error: {
                    message: `Cannot delete profile — ${assignedUserCount} user(s) are assigned to it. Reassign them first.`,
                },
            });
        }

        await ProfileModel.findByIdAndDelete(id);

        res.status(204).send();
    } catch (error) {
        logger.error(`Error deleting profile ${req.params.id}:`, { error });
        res.status(500).json({ error: { message: "Failed to delete profile" } });
    }
};

export const cloneProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = req.body ?? {};
        const { newName, name, description } = body;
        const profileName = (typeof (newName ?? name) === "string" ? (newName ?? name).trim() : "") || undefined;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid profile ID format" } });
        }

        if (!profileName) {
            logger.warn("Clone profile missing or empty name", { bodyKeys: Object.keys(body) });
            return res.status(400).json({ error: { message: "New profile name is required" } });
        }

        const sourceProfile = await ProfileModel.findById(id).lean();
        if (!sourceProfile) {
            return res.status(404).json({ error: { message: "Source profile not found" } });
        }

        const newProfile = await ProfileModel.create({
            name: profileName,
            description: description || `Cloned from ${sourceProfile.name}`,
            modulePermissions: sourceProfile.modulePermissions,
            setupPermissions: sourceProfile.setupPermissions,
            clonedFrom: sourceProfile._id,
            isSystemProfile: false
        });

        res.status(201).json(newProfile);
    } catch (error) {
        logger.error(`Error cloning profile ${req.params.id}:`, { error });
        res.status(500).json({ error: { message: "Failed to clone profile" } });
    }
};
