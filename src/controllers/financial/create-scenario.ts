import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateScenario } from "../../models/index";
import { createScenario } from "../../business-logic/financial/index";
import { onScenarioCreated } from "../../business-logic/notifications/index";

/** POST /api/v1/financial/scenarios — ADMIN (CU-14). */
export const createScenarioController: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const scenario = await createScenario(userId, parseCreateScenario(req.body));
  onScenarioCreated(scenario, userId);
  res.status(201).json(scenario);
};
