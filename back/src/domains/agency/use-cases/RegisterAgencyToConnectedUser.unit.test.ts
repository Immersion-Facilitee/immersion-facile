import {
  AgencyDtoBuilder,
  type ConnectedUser,
  defaultProConnectInfos,
  errors,
  expectArraysToMatch,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
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
  makeRegisterAgencyToConnectedUser,
  type RegisterAgencyToConnectedUser,
} from "./RegisterAgencyToConnectedUser";

describe("RegisterAgencyToConnectedUser use case", () => {
  const notFtUser: ConnectedUser = {
    id: "notFtUser",
    email: "john.doe@mail.com",
    firstName: "Joe",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
    agencyRights: [],
    dashboards: {
      agencies: noAgencyDashboards,
      establishments: noEstablishmentDashboard,
    },
  };

  const ftUser: ConnectedUser = {
    id: "ftUser",
    email: "jean.valideur@francetravail.fr",
    firstName: "jean",
    lastName: "valideur",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
    agencyRights: [],
    dashboards: {
      agencies: noAgencyDashboards,
      establishments: noEstablishmentDashboard,
    },
  };

  const agency1 = new AgencyDtoBuilder().withId("agency-111").build();
  const agency2 = new AgencyDtoBuilder().withId("agency-222").build();
  const agencyFt = new AgencyDtoBuilder()
    .withKind("france-travail")
    .withId("agencyFt")
    .build();

  let registerAgencyToConnectedUser: RegisterAgencyToConnectedUser;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    registerAgencyToConnectedUser = makeRegisterAgencyToConnectedUser({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new TestUuidGenerator(),
        }),
      },
    });
  });

  describe("Wrong path", () => {
    it("fails if no agency exist", async () => {
      uow.userRepository.users = [notFtUser];
      await expectPromiseToFailWithError(
        registerAgencyToConnectedUser.execute([agency1.id], notFtUser),
        errors.agencies.notFound({ missingAgencyIds: [agency1.id] }),
      );
    });

    it("fails if user already has agency rights for agency", async () => {
      uow.userRepository.users = [notFtUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [notFtUser.id]: { roles: ["counsellor"], isNotifiedByEmail: false },
        }),
      ];

      await expectPromiseToFailWithError(
        registerAgencyToConnectedUser.execute([agency1.id], notFtUser),
        errors.user.alreadyHaveAgencyRights({ userId: notFtUser.id }),
      );
    });

    it("fails if user want to register FT Agency but the user is not FT", async () => {
      uow.userRepository.users = [notFtUser];
      const agency = toAgencyWithRights(agencyFt, {});
      uow.agencyRepository.agencies = [agency];

      await expectPromiseToFailWithError(
        registerAgencyToConnectedUser.execute([agencyFt.id], notFtUser),
        errors.agency.registerNotFtUserForbidden({ user: notFtUser, agency }),
      );
    });
  });

  describe("When User and agencies exist", () => {
    beforeEach(() => {
      uow.userRepository.users = [notFtUser, ftUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {}),
        toAgencyWithRights(agency2, {}),
        toAgencyWithRights(agencyFt, {}),
      ];
    });

    it("makes the link between user and provided agency id, and saves the corresponding event", async () => {
      await registerAgencyToConnectedUser.execute([agency1.id], notFtUser);

      expectToEqual(uow.userRepository.users, [notFtUser, ftUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency1)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          },
        ),
        toAgencyWithRights(agency2, {}),
        toAgencyWithRights(agencyFt, {}),
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyRegisteredToConnectedUser",
          payload: {
            userId: notFtUser.id,
            agencyIds: [agency1.id],
            triggeredBy: { kind: "connected-user", userId: notFtUser.id },
          },
        },
      ]);
    });

    it("can register to another agency", async () => {
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency1, {
          [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
        }),
        toAgencyWithRights(agency2, {}),
      ];

      await registerAgencyToConnectedUser.execute([agency2.id], notFtUser);

      expectToEqual(uow.userRepository.users, [notFtUser, ftUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency1, {
          [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
        }),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency2)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          },
        ),
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyRegisteredToConnectedUser",
          payload: {
            userId: notFtUser.id,
            agencyIds: [agency2.id],
            triggeredBy: { kind: "connected-user", userId: notFtUser.id },
          },
        },
      ]);
    });

    it("makes the links with all the given agencies, and events has all relevant ids", async () => {
      await registerAgencyToConnectedUser.execute(
        [agency1.id, agency2.id],
        notFtUser,
      );

      expectToEqual(uow.userRepository.users, [notFtUser, ftUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency1)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency2)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [notFtUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          },
        ),
        toAgencyWithRights(agencyFt, {}),
      ]);
      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyRegisteredToConnectedUser",
          payload: {
            userId: notFtUser.id,
            agencyIds: [agency1.id, agency2.id],
            triggeredBy: { kind: "connected-user", userId: notFtUser.id },
          },
        },
      ]);
    });

    it("allows FT user to register with FT agency", async () => {
      await registerAgencyToConnectedUser.execute([agencyFt.id], ftUser);

      expectToEqual(uow.userRepository.users, [notFtUser, ftUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency1, {}),
        toAgencyWithRights(agency2, {}),
        toAgencyWithRights(
          new AgencyDtoBuilder(agencyFt)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [ftUser.id]: { roles: ["to-review"], isNotifiedByEmail: false },
          },
        ),
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyRegisteredToConnectedUser",
          payload: {
            userId: ftUser.id,
            agencyIds: [agencyFt.id],
            triggeredBy: { kind: "connected-user", userId: ftUser.id },
          },
        },
      ]);
    });
  });
});
