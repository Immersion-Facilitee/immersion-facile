import {
  AgencyDtoBuilder,
  type AgencyUsersRights,
  BadRequestError,
  type ConnectedUser,
  ConnectedUserBuilder,
  type DelegationAgencyInfo,
  errors,
  expectArraysToMatch,
  expectPromiseToFail,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UserWithAdminRights,
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
import { makeUpdateAgency, type UpdateAgency } from "./UpdateAgency";

describe("Update agency", () => {
  const initialAgencyInRepo = new AgencyDtoBuilder().build();
  const adminBuilder = new ConnectedUserBuilder()
    .withId("backoffice-admin-id")
    .withIsAdmin(true);

  const admin = adminBuilder.buildUser();
  const connectedAdmin = adminBuilder.build();

  const notAdminBuilder = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false);
  const notAdmin = notAdminBuilder.buildUser();
  const connectedNotAdmin = notAdminBuilder.build();

  const agencyAdminBuilder = new ConnectedUserBuilder()
    .withId("agency-admin-id")
    .withIsAdmin(false);
  const agencyAdmin = agencyAdminBuilder.buildUser();
  const connectedAgencyAdmin = agencyAdminBuilder
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(initialAgencyInRepo, []),
        roles: ["agency-admin"],
        isNotifiedByEmail: true,
      },
    ])
    .build();

  let uow: InMemoryUnitOfWork;
  let updateAgency: UpdateAgency;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    timeGateway = new CustomTimeGateway();
    uow = createInMemoryUow();
    updateAgency = makeUpdateAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new TestUuidGenerator([
            "event-uuid-1",
            "event-uuid-2",
            "event-uuid-3",
          ]),
        }),
      },
    });

    uow.userRepository.users = [admin, notAdmin];
  });

  describe("Wrong path", () => {
    it("throws Forbidden if current user is not admin nore agency admin on agency", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(initialAgencyInRepo, {}),
      ];
      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...initialAgencyInRepo, validatorEmails: ["mail@mail.com"] },
          connectedNotAdmin,
        ),
        errors.user.forbidden({ userId: notAdmin.id }),
      );
    });

    it("Fails trying to update if no matching agency was found", async () => {
      const agency = new AgencyDtoBuilder().build();
      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...agency, validatorEmails: ["mail@mail.com"] },
          connectedAdmin,
        ),
        errors.agency.notFound({ agencyId: agency.id }),
      );
    });

    it("Fails to update agency if address components are empty", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(initialAgencyInRepo, {}),
      ];
      const updatedAgency = new AgencyDtoBuilder()
        .withId(initialAgencyInRepo.id)
        .withName("L'agence modifié")
        .withAddress({
          streetNumberAndAddress: "",
          postcode: "",
          city: "",
          departmentCode: "",
        })
        .build();
      await expectPromiseToFail(
        updateAgency.execute(
          { ...updatedAgency, validatorEmails: ["new-validator@mail.com"] },
          connectedAdmin,
        ),
      );
    });

    it("Fails to update agency if geo components are 0,0", async () => {
      const initialAgencyInRepo = new AgencyDtoBuilder().build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(initialAgencyInRepo, {}),
      ];
      const updatedAgency = new AgencyDtoBuilder()
        .withId(initialAgencyInRepo.id)
        .withName("L'agence modifié")
        .withPosition(0, 0)
        .build();

      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...updatedAgency, validatorEmails: ["new-validator@mail.com"] },
          connectedAdmin,
        ),
        new BadRequestError(
          `Schema validation failed in usecase UpdateAgency for element with id ${updatedAgency.id}. See issues for details.`,
          [
            "position.lat : 0 est une latitude par défaut qui ne semble pas correcte",
            "position.lon : 0 est une longitude par défaut qui ne semble pas correcte",
          ],
        ),
      );
    });
  });

  it.each([
    {
      triggeredByRole: "backoffice-admin",
      triggeredByUser: connectedAdmin,
      initialUsers: [admin, notAdmin],
    },
    {
      triggeredByRole: "agency-admin",
      triggeredByUser: connectedAgencyAdmin,
      initialUsers: [agencyAdmin],
    },
  ] satisfies {
    triggeredByRole: string;
    triggeredByUser: ConnectedUser;
    initialUsers: UserWithAdminRights[];
  }[])("$triggeredByRole can update agency without changes on user rights and create corresponding event", async ({
    initialUsers,
    triggeredByUser,
  }) => {
    uow.userRepository.users = initialUsers;
    uow.agencyRepository.agencies = [
      toAgencyWithRights(initialAgencyInRepo, {}),
    ];

    const updatedAgency = new AgencyDtoBuilder(initialAgencyInRepo)
      .withName("L'agence modifié")
      .build();

    await updateAgency.execute(
      { ...updatedAgency, validatorEmails: ["new-validator@mail.com"] },
      triggeredByUser,
    );

    expectToEqual(uow.agencyRepository.agencies, [
      toAgencyWithRights(
        new AgencyDtoBuilder(initialAgencyInRepo)
          .withName("L'agence modifié")
          .withUpdatedAt(timeGateway.now())
          .build(),
        {},
      ),
    ]);
    expectToEqual(uow.userRepository.users, initialUsers);
    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "AgencyUpdated",
        payload: {
          agencyId: updatedAgency.id,
          triggeredBy: {
            kind: "connected-user",
            userId: triggeredByUser.id,
          },
        },
      },
    ]);
  });

  describe("Status change", () => {
    const usersRightsWithAdmin = {
      "agency-admin-user": {
        roles: ["agency-admin", "validator"],
        isNotifiedByEmail: true,
      },
    } satisfies AgencyUsersRights;

    const triggeredByAdmin = {
      kind: "connected-user",
      userId: connectedAdmin.id,
    } as const;

    it("backoffice admin activating a needsReview agency clears status justification and emits AgencyUpdated then AgencyActivated", async () => {
      const needsReviewAgency = new AgencyDtoBuilder()
        .withStatus("needsReview")
        .withStatusJustification("previous rejection reason")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, usersRightsWithAdmin),
      ];

      const activatedAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("active")
        .build();

      await updateAgency.execute(
        { ...activatedAgency, validatorEmails: ["validator@mail.com"] },
        connectedAdmin,
      );

      expectToEqual(uow.agencyRepository.agencies[0].status, "active");
      expectToEqual(uow.agencyRepository.agencies[0].statusJustification, null);
      expect(uow.outboxRepository.events).toHaveLength(2);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: activatedAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
        {
          topic: "AgencyActivated",
          payload: {
            agencyId: activatedAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
      ]);
    });

    it("backoffice admin rejecting an agency emits AgencyUpdated then AgencyRejected", async () => {
      const needsReviewAgency = new AgencyDtoBuilder()
        .withStatus("needsReview")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, usersRightsWithAdmin),
      ];

      const rejectedAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("rejected")
        .withStatusJustification("not a legit agency")
        .build();

      await updateAgency.execute(
        { ...rejectedAgency, validatorEmails: ["validator@mail.com"] },
        connectedAdmin,
      );

      expectToEqual(uow.agencyRepository.agencies[0].status, "rejected");
      expect(uow.outboxRepository.events).toHaveLength(2);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: rejectedAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
        {
          topic: "AgencyRejected",
          payload: {
            agencyId: rejectedAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
      ]);
    });

    it("backoffice admin activating an agency as from-api-PE emits AgencyUpdated then AgencyActivated", async () => {
      const needsReviewAgency = new AgencyDtoBuilder()
        .withStatus("needsReview")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, usersRightsWithAdmin),
      ];

      const fromApiAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("from-api-PE")
        .build();

      await updateAgency.execute(
        { ...fromApiAgency, validatorEmails: ["validator@mail.com"] },
        connectedAdmin,
      );

      expectToEqual(uow.agencyRepository.agencies[0].status, "from-api-PE");
      expect(uow.outboxRepository.events).toHaveLength(2);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: fromApiAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
        {
          topic: "AgencyActivated",
          payload: {
            agencyId: fromApiAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
      ]);
    });

    it("backoffice admin can close an agency by updating it", async () => {
      const activeAgency = new AgencyDtoBuilder().withStatus("active").build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(activeAgency, usersRightsWithAdmin),
      ];

      const closedAgency = new AgencyDtoBuilder(activeAgency)
        .withStatus("closed")
        .withStatusJustification("Agence fermée manuellement")
        .build();

      await updateAgency.execute(
        { ...closedAgency, validatorEmails: ["validator@mail.com"] },
        connectedAdmin,
      );

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          { ...closedAgency, updatedAt: timeGateway.now().toISOString() },
          usersRightsWithAdmin,
        ),
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: closedAgency.id,
            triggeredBy: triggeredByAdmin,
          },
        },
      ]);
    });

    it("throws cannotActivateWithoutAdmin when activating an agency without an agency-admin", async () => {
      const needsReviewAgency = new AgencyDtoBuilder()
        .withStatus("needsReview")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, {}),
      ];

      const activatedAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("active")
        .build();

      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...activatedAgency, validatorEmails: ["validator@mail.com"] },
          connectedAdmin,
        ),
        errors.agency.cannotActivateWithoutAdmin({
          agencyId: activatedAgency.id,
        }),
      );
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("throws notEnoughValidators when activating an agency without a notified validator", async () => {
      const needsReviewAgency = new AgencyDtoBuilder()
        .withStatus("needsReview")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, {
          "agency-admin-user": {
            roles: ["agency-admin"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      const activatedAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("active")
        .build();

      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...activatedAgency, validatorEmails: ["validator@mail.com"] },
          connectedAdmin,
        ),
        errors.agency.notEnoughValidators({
          agencyId: activatedAgency.id,
        }),
      );
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("throws Forbidden when an agency-admin (not backoffice) changes the status", async () => {
      const needsReviewAgency = new AgencyDtoBuilder(initialAgencyInRepo)
        .withStatus("needsReview")
        .build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(needsReviewAgency, usersRightsWithAdmin),
      ];

      const activatedAgency = new AgencyDtoBuilder(needsReviewAgency)
        .withStatus("active")
        .build();

      await expectPromiseToFailWithError(
        updateAgency.execute(
          { ...activatedAgency, validatorEmails: ["validator@mail.com"] },
          connectedAgencyAdmin,
        ),
        errors.user.forbidden({ userId: agencyAdmin.id }),
      );
    });
  });

  it("updates agency with delegationAgencyInfo", async () => {
    const agencyWithDelegation = new AgencyDtoBuilder()
      .withId("agency-with-delegation")
      .withName("Agency with delegation")
      .withKind("autre")
      .withDelegationAgencyInfo({
        delegationEndDate: new Date("2029-01-01").toISOString(),
        delegationAgencyName: "France Travail",
        delegationAgencyKind: "france-travail",
      })
      .build();

    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyWithDelegation, {}),
    ];

    const updatedDelegationInfo: DelegationAgencyInfo = {
      delegationEndDate: new Date("2030-06-15").toISOString(),
      delegationAgencyName: "Mission Locale",
      delegationAgencyKind: "mission-locale",
    };

    const updatedAgency = new AgencyDtoBuilder(agencyWithDelegation)
      .withDelegationAgencyInfo(updatedDelegationInfo)
      .build();

    await updateAgency.execute(
      { ...updatedAgency, validatorEmails: ["validator@mail.com"] },
      connectedAdmin,
    );

    expectToEqual(uow.agencyRepository.agencies, [
      toAgencyWithRights(
        { ...updatedAgency, updatedAt: timeGateway.now().toISOString() },
        {},
      ),
    ]);
  });
});
