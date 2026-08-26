import {
  type ConnectedUser,
  errors,
  type WithPreventToDelete,
  type WithUserId,
  withPreventToDeleteSchema,
  withUserIdSchema,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { throwIfNotAdmin } from "../helpers/authorization.helper";

export type UpdateUserPreventToDelete = ReturnType<
  typeof makeUpdateUserPreventToDelete
>;

export const makeUpdateUserPreventToDelete = useCaseBuilder(
  "UpdateUserPreventToDelete",
)
  .withInput<WithUserId & WithPreventToDelete>(
    withUserIdSchema.and(withPreventToDeleteSchema),
  )
  .withCurrentUser<ConnectedUser>()
  .build(async ({ uow, currentUser, inputParams }) => {
    throwIfNotAdmin(currentUser);

    const user = await uow.userRepository.getById(inputParams.userId);
    if (!user) throw errors.user.notFound({ userId: inputParams.userId });

    await uow.userRepository.save({
      ...user,
      preventToDelete: inputParams.preventToDelete ? true : undefined,
    });
  });
