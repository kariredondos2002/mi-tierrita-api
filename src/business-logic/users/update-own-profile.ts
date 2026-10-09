import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toUserResponse, type UpdateProfileRequest, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** Perfil propio (v4): cada usuario corrige su nombre y apellido. El usuario y el rol no cambian aquí. */
export const updateOwnProfile = async (userId: number, input: UpdateProfileRequest): Promise<UserResponse> => {
  const { rowCount } = await db.query(`UPDATE users SET first_name = $2, last_name = $3 WHERE id = $1`, [userId, input.firstName, input.lastName]);
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.USER_NOT_FOUND);
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
