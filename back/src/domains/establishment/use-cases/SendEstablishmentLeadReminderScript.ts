import { subDays } from "date-fns";
import {
  type AbsoluteUrl,
  type ConventionDto,
  type ConventionId,
  castError,
  executeInSequence,
  frontRoutes,
  immersionFacileNoReplyEmailSender,
  localization,
  makeRouteAbsoluteUrl,
  type SiretDto,
} from "shared";
import { z } from "zod";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../config/bootstrap/magicLinkUrl";
import { createLogger } from "../../../utils/logger";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { SaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { makeShortLink } from "../../core/short-link/ShortLink";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  type EstablishmentLeadEventKind,
  establishmentLeadEventKind,
} from "../entities/EstablishmentLeadEntity";

const logger = createLogger(__filename);

export type SendEstablishmentLeadReminderOutput = {
  errors?: Record<SiretDto, Error>;
  establishmentsReminded: SiretDto[];
};

export type EstablishmentLeadReminderParams = {
  kind: EstablishmentLeadEventKind;
  beforeDate?: Date;
};

export type SendEstablishmentLeadReminderScript = ReturnType<
  typeof makeSendEstablishmentLeadReminderScript
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  createNewEvent: CreateNewEvent;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  timeGateway: TimeGateway;
};

export const makeSendEstablishmentLeadReminderScript = useCaseBuilder(
  "SendEstablishmentLeadReminderScript",
)
  .withInput(
    z.object({
      kind: z.enum(establishmentLeadEventKind, {
        error: localization.invalidEnum,
      }),
      beforeDate: z.date().optional(),
    }),
  )
  .withOutput<SendEstablishmentLeadReminderOutput>()
  .withDeps<Deps>()
  .build(async ({ deps, inputParams: { kind, beforeDate }, uow }) => {
    const tenDaysAgo = subDays(deps.timeGateway.now(), 10);
    const leadConventions =
      await uow.establishmentLeadQueries.getLastConventionsByUniqLastEventKind({
        conventionEndDateGreater: tenDaysAgo,
        kind,
        beforeDate,
        maxResults: 1000,
      });

    const registeredSirets =
      await uow.establishmentAggregateRepository.getSiretsInRepoFromSiretList(
        leadConventions.map(({ siret }) => siret),
      );

    const conventions = leadConventions.filter(
      ({ siret }) => !registeredSirets.includes(siret),
    );

    logger.info({ message: `processing ${conventions.length} conventions` });

    const errors: Record<ConventionId, Error> = {};

    await executeInSequence(conventions, async (convention) =>
      sendOneEmailWithEstablishmentLeadReminder({
        uow,
        deps,
        convention,
      }).catch((error) => {
        errors[convention.id] = castError(error);
      }),
    );

    return {
      establishmentsReminded: conventions.map(({ siret }) => siret),
      errors,
    };
  });

const sendOneEmailWithEstablishmentLeadReminder = async ({
  uow,
  convention,
  deps: {
    config,
    generateConventionMagicLinkUrl,
    createNewEvent,
    saveNotificationAndRelatedEvent,
    shortLinkIdGeneratorGateway,
    timeGateway,
  },
}: {
  uow: UnitOfWork;
  deps: Deps;
  convention: ConventionDto;
}): Promise<void> => {
  const now = timeGateway.now();

  const registerEstablishmentShortLink = await makeShortLink({
    uow,
    shortLinkIdGeneratorGateway,
    config,
    longLink: generateAddEstablishmentFormLink({
      config,
      convention,
      acquisitionCampaign: "transactionnel-etablissement-rappel-inscription",
    }),
  });

  const unsubscribeToEmailShortLink = await makeShortLink({
    uow,
    shortLinkIdGeneratorGateway,
    config,
    longLink: generateConventionMagicLinkUrl({
      id: convention.id,
      email: convention.signatories.establishmentRepresentative.email,
      role: "establishment-representative",
      targetRoute: "unregisterEstablishmentLead",
      now,
    }),
  });

  const notification = await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      kind: "ESTABLISHMENT_LEAD_REMINDER",
      recipients: [convention.signatories.establishmentRepresentative.email],
      sender: immersionFacileNoReplyEmailSender,
      params: {
        businessName: convention.businessName,
        registerEstablishmentShortLink,
        unsubscribeToEmailShortLink,
      },
    },
    followedIds: {
      conventionId: convention.id,
      establishmentSiret: convention.siret,
    },
  });

  const establishmentLead = await uow.establishmentLeadRepository.getBySiret(
    convention.siret,
  );

  if (establishmentLead) {
    await uow.establishmentLeadRepository.save({
      ...establishmentLead,
      events: [
        ...establishmentLead.events,
        {
          kind: "reminder-sent",
          occurredAt: now,
          notification: { kind: notification.kind, id: notification.id },
        },
      ],
    });
  }

  await uow.outboxRepository.save(
    createNewEvent({
      topic: "EstablishmentLeadReminderSent",
      payload: { id: convention.id },
    }),
  );
};

const generateAddEstablishmentFormLink = ({
  config,
  convention,
  acquisitionCampaign,
}: {
  config: AppConfig;
  convention: ConventionDto;
  acquisitionCampaign: string;
}): AbsoluteUrl =>
  makeRouteAbsoluteUrl({
    route: frontRoutes.formEstablishment({
      fromConventionId: convention.id,
      at_campaign: acquisitionCampaign,
    }),
    baseUrl: config.immersionFacileBaseUrl,
  });
