import {
  type AgencyDto,
  type AgencyId,
  type AssessmentDto,
  agencyIdSchema,
  assessmentDtoSchema,
  type ConventionReadDto,
  cleanSpecialChars,
  conventionReadSchema,
  sliceTextUpToBytesLimit,
} from "shared";
import z from "zod";
import { toPartnerAgencyKind } from "../../../../utils/agency";
import { isAxiosError } from "../../../../utils/axiosUtils";
import {
  broadcastToFtConsumerName,
  broadcastToFtServiceName,
} from "../../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import {
  getLinkedAgenciesFromAgencyId,
  shouldBroadcastToFranceTravail,
} from "../../entities/Convention";
import {
  type FranceTravailBroadcastResponse,
  type FranceTravailConventionReadDto,
  type FranceTravailGateway,
  isBroadcastSuccessResponse,
  notifyFranceTravailOnConventionUpdatedParamsSchema,
} from "../../ports/FranceTravailGateway";
import type { BroadcastConventionParams } from "./broadcastConventionParams";

export const broadcastToFranceTravailOnConventionUpdatesInputSchema: z.ZodType<
  BroadcastConventionParams,
  | {
      eventType: "CONVENTION_UPDATED";
      convention: ConventionReadDto;
      previousAgencyId?: AgencyId;
      assessment?: AssessmentDto;
    }
  | {
      eventType: "ASSESSMENT_CREATED";
      convention: ConventionReadDto;
      assessment: AssessmentDto;
    }
> = z.union([
  z.object({
    eventType: z.literal("CONVENTION_UPDATED"),
    convention: conventionReadSchema,
    previousAgencyId: agencyIdSchema.optional(),
    assessment: assessmentDtoSchema.optional(),
  }),
  z.object({
    eventType: z.literal("ASSESSMENT_CREATED"),
    convention: conventionReadSchema,
    assessment: assessmentDtoSchema,
  }),
]);

export type BroadcastToFranceTravailOnConventionUpdates = ReturnType<
  typeof makeBroadcastToFranceTravailOnConventionUpdates
>;
export const makeBroadcastToFranceTravailOnConventionUpdates = useCaseBuilder(
  "BroadcastToFranceTravailOnConventionUpdates",
)
  .withInput(broadcastToFranceTravailOnConventionUpdatesInputSchema)
  .withDeps<{
    franceTravailGateway: FranceTravailGateway;
    timeGateway: TimeGateway;
    options: { resyncMode: boolean };
  }>()
  .build(async ({ inputParams, uow, deps }): Promise<void> => {
    const { agency, refersToAgency } = await getLinkedAgenciesFromAgencyId(
      uow,
      inputParams.convention.agencyId,
    );

    const featureFlags = await uow.featureFlagQueries.getAll();

    const shouldBroadcastForCurrentAgency = shouldBroadcastToFranceTravail({
      agency,
      refersToAgency,
      featureFlags,
    });

    const previousLinkedAgencies =
      inputParams.eventType === "CONVENTION_UPDATED" &&
      inputParams.previousAgencyId &&
      !shouldBroadcastForCurrentAgency
        ? await getLinkedAgenciesFromAgencyId(uow, inputParams.previousAgencyId)
        : undefined;

    const shouldBroadcastForPreviousAgency = previousLinkedAgencies
      ? shouldBroadcastToFranceTravail({
          agency: previousLinkedAgencies.agency,
          refersToAgency: previousLinkedAgencies.refersToAgency,
          featureFlags,
        })
      : false;

    const shouldBroadcast =
      shouldBroadcastForCurrentAgency || shouldBroadcastForPreviousAgency;

    if (!shouldBroadcast)
      return deps.options.resyncMode
        ? uow.conventionsToSyncRepository.save({
            id: inputParams.convention.id,
            status: "SKIP",
            processDate: deps.timeGateway.now(),
            reason: "Agency is not of kind france-travail",
          })
        : undefined;

    if (!featureFlags.enableFranceTravailConventionBroadcast.isActive) {
      await uow.conventionsToSyncRepository.save({
        id: inputParams.convention.id,
        status: "TO_PROCESS",
      });
      return;
    }

    const response = await deps.franceTravailGateway.notifyOnConventionUpdated(
      notifyFranceTravailOnConventionUpdatedParamsSchema.parse({
        ...inputParams,
        convention: makeFranceTravailSupportedConvention(
          inputParams.convention,
          agency,
        ),
      }),
    );

    if (isBroadcastTimeoutError(response))
      await uow.conventionsToSyncRepository.save({
        id: inputParams.convention.id,
        status: "TO_PROCESS",
      });
    else if (deps.options.resyncMode && isBroadcastSuccessResponse(response))
      await uow.conventionsToSyncRepository.save({
        id: inputParams.convention.id,
        status: "SUCCESS",
        processDate: deps.timeGateway.now(),
      });

    await uow.broadcastFeedbacksRepository.save({
      consumerId: null,
      consumerName: broadcastToFtConsumerName,
      conventionId: inputParams.convention.id,
      agencyId: inputParams.convention.agencyId,
      serviceName: broadcastToFtServiceName,
      requestParams: {
        conventionId: inputParams.convention.id,
        conventionStatus: inputParams.convention.status,
      },
      response: { httpStatus: response.status, body: response.body },
      occurredAt: deps.timeGateway.now().toISOString(),
      handledByAgency: false,
      ...(!isBroadcastSuccessResponse(response)
        ? { subscriberErrorFeedback: response.subscriberErrorFeedback }
        : {}),
    });
  });

const makeFranceTravailSupportedConvention = (
  convention: ConventionReadDto,
  agency: AgencyDto,
): FranceTravailConventionReadDto => {
  const { agencyKind, agencyRefersTo, ...rest } = convention;
  return {
    ...rest,
    agencyKind: toPartnerAgencyKind(agencyKind),
    ...(agencyRefersTo
      ? {
          agencyRefersTo: {
            ...agencyRefersTo,
            kind: toPartnerAgencyKind(agencyRefersTo.kind),
          },
        }
      : {}),
    establishmentTutor: {
      ...convention.establishmentTutor,
      job: sliceTextUpToBytesLimit(convention.establishmentTutor.job, 255),
    },
    sanitaryPreventionDescription: sliceTextUpToBytesLimit(
      cleanSpecialChars(convention.sanitaryPreventionDescription),
      255,
    ),
    individualProtectionDescription: sliceTextUpToBytesLimit(
      cleanSpecialChars(convention.individualProtectionDescription),
      255,
    ),
    agencyValidatorEmails: agency.validatorEmails,
  };
};

const isBroadcastTimeoutError = (
  response: FranceTravailBroadcastResponse,
): boolean => {
  if (isBroadcastSuccessResponse(response)) return false;
  const message = response.subscriberErrorFeedback.message.toLowerCase();
  if (message.includes("timeout")) return true;
  const error = response.subscriberErrorFeedback.error;

  if (
    isAxiosError(error) &&
    (error.code === "ECONNABORTED" || error.code === "ECONNRESET")
  )
    return true;
  return false;
};
