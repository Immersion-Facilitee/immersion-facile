import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type {
  EstablishmentAdminRight,
  EstablishmentContactRight,
} from "../../establishment/entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../../establishment/helpers/EstablishmentBuilders";
import { type DeleteUser, makeDeleteUser } from "./DeleteUser";

describe("DeleteUser", () => {
  const admin1 = new UserBuilder().withId("admin1").withEmail("admin1").build();
  const admin2 = new UserBuilder().withId("admin2").withEmail("admin2").build();
  const contactMostActive = new UserBuilder()
    .withId("contactMostActive")
    .withEmail("contactMostActive")
    .withLastLoginAt(new Date("2025-01-01"))
    .build();
  const contactLessActive = new UserBuilder()
    .withId("contactLessActive")
    .withEmail("contactLessActive")
    .withLastLoginAt(new Date("2024-01-01"))
    .build();
  const readOnlyAndCounsellor = new UserBuilder()
    .withId("readOnlyAndCounsellor")
    .withEmail("readOnlyAndCounsellor")
    .build();
  const validator1 = new UserBuilder()
    .withId("validator1")
    .withEmail("validator1")
    .build();
  const validator2 = new UserBuilder()
    .withId("validator2")
    .withEmail("validator2")
    .build();
  const admin1Right: EstablishmentAdminRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    userId: admin1.id,
    isMainContactByPhone: true,
    job: "",
    phone: "",
    shouldReceiveDiscussionNotifications: true,
  };
  const admin2Right: EstablishmentAdminRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    userId: admin2.id,
    isMainContactByPhone: null,
    job: "",
    phone: "",
    shouldReceiveDiscussionNotifications: true,
  };
  const contactMostActiveRight: EstablishmentContactRight = {
    userId: contactMostActive.id,
    role: "establishment-contact",
    status: "ACCEPTED",
    shouldReceiveDiscussionNotifications: true,
  };
  const contactLessActiveRight: EstablishmentContactRight = {
    userId: contactLessActive.id,
    role: "establishment-contact",
    status: "ACCEPTED",
    shouldReceiveDiscussionNotifications: true,
  };

  const establishment = new EstablishmentAggregateBuilder()
    .withUserRights([
      admin1Right,
      admin2Right,
      contactMostActiveRight,
      contactLessActiveRight,
    ])
    .build();

  const establishmentWithContactInPerson = new EstablishmentAggregateBuilder()
    .withUserRights([
      {
        ...admin1Right,
        isMainContactInPerson: true,
        isMainContactByPhone: null,
      },
      admin2Right,
      contactMostActiveRight,
      contactLessActiveRight,
    ])
    .build();

  const admin2WithIsMainContactByPhone = {
    ...admin2Right,
    isMainContactByPhone: true,
  };
  const establishmentWithMultipleMainContacts =
    new EstablishmentAggregateBuilder()
      .withUserRights([
        admin1Right,
        admin2WithIsMainContactByPhone,
        contactMostActiveRight,
        contactLessActiveRight,
      ])
      .build();

  const agency = new AgencyDtoBuilder().build();

  let deleteUser: DeleteUser;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    deleteUser = makeDeleteUser({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new UuidV4Generator(),
        }),
      },
    });

    uow.userRepository.users = [
      admin1,
      admin2,
      contactMostActive,
      contactLessActive,
      readOnlyAndCounsellor,
      validator1,
      validator2,
    ];
  });

  describe("right paths", () => {
    describe("User with establishment rights", () => {
      beforeEach(() => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishment,
        ];
      });

      it("case E1 - with contact right - remove establishment right + event UserDeleted + user deleted", async () => {
        await deleteUser.execute({
          userId: contactMostActive.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                admin1Right,
                admin2Right,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: contactMostActive.id,
            },
          },
        ]);
      });

      it("case E2 - with admin right and another user with not admin right - remove establishment right + event UserDeleted + user deleted + most active remaining user with admin right", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder(establishment)
            .withUserRights([
              admin1Right,
              contactMostActiveRight,
              contactLessActiveRight,
            ])
            .build(),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                {
                  userId: contactMostActive.id,
                  role: "establishment-admin",
                  status: "ACCEPTED",
                  shouldReceiveDiscussionNotifications: true,
                  isMainContactByPhone: true,
                  job: "non-communiqué", // comment on défini le job si on ne le connait pas ?
                  phone: "+33600000000", // comment on défini le phone si on ne le connait pas ?
                } satisfies EstablishmentAdminRight,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          { topic: "UserDeleted" },
        ]);
      });

      it("case E2 bis - user with admin right and another user with admin right -> remove establishment right + event UserDeleted + user deleted + latest active user is now main contact by phone", async () => {
        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        const contactMostActiveRightWithNewRole: EstablishmentContactRight = {
          ...contactMostActiveRight,
          isMainContactByPhone: true,
        };

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                admin2Right,
                contactMostActiveRightWithNewRole,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: { triggeredBy: { kind: "crawler" }, userId: admin1.id },
          },
        ]);
      });

      it("case E2 ter - user with admin right and another user with admin right -> remove establishment right + event UserDeleted + user deleted + latest active user is now main contact in person", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentWithContactInPerson,
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        const contactMostActiveRightWithNewRole: EstablishmentContactRight = {
          ...contactMostActiveRight,
          isMainContactInPerson: true,
        };

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                admin2Right,
                contactMostActiveRightWithNewRole,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: { triggeredBy: { kind: "crawler" }, userId: admin1.id },
          },
        ]);
      });

      it("should not happen: multiple main contacts, do not set contact props on latest active user", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentWithMultipleMainContacts,
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                admin2WithIsMainContactByPhone,
                contactMostActiveRight,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: { triggeredBy: { kind: "crawler" }, userId: admin1.id },
          },
        ]);
      });

      it("case E3 - User with admin right and no other user have right on establishment -> remove establishment right + event UserDeleted + event EstablishmentDeletionTriggered + user deleted ", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder(establishment)
            .withUserRights([admin1Right])
            .build(),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);
        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            {
              ...new EstablishmentAggregateBuilder(establishment)
                .withEstablishmentUpdatedAt(timeGateway.now())
                .build(),
              userRights: [],
            },
          ],
        );
        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: { triggeredBy: { kind: "crawler" }, userId: admin1.id },
          },
          {
            topic: "AllEstablishmentUsersDeleted",
            payload: {
              siret: establishment.establishment.siret,
              triggeredBy: { kind: "crawler" },
            },
          },
        ]);
      });
    });

    describe("User with agency rights", () => {
      it("case P1 - with read-only/counsellor -> remove agency right + event UserDeleted + user deleted", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
            [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
            [readOnlyAndCounsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["agency-viewer", "counsellor"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: readOnlyAndCounsellor.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin1.id]: {
                isNotifiedByEmail: false,
                roles: ["agency-admin"],
              },
              [validator1.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: readOnlyAndCounsellor.id,
            },
          },
        ]);
      });

      it("case P2 - with validator and another user with validator right not notified -> remove agency right + event UserDeleted + user deleted + set last validator notified", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
            [validator2.id]: {
              isNotifiedByEmail: false,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: validator1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin1.id]: {
                isNotifiedByEmail: false,
                roles: ["agency-admin"],
              },
              [validator2.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: validator1.id,
            },
          },
        ]);
      });

      it("case P2- BIS - with validator and another user with validator right notified -> remove agency right + event UserDeleted + user deleted", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
            [validator2.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: validator1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin1.id]: {
                isNotifiedByEmail: false,
                roles: ["agency-admin"],
              },
              [validator2.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: validator1.id,
            },
          },
        ]);
      });

      it("case P3 - with last validator and admins -> remove agency right + event UserDeleted + user deleted + set most active admin validator & notified", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: validator1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin1.id]: {
                isNotifiedByEmail: true,
                roles: ["agency-admin", "validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: validator1.id,
            },
          },
        ]);
      });

      it("case P3 BIS - with last validator and no admins and no convention - remove agency right  + user deleted + agency rejected + event UserDeleted + event AgencyHasBeenPutOnHold", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
            [readOnlyAndCounsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: validator1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withStatus("rejected")
              .withStatusJustification("Aucun utilisateur actif")
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [readOnlyAndCounsellor.id]: {
                isNotifiedByEmail: false,
                roles: ["counsellor"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: validator1.id,
            },
          },
          {
            topic: "AgencyHasBeenPutOnHold",
            payload: {
              triggeredBy: { kind: "crawler" },
              agencyId: agency.id,
            },
          },
        ]);
      });

      it("case P4 - with admin and other admins - remove agency right  + user deleted + event UserDeleted", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin"],
            },
            [admin2.id]: {
              isNotifiedByEmail: false,
              roles: ["agency-admin"],
            },
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin2.id]: {
                isNotifiedByEmail: false,
                roles: ["agency-admin"],
              },
              [validator1.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: admin1.id,
            },
          },
        ]);
      });

      it("case P4 BIS - with admin and other validators - remove agency right  + user deleted + event UserDeleted + set most active validator admin", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin"],
            },
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [validator1.id]: {
                isNotifiedByEmail: true,
                roles: ["validator", "agency-admin"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: admin1.id,
            },
          },
        ]);
      });
      it("case P5 ALT - with last admin + validator and another user with counsellor/readonly + no convention - remove agency right  + user deleted + agency rejected + event UserDeleted + event AgencyHasBeenPutOnHold ", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
            [readOnlyAndCounsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor", "agency-viewer"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withStatus("rejected")
              .withStatusJustification("Aucun utilisateur actif")
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [readOnlyAndCounsellor.id]: {
                isNotifiedByEmail: false,
                roles: ["counsellor", "agency-viewer"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: admin1.id,
            },
          },
          {
            topic: "AgencyHasBeenPutOnHold",
            payload: {
              triggeredBy: { kind: "crawler" },
              agencyId: agency.id,
            },
          },
        ]);
      });

      it("case P6 - with last admin + validator and no more users - remove agency right  + user deleted + agency closed + event UserDeleted", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withStatus("closed")
              .withStatusJustification("Aucun utilisateur actif")
              .withUpdatedAt(timeGateway.now())
              .build(),
            {},
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: admin1.id,
            },
          },
        ]);
      });

      it("case P7 - with last admin + validator, another user and validated convention - remove agency right + user deleted + agency closed + event UserDeleted + event AgencyHasBeenPutOnHold", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
            [readOnlyAndCounsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor"],
            },
          }),
        ];
        uow.conventionRepository.setConventions([
          new ConventionDtoBuilder()
            .withAgencyId(agency.id)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .build(),
        ]);

        await deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withStatus("closed")
              .withStatusJustification("Aucun utilisateur actif")
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [readOnlyAndCounsellor.id]: {
                isNotifiedByEmail: false,
                roles: ["counsellor"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: admin1.id,
            },
          },
          {
            topic: "AgencyHasBeenPutOnHold",
            payload: {
              triggeredBy: { kind: "crawler" },
              agencyId: agency.id,
            },
          },
        ]);
      });

      it("case P8 - with rejected agency, last validator and validated convention - agency stays rejected + user deleted + keep agency rejected + event UserDeleted + event AgencyHasBeenPutOnHold", async () => {
        const rejectedAgency = new AgencyDtoBuilder(agency)
          .withStatus("rejected")
          .withStatusJustification("Doublon détecté")
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(rejectedAgency, {
            [validator1.id]: {
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: validator1.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactMostActive,
          contactLessActive,
          readOnlyAndCounsellor,
          validator2,
        ]);

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            {
              ...rejectedAgency,
              updatedAt: timeGateway.now().toISOString(),
              statusJustification: "Aucun utilisateur actif",
            },
            {},
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: validator1.id,
            },
          },
        ]);
      });
    });

    describe("Hybrid cases", () => {
      it("case H1  - not active user on agency only ", async () => {
        expectPromiseToFailWithError(
          deleteUser.execute({
            userId: admin1.id,
            triggeredBy: { kind: "crawler" },
            partialDelete: "agency-only",
          }),
          new Error("HYBRID BEHAVIOR NOT IMPLEMENTED"),
        );
      });

      it("case H1 bis - not active user on establishment only", async () => {
        expectPromiseToFailWithError(
          deleteUser.execute({
            userId: admin1.id,
            triggeredBy: { kind: "crawler" },
            partialDelete: "establishement-only",
          }),
          new Error("HYBRID BEHAVIOR NOT IMPLEMENTED"),
        );
      });

      it("case H2 - user with rights on establishment & agency - apply rules according to establishment & agency rights respectivelly + delete user + event UserDeleted", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishment,
        ];

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [admin1.id]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
            [contactMostActive.id]: {
              isNotifiedByEmail: false,
              roles: ["agency-viewer", "counsellor"],
            },
          }),
        ];

        await deleteUser.execute({
          userId: contactMostActive.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishment)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withUserRights([
                admin1Right,
                admin2Right,
                contactLessActiveRight,
              ])
              .build(),
          ],
        );

        expectToEqual(uow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agency)
              .withUpdatedAt(timeGateway.now())
              .build(),
            {
              [admin1.id]: {
                isNotifiedByEmail: true,
                roles: ["agency-admin", "validator"],
              },
            },
          ),
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: contactMostActive.id,
            },
          },
        ]);
      });

      it("case H2 - user without rights on establishment & agency - delete user + event UserDeleted", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [];
        uow.agencyRepository.agencies = [];

        await deleteUser.execute({
          userId: contactMostActive.id,
          triggeredBy: { kind: "crawler" },
        });

        expectToEqual(uow.userRepository.users, [
          admin1,
          admin2,
          contactLessActive,
          readOnlyAndCounsellor,
          validator1,
          validator2,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "UserDeleted",
            payload: {
              triggeredBy: { kind: "crawler" },
              userId: contactMostActive.id,
            },
          },
        ]);

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [],
        );

        expectToEqual(uow.agencyRepository.agencies, []);
      });
    });
  });

  describe("wrong paths", () => {
    it("missing user", async () => {
      uow.userRepository.users = [];

      expectPromiseToFailWithError(
        deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "crawler" },
        }),
        errors.user.notFound({ userId: admin1.id }),
      );
    });

    it("forbidden, not triggered by crawler", async () => {
      expectPromiseToFailWithError(
        deleteUser.execute({
          userId: admin1.id,
          triggeredBy: { kind: "connected-user", userId: "osef" },
        }),
        errors.user.forbiddenNotTriggeredByCrawler(),
      );
    });
  });
});
