import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConnectedUserJwtPayload,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionMagicLinkRoutes,
  type ConventionRole,
  conventionMagicLinkRoutes,
  currentJwtVersions,
  defaultProConnectInfos,
  displayRouteName,
  errors,
  expectArraysToMatch,
  expectHttpResponseToEqual,
  expectToEqual,
  type RenewConventionParams,
  ScheduleDtoBuilder,
  type User,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type {
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
} from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { makeHashByRolesForTest } from "../../../../utils/emailHash";
import { createConventionMagicLinkPayload } from "../../../../utils/jwt";

describe("Magic link router", () => {
  const payloadMeta = {
    exp: Date.now() / 1000 + 1000,
    iat: Date.now() / 1000,
    version: 1,
  };

  const conventionBuilder = new ConventionDtoBuilder().withStatus(
    "READY_TO_SIGN",
  );

  const backofficeAdminUserBuilder = new ConnectedUserBuilder()
    .withId("backoffice-admin-user")
    .withIsAdmin(true);
  const connectedBackofficeAdminUser = backofficeAdminUserBuilder.build();
  const backofficeAdminUser = backofficeAdminUserBuilder.build();

  const backofficeAdminJwtPayload: ConnectedUserJwtPayload = {
    version: currentJwtVersions.connectedUser,
    iat: Date.now(),
    exp: addDays(new Date(), 30).getTime(),
    userId: connectedBackofficeAdminUser.id,
  };

  let request: SuperTest<Test>;
  let generateConventionJwt: GenerateConventionJwt;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let httpClient: HttpClient<ConventionMagicLinkRoutes>;
  let gateways: InMemoryGateways;

  beforeEach(async () => {
    ({
      request,
      generateConventionJwt,
      generateConnectedUserJwt,
      inMemoryUow,
      gateways,
    } = await buildTestApp());
    httpClient = createSupertestSharedClient(
      conventionMagicLinkRoutes,
      request,
    );
    const initialConvention = conventionBuilder.build();
    inMemoryUow.conventionRepository.setConventions([initialConvention]);
    inMemoryUow.userRepository.users = [backofficeAdminUser];
  });

  describe("POST /auth/demande-immersion/:conventionId", () => {
    describe("when beneficiary modification", () => {
      it("can update the convention", async () => {
        const updatedConvention = conventionBuilder
          .withStatus("READY_TO_SIGN")
          .withActivities("Plein d'activitées cool !")
          .build();

        inMemoryUow.conventionRepository.setConventions([
          {
            ...updatedConvention,
            immersionActivities: "pas grand chose",
            status: "READY_TO_SIGN",
          },
        ]);
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(
            AgencyDtoBuilder.create(updatedConvention.agencyId)
              .withName("TEST-name")
              .withSignature("TEST-signature")
              .build(),
          ),
        ];

        const counsellor = new ConnectedUserBuilder()
          .withId("dummy-counsellor")
          .withEmail("counsellor@test.com")
          .buildUser();
        const validator = new ConnectedUserBuilder()
          .withId("dummy-validator")
          .withEmail("validator@test.com")
          .buildUser();

        const emailHash = makeHashByRolesForTest(
          updatedConvention,
          counsellor,
          validator,
        ).beneficiary;

        const backOfficeJwt = generateConventionJwt({
          ...payloadMeta,
          role: "beneficiary",
          emailHash: emailHash,
          applicationId: updatedConvention.id,
        });

        const response = await httpClient.updateConvention({
          urlParams: { conventionId: updatedConvention.id },
          body: { convention: updatedConvention },
          headers: { authorization: backOfficeJwt },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: { id: updatedConvention.id },
        });
      });
    });

    describe("User is not allowed", () => {
      it("throws when user is not admin and have no rights on the agency", async () => {
        const updatedConvention = conventionBuilder
          .withBeneficiaryFirstName("Merguez")
          .withStatus("READY_TO_SIGN")
          .withStatusJustification("Justif")
          .build();

        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(
            AgencyDtoBuilder.create(updatedConvention.agencyId).build(),
          ),
        ];

        const notAdminUser = new ConnectedUserBuilder()
          .withIsAdmin(false)
          .buildUser();

        inMemoryUow.userRepository.users = [notAdminUser];

        const response = await httpClient.updateConvention({
          urlParams: { conventionId: updatedConvention.id },
          body: { convention: updatedConvention },
          headers: {
            authorization: generateConnectedUserJwt({
              userId: notAdminUser.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
        });

        expectHttpResponseToEqual(response, {
          status: 403,
          body: {
            status: 403,
            message: errors.convention.updateForbidden({
              id: updatedConvention.id,
            }).message,
          },
        });
      });
    });

    describe("when admin sends modification requests", () => {
      it("works fine", async () => {
        const updatedConvention = conventionBuilder
          .withBeneficiaryFirstName("Merguez")
          .withStatus("READY_TO_SIGN")
          .withStatusJustification("Justif")
          .notSigned()
          .build();

        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(
            AgencyDtoBuilder.create(updatedConvention.agencyId).build(),
          ),
        ];

        const backOfficeJwt = generateConnectedUserJwt(
          backofficeAdminJwtPayload,
        );

        const response = await httpClient.updateConvention({
          urlParams: { conventionId: updatedConvention.id },
          body: { convention: updatedConvention },
          headers: { authorization: backOfficeJwt },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: { id: updatedConvention.id },
        });
        expectToEqual(inMemoryUow.conventionRepository.conventions, [
          updatedConvention,
        ]);
      });
    });
  });

  describe("POST /renew-convention", () => {
    const existingConvention = new ConventionDtoBuilder().build();
    const renewedConventionStartDate = addDays(
      new Date(existingConvention.dateEnd),
      1,
    );
    const renewedConventionEndDate = addDays(renewedConventionStartDate, 5);
    const renewedConventionParams: RenewConventionParams = {
      id: "11111111-1111-4111-9111-111111111111",
      dateStart: renewedConventionStartDate.toISOString(),
      dateEnd: renewedConventionEndDate.toISOString(),
      schedule: new ScheduleDtoBuilder()
        .withDateInterval({
          start: renewedConventionStartDate,
          end: renewedConventionEndDate,
        })
        .withRegularSchedule({
          selectedDays: [0, 4],
          timePeriods: [
            { start: "09:00", end: "12:00" },
            { start: "13:00", end: "17:00" },
          ],
        })
        .build(),
      renewed: {
        from: existingConvention.id,
        justification: "Il faut bien...",
      },
    };

    const createTokenForRole = ({
      role,
      conventionId,
    }: {
      role: ConventionRole;
      conventionId: ConventionId;
    }) =>
      generateConventionJwt({
        applicationId: conventionId,
        role,
        version: 1,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 1000,
        emailHash: "my-hash",
      });

    it("200 - Creates a convention with provided data and convention jwt", async () => {
      const existingConvention = new ConventionDtoBuilder()
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      inMemoryUow.conventionRepository.setConventions([existingConvention]);
      const renewedConventionStartDate = addDays(
        new Date(existingConvention.dateEnd),
        1,
      );
      const renewedConventionEndDate = addDays(renewedConventionStartDate, 5);
      const renewedConventionParams: RenewConventionParams = {
        id: "22222222-2222-4222-9222-222222222222",
        dateStart: renewedConventionStartDate.toISOString(),
        dateEnd: renewedConventionEndDate.toISOString(),
        schedule: new ScheduleDtoBuilder()
          .withReasonableScheduleInInterval({
            start: renewedConventionStartDate,
            end: renewedConventionEndDate,
          })
          .build(),
        renewed: {
          from: existingConvention.id,
          justification: "Il faut bien...",
        },
      };
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams)
        .set({
          authorization: generateConventionJwt({
            applicationId: existingConvention.id,
            role: "validator",
            version: 1,
            iat: Date.now() / 1000,
            exp: Date.now() / 1000 + 1000,
            emailHash: "my-hash",
          }),
        });

      expectToEqual(response.body, "");
      expectToEqual(response.status, 200);
      expectToEqual(inMemoryUow.conventionRepository.conventions, [
        existingConvention,
        {
          ...existingConvention,
          ...renewedConventionParams,
          signatories: {
            beneficiary: {
              ...existingConvention.signatories.beneficiary,
              signedAt: undefined,
            },
            establishmentRepresentative: {
              ...existingConvention.signatories.establishmentRepresentative,
              signedAt: undefined,
            },
          },
          status: "READY_TO_SIGN",
        },
      ]);
    });

    it("200 - Creates a convention with provided data and backoffice jwt", async () => {
      const existingConvention = new ConventionDtoBuilder()
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      inMemoryUow.conventionRepository.setConventions([existingConvention]);
      const renewedConventionStartDate = addDays(
        new Date(existingConvention.dateEnd),
        1,
      );
      const renewedConventionEndDate = addDays(renewedConventionStartDate, 5);
      const renewedConventionParams: RenewConventionParams = {
        id: "22222222-2222-4222-9222-222222222222",
        dateStart: renewedConventionStartDate.toISOString(),
        dateEnd: renewedConventionEndDate.toISOString(),
        schedule: new ScheduleDtoBuilder()
          .withReasonableScheduleInInterval({
            start: renewedConventionStartDate,
            end: renewedConventionEndDate,
          })
          .build(),
        renewed: {
          from: existingConvention.id,
          justification: "Il faut bien...",
        },
      };
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams)
        .set({
          authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
        });

      expectToEqual(response.body, "");
      expectToEqual(response.status, 200);
      expectToEqual(inMemoryUow.conventionRepository.conventions, [
        existingConvention,
        {
          ...existingConvention,
          ...renewedConventionParams,
          signatories: {
            beneficiary: {
              ...existingConvention.signatories.beneficiary,
              signedAt: undefined,
            },
            establishmentRepresentative: {
              ...existingConvention.signatories.establishmentRepresentative,
              signedAt: undefined,
            },
          },
          status: "READY_TO_SIGN",
        },
      ]);
    });

    it("200 - Creates a convention with provided data and connected user JWT", async () => {
      const agency = new AgencyDtoBuilder().build();
      const existingConvention = new ConventionDtoBuilder()
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withAgencyId(agency.id)
        .build();
      inMemoryUow.conventionRepository.setConventions([existingConvention]);

      const validator: User = {
        id: "my-user-id",
        email: "my-user@email.com",
        firstName: "John",
        lastName: "Doe",
        proConnect: defaultProConnectInfos,
        createdAt: new Date().toISOString(),
        preventToDelete: false,
      };

      inMemoryUow.userRepository.users = [validator];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        }),
      ];

      const renewedConventionStartDate = addDays(
        new Date(existingConvention.dateEnd),
        1,
      );
      const renewedConventionEndDate = addDays(renewedConventionStartDate, 5);
      const renewedConventionParams: RenewConventionParams = {
        id: "22222222-2222-4222-9222-222222222222",
        dateStart: renewedConventionStartDate.toISOString(),
        dateEnd: renewedConventionEndDate.toISOString(),
        schedule: new ScheduleDtoBuilder()
          .withReasonableScheduleInInterval({
            start: renewedConventionStartDate,
            end: renewedConventionEndDate,
          })
          .build(),
        renewed: {
          from: existingConvention.id,
          justification: "Il faut bien...",
        },
      };
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams)
        .set({
          authorization: generateConnectedUserJwt({
            userId: validator.id,
            version: 1,
            iat: Date.now() / 1000,
            exp: Date.now() / 1000 + 1000,
          }),
        });

      expectToEqual(response.body, "");
      expectToEqual(response.status, 200);
      expectToEqual(inMemoryUow.conventionRepository.conventions, [
        existingConvention,
        {
          ...existingConvention,
          ...renewedConventionParams,
          signatories: {
            beneficiary: {
              ...existingConvention.signatories.beneficiary,
              signedAt: undefined,
            },
            establishmentRepresentative: {
              ...existingConvention.signatories.establishmentRepresentative,
              signedAt: undefined,
            },
          },
          status: "READY_TO_SIGN",
        },
      ]);
    });

    it("400 - Fails if no convention magic link token is provided", async () => {
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams);

      expectToEqual(response.body, {
        issues: [
          "authorization : Invalid input: expected string, received undefined",
        ],
        message:
          "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: POST /auth/renew-convention",
        status: 400,
      });
      expectToEqual(response.status, 400);
    });

    it("400 - Fails if original convention is not ACCEPTED_BY_VALIDATOR", async () => {
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams)
        .set({
          authorization: createTokenForRole({
            role: "counsellor",
            conventionId: existingConvention.id,
          }),
        });

      expectToEqual(response.body, {
        status: 400,
        message:
          "This convention cannot be renewed, as it has status : 'READY_TO_SIGN'",
      });
      expectToEqual(response.status, 400);
    });

    it("403 - Fails if provided token does not have enough privileges", async () => {
      const response = await request
        .post(conventionMagicLinkRoutes.renewConvention.url)
        .send(renewedConventionParams)
        .set({
          authorization: createTokenForRole({
            role: "beneficiary",
            conventionId: existingConvention.id,
          }),
        });

      expectToEqual(response.body, {
        status: 403,
        message: "The role 'beneficiary' is not allowed to renew convention",
      });
      expectToEqual(response.status, 403);
    });
  });

  describe("POST /auth/sign-application/:conventionId", () => {
    const agency = new AgencyDtoBuilder().build();
    const convention = new ConventionDtoBuilder()
      .withAgencyId(agency.id)
      .withStatus("READY_TO_SIGN")
      .notSigned()
      .build();

    beforeEach(() => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [];
    });

    it.each([
      {
        signatory: "establishment-representative",
        getEmail: (convention: ConventionDto) =>
          convention.signatories.establishmentRepresentative.email,
      },
      {
        signatory: "beneficiary",
        getEmail: (convention: ConventionDto) =>
          convention.signatories.beneficiary.email,
      },
    ] satisfies {
      signatory: "establishment-representative" | "beneficiary";
      getEmail: (convention: ConventionDto) => string;
    }[])(
      "200 - connected $signatory can sign convention",
      async ({ signatory, getEmail }) => {
        const signedAt = new Date("2025-01-15T10:00:00.000Z");
        gateways.timeGateway.setNextDate(signedAt);
        const signatoryUser = new ConnectedUserBuilder()
          .withId(`${getEmail(convention)}-user-id`)
          .withEmail(getEmail(convention))
          .buildUser();

        inMemoryUow.userRepository.users = [signatoryUser];

        const response = await httpClient.signConvention({
          urlParams: { conventionId: convention.id },
          headers: {
            authorization: generateConnectedUserJwt({
              userId: signatoryUser.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: { id: convention.id },
        });

        const signedAtIso = signedAt.toISOString();

        expectToEqual(inMemoryUow.conventionRepository.conventions, [
          {
            ...convention,
            status: "PARTIALLY_SIGNED",
            signatories: {
              ...convention.signatories,
              beneficiary:
                signatory === "beneficiary"
                  ? {
                      ...convention.signatories.beneficiary,
                      signedAt: signedAtIso,
                    }
                  : convention.signatories.beneficiary,
              establishmentRepresentative:
                signatory === "establishment-representative"
                  ? {
                      ...convention.signatories.establishmentRepresentative,
                      signedAt: signedAtIso,
                    }
                  : convention.signatories.establishmentRepresentative,
            },
          },
        ]);
      },
    );

    it("403 - cannot sign with connected user who is not a signatory", async () => {
      const userWithNoRightOnConvention = new ConnectedUserBuilder()
        .withId("user-with-no-right-on-convention")
        .withEmail("user-with-no-right-on-convention@mail.com")
        .buildUser();

      inMemoryUow.userRepository.users = [userWithNoRightOnConvention];

      const response = await httpClient.signConvention({
        urlParams: { conventionId: convention.id },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: userWithNoRightOnConvention.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.connectedUserNotSignatory({
            userId: userWithNoRightOnConvention.id,
            conventionId: convention.id,
          }).message,
        },
      });
    });

    it("200 - establishment-representative with valid magic link JWT can sign convention", async () => {
      const signedAt = new Date("2025-01-15T10:00:00.000Z");
      gateways.timeGateway.setNextDate(signedAt);

      const establishmentRepresentativeJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "establishment-representative",
          email: convention.signatories.establishmentRepresentative.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signConvention({
        urlParams: { conventionId: convention.id },
        headers: { authorization: establishmentRepresentativeJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { id: convention.id },
      });
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.signConvention({
        urlParams: { conventionId: convention.id },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("404 - convention not found", async () => {
      const unknownConventionId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as ConventionId;
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: unknownConventionId,
          role: "establishment-representative",
          email: "rep@mail.com",
          now: new Date(),
        }),
      );

      inMemoryUow.conventionRepository.setConventions([]);

      const response = await httpClient.signConvention({
        urlParams: { conventionId: unknownConventionId },
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownConventionId,
          }).message,
        },
      });
    });

    it("403 - convention id does not match the one in token", async () => {
      const anotherConvention = new ConventionDtoBuilder()
        .withId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
        .withAgencyId(agency.id)
        .withStatus("READY_TO_SIGN")
        .notSigned()
        .build();

      inMemoryUow.conventionRepository.setConventions([
        convention,
        anotherConvention,
      ]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "establishment-representative",
          email: convention.signatories.establishmentRepresentative.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signConvention({
        urlParams: { conventionId: anotherConvention.id },
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenConventionIdMismatch({
            jwtConventionId: convention.id,
            jwtRole: "establishment-representative",
            requestedConventionId: anotherConvention.id,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.editConventionWithFinalStatus,
  )}`, () => {
    const agency = new AgencyDtoBuilder().build();
    const validator = new ConnectedUserBuilder()
      .withId("validator")
      .withEmail("validator@mail.com")
      .buildUser();
    const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
    const newBirthdate = "1995-03-15";
    const oldBeneficiaryBirthdate = "2002-10-05";
    const newFirstName = "Jean";
    const newLastName = "Martin";
    const newTutorEmail = "new-tutor@mail.com";
    const convention = new ConventionDtoBuilder()
      .withId(conventionId)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withAgencyId(agency.id)
      .withBeneficiaryBirthdate(oldBeneficiaryBirthdate)
      .build();

    const establishmentTutorBody = {
      firstname: "Marie",
      lastname: "Curie",
      job: convention.establishmentTutor.job,
      email: newTutorEmail,
      phone: convention.establishmentTutor.phone,
    };

    const beneficiaryBody = {
      updatedBeneficiaryBirthDate: newBirthdate,
      firstname: newFirstName,
      lastname: newLastName,
    };

    const adminUser = new ConnectedUserBuilder()
      .withId("admin-user-id")
      .withEmail("admin@mail.com")
      .withIsAdmin(true)
      .buildUser();

    const validatorToken = () =>
      generateConnectedUserJwt({
        userId: validator.id,
        version: currentJwtVersions.connectedUser,
      });

    it("401 with bad token", async () => {
      const response = await httpClient.editConventionWithFinalStatus({
        headers: { authorization: "wrong-token" },
        body: {
          conventionId,
          establishmentTutor: establishmentTutorBody,
          beneficiary: beneficiaryBody,
        },
      });
      expectHttpResponseToEqual(response, {
        body: { message: invalidTokenMessage, status: 401 },
        status: 401,
      });
    });

    it("403 when non-admin sends beneficiary update", async () => {
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [validator];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];

      const response = await httpClient.editConventionWithFinalStatus({
        headers: { authorization: validatorToken() },
        body: {
          conventionId,
          establishmentTutor: establishmentTutorBody,
          beneficiary: beneficiaryBody,
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 403,
          message: errors.user.forbidden({ userId: validator.id }).message,
        },
        status: 403,
      });
    });

    it("404 when convention is not found", async () => {
      const unknownId = "00000000-0000-4000-8000-000000000001";
      inMemoryUow.userRepository.users = [adminUser];
      inMemoryUow.conventionRepository.setConventions([]);

      const response = await httpClient.editConventionWithFinalStatus({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: adminUser.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        body: {
          conventionId: unknownId,
          establishmentTutor: establishmentTutorBody,
          beneficiary: beneficiaryBody,
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 404,
          message: errors.convention.notFound({ conventionId: unknownId })
            .message,
        },
        status: 404,
      });
    });

    it("400 when convention status is not allowed", async () => {
      const conventionInReview = new ConventionDtoBuilder(convention)
        .withStatus("IN_REVIEW")
        .build();
      inMemoryUow.conventionRepository.setConventions([conventionInReview]);
      inMemoryUow.userRepository.users = [adminUser];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];

      const response = await httpClient.editConventionWithFinalStatus({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: adminUser.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        body: {
          conventionId: conventionInReview.id,
          establishmentTutor: establishmentTutorBody,
          beneficiary: beneficiaryBody,
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 400,
          message:
            errors.convention.editConventionWithFinalStatusNotAllowedForStatus({
              status: "IN_REVIEW",
              conventionId: conventionInReview.id,
            }).message,
        },
        status: 400,
      });
    });

    it("200 - establishment representative can update establishment tutor", async () => {
      const repEmail = convention.signatories.establishmentRepresentative.email;
      const emailHash = createConventionMagicLinkPayload({
        id: convention.id,
        role: "establishment-representative",
        email: repEmail,
        now: new Date(),
      }).emailHash;

      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      inMemoryUow.conventionRepository.setConventions([convention]);

      const response = await httpClient.editConventionWithFinalStatus({
        headers: {
          authorization: generateConventionJwt({
            ...payloadMeta,
            applicationId: convention.id,
            role: "establishment-representative",
            emailHash,
          }),
        },
        body: {
          conventionId: convention.id,
          establishmentTutor: establishmentTutorBody,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
      expectToEqual(
        inMemoryUow.conventionRepository.conventions[0]?.establishmentTutor
          .email,
        newTutorEmail,
      );
    });

    it("200 updates establishment tutor when validator has agency rights", async () => {
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [validator];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];

      const response = await httpClient.editConventionWithFinalStatus({
        headers: { authorization: validatorToken() },
        body: {
          conventionId,
          establishmentTutor: establishmentTutorBody,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      expectToEqual(
        inMemoryUow.conventionRepository.conventions[0]?.establishmentTutor
          .email,
        newTutorEmail,
      );
    });

    it("200 updates beneficiary and saves ConventionWithFinalStatusEdited event", async () => {
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [adminUser];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [adminUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];

      const adminToken = generateConnectedUserJwt({
        userId: adminUser.id,
        version: currentJwtVersions.connectedUser,
      });

      const response = await httpClient.editConventionWithFinalStatus({
        headers: { authorization: adminToken },
        body: {
          conventionId,
          beneficiary: beneficiaryBody,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      const updatedConvention = inMemoryUow.conventionRepository.conventions[0];
      expectToEqual(
        updatedConvention?.signatories.beneficiary.birthdate,
        newBirthdate,
      );
      expectToEqual(
        updatedConvention?.signatories.beneficiary.firstName,
        newFirstName,
      );
      expectToEqual(
        updatedConvention?.signatories.beneficiary.lastName,
        newLastName,
      );
      expectToEqual(
        updatedConvention?.establishmentTutor.email,
        convention.establishmentTutor.email,
      );

      expectArraysToMatch(inMemoryUow.outboxRepository.events, [
        {
          topic: "ConventionWithFinalStatusEdited",
          payload: {
            convention: updatedConvention,
            triggeredBy: {
              kind: "connected-user",
              userId: adminUser.id,
            },
          },
        },
      ]);
    });
  });

  describe("POST /auth/convention/signatories/send-signature-link", () => {
    const agency = new AgencyDtoBuilder().build();
    const convention = new ConventionDtoBuilder()
      .withAgencyId(agency.id)
      .withStatus("READY_TO_SIGN")
      .notSigned()
      .build();
    const conventionWithBeneficiaryPhone = new ConventionDtoBuilder(convention)
      .withBeneficiaryPhone("+33611111111")
      .build();
    const validator = new ConnectedUserBuilder()
      .withId("validator")
      .withEmail("validator@mail.com")
      .buildUser();
    const beneficiary = new ConnectedUserBuilder()
      .withId("beneficiary")
      .withEmail(convention.signatories.beneficiary.email)
      .buildUser();
    const establishmentRepresentativeConnected = new ConnectedUserBuilder()
      .withId("establishment-representative")
      .withEmail(convention.signatories.establishmentRepresentative.email)
      .buildUser();
    const establishmentRepresentativeUser: User = {
      email: convention.signatories.establishmentRepresentative.email,
      firstName: "",
      lastName: "",
      id: "1",
      proConnect: defaultProConnectInfos,
      createdAt: new Date().toISOString(),
      preventToDelete: false,
    };

    beforeEach(() => {
      gateways.shortLinkGenerator.addMoreShortLinkIds(["shortLink1"]);
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [];
    });

    it("200 - connected validator can send signature link to signatory", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      inMemoryUow.userRepository.users = [
        establishmentRepresentativeUser,
        validator,
      ];

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: convention.id,
          signatoryRole: "establishment-representative",
          notificationKind: "sms",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: validator.id,
            version: 1,
          }),
        },
      });
      expectToEqual(response.status, 200);
      expectToEqual(response.body, "");
    });

    it("200 - connected beneficiary can send signature link to themselves", async () => {
      inMemoryUow.conventionRepository.setConventions([
        conventionWithBeneficiaryPhone,
      ]);
      inMemoryUow.userRepository.users = [beneficiary];

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: conventionWithBeneficiaryPhone.id,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: 1,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it("200 - connected beneficiary can send signature link to another signatory", async () => {
      inMemoryUow.userRepository.users = [beneficiary];

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: convention.id,
          signatoryRole: "establishment-representative",
          notificationKind: "sms",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: 1,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it("200 - connected establishment representative can send signature link to a signatory", async () => {
      inMemoryUow.conventionRepository.setConventions([
        conventionWithBeneficiaryPhone,
      ]);
      inMemoryUow.userRepository.users = [establishmentRepresentativeConnected];

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: conventionWithBeneficiaryPhone.id,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: establishmentRepresentativeConnected.id,
            version: 1,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it("403 - connected user whose email is not linked to the convention cannot send signature link", async () => {
      const unrelatedUser = new ConnectedUserBuilder()
        .withId("unrelated-user")
        .withEmail("unrelated@mail.com")
        .buildUser();

      inMemoryUow.userRepository.users = [unrelatedUser];

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: convention.id,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: unrelatedUser.id,
            version: 1,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message:
            errors.convention.sendSignatureLinkNotAuthorizedForRole().message,
        },
      });
    });

    it("200 - validator with valid magic link JWT can send signature link", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      inMemoryUow.userRepository.users = [
        establishmentRepresentativeUser,
        validator,
      ];

      const validatorJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "validator",
          email: validator.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: convention.id,
          signatoryRole: "establishment-representative",
          notificationKind: "sms",
        },
        headers: { authorization: validatorJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it("401 - invalid JWT", async () => {
      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: convention.id,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("404 - convention not found", async () => {
      const unknownConventionId =
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as ConventionId;
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: unknownConventionId,
          role: "validator",
          email: "validator@mail.com",
          now: new Date(),
        }),
      );

      inMemoryUow.conventionRepository.setConventions([]);

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: unknownConventionId,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownConventionId,
          }).message,
        },
      });
    });

    it("403 - convention id does not match the one in token", async () => {
      const anotherConventionId =
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as ConventionId;
      const anotherConvention = new ConventionDtoBuilder()
        .withId(anotherConventionId)
        .withAgencyId(agency.id)
        .withStatus("READY_TO_SIGN")
        .notSigned()
        .build();

      inMemoryUow.conventionRepository.setConventions([
        convention,
        anotherConvention,
      ]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "validator",
          email: "validator@mail.com",
          now: new Date(),
        }),
      );

      const response = await httpClient.sendSignatureLink({
        body: {
          conventionId: anotherConventionId,
          signatoryRole: "beneficiary",
          notificationKind: "sms",
        },
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenConventionIdMismatch({
            jwtConventionId: convention.id,
            jwtRole: "validator",
            requestedConventionId: anotherConventionId,
          }).message,
        },
      });
    });
  });
});
