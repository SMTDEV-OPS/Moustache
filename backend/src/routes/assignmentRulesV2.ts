import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { assignmentRuleV2Schema } from "../validations/assignmentRulesV2";
import { AssignmentRuleModel } from "../models/assignmentRule";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    // Validate target
    if (payload.assignTo === "group" && !payload.employeeGroupId) {
      return res.status(400).json({ error: "Group is required" });
    }
    if (payload.assignTo === "user" && !payload.specificUserId) {
      return res.status(400).json({ error: "User is required" });
    }

    const rule = new AssignmentRuleModel(payload);
    await rule.save();

    res.status(201).json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:module", async (req, res) => {
  try {
    const module = req.params.module;
    const rules = await AssignmentRuleModel.find({ module }).sort({ priority: 1, createdAt: 1 })
      .populate("employeeGroupId", "name")
      .populate("specificUserId", "name email");

    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/details/:id", async (req, res) => {
  try {
    const rule = await AssignmentRuleModel.findById(req.params.id)
      .populate("employeeGroupId", "name")
      .populate("specificUserId", "name email");
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const rule = await AssignmentRuleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await AssignmentRuleModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Rule deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
