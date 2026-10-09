import type { RequestHandler } from "express";
import { AuditMethods, parseSignin } from "../../models/index";
import { signin } from "../../business-logic/auth/index";
import { recordAudit } from "../../business-logic/audits/index";

/** POST /api/v1/auth/signin — público (CU-01). Cada inicio de sesión exitoso queda en la auditoría (SIGNIN). */
export const signinController: RequestHandler = async (req, res) => {
  const result = await signin(parseSignin(req.body));
  void recordAudit({ userId: result.user.id, method: AuditMethods.SIGNIN, resource: "/api/v1/auth/signin", detail: `Inicio de sesión desde ${req.ip ?? "IP desconocida"}` }).catch((err: unknown) =>
    console.error("No se pudo auditar el inicio de sesión:", err),
  );
  res.status(200).json(result);
};
