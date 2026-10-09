import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/index";
import { authorize, Roles } from "../security/index";
import { createContactController, handleContactController, listContactController } from "../controllers/contact/index";

/** El formulario público acepta 5 envíos por hora por IP. */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

/** Pública: se monta ANTES de authenticate. */
export const contactPublicRouter = Router();
contactPublicRouter.post("/", contactLimiter, createContactController);

export const contactRouter = Router();
contactRouter.use(authorize(Roles.ADMIN));
contactRouter.get("/", listContactController);
contactRouter.post("/:id/handled", handleContactController);
