import subDays from "date-fns/subDays";
import { configureGenerateHtmlFromTemplate } from "html-templates";
import {
  type AbsoluteUrl,
  type CommonDiscussionDto,
  type CreateDiscussionDto,
  createDiscussionSchema,
  type DiscussionDto,
  type ExtraDiscussionDtoProperties,
  emailTemplatesByName,
  errors,
  normalizedMonthInDays,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { UuidGenerator } from "../../core/uuid-generator/ports/UuidGenerator";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";
import { makeContactByEmailRequestParams } from "../helpers/contactRequest";

type Deps = {
  createNewEvent: CreateNewEvent;
  uuidGenerator: UuidGenerator;
  timeGateway: TimeGateway;
  minimumNumberOfDaysBetweenSimilarContactRequests: number;
  immersionFacileBaseUrl: AppConfig["immersionFacileBaseUrl"];
};

export type ContactEstablishment = ReturnType<typeof makeContactEstablishment>;

export const makeContactEstablishment = useCaseBuilder("ContactEstablishment")
  .withInput(createDiscussionSchema)
  .withDeps<Deps>()
  .build(
    async ({
      inputParams: contactRequest,
      uow,
      deps: {
        createNewEvent,
        immersionFacileBaseUrl,
        minimumNumberOfDaysBetweenSimilarContactRequests,
        timeGateway,
        uuidGenerator,
      },
    }) => {
      const now = timeGateway.now();
      const { siret, contactMode } = contactRequest;

      const establishmentAggregate =
        await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
          siret,
        );
      if (!establishmentAggregate)
        throw errors.establishment.notFound({ siret });

      if (
        await uow.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
          siret,
        )
      )
        throw errors.establishment.bannedEstablishment({ siret });

      if (contactMode !== establishmentAggregate.establishment.contactMode)
        throw errors.establishment.contactRequestContactModeMismatch({
          siret,
          contactModes: {
            inParams: contactMode,
            inRepo: establishmentAggregate.establishment.contactMode,
          },
        });

      if (
        (establishmentAggregate.establishment.nextAvailabilityDate &&
          new Date(establishmentAggregate.establishment.nextAvailabilityDate) >
            timeGateway.now()) ||
        establishmentAggregate.establishment.isMaxDiscussionsForPeriodReached
      )
        throw errors.establishment.forbiddenUnavailable({ siret });

      const similarDiscussionAlreadyExits =
        await uow.discussionRepository.hasDiscussionMatching({
          siret: contactRequest.siret,
          appellationCode: contactRequest.appellationCode,
          potentialBeneficiaryEmail: contactRequest.potentialBeneficiaryEmail,
          addressId: contactRequest.locationId,
          since: subDays(now, minimumNumberOfDaysBetweenSimilarContactRequests),
        });

      if (similarDiscussionAlreadyExits)
        throw errors.establishment.contactRequestConflict({
          siret,
          appellationCode: contactRequest.appellationCode,
          minimumNumberOfDaysBetweenSimilarContactRequests:
            minimumNumberOfDaysBetweenSimilarContactRequests,
        });

      const appellationLabel = establishmentAggregate.offers.find(
        (offer) => offer.appellationCode === contactRequest.appellationCode,
      )?.appellationLabel;

      if (!appellationLabel) {
        throw errors.establishment.offerMissing({
          siret,
          appellationCode: contactRequest.appellationCode,
          mode: "bad request",
        });
      }

      const discussion = await createDiscussion({
        contactRequest,
        establishment: establishmentAggregate,
        now,
        uow,
        uuidGenerator,
        immersionFacileBaseUrl,
      });

      await uow.discussionRepository.insert(discussion);

      await markEstablishmentAsNotSearchableIfLimitReached({
        uow,
        establishmentAggregate,
        now,
      });

      await uow.outboxRepository.save(
        createNewEvent({
          topic: "ContactRequestedByBeneficiary",
          payload: {
            siret: discussion.siret,
            discussionId: discussion.id,
            triggeredBy: null,
            isLegacy: false,
          },
        }),
      );
    },
  );

const createDiscussion = async ({
  contactRequest,
  establishment,
  now,
  uow,
  uuidGenerator,
  immersionFacileBaseUrl,
}: {
  contactRequest: CreateDiscussionDto;
  establishment: EstablishmentAggregate;
  now: Date;
  uow: UnitOfWork;
  uuidGenerator: UuidGenerator;
  immersionFacileBaseUrl: AbsoluteUrl;
}): Promise<DiscussionDto> => {
  const matchingAddress =
    contactRequest.contactMode === "IN_PERSON"
      ? establishment.establishment.potentialBeneficiaryWelcomeAddress
      : establishment.establishment.locations.find(
          (address) => address.id === contactRequest.locationId,
        );
  if (!matchingAddress)
    throw errors.establishment.missingLocation({
      siret: contactRequest.siret,
      locationId: contactRequest.locationId,
    });

  const common: CommonDiscussionDto = {
    id: uuidGenerator.new(),
    siret: contactRequest.siret,
    businessName:
      establishment.establishment.customizedName ??
      establishment.establishment.name,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    address: matchingAddress.address,
    status: "PENDING",
    locationId: contactRequest.locationId,
    ...(establishment.establishment.isEstablishmentBanned
      ? {
          isEstablishmentBanned:
            establishment.establishment.isEstablishmentBanned,
          establishmentBannishmentJustification:
            establishment.establishment.establishmentBannishmentJustification,
        }
      : {
          isEstablishmentBanned:
            establishment.establishment.isEstablishmentBanned,
        }),
  };

  const extraDiscussionDtoProperties: ExtraDiscussionDtoProperties = {
    appellationCode: contactRequest.appellationCode,
    acquisitionCampaign: contactRequest.acquisitionCampaign,
    acquisitionKeyword: contactRequest.acquisitionKeyword,
    exchanges: [],
  };

  return makeDiscussionDto({
    contactRequest,
    immersionFacileBaseUrl,
    common,
    extraDiscussionDtoProperties,
    now,
    uow,
  });
};

