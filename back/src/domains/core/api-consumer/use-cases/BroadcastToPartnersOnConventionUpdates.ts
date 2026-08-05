import { filter } from "ramda";
import {
  type ApiConsumer,
  type ApiConsumerName,
  type AppellationAndRomeDto,
  type ConventionReadDto,
  errors,
  executeInSequence,
  isApiConsumerAllowed,
  pipeWithValue,
} from "shared";
import { conventionDtosToConventionReadDtos } from "../../../../utils/convention";
import { createLogger } from "../../../../utils/logger";
import { withConventionIdAndPreviousAgencySchema } from "../../../convention/use-cases/broadcast/broadcastConventionParams";
import { broadcastToPartnersServiceName } from "../../saved-errors/ports/BroadcastFeedbacksRepository";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../useCaseBuilder";
import { getReferedAgency } from "../helpers/agency";
import type { SubscribersGateway } from "../ports/SubscribersGateway";

const logger = createLogger(__filename);

export type BroadcastToPartnersOnConventionUpdates = ReturnType<
  typeof makeBroadcastToPartnersOnConventionUpdates
>;

export const makeBroadcastToPartnersOnConventionUpdates = useCaseBuilder(
  "BroadcastToPartnersOnConventionUpdates",
)
  .withInput(withConventionIdAndPreviousAgencySchema)
  .withDeps<{
    subscribersGateway: SubscribersGateway;
    timeGateway: TimeGateway;
    consumerNamesUsingRomeV3: ApiConsumerName[];
  }>()
  .build(async ({ inputParams, uow, deps }) => {
    const { conventionId } = inputParams;
    const convention = await uow.conventionRepository.getById(conventionId);
    if (!convention) throw errors.convention.notFound({ conventionId });

    const {
      acquisitionCampaign: _,
      acquisitionKeyword: __,
      ...conventionWithoutAcquisitionParams
    } = convention;

    const [conventionRead] = await conventionDtosToConventionReadDtos(
      [conventionWithoutAcquisitionParams],
      uow,
    );

    const previousAgencyWithRights = inputParams.previousAgencyId
      ? await uow.agencyRepository.getById(inputParams.previousAgencyId)
      : undefined;
    const previousRefersTo = previousAgencyWithRights?.refersToAgencyId
      ? await getReferedAgency(uow, previousAgencyWithRights.refersToAgencyId)
      : undefined;

    const apiConsumers = pipeWithValue(
      await uow.apiConsumerRepository.getByFilters({
        agencyIds: [
          conventionRead.agencyId,
          ...(conventionRead.agencyRefersTo
            ? [conventionRead.agencyRefersTo.id]
            : []),
          ...(previousAgencyWithRights ? [previousAgencyWithRights.id] : []),
          ...(previousRefersTo ? [previousRefersTo.id] : []),
        ],
        agencyKinds: [
          conventionRead.agencyKind,
          ...(conventionRead.agencyRefersTo
            ? [conventionRead.agencyRefersTo.kind]
            : []),
          ...(previousAgencyWithRights ? [previousAgencyWithRights.kind] : []),
          ...(previousRefersTo ? [previousRefersTo.kind] : []),
        ],
      }),
      filter<ApiConsumer>(
        (apiConsumer) =>
          isApiConsumerAllowed({
            apiConsumer,
            rightName: "convention",
            consumerKind: "SUBSCRIPTION",
          }) && isConsumerSubscribedToConventionUpdated(apiConsumer),
      ),
    );

    if (conventionRead.agencyKind === "mission-locale") {
      logger.warn({
        message: debugDoubleBroadcastMessage(
          `apiConsumers.length: ${apiConsumers.length}. ${apiConsumers.length > 1 ? JSON.stringify(apiConsumers) : ""}`,
        ),
        conventionId: convention.id,
      });
    }

    await executeInSequence(apiConsumers, (apiConsumer) =>
      notifySubscriber({ uow, conventionRead, deps })(apiConsumer),
    );
  });

const debugDoubleBroadcastMessage = (message: string) =>
  `Debug Mission Local, message en double. ${message}`;

