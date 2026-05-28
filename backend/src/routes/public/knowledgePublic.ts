import { Router } from "express";
import { getPublicGuideByToken } from "../../services/propertyGuideService";

export const knowledgePublicRouter = Router();

knowledgePublicRouter.get("/:shareToken", async (req, res, next) => {
  try {
    const payload = await getPublicGuideByToken(req.params.shareToken);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
