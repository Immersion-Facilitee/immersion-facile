import { keys } from "ramda";
import {
  type AgencyUsersRights,
  type AgencyWithUsersRights,
  type ConnectedUser,
  type Email,
  errors,
  type User,
  type UserParamsForAgency,
  userParamsForAgencySchema,
} from "shared";
import { throwErrorIfAttemptToAddCounsellorRoleToFTAgency } from "../../../utils/agency";
import type { UserRepository } from "../../core/authentication/connected-user/port/UserRepository";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  rejectIfEditionOfNotificationPreferencesWhenNotAdminNorOwnPreferences,
  rejectIfEditionOfRolesWhenNotBackofficeAdminNorAgencyAdmin,
  rejectIfEditionOfValidatorsOfAgencyWithRefersTo,
  validateAgencyRights,
} from "../helpers/agencyRights.helper";

export type UpdateUserForAgency = ReturnType<typeof makeUpdateUserForAgency>;
export const makeUpdateUserForAgency = useCaseBuilder("UpdateUserForAgency")
  .withInput(userParamsForAgencySchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ createNewEvent: CreateNewEvent; timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, deps, inputParams }) => {
    const { isBackOfficeOrAgencyAdmin } = throwIfUserHasNoRightOnAgency(
      currentUser,
      inputParams,
    );

    const userToUpdate = await uow.userRepository.getById(inputParams.userId);
    if (!userToUpdate)
      throw errors.user.notFound({ userId: inputParams.userId });

    const agency = await uow.agencyRepository.getById(inputParams.agencyId);
    if (!agency)
      throw errors.agency.notFound({ agencyId: inputParams.agencyId });

    throwErrorIfAttemptToAddCounsellorRoleToFTAgency({
      agencyKind: agency.kind,
      roles: inputParams.roles,
    });

    const agencyRightToUpdate = agency.usersRights[userToUpdate.id];
    if (!agencyRightToUpdate)
      throw errors.user.noRightsOnAgency({
        agencyId: agency.id,
        userId: userToUpdate.id,
      });

    rejectIfEditionOfRolesWhenNotBackofficeAdminNorAgencyAdmin(
      agencyRightToUpdate.roles,
      inputParams.roles,
      isBackOfficeOrAgencyAdmin,
    );
    rejectIfEditionOfNotificationPreferencesWhenNotAdminNorOwnPreferences(
      currentUser.id === userToUpdate.id,
      agencyRightToUpdate.isNotifiedByEmail !== inputParams.isNotifiedByEmail,
      isBackOfficeOrAgencyAdmin,
    );
    rejectIfEditionOfValidatorsOfAgencyWithRefersTo(agency, inputParams.roles);
    rejectEmailModificationIfProConnectedUser(userToUpdate, inputParams.email);
    rejectEmailModificationIfNotAdminNorOwnEmail(
      currentUser.id,
      userToUpdate.id,
      isBackOfficeOrAgencyAdmin,
    );
    await rejectIfEmailModificationToAnotherEmailAlreadyLinkedToAgency(
      agency,
      inputParams,
      uow,
    );

    const updatedRights: AgencyUsersRights = {
      ...agency.usersRights,
      [userToUpdate.id]: {
        roles: isBackOfficeOrAgencyAdmin
          ? inputParams.roles
          : agencyRightToUpdate.roles,
        isNotifiedByEmail: inputParams.isNotifiedByEmail,
      },
    };

    validateAgencyRights(agency.id, updatedRights, agency.refersToAgencyId);

    await uow.agencyRepository.update({
      id: agency.id,
      status: agency.status,
      usersRights: updatedRights,
      updatedAt: deps.timeGateway.now().toISOString(),
    });
    await updateIfUserEmailChanged(
      userToUpdate,
      inputParams.email,
      uow.userRepository,
    );
    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ConnectedUserAgencyRightChanged",
        payload: {
          ...inputParams,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
      }),
    );
  });

const rejectEmailModificationIfNotAdminNorOwnEmail = (
  currentUserId: string,
  userToUpdateId: string,
  isBackOfficeOrAgencyAdmin: boolean,
): void => {
  if (isBackOfficeOrAgencyAdmin) return;
  if (currentUserId === userToUpdateId) return;
  throw errors.user.forbiddenEmailUpdate();
};

const rejectEmailModificationIfProConnectedUser = (
  user: User,
  newEmail: Email,
): void => {
  if (!newEmail || !user.proConnect) return;
  if (user.email !== newEmail) {
    throw errors.user.forbiddenToChangeEmailForConnectedUser();
  }
};

const updateIfUserEmailChanged = async (
  user: User,
  newEmail: Email,
  userRepository: UserRepository,
): Promise<void> => {
  if (user.email === newEmail || user.proConnect) return;
  await userRepository.updateEmail(user.id, newEmail);
};

const throwIfUserHasNoRightOnAgency = (
  currentUser: ConnectedUser,
  userParamsForAgency: UserParamsForAgency,
): { isBackOfficeOrAgencyAdmin: boolean } => {
  if (currentUser.isBackofficeAdmin) return { isBackOfficeOrAgencyAdmin: true };

  const currentUserAgencyRight = currentUser.agencyRights.find(
    (agencyRight) => agencyRight.agency.id === userParamsForAgency.agencyId,
  );
  if (!currentUserAgencyRight)
    throw errors.user.forbidden({ userId: currentUser.id });

  const isAgencyAdmin = currentUserAgencyRight.roles.includes("agency-admin");

  return {
    isBackOfficeOrAgencyAdmin: currentUser.isBackofficeAdmin || isAgencyAdmin,
  };
};

const rejectIfEmailModificationToAnotherEmailAlreadyLinkedToAgency = async (
  agency: AgencyWithUsersRights,
  userToUpdate: UserParamsForAgency,
  uow: UnitOfWork,
) => {
  const user = await uow.userRepository.findByEmail(userToUpdate.email);

  if (user === undefined || (user && user.id === userToUpdate.userId)) return;

  if (keys(agency.usersRights).includes(user.id)) {
    throw errors.agency.userAlreadyExist();
  }
};
