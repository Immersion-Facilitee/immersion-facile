import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type CloseAgencyAndTransferConventions,
  makeCloseAgencyAndTransferConventions,
} from "./CloseAgencyAndTransferConventions";

describe("CloseAgencyAndTransfertConventions", () => {
  const agencyToClose = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("agency-to-close-id")
      .withName("Agence à fermer")
      .withStatus("active")
      .build(),
  );
  const agencyToTransferTo = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("agency-target-id")
      .withName("Agence cible")
      .withStatus("active")
      .withRefersToAgencyInfo(null)
      .build(),
  );
  const convention1 = new ConventionDtoBuilder()
    .withId("a99eaca1-ee70-4c90-b3f4-668d492f7391")
    .withAgencyId(agencyToClose.id)
    .build();
  const convention2 = new ConventionDtoBuilder()
    .withId("a99eaca1-ee70-4c90-b3f4-668d492f7392")
    .withAgencyId(agencyToClose.id)
    .build();
  const referringAgency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("referring-agency-id")
      .withRefersToAgencyInfo({
        refersToAgencyId: agencyToClose.id,
        refersToAgencyName: agencyToClose.name,
        refersToAgencyContactEmail: agencyToClose.contactEmail,
      })
      .build(),
  );

  const backOfficeUser = new ConnectedUserBuilder()
    .withId("admin-user-id")
    .withIsAdmin(true)
    .build();
  const nonBackOfficeUser = new ConnectedUserBuilder()
    .withId("user-id")
    .withIsAdmin(false)
    .build();

  let uow: InMemoryUnitOfWork;
  let useCase: CloseAgencyAndTransferConventions;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    useCase = makeCloseAgencyAndTransferConventions({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new TestUuidGenerator(["event-id-1", "event-id-2"]),
        }),
      },
    });
  });

  it("throws when user is not back-office admin", async () => {
    uow.agencyRepository.agencies = [agencyToClose, agencyToTransferTo];
    uow.conventionRepository.setConventions([convention1]);

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: agencyToTransferTo.id,
        },
        nonBackOfficeUser,
      ),
      errors.user.forbidden({ userId: nonBackOfficeUser.id }),
    );
  });

  it("throws when agency to close does not exist", async () => {
    uow.agencyRepository.agencies = [agencyToTransferTo];

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: agencyToTransferTo.id,
        },
        backOfficeUser,
      ),
      errors.agency.notFound({ agencyId: agencyToClose.id }),
    );
  });

  it("throws when agency to transfer to does not exist", async () => {
    uow.agencyRepository.agencies = [agencyToClose];

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: agencyToTransferTo.id,
        },
        backOfficeUser,
      ),
      errors.agency.notFound({ agencyId: agencyToTransferTo.id }),
    );
  });

  it("throws when agency to transfer to is not active", async () => {
    const closedAgencyTarget = new AgencyDtoBuilder()
      .withStatus("closed")
      .build();

    uow.agencyRepository.agencies = [
      agencyToClose,
      toAgencyWithRights(closedAgencyTarget),
    ];

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: closedAgencyTarget.id,
        },
        backOfficeUser,
      ),
      errors.agency.targetAgencyMustBeActive({
        agencyId: closedAgencyTarget.id,
      }),
    );
  });

  it("throws when agency to close and agency to transfer to are the same", async () => {
    uow.agencyRepository.agencies = [agencyToClose];

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: agencyToClose.id,
        },
        backOfficeUser,
      ),
      errors.agency.sourceAndTargetAgencyMustBeDifferent({
        agencyId: agencyToClose.id,
      }),
    );
  });

  it("throws when agency to transfer to has refersTo", async () => {
    const agencyTargetWithRefersTo = new AgencyDtoBuilder()
      .withRefersToAgencyInfo({
        refersToAgencyId: agencyToClose.id,
        refersToAgencyName: agencyToClose.name,
        refersToAgencyContactEmail: agencyToClose.contactEmail,
      })
      .build();

    uow.agencyRepository.agencies = [
      agencyToClose,
      toAgencyWithRights(agencyTargetWithRefersTo),
    ];

    await expectPromiseToFailWithError(
      useCase.execute(
        {
          agencyToCloseId: agencyToClose.id,
          agencyToTransferConventionsToId: agencyTargetWithRefersTo.id,
        },
        backOfficeUser,
      ),
      errors.agency.targetAgencyMustNotReferToAnother({
        agencyId: agencyTargetWithRefersTo.id,
      }),
    );
  });

  it("transfers conventions, updates referring agencies, closes agency and emits events", async () => {
    uow.agencyRepository.agencies = [
      agencyToClose,
      agencyToTransferTo,
      referringAgency,
    ];
    uow.conventionRepository.setConventions([convention1, convention2]);

    await useCase.execute(
      {
        agencyToCloseId: agencyToClose.id,
        agencyToTransferConventionsToId: agencyToTransferTo.id,
      },
      backOfficeUser,
    );

    expectToEqual(uow.conventionRepository.conventions, [
      { ...convention1, agencyId: agencyToTransferTo.id },
      { ...convention2, agencyId: agencyToTransferTo.id },
    ]);

    const closedAgency = await uow.agencyRepository.getById(agencyToClose.id);
    expectToEqual(closedAgency, {
      ...agencyToClose,
      updatedAt: timeGateway.now().toISOString(),
      status: "closed",
      statusJustification: "Agence fermée suite à un transfert de convention",
    });

    const updatedReferringAgency = await uow.agencyRepository.getById(
      referringAgency.id,
    );
    expectToEqual(updatedReferringAgency, {
      ...referringAgency,
      updatedAt: timeGateway.now().toISOString(),
      refersToAgencyId: agencyToTransferTo.id,
      refersToAgencyName: agencyToTransferTo.name,
      refersToAgencyContactEmail: agencyToTransferTo.contactEmail,
    });

    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "ConventionTransferredToAgency",
        payload: {
          convention: { ...convention1, agencyId: agencyToTransferTo.id },
          agencyId: agencyToTransferTo.id,
          justification: "Transfert suite à la fermeture de l'agence",
          previousAgencyId: agencyToClose.id,
          shouldNotifyActors: false,
          triggeredBy: {
            kind: "connected-user",
            userId: backOfficeUser.id,
          },
        },
      },
      {
        topic: "ConventionTransferredToAgency",
        payload: {
          convention: { ...convention2, agencyId: agencyToTransferTo.id },
          agencyId: agencyToTransferTo.id,
          justification: "Transfert suite à la fermeture de l'agence",
          previousAgencyId: agencyToClose.id,
          shouldNotifyActors: false,
          triggeredBy: {
            kind: "connected-user",
            userId: backOfficeUser.id,
          },
        },
      },
    ]);
  });
});
