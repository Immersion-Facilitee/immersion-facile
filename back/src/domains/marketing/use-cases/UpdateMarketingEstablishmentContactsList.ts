import { equals } from "ramda";
import {
  type ConventionDto,
  errors,
  isSuperEstablishment,
  type SiretDto,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { SiretGateway } from "../../core/sirene/ports/SiretGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentAggregate } from "../../establishment/entities/EstablishmentAggregate";
import type { MarketingContact } from "../entities/MarketingContact";
import type {
  ConventionInfos,
  EstablishmentMarketingGateway,
  EstablishmentMarketingSearchableBy,
} from "../ports/EstablishmentMarketingGateway";

export type UpdateMarketingEstablishmentContactList = ReturnType<
  typeof makeUpdateMarketingEstablishmentContactList
>;

export const makeUpdateMarketingEstablishmentContactList = useCaseBuilder(
  "UpdateMarketingEstablishmentContactList",
)
  .withInput<WithSiretDto>(withSiretSchema)
  .withOutput<void>()
  .withCurrentUser<void>()
  .withDeps<{
    establishmentMarketingGateway: EstablishmentMarketingGateway;
    siretGateway: SiretGateway;
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
  }>()
  .build(
    async ({
      inputParams: { siret },
      deps: {
        establishmentMarketingGateway,
        timeGateway,
        siretGateway,
        createNewEvent,
      },
      uow,
    }): Promise<void> => {
      const establishment =
        await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
          siret,
        );

      const marketingConventionsData = await getMarketingConventionsData(
        uow,
        siret,
      );

      return establishment
        ? onEstablishment({
            uow,
            marketingGateway: establishmentMarketingGateway,
            timeGateway,
            establishmentAggregate: establishment,
            marketingConventionsData,
            siretGateway,
          })
        : onMissingEstablishment({
            uow,
            timeGateway,
            siretGateway,
            establishmentMarketingGateway,
            createNewEvent,
            marketingConventionsData,
            siret,
          });
    },
  );

type MarketingConventionsData = {
  firstConvention: ConventionDto | undefined;
  lastConvention: ConventionDto | undefined;
  totalNumberOfConvention: number;
};

const getMarketingConventionsData = async (
  uow: UnitOfWork,
  siret: SiretDto,
): Promise<MarketingConventionsData> => {
  const validatedConventionIds =
    await uow.conventionQueries.getConventionIdsByFilters({
      filters: {
        withSirets: [siret],
        withStatuses: ["ACCEPTED_BY_VALIDATOR"],
      },
      sortBy: "dateValidation",
    });

  const lastConventionId = validatedConventionIds.at(0);
  const firstConventionId = validatedConventionIds.at(-1);

  const lastConvention = lastConventionId
    ? await uow.conventionQueries.getConventionById(lastConventionId)
    : undefined;

  const firstConvention =
    firstConventionId && firstConventionId !== lastConventionId
      ? await uow.conventionQueries.getConventionById(firstConventionId)
      : lastConvention;

  return {
    firstConvention,
    lastConvention,
    totalNumberOfConvention: validatedConventionIds.length,
  };
};

const onMissingEstablishment = async ({
  uow,
  timeGateway,
  siretGateway,
  establishmentMarketingGateway,
  createNewEvent,
  marketingConventionsData,
  siret,
}: {
  uow: UnitOfWork;
  timeGateway: TimeGateway;
  siretGateway: SiretGateway;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
  createNewEvent: CreateNewEvent;
  marketingConventionsData: MarketingConventionsData;
  siret: SiretDto;
}): Promise<void> => {
  const { lastConvention } = marketingConventionsData;

  if (!lastConvention) {
    await uow.outboxRepository.save(
      createNewEvent({
        topic: "MarketingEstablishmentContactDeletionRequested",
        payload: { siret, triggeredBy: { kind: "crawler" } },
      }),
    );
    return;
  }

  const marketingContact: MarketingContact = {
    createdAt: timeGateway.now(),
    email: lastConvention.signatories.establishmentRepresentative.email,
    firstName: lastConvention.signatories.establishmentRepresentative.firstName,
    lastName: lastConvention.signatories.establishmentRepresentative.lastName,
  };

  await saveMarketingContactEntity({
    uow,
    siret: lastConvention.siret,
    marketingContact,
    siretGateway,
    establishmentMarketingGateway,
  });

  return establishmentMarketingGateway.save({
    isRegistered: false,
    email: marketingContact.email,
    firstName: marketingContact.firstName,
    lastName: marketingContact.lastName,
    conventions: makeConventionInfos(marketingConventionsData),
    hasIcAccount: false,
    numberEmployeesRange: lastConvention.establishmentNumberEmployeesRange,
    siret: lastConvention.siret,
  });
};

