import {
  type AbsoluteUrl,
  type AfterOAuthSuccessRedirectionResponse,
  type ConventionDraftDto,
  errors,
  executeInSequence,
  frontRoutes,
  makeRouteAbsoluteUrl,
  oAuthSuccessLoginParamsSchema,
  type UserId,
  type UserWithAdminRights,
} from "shared";
import { match } from "ts-pattern";
import type { GenerateConnectedUserLoginUrl } from "../../../../../config/bootstrap/magicLinkUrl";
import { makeThrowIfIncorrectJwt } from "../../../../../utils/jwt";
import {
  type AgencyRightOfUser,
  removeAgencyRightsForUser,
  updateAgencyRightsForUser,
} from "../../../../agency/ports/AgencyRepository";
import type { CreateNewEvent } from "../../../events/ports/EventBus";
import type { VerifyJwtFn } from "../../../jwt";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { UuidGenerator } from "../../../uuid-generator/ports/UuidGenerator";
import { chooseValidAdvisor } from "../../ft-connect/entities/ConventionFranceTravailAdvisorEntity";
import type { FtConnectGateway } from "../../ft-connect/port/FtConnectGateway";
import type {
  EmailOngoingAuth,
  FTConnectOngoingAuth,
  ProConnectOngoingAuth,
} from "../entities/OngoingOAuth";
import type {
  GetAccessTokenResult,
  OAuthGateway,
  ProConnectGetAccessTokenPayload,
} from "../port/OAuthGateway";

export type AfterOAuthSuccess = ReturnType<typeof makeAfterOAuthSuccess>;

type Deps = {
  createNewEvent: CreateNewEvent;
  proConnectOAuthGateway: OAuthGateway;
  ftConnectGateway: FtConnectGateway;
  uuidGenerator: UuidGenerator;
  generateConnectedUserLoginUrl: GenerateConnectedUserLoginUrl;
  verifyEmailAuthCodeJwt: VerifyJwtFn<"emailAuthCode">;
  immersionFacileBaseUrl: AbsoluteUrl;
  timeGateway: TimeGateway;
};

export const makeAfterOAuthSuccess = useCaseBuilder("AfterOAuthSuccess")
  .withInput(oAuthSuccessLoginParamsSchema)
  .withOutput<AfterOAuthSuccessRedirectionResponse>()
  .withDeps<Deps>()
  .build(async ({ inputParams: { code, state }, uow, deps }) => {
    const ongoingOAuth = await uow.ongoingOAuthRepository.findByState(state);
    if (!ongoingOAuth) throw errors.auth.missingOAuth({ state });

    return match(ongoingOAuth)
      .with({ provider: "email" }, async (emailOauth: EmailOngoingAuth) => {
        if (emailOauth.usedAt) throw errors.auth.alreadyUsedAuthentication();
        return saveEmailAuthenticationDataAndReturnRedirectURI({
          uow,
          generateConnectedUserLoginUrl: deps.generateConnectedUserLoginUrl,
          timeGateway: deps.timeGateway,
          ...(await onEmailProvider({
            uow,
            ongoingOAuth: emailOauth,
            code,
            deps,
          })),
        });
      })
      .with(
        { provider: "proConnect" },
        async (proConnectOngoingOAuth: ProConnectOngoingAuth) =>
          ongoingOAuth.usedAt
            ? {
                provider: ongoingOAuth.provider,
                redirectUri:
                  `${deps.immersionFacileBaseUrl}${ongoingOAuth.fromUri}?alreadyUsedAuthentication=true` satisfies AbsoluteUrl,
              }
            : saveProConnectAuthenticationDataAndReturnRedirectURI({
                uow,
                deps,
                ...(await onProConnectProvider({
                  uow,
                  deps,
                  proConnectOngoingOAuth: proConnectOngoingOAuth,
                  code,
                })),
              }),
      )
      .with(
        { provider: "ftConnect" },
        async (ftConnectOngoinOAuth: FTConnectOngoingAuth) => {
          return saveFTConnectAuthenticationDataAndReturnRedirectURI({
            uow,
            deps,
            ...(await onFTConnectProvider({
              deps,
              ftConnectOngoinOAuth: ftConnectOngoinOAuth,
              code,
            })),
          });
        },
      )
      .exhaustive();
  });

