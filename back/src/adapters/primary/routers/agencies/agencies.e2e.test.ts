import { addDays } from "date-fns";
import {
  type AddressDto,
  AgencyDtoBuilder,
  type AgencyRoutes,
  agencyRoutes,
  ConnectedUserBuilder,
  type ConnectedUserJwt,
  ConventionDtoBuilder,
  type CreateAgencyDto,
  currentJwtVersions,
  defaultProConnectInfos,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
  type User,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import type { GenerateConnectedUserJwt } from "../../../../domains/core/jwt";
import { TEST_OPEN_ESTABLISHMENT_1 } from "../../../../domains/core/sirene/adapters/InMemorySiretGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("Agency routes", () => {
  const defaultAddress: AddressDto = {
    streetNumberAndAddress: "",
    postcode: "75002",
    departmentCode: "75",
    city: "Paris",
  };

  const backofficeAdminUser = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .buildUser();

  const nonAdminUser = new ConnectedUserBuilder()
    .withId("non-admin-user")
    .withIsAdmin(false)
    .buildUser();

  let httpClient: HttpClient<AgencyRoutes>;
  let gateways: InMemoryGateways;
  let inMemoryUow: InMemoryUnitOfWork;
  let eventCrawler: BasicEventCrawler;
  let backofficeAdminToken: ConnectedUserJwt;
  let nonAdminToken: ConnectedUserJwt;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;

  beforeEach(async () => {
    const deps = await buildTestApp();
    ({ gateways, eventCrawler, inMemoryUow, generateConnectedUserJwt } = deps);

    httpClient = createSupertestSharedClient(agencyRoutes, deps.request);

    inMemoryUow.agencyRepository.agencies = [];
    inMemoryUow.userRepository.users = [backofficeAdminUser, nonAdminUser];
    gateways.timeGateway.defaultDate = new Date();

    backofficeAdminToken = generateConnectedUserJwt({
      userId: backofficeAdminUser.id,
      version: currentJwtVersions.connectedUser,
      iat: Date.now(),
      exp: addDays(new Date(), 5).getTime(),
    });
    nonAdminToken = generateConnectedUserJwt({
      userId: nonAdminUser.id,
      version: currentJwtVersions.connectedUser,
      iat: Date.now(),
      exp: addDays(new Date(), 5).getTime(),
    });
  });

  const agency1ActiveNearBy = AgencyDtoBuilder.create("test-agency-1")
    .withName("Test Agency 1")
    .withStatus("active")
    .withPosition(10.11, 10.12)
    .withAddress({ ...defaultAddress, departmentCode: "20" })
    .build();

  const agency2ActiveNearBy = AgencyDtoBuilder.create("test-agency-2")
    .withName("Test Agency 2")
    .withStatus("active")
    .withPosition(10, 10)
    .withAddress({ ...defaultAddress, departmentCode: "20" })
    .build();

  const agency3ActiveFarAway = AgencyDtoBuilder.create("test-agency-3")
    .withName("Test Agency 3")
    .withStatus("active")
    .withPosition(1, 2)
    .withAddress(defaultAddress)
    .build();

  const agency4NeedsReview = AgencyDtoBuilder.create("test-agency-4")
    .withName("Test Agency 4")
    .withStatus("needsReview")
    .withAddress(defaultAddress)
    .build();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .buildUser();

  describe("Public Routes", () => {
    describe(`${displayRouteName(
      agencyRoutes.getAgencyOptionsByFilter,
    )} get agencies with name and position given filters`, () => {
      it("Returns agency list with name and position nearby a given position", async () => {
        // Prepare
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency1ActiveNearBy),
          toAgencyWithRights(agency2ActiveNearBy),
          toAgencyWithRights(agency3ActiveFarAway),
          toAgencyWithRights(agency4NeedsReview, {
            [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          }),
        ];

        const response = await httpClient.getAgencyOptionsByFilter({
          queryParams: { departmentCode: "20" },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: [
            {
              id: agency1ActiveNearBy.id,
              name: agency1ActiveNearBy.name,
              kind: agency1ActiveNearBy.kind,
              status: agency1ActiveNearBy.status,
              address: agency1ActiveNearBy.address,
              refersToAgencyName: agency1ActiveNearBy.refersToAgencyName,
            },
            {
              id: agency2ActiveNearBy.id,
              name: agency2ActiveNearBy.name,
              kind: agency2ActiveNearBy.kind,
              status: agency2ActiveNearBy.status,
              address: agency2ActiveNearBy.address,
              refersToAgencyName: agency2ActiveNearBy.refersToAgencyName,
            },
          ],
        });
      });
    });

    describe(`${displayRouteName(
      agencyRoutes.getAgencyPublicInfoById,
    )} to get agency public info by id`, () => {
      it("Returns agency public info without refersToAgency", async () => {
        // Prepare
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency1ActiveNearBy),
        ];

        // Act and assert
        const response = await httpClient.getAgencyPublicInfoById({
          queryParams: { agencyId: agency1ActiveNearBy.id },
        });
        expectHttpResponseToEqual(response, {
          status: 200,
          body: {
            id: "test-agency-1",
            name: "Test Agency 1",
            kind: "autre",
            address: {
              city: "Paris",
              departmentCode: "20",
              postcode: "75002",
              streetNumberAndAddress: "",
            },
            position: {
              lat: 10.11,
              lon: 10.12,
            },
            agencySiret: "12345678904444",
            signature: "empty-signature",
            logoUrl: null,
            refersToAgency: null,
          },
        });
      });
    });

    describe(`${displayRouteName(
      agencyRoutes.addAgency,
    )} to add Agency`, () => {
      const parisMissionLocaleParams: CreateAgencyDto = {
        id: "some-id",
        createdAt: new Date().toISOString(),
        coveredDepartments: ["75"],
        address: {
          streetNumberAndAddress: "Agency 1 address",
          city: "Paris",
          postcode: "75001",
          departmentCode: "75",
        },
        counsellorEmails: ["counsellor@mail.com"],
        validatorEmails: ["validator@mail.com"],
        contactEmail: "agency-contact@mail.com",
        kind: "mission-locale",
        name: "Mission locale de Paris",
        position: { lat: 10, lon: 20 },
        signature: "Super signature of the agency",
        agencySiret: TEST_OPEN_ESTABLISHMENT_1.siret,
        refersToAgencyId: null,
        refersToAgencyName: null,
        refersToAgencyContactEmail: null,
        logoUrl: null,
        phoneNumber: "+33600000001",
        delegationAgencyInfo: null,
      };

      it("200 - support posting valid agency", async () => {
        const response = await httpClient.addAgency({
          body: parisMissionLocaleParams,
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: "",
        });

        const {
          refersToAgencyId: _,
          ...parisMissionLocaleParamsWithoutRefersToAgencyId
        } = parisMissionLocaleParams;

        const validator = await inMemoryUow.userRepository.findByEmail(
          parisMissionLocaleParams.validatorEmails[0],
        );
        if (!validator)
          throw errors.generic.testError("Missing validator user");
        const counsellor = await inMemoryUow.userRepository.findByEmail(
          parisMissionLocaleParams.counsellorEmails[0],
        );
        if (!counsellor)
          throw errors.generic.testError("Missing counsellor user");

        expectToEqual(inMemoryUow.userRepository.users, [
          backofficeAdminUser,
          nonAdminUser,
          validator,
          counsellor,
        ]);
        expectToEqual(inMemoryUow.agencyRepository.agencies, [
          toAgencyWithRights(
            {
              ...parisMissionLocaleParamsWithoutRefersToAgencyId,
              updatedAt: gateways.timeGateway.now().toISOString(),
              status: "needsReview",
              refersToAgencyId: null,
              codeSafir: null,
              statusJustification: null,
              counsellorEmails: [],
              validatorEmails: [],
            },
            {
              [validator.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
              [counsellor.id]: {
                isNotifiedByEmail: true,
                roles: ["counsellor"],
              },
            },
          ),
        ]);
      });

      it("404 - siret not valid", async () => {
        const missionLocaleWithBadSiret: CreateAgencyDto = {
          ...parisMissionLocaleParams,
          agencySiret: "12345678909999",
        };

        const response = await httpClient.addAgency({
          body: missionLocaleWithBadSiret,
        });

        expectHttpResponseToEqual(response, {
          status: 404,
          body: {
            status: 404,
            message: errors.agency.invalidSiret({
              siret: missionLocaleWithBadSiret.agencySiret,
            }).message,
          },
        });

        expectToEqual(inMemoryUow.agencyRepository.agencies, []);
      });
    });

    describe("/inclusion-connected/register-agency", () => {
      const agencyFt = new AgencyDtoBuilder()
        .withKind("france-travail")
        .build();
      const agencyFtUser: User = {
        id: "123",
        email: "joe@francetravail.fr",
        firstName: "Joe",
        lastName: "Doe",
        proConnect: defaultProConnectInfos,
        createdAt: new Date().toISOString(),
      };
      it(`${displayRouteName(
        agencyRoutes.registerAgenciesToUser,
      )} 200 add an agency as registered to a connected user`, async () => {
        inMemoryUow.userRepository.users = [agencyFtUser];
        inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agencyFt)];

        const response = await httpClient.registerAgenciesToUser({
          headers: {
            authorization: generateConnectedUserJwt({
              userId: agencyFtUser.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
          body: [agencyFt.id],
        });

        expectHttpResponseToEqual(response, {
          body: "",
          status: 200,
        });

        expectToEqual(inMemoryUow.userRepository.users, [agencyFtUser]);
        expectToEqual(inMemoryUow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder(agencyFt)
              .withUpdatedAt(gateways.timeGateway.now())
              .build(),
            {
              [agencyFtUser.id]: {
                isNotifiedByEmail: false,
                roles: ["to-review"],
              },
            },
          ),
        ]);
      });

      it(`${displayRouteName(
        agencyRoutes.registerAgenciesToUser,
      )} 400 without headers`, async () => {
        const response = await httpClient.registerAgenciesToUser({
          body: ["1"],
          headers: {} as any,
        });
        expectHttpResponseToEqual(response, {
          body: {
            issues: [
              "authorization : Invalid input: expected string, received undefined",
            ],
            message:
              "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: POST /inclusion-connected/register-agency",
            status: 400,
          },
          status: 400,
        });
      });
    });
  });

  describe(`${displayRouteName(
    agencyRoutes.updateUserRoleForAgency,
  )} update user role for agency`, () => {
    it("401 - rejects request with invalid token", async () => {
      const response = await httpClient.updateUserRoleForAgency({
        urlParams: { agencyId: "any-agency" },
        headers: { authorization: "invalid-token" },
        body: {
          agencyId: "any-agency",
          userId: "any-user",
          roles: ["validator"],
          isNotifiedByEmail: true,
          email: "any@email.fr",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("403 - non-admin user with agency-viewer role cannot update another user's email", async () => {
      const agency = new AgencyDtoBuilder().build();

      const victim: User = {
        id: "victim-id",
        email: "victim@mail.com",
        firstName: "Victim",
        lastName: "User",
        proConnect: null,
        createdAt: new Date().toISOString(),
      };

      const attacker: User = {
        id: "attacker-id",
        email: "attacker@mail.com",
        firstName: "Attacker",
        lastName: "User",
        proConnect: null,
        createdAt: new Date().toISOString(),
      };

      inMemoryUow.userRepository.users = [victim, attacker];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [victim.id]: { roles: ["validator"], isNotifiedByEmail: true },
          [attacker.id]: { roles: ["agency-viewer"], isNotifiedByEmail: false },
        }),
      ];

      const attackerToken = generateConnectedUserJwt({
        userId: attacker.id,
        version: currentJwtVersions.connectedUser,
        iat: Date.now(),
        exp: addDays(new Date(), 5).getTime(),
      });

      const response = await httpClient.updateUserRoleForAgency({
        urlParams: { agencyId: agency.id },
        headers: { authorization: attackerToken },
        body: {
          agencyId: agency.id,
          userId: victim.id,
          roles: ["validator"],
          isNotifiedByEmail: true,
          email: "attacker-controlled@email.com",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.user.forbiddenEmailUpdate().message,
        },
      });
    });

    it("201 - backoffice admin can update user role for agency", async () => {
      const agency = new AgencyDtoBuilder().build();

      const userToUpdate: User = {
        id: "user-to-update-id",
        email: "user-to-update@mail.com",
        firstName: "User",
        lastName: "ToUpdate",
        proConnect: null,
        createdAt: new Date().toISOString(),
      };

      inMemoryUow.userRepository.users = [backofficeAdminUser, userToUpdate];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [userToUpdate.id]: {
            roles: ["to-review"],
            isNotifiedByEmail: false,
          },
        }),
      ];

      const response = await httpClient.updateUserRoleForAgency({
        urlParams: { agencyId: agency.id },
        headers: { authorization: backofficeAdminToken },
        body: {
          agencyId: agency.id,
          userId: userToUpdate.id,
          roles: ["validator"],
          isNotifiedByEmail: true,
          email: userToUpdate.email,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 201,
        body: "",
      });
    });
  });

  describe("Private routes (for backoffice admin)", () => {
    describe(`${displayRouteName(
      agencyRoutes.closeAgencyAndTransfertConventions,
    )} to close an agency and transfer its conventions`, () => {
      const agencyToClose = AgencyDtoBuilder.create("agency-to-close-id")
        .withName("Agency to close")
        .withStatus("active")
        .withAddress(defaultAddress)
        .build();

      const agencyToTransferTo = AgencyDtoBuilder.create("target-agency-id")
        .withName("Target agency")
        .withStatus("active")
        .withAddress(defaultAddress)
        .withRefersToAgencyInfo(null)
        .build();

      it("401 - Returns Unauthorized if no token provided", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agencyToClose),
          toAgencyWithRights(agencyToTransferTo),
        ];

        const response = await httpClient.closeAgencyAndTransfertConventions({
          headers: { authorization: "" },
          body: {
            agencyToCloseId: agencyToClose.id,
            agencyToTransferConventionsToId: agencyToTransferTo.id,
          },
        });

        expectHttpResponseToEqual(response, {
          status: 401,
          body: { status: 401, message: "Veuillez vous authentifier" },
        });
      });

      it("403 - non-admin user cannot close agency and transfer conventions", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agencyToClose),
          toAgencyWithRights(agencyToTransferTo),
        ];

        const response = await httpClient.closeAgencyAndTransfertConventions({
          headers: { authorization: nonAdminToken },
          body: {
            agencyToCloseId: agencyToClose.id,
            agencyToTransferConventionsToId: agencyToTransferTo.id,
          },
        });

        expectHttpResponseToEqual(response, {
          status: 403,
          body: {
            status: 403,
            message: errors.user.forbidden({ userId: nonAdminUser.id }).message,
          },
        });
      });

      it("404 - agency to close not found", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agencyToTransferTo),
        ];

        const response = await httpClient.closeAgencyAndTransfertConventions({
          headers: { authorization: backofficeAdminToken },
          body: {
            agencyToCloseId: "non-existent-agency",
            agencyToTransferConventionsToId: agencyToTransferTo.id,
          },
        });

        expectHttpResponseToEqual(response, {
          status: 404,
          body: {
            status: 404,
            message: errors.agency.notFound({
              agencyId: "non-existent-agency",
            }).message,
          },
        });
      });

      it("404 - agency to transfer conventions to not found", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agencyToClose),
        ];

        const response = await httpClient.closeAgencyAndTransfertConventions({
          headers: { authorization: backofficeAdminToken },
          body: {
            agencyToCloseId: agencyToClose.id,
            agencyToTransferConventionsToId: "non-existent-target-agency",
          },
        });

        expectHttpResponseToEqual(response, {
          status: 404,
          body: {
            status: 404,
            message: errors.agency.notFound({
              agencyId: "non-existent-target-agency",
            }).message,
          },
        });
      });

      it("200 - closes agency, transfers conventions and updates referring agencies", async () => {
        const referringAgency = new AgencyDtoBuilder()
          .withId("referring-agency-id")
          .withName("Referring agency")
          .withStatus("active")
          .withRefersToAgencyInfo({
            refersToAgencyId: agencyToClose.id,
            refersToAgencyName: agencyToClose.name,
            refersToAgencyContactEmail: agencyToClose.contactEmail,
          })
          .build();

        const convention = new ConventionDtoBuilder()
          .withAgencyId(agencyToClose.id)
          .build();

        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agencyToClose),
          toAgencyWithRights(agencyToTransferTo),
          toAgencyWithRights(referringAgency),
        ];
        inMemoryUow.conventionRepository.setConventions([convention]);

        const response = await httpClient.closeAgencyAndTransfertConventions({
          headers: { authorization: backofficeAdminToken },
          body: {
            agencyToCloseId: agencyToClose.id,
            agencyToTransferConventionsToId: agencyToTransferTo.id,
          },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: "",
        });

        const closedAgency = await inMemoryUow.agencyRepository.getById(
          agencyToClose.id,
        );
        expectToEqual(closedAgency?.status, "closed");
        expectToEqual(
          closedAgency?.statusJustification,
          "Agence fermée suite à un transfert de convention",
        );

        const transferredConvention =
          await inMemoryUow.conventionRepository.getById(convention.id);
        expectToEqual(transferredConvention?.agencyId, agencyToTransferTo.id);

        const updatedReferring = await inMemoryUow.agencyRepository.getById(
          referringAgency.id,
        );
        expectToEqual(
          updatedReferring?.refersToAgencyId,
          agencyToTransferTo.id,
        );
        expectToEqual(
          updatedReferring?.refersToAgencyName,
          agencyToTransferTo.name,
        );
      });
    });

    describe(`${displayRouteName(
      agencyRoutes.updateAgency,
    )} to update an agency data`, () => {
      it("fails if provided token is not valid", async () => {
        const response = await httpClient.updateAgency({
          headers: { authorization: "wrong-token" },
          urlParams: { agencyId: "test-agency-4" },
          body: {
            ...new AgencyDtoBuilder()
              .withId(agency4NeedsReview.id)
              .withCodeSafir("1234")
              .build(),
            validatorEmails: ["this-is-a-new-validator@mail.com"],
          },
        });

        expectHttpResponseToEqual(response, {
          status: 401,
          body: { status: 401, message: invalidTokenMessage },
        });
      });

      it("rejects update when route agency id and body agency id differ", async () => {
        const routeAgencyId = "route-agency-id";
        const response = await httpClient.updateAgency({
          headers: { authorization: backofficeAdminToken },
          urlParams: { agencyId: routeAgencyId },
          body: {
            ...new AgencyDtoBuilder()
              .withId(agency4NeedsReview.id)
              .withStatus("needsReview")
              .build(),
            validatorEmails: ["this-is-a-new-validator@mail.com"],
          },
        });

        expectHttpResponseToEqual(response, {
          status: 400,
          body: {
            status: 400,
            message: errors.agency.routeIdMismatch({
              routeAgencyId,
              bodyAgencyId: agency4NeedsReview.id,
            }).message,
          },
        });
      });

      it("Updates the agency data without changing status and returns code 200", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency4NeedsReview, {
            [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          }),
        ];

        const response = await httpClient.updateAgency({
          headers: { authorization: backofficeAdminToken },
          urlParams: { agencyId: agency4NeedsReview.id },
          body: {
            ...new AgencyDtoBuilder()
              .withId(agency4NeedsReview.id)
              .withStatus("needsReview")
              .withCodeSafir("1234")
              .build(),
            validatorEmails: ["this-is-a-new-validator@mail.com"],
          },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: "",
        });

        expectToEqual(inMemoryUow.agencyRepository.agencies, [
          toAgencyWithRights(
            new AgencyDtoBuilder()
              .withId(agency4NeedsReview.id)
              .withStatus("needsReview")
              .withCodeSafir("1234")
              .withUpdatedAt(gateways.timeGateway.now())
              .build(),
            {
              [validator.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            },
          ),
        ]);

        expect(inMemoryUow.outboxRepository.events).toHaveLength(1);

        await processEventsForEmailToBeSent(eventCrawler);
        expect(gateways.notification.getSentEmails()).toHaveLength(0);
      });

      it("Activating the agency through update sends notifications and returns code 200", async () => {
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency4NeedsReview, {
            [validator.id]: {
              isNotifiedByEmail: true,
              roles: ["validator", "agency-admin"],
            },
          }),
        ];
        inMemoryUow.userRepository.users = [validator, backofficeAdminUser];

        const response = await httpClient.updateAgency({
          headers: { authorization: backofficeAdminToken },
          urlParams: { agencyId: agency4NeedsReview.id },
          body: {
            ...new AgencyDtoBuilder()
              .withId(agency4NeedsReview.id)
              .withStatus("active")
              .build(),
            validatorEmails: ["this-is-a-new-validator@mail.com"],
          },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: "",
        });

        expect(
          (await inMemoryUow.agencyRepository.getByIds(["test-agency-4"]))[0]
            ?.status,
        ).toBe("active");
        expect(inMemoryUow.outboxRepository.events).toHaveLength(2);

        await processEventsForEmailToBeSent(eventCrawler);
        expect(gateways.notification.getSentEmails()).toHaveLength(1);
      });
    });
  });
});