const markEstablishmentAsNotSearchableIfLimitReached = async ({
  uow,
  establishmentAggregate,
  now,
}: {
  uow: UnitOfWork;
  establishmentAggregate: EstablishmentAggregate;
  now: Date;
}) => {
  if (
    (await wasMaxForMonthReached({
      uow,
      establishment: establishmentAggregate.establishment,
      now,
    })) ||
    (await wasMaxForWeekReached({
      uow,
      establishment: establishmentAggregate.establishment,
      now,
    }))
  ) {
    const updatedEstablishment: EstablishmentAggregate = {
      ...establishmentAggregate,
      establishment: {
        ...establishmentAggregate.establishment,
        isMaxDiscussionsForPeriodReached: true,
      },
    };

    await uow.establishmentAggregateRepository.updateEstablishmentAggregate(
      updatedEstablishment,
      now,
    );
  }
};

const wasMaxForMonthReached = async ({
  uow,
  establishment,
  now,
}: {
  uow: UnitOfWork;
  establishment: EstablishmentEntity;
  now: Date;
}): Promise<boolean> => {
  const oneMonthAgo = subDays(now, normalizedMonthInDays);
  const numberOfDiscussionsOfPastMonth =
    await uow.discussionRepository.countDiscussionsForSiretSince(
      establishment.siret,
      oneMonthAgo,
    );

  return establishment.maxContactsPerMonth <= numberOfDiscussionsOfPastMonth;
};

const wasMaxForWeekReached = async ({
  uow,
  establishment,
  now,
}: {
  uow: UnitOfWork;
  establishment: EstablishmentEntity;
  now: Date;
}): Promise<boolean> => {
  const oneWeekAgo = subDays(now, 7);
  const numberOfDiscussionsOfPastWeek =
    await uow.discussionRepository.countDiscussionsForSiretSince(
      establishment.siret,
      oneWeekAgo,
    );
  const maxContactsPerWeek = Math.ceil(establishment.maxContactsPerMonth / 4);

  return maxContactsPerWeek <= numberOfDiscussionsOfPastWeek;
};

const makeDiscussionDto = async ({
  common,
  extraDiscussionDtoProperties,
  contactRequest,
  now,
  immersionFacileBaseUrl,
  uow,
}: {
  common: CommonDiscussionDto;
  extraDiscussionDtoProperties: ExtraDiscussionDtoProperties;
  contactRequest: CreateDiscussionDto;
  immersionFacileBaseUrl: AppConfig["immersionFacileBaseUrl"];
  uow: UnitOfWork;
  now: Date;
}): Promise<DiscussionDto> => {
  const discussion: DiscussionDto = {
    ...common,
    ...extraDiscussionDtoProperties,
    contactMode: contactRequest.contactMode,
    ...(contactRequest.kind === "IF"
      ? {
          kind: contactRequest.kind,
          potentialBeneficiary: {
            firstName: contactRequest.potentialBeneficiaryFirstName,
            lastName: contactRequest.potentialBeneficiaryLastName,
            email: contactRequest.potentialBeneficiaryEmail,
            motivation: contactRequest.motivation,
            immersionDuration: contactRequest.immersionDuration,
            experienceAdditionalInformation:
              contactRequest.experienceAdditionalInformation,
            datePreferences: contactRequest.datePreferences,
            phone: contactRequest.potentialBeneficiaryPhone,
            resumeLink: contactRequest.potentialBeneficiaryResumeLink,
            immersionObjective: contactRequest.immersionObjective,
          },
        }
      : {
          kind: contactRequest.kind,
          potentialBeneficiary: {
            firstName: contactRequest.potentialBeneficiaryFirstName,
            lastName: contactRequest.potentialBeneficiaryLastName,
            email: contactRequest.potentialBeneficiaryEmail,
            datePreferences: contactRequest.datePreferences,
            phone: contactRequest.potentialBeneficiaryPhone,
            levelOfEducation: contactRequest.levelOfEducation,
            immersionObjective: contactRequest.immersionObjective,
          },
        }),
  };

  if (discussion.contactMode === "EMAIL") {
    const [appellation] =
      await uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
        [discussion.appellationCode],
      );

    const emailContent = configureGenerateHtmlFromTemplate(
      emailTemplatesByName,
      {
        header: undefined,
        footer: undefined,
      },
    )(
      "CONTACT_BY_EMAIL_REQUEST",
      makeContactByEmailRequestParams({
        discussion,
        immersionFacileBaseUrl,
        appellation,
      }),
      { showContentParts: true },
    );

    if (!emailContent.contentParts)
      throw errors.email.missingContentParts("CONTACT_BY_EMAIL_REQUEST");

    return {
      ...discussion,
      exchanges: [
        {
          subject: emailContent.subject,
          sentAt: now.toISOString(),
          message: `${emailContent.contentParts.greetings}
              ${emailContent.contentParts.content}
              ${emailContent.contentParts.subContent}`,
          sender: "potentialBeneficiary",
          attachments: [],
        },
      ],
    };
  }

  return discussion;
};
