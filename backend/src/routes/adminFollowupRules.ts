import { Router } from "express";
import { AdminFollowupRulesController } from "../controllers/adminFollowupRulesController";
import { requireAuth } from "../middleware/auth";

export const adminFollowupRulesRouter = Router();

adminFollowupRulesRouter.use(requireAuth);

adminFollowupRulesRouter.get("/", AdminFollowupRulesController.listRules);
adminFollowupRulesRouter.post("/", AdminFollowupRulesController.createRule);
adminFollowupRulesRouter.put("/reorder", AdminFollowupRulesController.reorderRules);
adminFollowupRulesRouter.put("/:id", AdminFollowupRulesController.updateRule);
adminFollowupRulesRouter.delete("/:id", AdminFollowupRulesController.deleteRule);
