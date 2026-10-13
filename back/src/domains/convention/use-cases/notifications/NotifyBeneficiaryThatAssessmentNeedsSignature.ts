import {
  errors,
  frontRoutes,
  getAssessmentCreatorOrganizationName,
  getDisplayedBusinessName,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type WithAssessmentDto,
  type WithConventionDto,
  withAssessmentSchema,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export type NotifyBeneficiaryThatAssessmentNeedsSignature = ReturnType<
  typeof makeNotifyBeneficiaryThatAssessmentNeedsSignature
>;

export const makeNotifyBeneficiaryThatAssessmentNeedsSignature = useCaseBuilder(
  "NotifyBeneficiaryThatAssessmentNeedsSignature",
)
  .withInput<WithConventionDto & WithAssessmentDto>(
    withConventionSchema.and(withAssessmentSchema),
  )
  .withOutput<void>()
  .withCurrentUser<void>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    config: AppConfig;
  }>()
  .build(async ({ uow, inputParams, deps }) => {
    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      inputParams.convention.id,
    );

    const assessment = (
      await uow.assessmentRepository.getByConventionIds([
        inputParams.convention.id,
      ])
    ).at(0);

    if (!assessment)
      throw errors.assessment.notFound(inputParams.convention.id);

    if (assessment.status === "DID_NOT_SHOW") return;

    const beneficiary = convention.signatories.beneficiary;
    const createdBy =
      "createdBy" in assessment ? assessment.createdBy : undefined;

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
        recipients: [beneficiary.email],
        params: {
          conventionId: convention.id,
          beneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname: beneficiary.firstName,
          }),
          beneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: beneficiary.lastName,
          }),
          businessName: getDisplayedBusinessName(convention),
          internshipKind: convention.internshipKind,
          assessmentSignatureLink: makeRouteAbsoluteUrl({
            route: frontRoutes.assessmentDocument({
              conventionId: convention.id,
              loginPersona: "beneficiary",
            }),
            baseUrl: deps.config.immersionFacileBaseUrl,
          }),
          ...(createdBy
            ? {
                createdBy: {
                  ...createdBy,
                  organizationName: getAssessmentCreatorOrganizationName({
                    role: createdBy.role,
                    convention: convention,
                    agencyName: agency.name,
                    agencyRefersToName: agency.refersToAgencyName,
                  }),
                },
              }
            : {}),
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    });
  });