const onEstablishment = async ({
  uow,
  marketingGateway,
  timeGateway,
  establishmentAggregate,
  marketingConventionsData,
  siretGateway,
}: {
  uow: UnitOfWork;
  marketingGateway: EstablishmentMarketingGateway;
  timeGateway: TimeGateway;
  establishmentAggregate: EstablishmentAggregate;
  marketingConventionsData: MarketingConventionsData;
  siretGateway: SiretGateway;
}): Promise<void> => {
  const firstLocation = establishmentAggregate.establishment.locations.at(0);
  if (!firstLocation) throw new Error("Establishement has no location.");

  const establishmentAdmin = establishmentAggregate.userRights.find((user) =>
    user.role.includes("establishment-admin"),
  );
  if (!establishmentAdmin)
    throw errors.establishment.adminNotFound({
      siret: establishmentAggregate.establishment.siret,
    });

  const userMarketingContact = await uow.userRepository.getById(
    establishmentAdmin.userId,
  );

  if (!userMarketingContact)
    throw errors.user.notFound({ userId: establishmentAdmin.userId });
  const marketingContact: MarketingContact = {
    createdAt: timeGateway.now(),
    email: userMarketingContact.email,
    firstName: userMarketingContact.firstName,
    lastName: userMarketingContact.lastName,
  };

  await saveMarketingContactEntity({
    uow,
    siret: establishmentAggregate.establishment.siret,
    marketingContact,
    siretGateway,
    establishmentMarketingGateway: marketingGateway,
  });

  const user = await uow.userRepository.findByEmail(marketingContact.email);

  const hasIcAccount = !!user?.proConnect;

  const discussions = await uow.discussionRepository.getDiscussions({
    filters: { sirets: [establishmentAggregate.establishment.siret] },
    limit: 500,
  });

  const numberOfDiscussionsAnswered = discussions.filter((discussion) =>
    discussion.exchanges.some(
      (exchange) => exchange.sender === "establishment",
    ),
  ).length;

  return marketingGateway.save({
    email: marketingContact.email,
    firstName: marketingContact.firstName,
    lastName: marketingContact.lastName,
    conventions: makeConventionInfos(marketingConventionsData),
    departmentCode: firstLocation.address.departmentCode,
    hasIcAccount,
    isRegistered: true,
    maxContactsPerMonth:
      establishmentAggregate.establishment.maxContactsPerMonth,
    nafCode: establishmentAggregate.establishment.nafDto.code,
    numberOfDiscussionsAnswered,
    numberOfDiscussionsReceived: discussions.length,
    searchableBy: makeEstablishmentMarketingSearchableBy(
      establishmentAggregate,
    ),
    siret: establishmentAggregate.establishment.siret,
    nextAvailabilityDate:
      establishmentAggregate.establishment.nextAvailabilityDate &&
      new Date(establishmentAggregate.establishment.nextAvailabilityDate),
    numberEmployeesRange:
      establishmentAggregate.establishment.numberEmployeesRange,
    romes: establishmentAggregate.offers.map(({ romeCode }) => romeCode),
    isSuperEstablishment: isSuperEstablishment(
      establishmentAggregate.establishment.score,
    ),
  });
};

const makeConventionInfos = (
  marketingConventionsData: MarketingConventionsData,
): ConventionInfos => {
  const { firstConvention, lastConvention, totalNumberOfConvention } =
    marketingConventionsData;

  return {
    numberOfValidatedConvention: totalNumberOfConvention,
    ...(firstConvention?.dateValidation
      ? {
          firstConventionValidationDate: new Date(
            firstConvention.dateValidation,
          ),
        }
      : {}),
    ...(lastConvention?.dateValidation
      ? {
          lastConvention: {
            endDate: new Date(lastConvention.dateEnd),
            validationDate: new Date(lastConvention.dateValidation),
          },
        }
      : {}),
  };
};

const saveMarketingContactEntity = async ({
  uow,
  siret,
  marketingContact,
  siretGateway,
  establishmentMarketingGateway,
}: {
  uow: UnitOfWork;
  siret: SiretDto;
  marketingContact: MarketingContact;
  siretGateway: SiretGateway;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
}): Promise<void> => {
  const establishmentMarketingContactEntity =
    await uow.establishmentMarketingRepository.getBySiret(siret);

  const lastMarketingcontact =
    establishmentMarketingContactEntity?.emailContactHistory.at(0);

  if (establishmentMarketingContactEntity && !lastMarketingcontact)
    throw new Error(
      "Marketing contact does not have any contact history. This should not occurs.",
    );

  if (
    establishmentMarketingContactEntity &&
    establishmentMarketingContactEntity.contactEmail !== marketingContact.email
  ) {
    const previousContactEmail =
      establishmentMarketingContactEntity.contactEmail;

    const otherSiretsUsingPreviousContactEmail = (
      await uow.establishmentMarketingRepository.getSiretsByContactEmail(
        previousContactEmail,
      )
    ).filter((otherSiret) => otherSiret !== siret);

    if (otherSiretsUsingPreviousContactEmail.length === 0)
      await establishmentMarketingGateway.delete(previousContactEmail);
  }

  if (!equals(lastMarketingcontact, marketingContact))
    await uow.establishmentMarketingRepository.save({
      contactEmail: marketingContact.email,
      emailContactHistory: [
        marketingContact,
        ...(establishmentMarketingContactEntity
          ? establishmentMarketingContactEntity.emailContactHistory
          : []),
      ],
      siret,
      nafCode:
        (await siretGateway.getEstablishmentBySiret(siret))?.nafDto?.code ??
        null,
    });
};

const makeEstablishmentMarketingSearchableBy = (
  establishment: EstablishmentAggregate,
): EstablishmentMarketingSearchableBy => {
  if (
    establishment.establishment.searchableBy.jobSeekers &&
    establishment.establishment.searchableBy.students
  )
    return "all";

  return establishment.establishment.searchableBy.jobSeekers
    ? "jobSeekers"
    : "students";
};