const saveEmailAuthenticationDataAndReturnRedirectURI = async ({
  uow,
  newOrUpdatedUser,
  updatedOngoingOAuth,
  generateConnectedUserLoginUrl,
  timeGateway,
}: {
  uow: UnitOfWork;
  newOrUpdatedUser: UserWithAdminRights;
  updatedOngoingOAuth: EmailOngoingAuth;
  timeGateway: TimeGateway;
  generateConnectedUserLoginUrl: GenerateConnectedUserLoginUrl;
}): Promise<AfterOAuthSuccessRedirectionResponse> => {
  await uow.userRepository.save({
    ...newOrUpdatedUser,
    lastLoginAt: timeGateway.now().toISOString(),
  });
  await uow.ongoingOAuthRepository.save(updatedOngoingOAuth);

  return {
    provider: updatedOngoingOAuth.provider,
    redirectUri: generateConnectedUserLoginUrl({
      user: newOrUpdatedUser,
      ongoingOAuth: updatedOngoingOAuth,
      now: timeGateway.now(),
    }),
  };
};

const saveProConnectAuthenticationDataAndReturnRedirectURI = async ({
  uow,
  deps,
  newOrUpdatedUser,
  updatedOngoingOAuth,
  accessToken,
}: {
  uow: UnitOfWork;
  deps: Deps;
  newOrUpdatedUser: UserWithAdminRights;
  updatedOngoingOAuth: ProConnectOngoingAuth;
  accessToken: GetAccessTokenResult;
}): Promise<AfterOAuthSuccessRedirectionResponse> => {
  await uow.userRepository.save({
    ...newOrUpdatedUser,
    lastLoginAt: deps.timeGateway.now().toISOString(),
  });
  await uow.ongoingOAuthRepository.save(updatedOngoingOAuth);
  await uow.outboxRepository.save(
    deps.createNewEvent({
      topic: "UserAuthenticatedSuccessfully",
      payload: {
        userId: newOrUpdatedUser.id,
        codeSafir:
          accessToken &&
          "structure_pe" in accessToken.payload &&
          accessToken.payload.structure_pe
            ? accessToken.payload.structure_pe
            : null,
        triggeredBy: {
          kind: "connected-user",
          userId: newOrUpdatedUser.id,
        },
      },
    }),
  );
  return {
    provider: updatedOngoingOAuth.provider,
    redirectUri: deps.generateConnectedUserLoginUrl({
      user: newOrUpdatedUser,
      ongoingOAuth: updatedOngoingOAuth,
      now: deps.timeGateway.now(),
    }),
  };
};

