import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseUpdateProfile } from "../../models/index";
import { updateOwnProfile } from "../../business-logic/users/index";

/** PUT /api/v1/users/me — autenticado: nombre y apellido propios (pantalla Mi perfil). */
export const updateOwnProfileController: RequestHandler = async (req, res) => {
  res.json(await updateOwnProfile(requireAuth(req).userId, parseUpdateProfile(req.body)));
};
