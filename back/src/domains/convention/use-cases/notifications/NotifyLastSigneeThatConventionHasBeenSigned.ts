import {
  type AgencyWithUsersRights,
  type ConventionDto,
  errors,
  frontRoutes,
  loginPersonaByConventionRole,
  makeRouteAbsoluteUrl,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyLastSigneeThatConventionHasBeenSigned = ReturnType<
  typeof makeNotifyLastSigneeThatConventionHasBeenSigned
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  config: AppConfig;
};

export const makeNotifyLastSigneeThatConventionHasBeenSigned = useCaseBuilder(
  "NotifyLastSigneeThatConventionHasBeenSigned",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const savedConvention = await uow.conventionRepository.getById(
      convention.id,
    );

    if (!savedConvention)
      throw errors.convention.notFound({ conventionId: convention.id });

    const agency = await uow.agencyRepository.getById(savedConvention.agencyId);

    if (!agency)
      throw errors.agency.notFound({
        agencyId: savedConvention.agencyId,
      });

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: makeEmail(savedConvention, agency, deps.config),
      followedIds: {
        conventionId: savedConvention.id,
        agencyId: savedConvention.agencyId,
        establishmentSiret: savedConvention.siret,
      },
    });
  });

type Signee = Omit<Signatory, "signedAt"> & {
  signedAt: string;
};

const getLastSignee = (signatories: Signatory[]): Signee | undefined =>
  signatories
    .filter(
      (
        signatory,
      ): signatory is Signatory & {
        signedAt: string;
      } => signatory.signedAt !== undefined,
    )
    .sort((a, b) => (a.signedAt < b.signedAt ? -1 : 0))
    .at(-1);

const makeEmail = (
  convention: ConventionDto,
  agency: AgencyWithUsersRights,
  config: AppConfig,
): TemplatedEmail => {
  const lastSignee: Signee | undefined = getLastSignee(
    Object.values(convention.signatories),
  );

  if (lastSignee) {
    const { role } = lastSignee;
    const loginPersona = loginPersonaByConventionRole(role);

    return {
      kind: "SIGNEE_HAS_SIGNED_CONVENTION",
      params: {
        agencyLogoUrl: agency.logoUrl ?? undefined,
        internshipKind: convention.internshipKind,
        conventionId: convention.id,
        signedAt: lastSignee.signedAt,
        magicLink: makeRouteAbsoluteUrl({
          route: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.id,
            loginPersona,
          }),
          baseUrl: config.immersionFacileBaseUrl,
        }),
        agencyName: agency.name,
      },
      recipients: [lastSignee.email],
    };
  }

  throw errors.convention.noSignatoryHasSigned({
    conventionId: convention.id,
  });
};
