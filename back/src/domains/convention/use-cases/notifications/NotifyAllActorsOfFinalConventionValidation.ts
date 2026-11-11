import { uniqBy } from "ramda";
import {
  type AbsoluteUrl,
  type ConventionRole,
  type Email,
  errors,
  executeInSequence,
  frontRoutes,
  isConventionActorRole,
  loginPersonaByConventionRole,
  makeRouteAbsoluteUrl,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateVisitorOtpUrl } from "../../../../config/bootstrap/magicLinkUrl";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyAllActorsOfFinalConventionValidation = ReturnType<
  typeof makeNotifyAllActorsOfFinalConventionValidation
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  config: AppConfig;
  generateVisitorOtpUrl: GenerateVisitorOtpUrl;
  timeGateway: TimeGateway;
};

type EmailAndRole = {
  role: ConventionRole;
  email: Email;
};

export const makeNotifyAllActorsOfFinalConventionValidation = useCaseBuilder(
  "NotifyAllActorsOfFinalConventionValidation",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const [agencyWithRights] = await uow.agencyRepository.getByIds([
      convention.agencyId,
    ]);

    if (!agencyWithRights)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);

    const conventionBeneficiaryAdvisor =
      convention.signatories.beneficiary.federatedIdentity?.payload?.advisor;

    const recipientsRoleAndEmail: EmailAndRole[] = uniqBy(
      (recipient) => recipient.email,
      [
        ...Object.values(convention.signatories).map((signatory) => ({
          role: signatory.role,
          email: signatory.email,
        })),
        ...(convention.signatories.establishmentRepresentative.email !==
        convention.establishmentTutor.email
          ? [
              {
                role: convention.establishmentTutor.role,
                email: convention.establishmentTutor.email,
              },
            ]
          : []),
        ...agency.counsellorEmails.map<EmailAndRole>((counsellorEmail) => ({
          role: "counsellor",
          email: counsellorEmail,
        })),
        ...(conventionBeneficiaryAdvisor
          ? [
              {
                email: conventionBeneficiaryAdvisor.email,
                role: "validator",
              } satisfies EmailAndRole,
            ]
          : []),
      ],
    );

    const now = deps.timeGateway.now();

    const makeManageConventionLink = ({
      role,
      email,
    }: EmailAndRole): AbsoluteUrl =>
      isConventionActorRole(role)
        ? deps.generateVisitorOtpUrl({
            conventionId: convention.id,
            role,
            email,
            now,
            targetRoute: "manageConvention",
          })
        : makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
              loginPersona: loginPersonaByConventionRole(role),
              email,
            }),
            baseUrl: deps.config.immersionFacileBaseUrl,
          });

    await executeInSequence(
      recipientsRoleAndEmail.map<TemplatedEmail>((recipient) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [recipient.email],
        params: {
          convention,
          agencyLogoUrl: agency.logoUrl ?? undefined,
          agencyName: agency.name,
          manageConventionLink: makeManageConventionLink(recipient),
        },
      })),
      (templatedContent) =>
        deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent,
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        }),
    );
  });