const saveFTConnectAuthenticationDataAndReturnRedirectURI = async ({
  uow,
  deps,
  updatedOngoingOAuth,
  accessToken,
}: {
  uow: UnitOfWork;
  deps: Deps;
  updatedOngoingOAuth: FTConnectOngoingAuth;
  accessToken: GetAccessTokenResult;
}): Promise<AfterOAuthSuccessRedirectionResponse> => {
  await uow.ongoingOAuthRepository.save(updatedOngoingOAuth);
  const userAndAdvisors = await deps.ftConnectGateway.getUserAndAdvisors({
    value: accessToken.accessToken,
    expiresIn: accessToken.expire,
    idToken: accessToken.idToken,
  });
  if (!userAndAdvisors) {
    return {
      provider: updatedOngoingOAuth.provider,
      redirectUri: makeRouteAbsoluteUrl({
        route: frontRoutes.conventionImmersion({}),
        baseUrl: deps.immersionFacileBaseUrl,
      }),
    };
  }
  const validAdvisor = userAndAdvisors.user.isJobseeker
    ? chooseValidAdvisor(userAndAdvisors.user, userAndAdvisors.advisors)
    : undefined;

  await uow.conventionFranceTravailAdvisorRepository.saveFtUserAndAdvisor({
    advisor: validAdvisor,
    user: userAndAdvisors.user,
  });

  const conventionDraft: ConventionDraftDto = {
    id: deps.uuidGenerator.new(),
    internshipKind: "immersion",
    fromFtConnectedUser: true,
    signatories: {
      beneficiary: {
        birthdate: userAndAdvisors.user.birthdate,
        email: userAndAdvisors.user.email,
        firstName: userAndAdvisors.user.firstName,
        lastName: userAndAdvisors.user.lastName,
        phone: userAndAdvisors.user.phone,
        federatedIdentity: {
          provider: "ftConnect",
          token: userAndAdvisors.user.ftExternalId,
        },
      },
    },
    validators: validAdvisor
      ? {
          agencyCounsellor: {
            firstname: validAdvisor.firstName,
            lastname: validAdvisor.lastName,
          },
        }
      : undefined,
  };
  await uow.conventionDraftRepository.save(
    conventionDraft,
    deps.timeGateway.now().toISOString(),
  );

  await uow.outboxRepository.save(
    deps.createNewEvent({
      topic: "FTConnectedSuccessfully",
      payload: {
        ftConnectUserId: userAndAdvisors.user.ftExternalId,
        conventionDraftId: conventionDraft.id,
      },
    }),
  );
  return {
    provider: updatedOngoingOAuth.provider,
    redirectUri:
      `${deps.immersionFacileBaseUrl}${updatedOngoingOAuth.fromUri}?skipIntro=true&conventionDraftId=${conventionDraft.id}` satisfies AbsoluteUrl,
  };
};

const onProConnectProvider = async ({
  uow,
  deps,
  proConnectOngoingOAuth,
  code,
}: {
  uow: UnitOfWork;
  deps: Deps;
  proConnectOngoingOAuth: ProConnectOngoingAuth;
  code: string;
}): Promise<{
  newOrUpdatedUser: UserWithAdminRights;
  updatedOngoingOAuth: ProConnectOngoingAuth;
  accessToken: GetAccessTokenResult;
}> => {
  const accessToken = await deps.proConnectOAuthGateway.getAccessToken({
    code,
  });

  if (accessToken.type !== "proConnect")
    throw errors.auth.accessTokenErrorType({
      actualType: "ftConnect",
      expectedType: "proConnect",
    });

  if (accessToken.payload.nonce !== proConnectOngoingOAuth.nonce)
    throw errors.auth.nonceMismatch();

  const newOrUpdatedUser = await makeNewOrUpdatedProConnectedUser({
    uow,
    deps,
    payload: accessToken.payload,
  });

  return {
    newOrUpdatedUser,
    updatedOngoingOAuth: {
      ...proConnectOngoingOAuth,
      userId: newOrUpdatedUser.id,
      usedAt: deps.timeGateway.now(),
      externalId: newOrUpdatedUser.proConnect?.externalId,
      accessToken: accessToken.accessToken,
      idToken: accessToken.idToken,
    },
    accessToken,
  };
};

const onFTConnectProvider = async ({
  ftConnectOngoinOAuth,
  code,
  deps,
}: {
  deps: Deps;
  ftConnectOngoinOAuth: FTConnectOngoingAuth;
  code: string;
}): Promise<{
  updatedOngoingOAuth: FTConnectOngoingAuth;
  accessToken: GetAccessTokenResult;
}> => {
  const accessToken = await deps.ftConnectGateway.getAccessToken({
    code,
  });

  if (accessToken.payload.nonce !== ftConnectOngoinOAuth.nonce)
    throw errors.auth.nonceMismatch();

  return {
    updatedOngoingOAuth: {
      ...ftConnectOngoinOAuth,
      usedAt: deps.timeGateway.now(),
      accessToken: accessToken.accessToken,
      idToken: accessToken.idToken,
    },
    accessToken,
  };
};

