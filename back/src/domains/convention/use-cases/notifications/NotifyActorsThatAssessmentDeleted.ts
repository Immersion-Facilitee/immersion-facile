import {
  type DeleteAssessmentRequestDto,
  deleteAssessmentRequestDtoSchema,
  errors,
  getFormattedFirstnameAndLastname,
  triggeredBySchema,
  type WithTriggeredBy,
} from "shared";
import { z } from "zod";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../../config/bootstrap/magicLinkUrl";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { prepareConventionMagicShortLinkMaker } from "../../../core/short-link/ShortLink";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

type NotifyActorsThatAssessmentDeletedInput = DeleteAssessmentRequestDto &
  WithTriggeredBy;

export type NotifyActorsThatAssessmentDeleted = ReturnType<
  typeof makeNotifyActorsThatAssessmentDeleted
>;

export const makeNotifyActorsThatAssessmentDeleted = useCaseBuilder(
  "NotifyActorsThatAssessmentDeleted",
)
  .withInput<NotifyActorsThatAssessmentDeletedInput>(
    deleteAssessmentRequestDtoSchema.and(
      z.object({ triggeredBy: triggeredBySchema.nullable() }),
    ),
  )
  .withOutput<void>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
    timeGateway: TimeGateway;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    config: AppConfig;
  }>()
  .build(async ({ inputParams, uow, deps }) => {
    const convention = await uow.conventionRepository.getById(
      inputParams.conventionId,
    );
    if (!convention)
      throw errors.convention.notFound({
        conventionId: inputParams.conventionId,
      });

    const now = deps.timeGateway.now();
    const makeShortMagicLink = prepareConventionMagicShortLinkMaker({
      config: deps.config,
      conventionMagicLinkPayload: {
        id: convention.id,
        email: convention.establishmentTutor.email,
        role: "establishment-tutor",
        now,
      },
      generateConventionMagicLinkUrl: deps.generateConventionMagicLinkUrl,
      shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
      uow,
    });

    const assessmentCreationLink = await makeShortMagicLink({
      targetRoute: "assessment",
      lifetime: "2Days",
    });

    const beneficiaryName = getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
      lastname: convention.signatories.beneficiary.lastName,
    });
    const establishmentTutorName = getFormattedFirstnameAndLastname({
      firstname: convention.establishmentTutor.firstName,
      lastname: convention.establishmentTutor.lastName,
    });

    await Promise.all([
      deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: {
          kind: "ASSESSMENT_DELETED_ESTABLISHMENT_NOTIFICATION",
          recipients: [convention.establishmentTutor.email],
          params: {
            assessmentCreationLink,
            beneficiaryName,
            establishmentTutorName,
            justification: inputParams.deleteAssessmentJustification,
            internshipKind: convention.internshipKind,
          },
        },
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
          ...(inputParams.triggeredBy?.kind === "connected-user"
            ? { userId: inputParams.triggeredBy.userId }
            : {}),
        },
      }),
      deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: {
          kind: "ASSESSMENT_DELETED_BENEFICIARY_NOTIFICATION",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            beneficiaryName,
            conventionId: convention.id,
            internshipKind: convention.internshipKind,
          },
        },
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
          ...(inputParams.triggeredBy?.kind === "connected-user"
            ? { userId: inputParams.triggeredBy.userId }
            : {}),
        },
      }),
    ]);
  });
