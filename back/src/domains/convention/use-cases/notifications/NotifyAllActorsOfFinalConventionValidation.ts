import { parseISO } from "date-fns";
import { uniqBy } from "ramda";
import {
  type AgencyDto,
  type ConventionDto,
  type ConventionRole,
  displayEmergencyContactInfos,
  type Email,
  errors,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  loginPersonaByConventionRole,
  makeRouteAbsoluteUrl,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyAllActorsOfFinalConventionValidation = ReturnType<
  typeof makeNotifyAllActorsOfFinalConventionValidation
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
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
    const conventionBeneficiaryAdvisorRole: ConventionRole = "validator";
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
          ...agency.validatorEmails.map(
            (validatorEmail): { role: ConventionRole; email: Email } => ({
              role: "validator",
              email: validatorEmail,
            }),
          ),
          ...agency.counsellorEmails.map(
            (counsellorEmail): { role: ConventionRole; email: Email } => ({
              role: "counsellor",
              email: counsellorEmail,
            }),
          ),
          ...(conventionBeneficiaryAdvisor
            ? [
                {
                  email: conventionBeneficiaryAdvisor.email,
                  role: conventionBeneficiaryAdvisorRole,
                },
              ]
            : []),
        ],
      );

    for (const { email, role } of recipientsRoleAndEmail) {
      await deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: prepareEmail({
          email,
          role,
          convention,
          config: deps.config,
          agency,
        }),
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
      });
    }
  });

const prepareEmail = ({
  convention,
  config,
  agency,
  email,
  role,
}: {
  role: ConventionRole;
  email: Email;
  convention: ConventionDto;
  config: AppConfig;
  agency: AgencyDto;
}): TemplatedEmail => {
  const loginPersona = loginPersonaByConventionRole(role);

  return {
    kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
    recipients: [email],
    params: {
      conventionId: convention.id,
      internshipKind: convention.internshipKind,
      beneficiaryFirstName: getFormattedFirstnameAndLastname({
        firstname: convention.signatories.beneficiary.firstName,
      }),
      beneficiaryLastName: getFormattedFirstnameAndLastname({
        lastname: convention.signatories.beneficiary.lastName,
      }),
      beneficiaryBirthdate: convention.signatories.beneficiary.birthdate,
      dateStart: parseISO(convention.dateStart).toLocaleDateString("fr"),
      dateEnd: parseISO(convention.dateEnd).toLocaleDateString("fr"),
      establishmentTutorName: getFormattedFirstnameAndLastname({
        firstname: convention.establishmentTutor.firstName,
        lastname: convention.establishmentTutor.lastName,
      }),
      businessName: convention.businessName,
      immersionAppellationLabel:
        convention.immersionAppellation.appellationLabel,
      emergencyContactInfos: displayEmergencyContactInfos({
        beneficiaryRepresentative:
          convention.signatories.beneficiaryRepresentative,
        beneficiary: convention.signatories.beneficiary,
      }),
      agencyLogoUrl: agency.logoUrl ?? undefined,
      magicLink: makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: convention.id,
          loginPersona,
        }),
        baseUrl: config.immersionFacileBaseUrl,
      }),
      agencyName: agency.name,
      validatorName: convention.validators?.agencyValidator
        ? getFormattedFirstnameAndLastname(
            convention.validators.agencyValidator,
          )
        : "",
    },
  };
};
