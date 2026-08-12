import { addDays, subHours } from "date-fns";
import {
  type AbsoluteUrl,
  type AddConventionInput,
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
  ConnectedUserBuilder,
  type ConnectedUserJwtPayload,
  type ConventionDraftId,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionMagicLinkRoutes,
  type ConventionRole,
  conventionMagicLinkRoutes,
  currentJwtVersions,
  defaultProConnectInfos,
  displayRouteName,
  errors,
  expectArraysToEqual,
  expectArraysToMatch,
  expectEmailOfType,
  expectHttpResponseToEqual,
  expectToEqual,
  expiredJwtErrorMessage,
  frontRoutes,
  makeEmptyLastReminders,
  makeRouteAbsoluteUrl,
  type TechnicalRoutes,
  technicalRoutes,
  type UnauthenticatedConventionRoutes,
  type User,
  unauthenticatedConventionRoutes,
  type WithAuthorizationHeader,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { match } from "ts-pattern";
import { v4 as uuid } from "uuid";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import { createAssessmentEntity } from "../../../../domains/convention/entities/AssessmentEntity";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import type {
  GenerateConnectedUserJwt,
  GenerateConventionJwt,
} from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { shortLinkRedirectToLinkWithValidation } from "../../../../utils/e2eTestHelpers";
import {
  createConventionMagicLinkPayload,
  makeEmailHash,
} from "../../../../utils/jwt";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("convention e2e", () => {
  const peAgency = new AgencyDtoBuilder().withKind("pole-emploi").build();

  const validator: User = {
    id: "my-user-id",
    email: "my-user@email.com",
    firstName: "John",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
  };
  const convention = new ConventionDtoBuilder()
    .withAgencyId(peAgency.id)
    .withFederatedIdentity({ provider: "ftConnect", token: "some-id" })
    .build();

  const unknownId: ConventionId = "add5c20e-6dd2-45af-affe-927358005251";

  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin-user")
    .withIsAdmin(true)
    .buildUser();

  const backofficeAdminJwtPayload: ConnectedUserJwtPayload = {
    version: currentJwtVersions.connectedUser,
    iat: Date.now(),
    exp: addDays(new Date(), 30).getTime(),
    userId: backofficeAdminUser.id,
  };

  let unauthenticatedRequest: HttpClient<UnauthenticatedConventionRoutes>;
  let magicLinkRequest: HttpClient<ConventionMagicLinkRoutes>;
  let technicalRoutesClient: HttpClient<TechnicalRoutes>;
  let generateConventionJwt: GenerateConventionJwt;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let eventCrawler: BasicEventCrawler;
  let gateways: InMemoryGateways;

  beforeEach(async () => {
    const testApp = await buildTestApp(new AppConfigBuilder().build());
    const request = testApp.request;

    ({
      eventCrawler,
      gateways,
      generateConventionJwt,
      generateConnectedUserJwt,
      inMemoryUow,
    } = testApp);

    unauthenticatedRequest = createSupertestSharedClient(
      unauthenticatedConventionRoutes,
      request,
    );

    magicLinkRequest = createSupertestSharedClient(
      conventionMagicLinkRoutes,
      request,
    );

    technicalRoutesClient = createSupertestSharedClient(
      technicalRoutes,
      request,
    );

    gateways.timeGateway.defaultDate = new Date();
  });

  describe(`${displayRouteName(
    unauthenticatedConventionRoutes.createConvention,
  )} add a new convention`, () => {
    it("200 - Create convention without auth", async () => {
      expectToEqual(inMemoryUow.conventionRepository.conventions, []);

      const response = await unauthenticatedRequest.createConvention({
        body: { convention },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { id: convention.id },
      });

      expectToEqual(inMemoryUow.conventionRepository.conventions, [convention]);
    });

    it("400 - Invalid body", async () => {
      const response = await unauthenticatedRequest.createConvention({
        body: {
          invalid_params: true,
        } as unknown as AddConventionInput,
      });

      expectHttpResponseToEqual(response, {
        body: {
          message:
            "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /demandes-immersion",
          status: 400,
          issues: [
            "convention : Invalid input: expected object, received undefined",
          ],
        },
        status: 400,
      });
    });

    it("409 - Conflict", async () => {
      inMemoryUow.conventionRepository.setConventions([convention]);

      const response = await unauthenticatedRequest.createConvention({
        body: { convention },
      });

      expectHttpResponseToEqual(response, {
        status: 409,
        body: {
          status: 409,
          message: errors.convention.conflict({
            conventionId: convention.id,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    unauthenticatedConventionRoutes.saveConventionDraft,
  )} shares a conventions with a short link`, () => {
    describe("200 - Share convention without auth", () => {
      it("should successfully ask for a short link", async () => {
        const shortLinkId = "shortLink1";
        gateways.shortLinkGenerator.addMoreShortLinkIds([shortLinkId]);
        const conventionDraftId: ConventionDraftId =
          "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
        const localBaseUrl: AbsoluteUrl = "http://localhost";
        const conventionDraftLink = makeRouteAbsoluteUrl({
          route: frontRoutes.conventionImmersion({ conventionDraftId }),
          baseUrl: localBaseUrl,
        });
        expectToEqual(inMemoryUow.conventionRepository.conventions, []);

        const response = await unauthenticatedRequest.saveConventionDraft({
          body: {
            senderEmail: "any@email.fr",
            conventionDraft: {
              id: conventionDraftId,
              internshipKind: "immersion",
            },
          },
        });

        expectHttpResponseToEqual(response, {
          status: 200,
          body: "",
        });

        await processEventsForEmailToBeSent(eventCrawler);

        const sentEmails = gateways.notification.getSentEmails();
        expectToEqual(sentEmails.length, 1);
        const conventionShortLinkEmail = expectEmailOfType(
          sentEmails[0],
          "SHARE_CONVENTION_DRAFT_SENDER",
        );

        const sharedConventionLink =
          await shortLinkRedirectToLinkWithValidation(
            conventionShortLinkEmail.params.conventionFormUrl,
            technicalRoutesClient,
          );

        expectToEqual(conventionDraftLink, sharedConventionLink);
      });
    });

    describe("400 - Invalid body", () => {
      it("should return error message when missing mandatory fields", async () => {
        expectToEqual(inMemoryUow.conventionRepository.conventions, []);
        const response = await unauthenticatedRequest.saveConventionDraft({
          body: {
            details: "any@email.fr",
            senderEmail: "invalid-email",
            conventionDraft: {
              id: uuid(),
              internshipKind: "immersion",
            },
          },
        });

        expectHttpResponseToEqual(response, {
          status: 400,
          body: {
            status: 400,
            message:
              "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /convention-drafts",
            issues: [
              "senderEmail : Veuillez saisir une adresse e-mail valide - email fourni : 'invalid-email'",
            ],
          },
        });
      });
    });
  });

  describe(`${displayRouteName(
    unauthenticatedConventionRoutes.getConventionDraft,
  )} gets a convention draft`, () => {
    it("200 - Returns the convention draft when it exists", async () => {
      const now = new Date().toISOString();
      const conventionDraftId: ConventionDraftId =
        "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const conventionDraft = {
        id: conventionDraftId,
        internshipKind: "immersion" as const,
      };
      await inMemoryUow.conventionDraftRepository.save(conventionDraft, now);

      const response = await unauthenticatedRequest.getConventionDraft({
        urlParams: { conventionDraftId },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          ...conventionDraft,
          updatedAt: now,
        },
      });
    });

    it("400 - Returns error when conventionDraftId is not a valid UUID", async () => {
      const notValidId: ConventionDraftId = "invalid-uuid";

      const response = await unauthenticatedRequest.getConventionDraft({
        urlParams: { conventionDraftId: notValidId },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message:
            "Schema validation failed in usecase GetConventionDraftById. See issues for details.",
          issues: ["Le format de l'identifiant est invalide"],
        },
      });
    });

    it("404 - Returns error when convention draft does not exist", async () => {
      const nonExistentId: ConventionDraftId =
        "bbbbbc99-9c0b-1bbb-bb6d-6bb9bd38bbbb";

      const response = await unauthenticatedRequest.getConventionDraft({
        urlParams: { conventionDraftId: nonExistentId },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.conventionDraft.notFound({
            conventionDraftId: nonExistentId,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    unauthenticatedConventionRoutes.findSimilarConventions,
  )} finds similar conventions`, () => {
    it("find no conventions ids when none have similar data", async () => {
      const response = await unauthenticatedRequest.findSimilarConventions({
        queryParams: {
          dateStart: "2021-01-06",
          siret: "11112222333311",
          codeAppellation: "017751",
          beneficiaryBirthdate: "2002-10-05",
          beneficiaryLastName: "Martin",
        },
      });
      expectHttpResponseToEqual(response, {
        status: 200,
        body: { similarConventionIds: [] },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.getConvention,
  )} gets a convention from a magic link`, () => {
    beforeEach(() => {
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(peAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
    });

    it.each([
      "ConventionJwt",
      "BackOfficeJwt",
      "ConnectedUserJwt",
    ] as const)("200 - succeeds with JWT %s", async (scenario) => {
      inMemoryUow.userRepository.users = [validator, backofficeAdminUser];
      inMemoryUow.assessmentRepository.assessments = [
        {
          conventionId: convention.id,
          status: "COMPLETED",
          endedWithAJob: false,
          establishmentFeedback: "Ca c'est bien passé",
          establishmentAdvices: "mon conseil",
          numberOfHoursActuallyMade: 35,
          beneficiaryAgreement: null,
          beneficiaryFeedback: null,
          signedAt: null,
          createdAt: new Date("2025-01-01").toISOString(),
          _entityName: "Assessment",
        },
      ];

      const jwt = match(scenario)
        .with("ConventionJwt", () =>
          generateConventionJwt({
            applicationId: convention.id,
            role: "beneficiary",
            emailHash: makeEmailHash(convention.signatories.beneficiary.email),
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
            exp:
              Math.round(gateways.timeGateway.now().getTime() / 1000) +
              31 * 24 * 3600,
            version: currentJwtVersions.convention,
          }),
        )
        .with("BackOfficeJwt", () =>
          generateConnectedUserJwt(backofficeAdminJwtPayload),
        )
        .with("ConnectedUserJwt", () =>
          generateConnectedUserJwt({
            userId: validator.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
          }),
        )
        .exhaustive();

      const response = await magicLinkRequest.getConvention({
        headers: { authorization: jwt },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          ...convention,
          agencyName: peAgency.name,
          agencyDepartment: peAgency.address.departmentCode,
          agencyContactEmail: peAgency.contactEmail,
          agencyKind: peAgency.kind,
          agencySiret: peAgency.agencySiret,
          agencyValidationSteps: "validator-only",
          assessment: {
            status: "COMPLETED",
            endedWithAJob: false,
            signedAt: null,
            createdAt: new Date("2025-01-01").toISOString(),
          },
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        },
      });
    });

    it("400 - no JWT", async () => {
      const response = await magicLinkRequest.getConvention({
        urlParams: {
          conventionId: convention.id,
        },
        headers: undefined as unknown as WithAuthorizationHeader,
      });

      expectHttpResponseToEqual(response, {
        body: {
          issues: [
            "authorization : Invalid input: expected string, received undefined",
          ],
          message:
            "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: GET /auth/demandes-immersion/:conventionId",
          status: 400,
        },
        status: 400,
      });
    });

    it("403 - JWT Expired", async () => {
      const response = await magicLinkRequest.getConvention({
        urlParams: {
          conventionId: convention.id,
        },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "beneficiary",
              email: convention.signatories.beneficiary.email,
              durationDays: 1,
              now: gateways.timeGateway.now(),
              expOverride:
                Math.round(gateways.timeGateway.now().getTime() / 1000) -
                2 * 24 * 3600,
            }),
          ),
        },
      });

      // GETting the created convention 403's and sets needsNewMagicLink flag to inform the front end to go to the link renewal page.
      expectHttpResponseToEqual(response, {
        body: {
          message: expiredJwtErrorMessage,
          needsNewMagicLink: true,
        },
        status: 403,
      });
    });

    it("404 - Fetching unknown convention id", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: unknownId,
          role: "beneficiary",
          email: "some email",
          now: gateways.timeGateway.now(),
        }),
      );
      const response = await magicLinkRequest.getConvention({
        headers: { authorization: jwt },
        urlParams: {
          conventionId: unknownId,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({ conventionId: unknownId })
            .message,
        },
      });
    });

    it("200 - connected beneficiary can get convention", async () => {
      const beneficiary = new ConnectedUserBuilder()
        .withId("beneficiary")
        .withEmail(convention.signatories.beneficiary.email)
        .buildUser();

      inMemoryUow.userRepository.users = [beneficiary];
      inMemoryUow.assessmentRepository.assessments = [
        {
          conventionId: convention.id,
          status: "COMPLETED",
          endedWithAJob: false,
          establishmentFeedback: "Ca c'est bien passé",
          establishmentAdvices: "mon conseil",
          numberOfHoursActuallyMade: 35,
          beneficiaryAgreement: null,
          beneficiaryFeedback: null,
          signedAt: null,
          createdAt: new Date("2025-01-01").toISOString(),
          _entityName: "Assessment",
        },
      ];

      const response = await magicLinkRequest.getConvention({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
          }),
        },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          ...convention,
          agencyName: peAgency.name,
          agencyDepartment: peAgency.address.departmentCode,
          agencyContactEmail: peAgency.contactEmail,
          agencyKind: peAgency.kind,
          agencySiret: peAgency.agencySiret,
          agencyValidationSteps: "validator-only",
          assessment: {
            status: "COMPLETED",
            endedWithAJob: false,
            signedAt: null,
            createdAt: new Date("2025-01-01").toISOString(),
          },
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        },
      });
    });

    it("403 - connected user whose email is not linked to the convention cannot get convention", async () => {
      const userWithNoRightOnConvention = new ConnectedUserBuilder()
        .withId("user-with-no-right-on-convention")
        .withEmail("user-with-no-right-on-convention@mail.com")
        .buildUser();

      inMemoryUow.userRepository.users = [userWithNoRightOnConvention];

      const response = await magicLinkRequest.getConvention({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: userWithNoRightOnConvention.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
          }),
        },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenMissingRightsUserId({
            conventionId: convention.id,
            userId: userWithNoRightOnConvention.id,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.updateConvention,
  )} updates convention`, () => {
    const partiallySignedConvention = new ConventionDtoBuilder(convention)
      .withStatus("PARTIALLY_SIGNED")
      .signedByEstablishmentRepresentative(
        new Date("2025-01-15T10:00:00.000Z").toISOString(),
      )
      .build();
    const beneficiary = new ConnectedUserBuilder()
      .withId("beneficiary")
      .withEmail(convention.signatories.beneficiary.email)
      .buildUser();

    beforeEach(() => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(peAgency)];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [];
    });

    it("200 - Success with JWT ConventionJwt", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(
          AgencyDtoBuilder.create(convention.agencyId)
            .withName("TEST-name")
            .withSignature("TEST-signature")
            .build(),
        ),
      ];
      const updatedConvention = new ConventionDtoBuilder(convention)
        .withBeneficiaryEmail("new@email.fr")
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .build();

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.updateConvention({
        headers: { authorization: jwt },
        urlParams: { conventionId: convention.id },
        body: {
          convention: updatedConvention,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { id: convention.id },
      });
    });

    it("200 - connected beneficiary can update convention", async () => {
      gateways.timeGateway.setNextDate(new Date("2025-01-15T11:00:00.000Z"));
      inMemoryUow.userRepository.users = [beneficiary];
      inMemoryUow.conventionRepository.setConventions([
        partiallySignedConvention,
      ]);

      const updatedConvention = new ConventionDtoBuilder(
        partiallySignedConvention,
      )
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .notSigned()
        .build();

      const response = await magicLinkRequest.updateConvention({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        urlParams: { conventionId: partiallySignedConvention.id },
        body: { convention: updatedConvention },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { id: partiallySignedConvention.id },
      });

      expectArraysToMatch(inMemoryUow.outboxRepository.events, [
        {
          topic: "ConventionModifiedAndSigned",
          payload: {
            convention: expect.objectContaining({
              id: partiallySignedConvention.id,
              status: "PARTIALLY_SIGNED",
            }),
            triggeredBy: {
              kind: "connected-user",
              userId: beneficiary.id,
            },
          },
        },
      ]);
    });

    it("403 - connected user whose email is not linked to the convention cannot update convention", async () => {
      const userWithNoRightOnConvention = new ConnectedUserBuilder()
        .withId("user-with-no-right-on-convention")
        .withEmail("user-with-no-right-on-convention@mail.com")
        .buildUser();

      inMemoryUow.userRepository.users = [userWithNoRightOnConvention];

      const updatedConvention = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .build();

      const response = await magicLinkRequest.updateConvention({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: userWithNoRightOnConvention.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        urlParams: { conventionId: convention.id },
        body: { convention: updatedConvention },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.updateForbidden({
            id: convention.id,
          }).message,
        },
      });
    });

    it("401 - invalid JWT", async () => {
      const updatedConvention = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .build();

      const response = await magicLinkRequest.updateConvention({
        headers: { authorization: "invalid-jwt" },
        urlParams: { conventionId: convention.id },
        body: { convention: updatedConvention },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("403 - convention id does not match the one in token", async () => {
      const anotherConventionId =
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as ConventionId;
      const anotherConvention = new ConventionDtoBuilder()
        .withId(anotherConventionId)
        .withAgencyId(peAgency.id)
        .withStatus("READY_TO_SIGN")
        .build();

      inMemoryUow.conventionRepository.setConventions([
        convention,
        anotherConvention,
      ]);

      const updatedConvention = new ConventionDtoBuilder(anotherConvention)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .build();

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.updateConvention({
        headers: { authorization: jwt },
        urlParams: { conventionId: anotherConventionId },
        body: { convention: updatedConvention },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenConventionIdMismatch({
            jwtConventionId: convention.id,
            jwtRole: "beneficiary",
            requestedConventionId: anotherConventionId,
          }).message,
        },
      });
    });

    it("404 - Updating an unknown convention id", async () => {
      const conventionWithUnknownId = new ConventionDtoBuilder()
        .withId(unknownId)
        .withStatus("READY_TO_SIGN")
        .build();

      const response = await magicLinkRequest.updateConvention({
        body: {
          convention: conventionWithUnknownId,
        },
        urlParams: { conventionId: unknownId },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: unknownId,
              role: "beneficiary",
              email: "some email",
              now: gateways.timeGateway.now(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownId,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.updateConventionStatus,
  )} updates the status of a convention`, () => {
    const externalId = "00000000001";

    beforeEach(() => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(peAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
      const inReviewConvention = new ConventionDtoBuilder(convention)
        .withStatus("IN_REVIEW")
        .build();
      inMemoryUow.conventionRepository.setConventions([inReviewConvention]);
      inMemoryUow.conventionExternalIdRepository.externalIdsByConventionId = {
        [inReviewConvention.id]: externalId,
      };
      inMemoryUow.userRepository.users = [validator, backofficeAdminUser];
    });

    it.each([
      "ConventionJwt",
      "BackOfficeJwt",
      "ConnectedUserJwt",
    ] as const)("200 - Succeeds with JWT %s", async (scenario) => {
      const jwt = match(scenario)
        .with("ConventionJwt", () =>
          generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "counsellor",
              email: "counsellor@pe.fr",
              now: gateways.timeGateway.now(),
            }),
          ),
        )
        .with("BackOfficeJwt", () =>
          generateConnectedUserJwt({
            userId: validator.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
            exp: Math.round(gateways.timeGateway.now().getTime() / 1000) + 3600,
          }),
        )
        .with("ConnectedUserJwt", () =>
          generateConnectedUserJwt({
            userId: validator.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
          }),
        )
        .exhaustive();

      const statusJustification = "test-justification";

      const response = await magicLinkRequest.updateConventionStatus({
        headers: { authorization: jwt },
        body: {
          status: "REJECTED",
          statusJustification,
          conventionId: convention.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: { id: convention.id },
      });

      await eventCrawler.processNewEvents();

      expectToEqual(gateways.franceTravailGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...convention,
            status: "REJECTED",
            statusJustification,
            agencyName: peAgency.name,
            agencyDepartment: peAgency.address.departmentCode,
            agencyContactEmail: peAgency.contactEmail,
            agencyKind: peAgency.kind,
            agencySiret: peAgency.agencySiret,
            agencyValidatorEmails: peAgency.validatorEmails,
            agencyValidationSteps: "validator-only",
            agencyRefersTo: undefined,
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
    });

    it("when a convention is ACCEPTED_BY_VALIDATOR, an Establishment Lead is created", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "validator",
          email: "validator@pe.fr",
          now: gateways.timeGateway.now(),
        }),
      );

      gateways.shortLinkGenerator.addMoreShortLinkIds([
        "short-link-1",
        "short-link-2",
        "short-link-3",
      ]);

      await magicLinkRequest.updateConventionStatus({
        headers: { authorization: jwt },
        body: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: convention.id,
          firstname: "John",
          lastname: "Doe",
        },
      });

      await eventCrawler.processNewEvents();

      expectArraysToEqual(
        inMemoryUow.establishmentLeadRepository.establishmentLeads,
        [
          {
            siret: convention.siret,
            lastEventKind: "to-be-reminded",
            events: [
              {
                conventionId: convention.id,
                kind: "to-be-reminded",
                occurredAt: gateways.timeGateway.now(),
              },
            ],
          },
        ],
      );
    });

    it("400 - no JWT", async () => {
      const response = await magicLinkRequest.updateConventionStatus({
        body: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: convention.id,
          firstname: "John",
          lastname: "Doe",
        },
        headers: undefined as unknown as WithAuthorizationHeader,
      });

      expectHttpResponseToEqual(response, {
        body: {
          issues: [
            "authorization : Invalid input: expected string, received undefined",
          ],
          message:
            "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: POST /auth/update-application-status",
          status: 400,
        },
        status: 400,
      });
    });

    it("403 - unauthorized role for expected status update", async () => {
      const response = await magicLinkRequest.updateConventionStatus({
        body: {
          status: "ACCEPTED_BY_VALIDATOR",
          conventionId: convention.id,
          firstname: "John",
          lastname: "Doe",
        },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "establishment-representative",
              email: convention.signatories.establishmentRepresentative.email,
              now: gateways.timeGateway.now(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.badRoleStatusChange({
            roles: ["establishment-representative"],
            status: "ACCEPTED_BY_VALIDATOR",
            conventionId: convention.id,
          }).message,
        },
      });
    });

    it("403 - connected beneficiary cannot update convention status", async () => {
      const beneficiary = new ConnectedUserBuilder()
        .withId("beneficiary")
        .withEmail(convention.signatories.beneficiary.email)
        .buildUser();
      inMemoryUow.userRepository.users = [beneficiary];

      const response = await magicLinkRequest.updateConventionStatus({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: currentJwtVersions.connectedUser,
            iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
          }),
        },
        body: {
          status: "REJECTED",
          statusJustification: "test-justification",
          conventionId: convention.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.badRoleStatusChange({
            roles: ["beneficiary"],
            status: "REJECTED",
            conventionId: convention.id,
          }).message,
        },
      });
    });

    it("404 - unknown convention id", async () => {
      const response = await magicLinkRequest.updateConventionStatus({
        body: {
          status: "ACCEPTED_BY_COUNSELLOR",
          conventionId: unknownId,
          firstname: "John",
          lastname: "Doe",
        },
        headers: {
          authorization: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: unknownId,
              role: "counsellor",
              email: "counsellor@pe.fr",
              now: gateways.timeGateway.now(),
            }),
          ),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: unknownId,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.sendAssessmentLink,
  )} sends assessment link`, () => {
    beforeEach(() => {
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(peAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
      inMemoryUow.userRepository.users = [validator, backofficeAdminUser];
    });

    it("200 - Successfully sends assessment link", async () => {
      const conventionWithValidStatus = new ConventionDtoBuilder(convention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      inMemoryUow.conventionRepository.setConventions([
        conventionWithValidStatus,
      ]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithValidStatus.id,
          role: "beneficiary",
          email: conventionWithValidStatus.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      gateways.shortLinkGenerator.addMoreShortLinkIds(["shortLink1"]);

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithValidStatus.id,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      await processEventsForEmailToBeSent(eventCrawler);

      const sentSms = gateways.notification.getSentSms();
      expectToEqual(sentSms.length, 1);
    });

    it("200 - connected beneficiary can send assessment link", async () => {
      const conventionWithValidStatus = new ConventionDtoBuilder(convention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      const beneficiary = new ConnectedUserBuilder()
        .withId("beneficiary")
        .withEmail(conventionWithValidStatus.signatories.beneficiary.email)
        .buildUser();

      inMemoryUow.conventionRepository.setConventions([
        conventionWithValidStatus,
      ]);
      inMemoryUow.userRepository.users = [beneficiary];
      gateways.shortLinkGenerator.addMoreShortLinkIds(["shortLink1"]);

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: 1,
          }),
        },
        body: {
          conventionId: conventionWithValidStatus.id,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      await processEventsForEmailToBeSent(eventCrawler);

      expectToEqual(gateways.notification.getSentSms().length, 1);
    });

    it("403 - connected user whose email is not linked to the convention cannot send assessment link", async () => {
      const conventionWithValidStatus = new ConventionDtoBuilder(convention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      const unrelatedUser = new ConnectedUserBuilder()
        .withId("unrelated-user")
        .withEmail("unrelated@mail.com")
        .buildUser();

      inMemoryUow.conventionRepository.setConventions([
        conventionWithValidStatus,
      ]);
      inMemoryUow.userRepository.users = [unrelatedUser];

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: unrelatedUser.id,
            version: 1,
          }),
        },
        body: {
          conventionId: conventionWithValidStatus.id,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.sendAssessmentLinkForbidden().message,
        },
      });
    });

    it("400 - Cannot send assessment link when convention is READY_TO_SIGN", async () => {
      const conventionReadyToSign = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .build();
      inMemoryUow.conventionRepository.setConventions([conventionReadyToSign]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionReadyToSign.id,
          role: "beneficiary",
          email: conventionReadyToSign.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionReadyToSign.id,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message: errors.assessment.sendAssessmentLinkNotAllowedForStatus({
            status: "READY_TO_SIGN",
          }).message,
        },
      });
    });

    it("403 - Forbidden when unauthorized user tries to send assessment link", async () => {
      const conventionWithValidStatus = new ConventionDtoBuilder(convention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      inMemoryUow.conventionRepository.setConventions([
        conventionWithValidStatus,
      ]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithValidStatus.id,
          role: "agency-viewer" as ConventionRole,
          email: conventionWithValidStatus.establishmentTutor.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithValidStatus.id,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.sendAssessmentLinkForbidden().message,
        },
      });
    });

    it("401 - Invalid JWT", async () => {
      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: "invalid-token" },
        body: { conventionId: convention.id, notificationKind: "sms" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "Provided token is invalid",
        },
      });
    });

    it("404 - Convention not found", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: unknownId,
          role: "beneficiary",
          email: "some@email.com",
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: jwt },
        body: { conventionId: unknownId, notificationKind: "sms" },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({ conventionId: unknownId })
            .message,
        },
      });
    });

    it("403 - convention id does not match the one in token", async () => {
      const conventionWithValidStatus = new ConventionDtoBuilder(convention)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      const anotherConventionId =
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as ConventionId;
      const anotherConvention = new ConventionDtoBuilder()
        .withId(anotherConventionId)
        .withAgencyId(peAgency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();

      inMemoryUow.conventionRepository.setConventions([
        conventionWithValidStatus,
        anotherConvention,
      ]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithValidStatus.id,
          role: "beneficiary",
          email: conventionWithValidStatus.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentLink({
        headers: { authorization: jwt },
        body: {
          conventionId: anotherConventionId,
          notificationKind: "sms",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.convention.forbiddenConventionIdMismatch({
            jwtConventionId: conventionWithValidStatus.id,
            jwtRole: "beneficiary",
            requestedConventionId: anotherConventionId,
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.sendAssessmentSignatureReminder,
  )} sends assessment signature reminder`, () => {
    const conventionWithAssessment = new ConventionDtoBuilder(convention)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .build();

    const assessmentDto = new AssessmentDtoBuilder()
      .withConventionId(conventionWithAssessment.id)
      .withCreatedAt("2026-04-01T00:00:00.000Z")
      .build();

    beforeEach(() => {
      inMemoryUow.conventionRepository.setConventions([
        conventionWithAssessment,
      ]);
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(peAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
      inMemoryUow.userRepository.users = [validator, backofficeAdminUser];
      inMemoryUow.assessmentRepository.assessments = [
        createAssessmentEntity(assessmentDto, conventionWithAssessment),
      ];
    });

    it("200 - Successfully sends assessment signature reminder by email", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithAssessment.id,
          role: "establishment-representative",
          email:
            conventionWithAssessment.signatories.establishmentRepresentative
              .email,
          now: gateways.timeGateway.now(),
        }),
      );

      gateways.shortLinkGenerator.addMoreShortLinkIds([
        "shortLinkAssessmentSign",
      ]);

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithAssessment.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      await processEventsForEmailToBeSent(eventCrawler);

      const sentEmails = gateways.notification.getSentEmails();
      expectToEqual(sentEmails.length, 1);
      expectEmailOfType(
        sentEmails[0],
        "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
      );
    });

    it("400 - Cannot send reminder when convention is not validated", async () => {
      const conventionReadyToSign = new ConventionDtoBuilder(
        conventionWithAssessment,
      )
        .withStatus("READY_TO_SIGN")
        .build();
      inMemoryUow.conventionRepository.setConventions([conventionReadyToSign]);

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionReadyToSign.id,
          role: "establishment-representative",
          email:
            conventionReadyToSign.signatories.establishmentRepresentative.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionReadyToSign.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message:
            errors.assessment.sendAssessmentSignatureReminderNotAllowedForStatus(
              { status: "READY_TO_SIGN" },
            ).message,
        },
      });
    });

    it("403 - Forbidden for beneficiary role", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithAssessment.id,
          role: "beneficiary",
          email: conventionWithAssessment.signatories.beneficiary.email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithAssessment.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message:
            errors.assessment.sendAssessmentSignatureReminderForbidden()
              .message,
        },
      });
    });

    it("401 - Invalid JWT", async () => {
      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: "invalid-token" },
        body: {
          conventionId: conventionWithAssessment.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "Provided token is invalid",
        },
      });
    });

    it("404 - Convention not found", async () => {
      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: unknownId,
          role: "establishment-representative",
          email:
            conventionWithAssessment.signatories.establishmentRepresentative
              .email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: unknownId,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({ conventionId: unknownId })
            .message,
        },
      });
    });

    it("404 - Assessment not found", async () => {
      inMemoryUow.assessmentRepository.assessments = [];

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithAssessment.id,
          role: "establishment-representative",
          email:
            conventionWithAssessment.signatories.establishmentRepresentative
              .email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithAssessment.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.assessment.notFound(conventionWithAssessment.id)
            .message,
        },
      });
    });

    it("429 - Too many requests when reminder was sent less than 24h ago", async () => {
      inMemoryUow.notificationRepository.notifications = [
        {
          id: "past-assessment-signature-reminder-email",
          createdAt: subHours(gateways.timeGateway.now(), 2).toISOString(),
          kind: "email",
          followedIds: {
            conventionId: conventionWithAssessment.id,
            agencyId: conventionWithAssessment.agencyId,
            establishmentSiret: conventionWithAssessment.siret,
          },
          templatedContent: {
            kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
            recipients: [
              conventionWithAssessment.signatories.beneficiary.email,
            ],
            params: {
              conventionId: conventionWithAssessment.id,
              beneficiaryFirstName: "Jean",
              beneficiaryLastName: "Dupont",
              businessName: conventionWithAssessment.businessName,
              internshipKind: conventionWithAssessment.internshipKind,
              assessmentSignatureLink: "https://example.com",
            },
          },
        },
      ];

      const jwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: conventionWithAssessment.id,
          role: "establishment-representative",
          email:
            conventionWithAssessment.signatories.establishmentRepresentative
              .email,
          now: gateways.timeGateway.now(),
        }),
      );

      const response = await magicLinkRequest.sendAssessmentSignatureReminder({
        headers: { authorization: jwt },
        body: {
          conventionId: conventionWithAssessment.id,
          notificationKind: "email",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 429,
        body: {
          status: 429,
          message: errors.assessment.assessmentLinkAlreadySent({
            notificationKind: "email",
            minHoursBetweenReminder:
              CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
            timeRemaining: "22h00",
          }).message,
        },
      });
    });
  });
});