const onEmailProvider = async ({
  uow,
  deps,
  ongoingOAuth,
  code,
}: {
  uow: UnitOfWork;
  deps: Deps;
  ongoingOAuth: EmailOngoingAuth;
  code: string;
}): Promise<{
  newOrUpdatedUser: UserWithAdminRights;
  updatedOngoingOAuth: EmailOngoingAuth;
}> => {
  makeThrowIfIncorrectJwt(deps.verifyEmailAuthCodeJwt, deps.timeGateway)(code);

  const existingUser = await uow.userRepository.findByEmail(ongoingOAuth.email);

  const newOrUpdatedUser = existingUser ?? {
    id: deps.uuidGenerator.new(),
    createdAt: deps.timeGateway.now().toISOString(),
    email: ongoingOAuth.email,
    firstName: "",
    lastName: "",
    proConnect: null,
  };

  return {
    newOrUpdatedUser: newOrUpdatedUser,
    updatedOngoingOAuth: {
      ...ongoingOAuth,
      userId: newOrUpdatedUser.id,
      usedAt: deps.timeGateway.now(),
    },
  };
};

const makeNewOrUpdatedProConnectedUser = async ({
  uow,
  deps,
  payload,
}: {
  uow: UnitOfWork;
  deps: Deps;
  payload: ProConnectGetAccessTokenPayload;
}): Promise<UserWithAdminRights> => {
  const existingUserByExternalId =
    "sub" in payload
      ? await uow.userRepository.findByExternalId(payload.sub)
      : undefined;

  const existingUserByEmail = await uow.userRepository.findByEmail(
    payload.email,
  );

  const conflictingUserFound =
    existingUserByEmail &&
    existingUserByExternalId &&
    existingUserByEmail.id !== existingUserByExternalId.id;

  if (conflictingUserFound) {
    await resolveConflictingUsers({
      uow,
      userToKeepId: existingUserByExternalId.id,
      userToDeleteId: existingUserByEmail.id,
    });
  }

  return {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    proConnect: {
      externalId: payload.sub,
      siret: payload.siret,
    },
    id:
      existingUserByExternalId?.id ||
      existingUserByEmail?.id ||
      deps.uuidGenerator.new(),
    createdAt:
      existingUserByExternalId?.createdAt ||
      existingUserByEmail?.createdAt ||
      deps.timeGateway.now().toISOString(),
  };
};

const resolveConflictingUsers = async ({
  uow,
  userToKeepId,
  userToDeleteId,
}: {
  uow: UnitOfWork;
  userToKeepId: UserId;
  userToDeleteId: UserId;
}): Promise<void> => {
  const userToDeleteAgencyRights =
    await uow.agencyRepository.getAgenciesRightsByUserId(userToDeleteId);
  const userToKeepAgencyRights =
    await uow.agencyRepository.getAgenciesRightsByUserId(userToKeepId);

  const newAgenciesRightForUser = userToDeleteAgencyRights.reduce<
    AgencyRightOfUser[]
  >((acc, userToDeleteAgencyRight) => {
    const existingUserToKeepAgencyRight = userToKeepAgencyRights.find(
      (newAgencyRight) =>
        newAgencyRight.agencyId === userToDeleteAgencyRight.agencyId,
    );

    return [
      ...acc,
      {
        agencyId: userToDeleteAgencyRight.agencyId,
        isNotifiedByEmail:
          existingUserToKeepAgencyRight?.isNotifiedByEmail ||
          userToDeleteAgencyRight.isNotifiedByEmail,
        roles: [
          ...(existingUserToKeepAgencyRight?.roles || []),
          ...userToDeleteAgencyRight.roles,
        ],
      },
    ];
  }, []);

  await executeInSequence(newAgenciesRightForUser, (agencyRightsForUser) =>
    updateAgencyRightsForUser(uow, userToKeepId, agencyRightsForUser),
  );

  await executeInSequence(userToDeleteAgencyRights, (agencyRightsForUser) =>
    removeAgencyRightsForUser(uow, userToDeleteId, agencyRightsForUser),
  );

  await uow.userRepository.delete(userToDeleteId);
};
