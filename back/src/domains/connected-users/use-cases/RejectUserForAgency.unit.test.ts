import {
  AgencyDtoBuilder,
  type ConnectedUser,
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
  type ProConnectInfos,
  toAgencyDtoForAgencyUsersAndAdmins,
  type User,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  defaultPriority,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeRejectUserForAgency,
  type RejectUserForAgency,
} from "./RejectUserForAgency";

describe("RejectUserForAgency", () => {
  const proConnect: ProConnectInfos = {
    externalId: "john-external-id",
    siret: "00000000007777",
  };

  const user: User = {
    id: "john-123",
    email: "john@mail.com",
    firstName: "John",
    lastName: "Lennon",
    createdAt: new Date().toISOString(),
    proConnect,
  };

  const agency1 = new AgencyDtoBuilder().withId("agency1").build();
  const agency2 = new AgencyDtoBuilder().withId("agency2").build();

  const adminBuilder = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .withId("backoffice-admin");
  const connectedAdmin = adminBuilder.build();
  const admin = adminBuilder.buildUser();

  const notAdminBuilder = new ConnectedUserBuilder().withId("not-an-admin-id");
  const connectedNotAdmin = notAdminBuilder.build();
  const notAdmin = notAdminBuilder.buildUser();

  const agency1AdminBuilder = new ConnectedUserBuilder()
    .withId("agency-admin-id")
    .withIsAdmin(false)
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
        roles: ["agency-admin"],
        isNotifiedByEmail: true,
      },
    ]);
  const connectedAgency1Admin = agency1AdminBuilder.build();
  const agency1Admin = agency1AdminBuilder.buildUser();

  let uow: InMemoryUnitOfWork;
  let rejectUserForAgencyUsecase: RejectUserForAgency;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    uuidGenerator = new TestUuidGenerator();

    rejectUserForAgencyUsecase = makeRejectUserForAgency({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({ timeGateway, uuidGenerator }),
      },
    });

    uow.userRepository.users = [admin];
  });

  it("Throws if current user is not a backoffice admin nor an agency admin", async () => {
    uow.userRepository.users = [notAdmin];

    await expectPromiseToFailWithError(
      rejectUserForAgencyUsecase.execute(
        {
          userId: "osef",
          agencyId: "osef",
          justification: "osef",
        },
        connectedNotAdmin,
      ),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
  });

  it("throws Forbidden if agency admin rejects a user on an agency he is not admin on", async () => {
    await expectPromiseToFailWithError(
      rejectUserForAgencyUsecase.execute(
        {
          userId: user.id,
          agencyId: agency2.id,
          justification: "osef",
        },
        connectedAgency1Admin,
      ),
      errors.user.forbidden({ userId: connectedAgency1Admin.id }),
    );
  });

  it("Throw when no icUser were found", async () => {
    const connectedUser: ConnectedUser = {
      ...user,
      proConnect,
      agencyRights: [
        {
          agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
          roles: ["to-review"],
          isNotifiedByEmail: false,
        },
      ],
      dashboards: {
        agencies: noAgencyDashboards,
        establishments: noEstablishmentDashboard,
      },
    };

    await expectPromiseToFailWithError(
      rejectUserForAgencyUsecase.execute(
        {
          userId: connectedUser.id,
          agencyId: agency1.id,
          justification: "osef",
        },
        connectedAdmin,
      ),
      errors.user.notFound({ userId: connectedUser.id }),
    );
  });

  it("Throw when no agency were found", async () => {
    const connectedUser: ConnectedUser = {
      ...user,
      proConnect,
      agencyRights: [
        {
          agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
          roles: ["to-review"],
          isNotifiedByEmail: false,
        },
      ],
      dashboards: {
        agencies: noAgencyDashboards,
        establishments: noEstablishmentDashboard,
      },
    };

    uow.userRepository.users = [connectedAdmin, connectedUser];

    await expectPromiseToFailWithError(
      rejectUserForAgencyUsecase.execute(
        {
          userId: connectedUser.id,
          agencyId: agency1.id,
          justification: "osef",
        },
        connectedAdmin,
      ),
      errors.agency.notFound({ agencyId: agency1.id }),
    );
  });

  it.each([
    {
      currentUserLabel: "backoffice admin",
      currentUser: connectedAdmin,
      usersInRepo: [admin, user],
    },
    {
      currentUserLabel: "agency admin",
      currentUser: connectedAgency1Admin,
      usersInRepo: [agency1Admin, user],
    },
  ])("Remove agency right for IcUser when $currentUserLabel requests it", async ({
    currentUser,
    usersInRepo,
  }) => {
    const now = new Date("2023-11-07");
    timeGateway.setNextDate(now);

    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency1, {
        [user.id]: { roles: ["to-review"], isNotifiedByEmail: false },
        [notAdmin.id]: { roles: ["validator"], isNotifiedByEmail: false },
      }),
      toAgencyWithRights(agency2, {
        [user.id]: { roles: ["to-review"], isNotifiedByEmail: false },
      }),
    ];

    uow.userRepository.users = usersInRepo;

    await rejectUserForAgencyUsecase.execute(
      {
        userId: user.id,
        agencyId: agency1.id,
        justification: "osef",
      },
      currentUser,
    );

    expectToEqual(uow.agencyRepository.agencies, [
      toAgencyWithRights(agency1, {
        [notAdmin.id]: { roles: ["validator"], isNotifiedByEmail: false },
      }),
      toAgencyWithRights(agency2, {
        [user.id]: { roles: ["to-review"], isNotifiedByEmail: false },
      }),
    ]);

    expectToEqual(uow.outboxRepository.events, [
      {
        id: uuidGenerator.new(),
        occurredAt: now.toISOString(),
        topic: "ConnectedUserAgencyRightRejected",
        payload: {
          userId: user.id,
          agencyId: agency1.id,
          justification: "osef",
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
        publications: [],
        status: "never-published",
        wasQuarantined: false,
        priority: defaultPriority,
      },
    ]);
  });
});
