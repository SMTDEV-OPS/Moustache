import { Router } from "express";
import { requireAuth, requirePermissions } from "../middleware/auth";
import * as profileController from "../controllers/profileController";

const router = Router();

// Only users with "users.manage" can manage profiles
router.use(requireAuth, requirePermissions(["users.manage"]));

router.get("/", profileController.getProfiles);
router.get("/:id", profileController.getProfile);
router.post("/", profileController.createProfile);
router.put("/:id", profileController.updateProfile);
router.post("/:id/clone", profileController.cloneProfile); // Added clone route
router.delete("/:id", profileController.deleteProfile);

export default router;
