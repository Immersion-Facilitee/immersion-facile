import { uniqBy } from "ramda";
import {
  type AgencyDto,
  type AgencyModifierRole,
  agencyModifierRoles,
  type ConventionDto,
  type ConventionRole,
  type Email,
  errors,
  frontRoutes,
  isEstablishmentTutorIsEstablishmentRepresentative,
  makeRouteAbsoluteUrl,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../../config/bootstrap/magicLinkUrl";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { prepareConventionMagicShortLinkMaker } from "../../../core/short-link/ShortLink";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyAllActorsOfFinalConventionValidation = ReturnType<
  typeof makeNotifyAllActorsOfFinalConventionValidation
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  timeGateway: TimeGateway;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
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

    const recipientsRoleAndEmail: { role: ConventionRole; email: Email }[] =
      uniqBy(
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
          ...agency.counsellorEmails.map(
            (counsellorEmail): { role: ConventionRole; email: Email } => ({
              role: "counsellor",
              email: counsellorEmail,
            }),
          ),
          ...((conventionBeneficiaryAdvisor
            ? [
                {
                  email: conventionBeneficiaryAdvisor.email,
                  role: "validator",
                },
              ]
            : []) satisfies { role: ConventionRole; email: Email }[]),
        ],
      );

    for (const { email, role } of recipientsRoleAndEmail) {
      await prepareEmail({ email, role, convention, deps, uow, agency }).then(
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
    }
  });

const prepareEmail = async ({
  convention,
  deps,
  uow,
  agency,
  email,
  role,
}: {
  role: ConventionRole;
  email: Email;
  convention: ConventionDto;
  deps: Deps;
  uow: UnitOfWork;
  agency: AgencyDto;
}): Promise<TemplatedEmail> => {
  const shouldHaveAssessmentMagicLink =
    (isEstablishmentTutorIsEstablishmentRepresentative(convention) &&
      role === "establishment-representative") ||
    (!isEstablishmentTutorIsEstablishmentRepresentative(convention) &&
      role === "establishment-tutor");

  const makeShortMagicLink = prepareConventionMagicShortLinkMaker({
    config: deps.config,
    conventionMagicLinkPayload: {
      id: convention.id,
      role,
      email,
      now: deps.timeGateway.now(),
      expOverride: deps.timeGateway.now().getTime() + 1000 * 60 * 60 * 24 * 365, // 1 year
    },
    generateConventionMagicLinkUrl: deps.generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
    uow,
  });

  return {
    kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
    recipients: [email],
    params: {
      convention,
      agencyLogoUrl: agency.logoUrl ?? undefined,
      magicLink: agencyModifierRoles.includes(role as AgencyModifierRole)
        ? makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: deps.config.immersionFacileBaseUrl,
          })
        : await makeShortMagicLink({
            targetRoute: "conventionDocument",
            lifetime: "1Month",
          }),
      assessmentMagicLink: shouldHaveAssessmentMagicLink
        ? await makeShortMagicLink({
            targetRoute: "assessment",
            lifetime: "2Days",
          })
        : undefined,
      agencyName: agency.name,
    },
  };
};
