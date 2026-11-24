import {
  ConventionDtoBuilder,
  type ConventionId,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID,
  SEED_FT_AGENCY_ID,
  SEED_PARTIALLY_SIGNED_CONVENTION_ID,
} from "shared";
import type {
  DomainEvent,
  EventFailure,
} from "../../domains/core/events/events";
import { defaultPriority } from "../../domains/core/events/ports/EventBus";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { franceMerguez } from "./establishmentSeed";
import { seedUsers } from "./userSeed";

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const publishedOnce = ({
  hoursAgo: hours,
  failure,
}: {
  hoursAgo: number;
  failure?: EventFailure;
}): Pick<
  DomainEvent,
  "occurredAt" | "publications" | "status" | "wasQuarantined" | "priority"
> => ({
  occurredAt: hoursAgo(hours),
  publications: [
    { publishedAt: hoursAgo(hours), failures: failure ? [failure] : [] },
  ],
  status: failure ? "failed-to-many-times" : "published",
  wasQuarantined: false,
  priority: defaultPriority,
});

const makeConventionBuilder = (conventionId: ConventionId) =>
  new ConventionDtoBuilder()
    .withId(conventionId)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .notSigned();

export const eventSeed = async (uow: UnitOfWork) => {
  // biome-ignore lint/suspicious/noConsole: seed script progress output
  console.log("eventSeed start...");

  const uuidGenerator = new UuidV4Generator();

  const submittedConvention = makeConventionBuilder(
    SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID,
  ).withStatus("READY_TO_SIGN");
  const signedByBeneficiaryConvention = submittedConvention
    .withStatus("PARTIALLY_SIGNED")
    .signedByBeneficiary(hoursAgo(96));
  const fullySignedConvention = signedByBeneficiaryConvention
    .withStatus("IN_REVIEW")
    .signedByEstablishmentRepresentative(hoursAgo(72));
  const acceptedConvention = fullySignedConvention
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateValidation(hoursAgo(48));

  const partiallySignedConvention = makeConventionBuilder(
    SEED_PARTIALLY_SIGNED_CONVENTION_ID,
  );

  const events: DomainEvent[] = [
    {
      id: uuidGenerator.new(),
      topic: "ConventionSubmittedByBeneficiary",
      payload: {
        convention: submittedConvention.build(),
        triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
      },
      ...publishedOnce({ hoursAgo: 120 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "ConventionPartiallySigned",
      payload: {
        convention: signedByBeneficiaryConvention.build(),
        triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
      },
      ...publishedOnce({ hoursAgo: 96 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "ConventionFullySigned",
      payload: {
        convention: fullySignedConvention.build(),
        triggeredBy: {
          kind: "convention-magic-link",
          role: "establishment-representative",
        },
      },
      ...publishedOnce({ hoursAgo: 72 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "ConventionAcceptedByValidator",
      payload: {
        convention: acceptedConvention.build(),
        triggeredBy: { kind: "connected-user", userId: seedUsers.adminUser.id },
      },
      ...publishedOnce({ hoursAgo: 48 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "EstablishmentLeadReminderSent",
      payload: { id: SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID },
      ...publishedOnce({ hoursAgo: 24 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "ConventionSubmittedByBeneficiary",
      payload: {
        convention: partiallySignedConvention
          .withStatus("READY_TO_SIGN")
          .build(),
        triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
      },
      ...publishedOnce({ hoursAgo: 50 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "ConventionPartiallySigned",
      payload: {
        convention: partiallySignedConvention
          .withStatus("PARTIALLY_SIGNED")
          .signedByBeneficiary(hoursAgo(48))
          .build(),
        triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
      },
      ...publishedOnce({
        hoursAgo: 48,
        failure: {
          subscriptionId: "BroadcastToPartnersOnConventionUpdates",
          errorMessage: "Request failed with status code 503",
        },
      }),
    },
    {
      id: uuidGenerator.new(),
      topic: "AgencyUpdated",
      payload: {
        agencyId: SEED_FT_AGENCY_ID,
        triggeredBy: { kind: "connected-user", userId: seedUsers.adminUser.id },
      },
      ...publishedOnce({ hoursAgo: 36 }),
    },
    {
      id: uuidGenerator.new(),
      topic: "UpdatedEstablishmentAggregateInsertedFromForm",
      payload: {
        siret: franceMerguez.establishment.siret,
        triggeredBy: {
          kind: "connected-user",
          userId: seedUsers.franceMerguezUser.id,
        },
      },
      ...publishedOnce({ hoursAgo: 30 }),
    },
  ];

  await Promise.all(events.map((event) => uow.outboxRepository.save(event)));

  // biome-ignore lint/suspicious/noConsole: seed script progress output
  console.log("eventSeed done");
};
