import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toUserResponse, type UpdateProfileRequest, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** Perfil propio: nombre, apellido, correo y teléfono. El usuario y el rol solo los cambia el administrador. */
export const updateOwnProfile = async (userId: number, input: UpdateProfileRequest): Promise<UserResponse> => {
  let rowCount: number | null;
  try {
    ({ rowCount } = await db.query(
      `UPDATE users SET first_name = $2, last_name = $3, email = $4, phone = $5, updated_at = now() WHERE id = $1`,
      [userId, input.firstName, input.lastName, input.email, input.phone],
    ));
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE, [{ path: "email", message: "Ese correo ya lo usa otra persona" }]);
    throw err;
  }
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.USER_NOT_FOUND);
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