const isConsumerSubscribedToConventionUpdated = (apiConsumer: ApiConsumer) => {
  const conventionUpdatedCallbackParams =
    apiConsumer.rights.convention.subscriptions.find(
      (sub) => sub.subscribedEvent === "convention.updated",
    );
  return !!conventionUpdatedCallbackParams;
};

const getImmersionAppellation = async ({
  uow,
  conventionRead,
  apiConsumer,
  consumerNamesUsingRomeV3,
}: {
  uow: UnitOfWork;
  conventionRead: ConventionReadDto;
  apiConsumer: ApiConsumer;
  consumerNamesUsingRomeV3: ApiConsumerName[];
}): Promise<AppellationAndRomeDto> => {
  if (consumerNamesUsingRomeV3.includes(apiConsumer.name)) {
    const appellationAndRome =
      await uow.romeRepository.getAppellationAndRomeLegacyV3(
        conventionRead.immersionAppellation.appellationCode,
      );

    if (appellationAndRome) return appellationAndRome;
  }

  return conventionRead.immersionAppellation;
};

const notifySubscriber = ({
  uow,
  conventionRead,
  deps,
}: {
  uow: UnitOfWork;
  conventionRead: ConventionReadDto;
  deps: {
    subscribersGateway: SubscribersGateway;
    timeGateway: TimeGateway;
    consumerNamesUsingRomeV3: ApiConsumerName[];
  };
}) => {
  return async (apiConsumer: ApiConsumer) => {
    const immersionAppellation = await getImmersionAppellation({
      uow,
      conventionRead,
      apiConsumer,
      consumerNamesUsingRomeV3: deps.consumerNamesUsingRomeV3,
    });

    const conventionUpdatedCallbackParams =
      apiConsumer.rights.convention.subscriptions.find(
        (sub) => sub.subscribedEvent === "convention.updated",
      );

    if (!conventionUpdatedCallbackParams) {
      throw errors.apiConsumer.missingCallbackParams({
        conventionId: conventionRead.id,
        consumerId: apiConsumer.id,
      });
    }

    const convention = {
      ...conventionRead,
      immersionAppellation,
    };

    if (conventionRead.agencyKind === "mission-locale") {
      logger.warn({
        message: debugDoubleBroadcastMessage("About to broadcast convention"),
        conventionId: convention.id,
      });
    }

    const response = await deps.subscribersGateway.notify(
      {
        payload: { convention },
        subscribedEvent: "convention.updated",
      },
      {
        callbackUrl: conventionUpdatedCallbackParams.callbackUrl,
        callbackHeaders: conventionUpdatedCallbackParams.callbackHeaders,
      },
    );

    if (response.title === "Partner subscription errored") {
      logger.error({ subscriberResponse: response });

      await uow.broadcastFeedbacksRepository.save({
        consumerId: apiConsumer.id,
        consumerName: apiConsumer.name,
        conventionId: convention.id,
        agencyId: convention.agencyId,
        handledByAgency: false,
        subscriberErrorFeedback: response.subscriberErrorFeedback,
        occurredAt: deps.timeGateway.now().toISOString(),
        requestParams: {
          callbackUrl: response.callbackUrl,
          conventionId: convention.id,
          conventionStatus: convention.status,
        },
        serviceName: broadcastToPartnersServiceName,
        ...(response.status
          ? { response: { httpStatus: response.status, body: response.body } }
          : {}),
      });

      return;
    }

    await uow.broadcastFeedbacksRepository.save({
      consumerId: apiConsumer.id,
      consumerName: apiConsumer.name,
      conventionId: convention.id,
      agencyId: convention.agencyId,
      handledByAgency: false,
      occurredAt: deps.timeGateway.now().toISOString(),
      requestParams: {
        callbackUrl: response.callbackUrl,
        conventionId: convention.id,
        conventionStatus: convention.status,
      },
      ...(response.status
        ? { response: { httpStatus: response.status, body: response.body } }
        : {}),
      serviceName: broadcastToPartnersServiceName,
    });

    logger.info({ subscriberResponse: response });
  };
};
