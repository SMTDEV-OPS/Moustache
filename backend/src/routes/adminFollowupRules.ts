import { Router } from "express";
import { AdminFollowupRulesController } from "../controllers/adminFollowupRulesController";

export const adminFollowupRulesRouter = Router();

adminFollowupRulesRouter.get("/", AdminFollowupRulesController.listRules);
adminFollowupRulesRouter.post("/", AdminFollowupRulesController.createRule);
adminFollowupRulesRouter.put("/reorder", AdminFollowupRulesController.reorderRules);
adminFollowupRulesRouter.put("/:id", AdminFollowupRulesController.updateRule);
adminFollowupRulesRouter.delete("/:id", AdminFollowupRulesController.deleteRule);
