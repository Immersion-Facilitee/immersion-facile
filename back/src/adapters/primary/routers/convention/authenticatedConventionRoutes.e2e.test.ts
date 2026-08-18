import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyUserConventionListDto,
  type ArchivedConventionRequestDto,
  ASSESSEMENT_SIGNATURE_RELEASE_DATE,
  type AuthenticatedConventionRoutes,
  authExpiredMessage,
  authenticatedConventionRoutes,
  ConnectedUserBuilder,
  type ConnectedUserJwt,
  type ConnectedUserJwtPayload,
  ConventionDtoBuilder,
  type ConventionTemplate,
  currentJwtVersions,
  defaultProConnectInfos,
  displayRouteName,
  errors,
  expectArraysToMatch,
  expectHttpResponseToEqual,
  expectToEqual,
  type User,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { ArchivedConventionRequestEntity } from "../../../../domains/convention/entities/ArchivedConventionRequestEntity";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import type { GenerateConnectedUserJwt } from "../../../../domains/core/jwt";
import { broadcastToFtServiceName } from "../../../../domains/core/saved-errors/ports/BroadcastFeedbacksRepository";
import type {
  InMemoryOutOfTransactionQueries,
  InMemoryUnitOfWork,
} from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";

describe("authenticatedConventionRoutes", () => {
  const agency = new AgencyDtoBuilder().withKind("france-travail").build();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .buildUser();

  let httpClient: HttpClient<AuthenticatedConventionRoutes>;

  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let eventCrawler: BasicEventCrawler;
  let gateways: InMemoryGateways;
  let queries: InMemoryOutOfTransactionQueries;
  let validToken: ConnectedUserJwt;

  beforeEach(async () => {
    let request: SuperTest<Test>;
    ({
      request,
      generateConnectedUserJwt,
      inMemoryUow,
      eventCrawler,
      gateways,
      queries,
    } = await buildTestApp());

    httpClient = createSupertestSharedClient(
      authenticatedConventionRoutes,
      request,
    );

    inMemoryUow.userRepository.users = [validator];

    validToken = generateConnectedUserJwt({
      userId: validator.id,
      version: currentJwtVersions.connectedUser,
    });
  });

  describe("Mark partners errored convention as handled", () => {
    it(`${displayRouteName(
      authenticatedConventionRoutes.markPartnersErroredConventionAsHandled,
    )} 400 without headers`, async () => {
      const response = await httpClient.markPartnersErroredConventionAsHandled({
        headers: {} as any,
        body: { conventionId: "11111111-1111-4111-9111-111111111111" },
      });
      expectHttpResponseToEqual(response, {
        body: {
          issues: [
            "authorization : Invalid input: expected string, received undefined",
          ],
          message:
            "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: POST /inclusion-connected/mark-errored-convention-as-handled",
          status: 400,
        },
        status: 400,
      });
    });

    it(`${displayRouteName(
      authenticatedConventionRoutes.markPartnersErroredConventionAsHandled,
    )} 401 with bad token`, async () => {
      const response = await httpClient.markPartnersErroredConventionAsHandled({
        headers: { authorization: "wrong-token" },
        body: { conventionId: "11111111-1111-4111-9111-111111111111" },
      });
      expectHttpResponseToEqual(response, {
        body: { message: invalidTokenMessage, status: 401 },
        status: 401,
      });
    });

    it(`${displayRouteName(
      authenticatedConventionRoutes.markPartnersErroredConventionAsHandled,
    )} 401 with expired token`, async () => {
      const userId = "123";
      const token = generateConnectedUserJwt(
        { userId, version: currentJwtVersions.connectedUser },
        0,
      );
      const response = await httpClient.markPartnersErroredConventionAsHandled({
        headers: { authorization: token },
        body: { conventionId: "11111111-1111-4111-9111-111111111111" },
      });
      expectHttpResponseToEqual(response, {
        body: { message: authExpiredMessage(), status: 401 },
        status: 401,
      });
    });

    it(`${displayRouteName(
      authenticatedConventionRoutes.markPartnersErroredConventionAsHandled,
    )} 403 when user has no rights on agency`, async () => {
      const userAgency = new AgencyDtoBuilder().withId("agency-id-1").build();
      const conventionAgency = new AgencyDtoBuilder()
        .withId("agency-id-2")
        .build();
      const conventionId = "11111111-1111-4111-9111-111111111111";
      const user: User = {
        id: "123456ab",
        email: "joe@mail.com",
        firstName: "Joe",
        lastName: "Doe",
        proConnect: defaultProConnectInfos,
        createdAt: new Date().toISOString(),
      };
      const token = generateConnectedUserJwt({
        userId: user.id,
        version: currentJwtVersions.connectedUser,
      });
      const convention = new ConventionDtoBuilder()
        .withId(conventionId)
        .withAgencyId(conventionAgency.id)
        .build();
      inMemoryUow.userRepository.users = [user];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(userAgency, {
          [user.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
        toAgencyWithRights(conventionAgency),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);

      const response = await httpClient.markPartnersErroredConventionAsHandled({
        headers: { authorization: token },
        body: { conventionId },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 403,
          message: errors.user.noRightsOnAgency({
            userId: "123456ab",
            agencyId: "agency-id-2",
          }).message,
        },
        status: 403,
      });
    });

    it("mark partners errored convention as handled", async () => {
      const conventionId = "11111111-1111-4111-9111-111111111111";
      const agency = new AgencyDtoBuilder().build();
      const convention = new ConventionDtoBuilder()
        .withId(conventionId)
        .withAgencyId(agency.id)
        .build();
      inMemoryUow.userRepository.users = [validator];
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      await inMemoryUow.broadcastFeedbacksRepository.save({
        serviceName: broadcastToFtServiceName,
        consumerName: "France Travail",
        consumerId: null,
        conventionId,
        agencyId: agency.id,
        subscriberErrorFeedback: { message: "Some message" },
        requestParams: { conventionId },
        response: { httpStatus: 500 },
        occurredAt: "2023-10-26T12:00:00.000Z",
        handledByAgency: false,
      });

      const response = await httpClient.markPartnersErroredConventionAsHandled({
        headers: { authorization: validToken },
        body: { conventionId: convention.id },
      });
      expectHttpResponseToEqual(response, { body: "", status: 200 });
      expectToEqual(
        inMemoryUow.broadcastFeedbacksRepository.broadcastFeedbacks,
        [
          {
            serviceName: broadcastToFtServiceName,
            consumerName: "France Travail",
            consumerId: null,
            conventionId,
            agencyId: agency.id,
            subscriberErrorFeedback: {
              message: "Some message",
            },
            requestParams: { conventionId },
            response: { httpStatus: 500 },
            occurredAt: "2023-10-26T12:00:00.000Z",
            handledByAgency: true,
          },
        ],
      );
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.broadcastConventionAgain,
  )}`, () => {
    it("throws an error if user is not authenticated", async () => {
      const response = await httpClient.broadcastConventionAgain({
        headers: { authorization: "wrong-token" },
        body: { conventionId: "11111111-1111-4111-9111-111111111111" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { message: invalidTokenMessage, status: 401 },
      });
    });

    it("save the event to Broadcast Convention again, than it event triggers calling partners", async () => {
      const convention = new ConventionDtoBuilder().build();
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.agencyRepository.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

      const response = await httpClient.broadcastConventionAgain({
        headers: { authorization: validToken },
        body: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });

      expectArraysToMatch(inMemoryUow.outboxRepository.events, [
        { topic: "ConventionBroadcastRequested", status: "never-published" },
      ]);

      await eventCrawler.processNewEvents();

      expectArraysToMatch(inMemoryUow.outboxRepository.events, [
        { topic: "ConventionBroadcastRequested", status: "published" },
      ]);

      // TODO : when we store all partner responses, check that they have been called
    });
  });

  describe("GetConventionsForAgencyUser", () => {
    const assessmentCreatedAt = addDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      2,
    ).toISOString();
    const ftAgency = new AgencyDtoBuilder().withKind("france-travail").build();

    const conventionWithAssessment = new ConventionDtoBuilder()
      .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
      .withAgencyId(ftAgency.id)
      .withDateStart(new Date("2023-03-15").toISOString())
      .withDateEnd(new Date("2023-03-20").toISOString())
      .withDateSubmission(new Date("2023-03-10").toISOString())
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .build();

    const conventionWithoutAssessment = new ConventionDtoBuilder()
      .withId("bbbbbc99-9c0b-1bbb-bb6d-6bb9bd38bbbb")
      .withAgencyId(ftAgency.id)
      .withDateStart(new Date("2023-02-15").toISOString())
      .withDateEnd(new Date("2023-02-20").toISOString())
      .withDateSubmission(new Date("2023-02-10").toISOString())
      .withStatus("PARTIALLY_SIGNED")
      .build();

    beforeEach(async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(ftAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
      inMemoryUow.conventionRepository.setConventions([
        conventionWithAssessment,
        conventionWithoutAssessment,
      ]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          conventionId: conventionWithAssessment.id,
          status: "COMPLETED",
          endedWithAJob: false,
          establishmentFeedback: "Ca c'est bien passé",
          establishmentAdvices: "mon conseil",
          numberOfHoursActuallyMade: 35,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "Mon commentaire",
          signedAt: assessmentCreatedAt,
          createdAt: assessmentCreatedAt,
          _entityName: "Assessment",
        },
      ];
    });

    it("401 - Unauthorized when not correctly authenticated", async () => {
      const response = await httpClient.getConventionsForAgencyUser({
        headers: { authorization: "invalid-token" },
        queryParams: {},
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "Provided token is invalid",
        },
      });
    });

    it("200 - Successfully gets conventions with date filter", async () => {
      gateways.timeGateway.setNextDate(new Date());
      const jwt = generateConnectedUserJwt({
        userId: validator.id,
        version: currentJwtVersions.connectedUser,
        iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
      });

      const response = await httpClient.getConventionsForAgencyUser({
        headers: { authorization: jwt },
        queryParams: {
          dateStartFrom: "2023-01-01",
          statuses: ["ACCEPTED_BY_VALIDATOR", "PARTIALLY_SIGNED"],
          sortBy: "dateStart",
          page: 1,
          perPage: 10,
        },
      });

      const conventionList1: AgencyUserConventionListDto = {
        id: conventionWithAssessment.id,
        status: conventionWithAssessment.status,
        dateStart: conventionWithAssessment.dateStart,
        dateEnd: conventionWithAssessment.dateEnd,
        businessName: conventionWithAssessment.businessName,
        agencyName: ftAgency.name,
        agencyReferent: conventionWithAssessment.agencyReferent,
        assessment: {
          status: "COMPLETED",
          endedWithAJob: false,
          signedAt: assessmentCreatedAt,
          createdAt: assessmentCreatedAt,
        },
        beneficiary: {
          firstName: conventionWithAssessment.signatories.beneficiary.firstName,
          lastName: conventionWithAssessment.signatories.beneficiary.lastName,
          federatedIdentity:
            conventionWithAssessment.signatories.beneficiary.federatedIdentity,
        },
      };

      const conventionList2: AgencyUserConventionListDto = {
        id: conventionWithoutAssessment.id,
        status: conventionWithoutAssessment.status,
        dateStart: conventionWithoutAssessment.dateStart,
        dateEnd: conventionWithoutAssessment.dateEnd,
        businessName: conventionWithoutAssessment.businessName,
        agencyName: ftAgency.name,
        agencyReferent: conventionWithoutAssessment.agencyReferent,
        assessment: null,
        beneficiary: {
          firstName:
            conventionWithoutAssessment.signatories.beneficiary.firstName,
          lastName:
            conventionWithoutAssessment.signatories.beneficiary.lastName,
          federatedIdentity:
            conventionWithoutAssessment.signatories.beneficiary
              .federatedIdentity,
        },
      };

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [conventionList1, conventionList2],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2,
          },
        },
      });
    });

    it("200 - Successfully gets conventions with assessment completion status filter - signed", async () => {
      gateways.timeGateway.setNextDate(new Date());
      const jwt = generateConnectedUserJwt({
        userId: validator.id,
        version: currentJwtVersions.connectedUser,
        iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
      });

      const response = await httpClient.getConventionsForAgencyUser({
        headers: { authorization: jwt },
        queryParams: {
          assessmentCompletionStatus: ["finalized"],
          sortBy: "dateStart",
          page: 1,
          perPage: 10,
        },
      });

      const conventionList1: AgencyUserConventionListDto = {
        id: conventionWithAssessment.id,
        status: conventionWithAssessment.status,
        dateStart: conventionWithAssessment.dateStart,
        dateEnd: conventionWithAssessment.dateEnd,
        businessName: conventionWithAssessment.businessName,
        agencyName: ftAgency.name,
        agencyReferent: conventionWithAssessment.agencyReferent,
        assessment: {
          status: "COMPLETED",
          endedWithAJob: false,
          signedAt: assessmentCreatedAt,
          createdAt: assessmentCreatedAt,
        },
        beneficiary: {
          firstName: conventionWithAssessment.signatories.beneficiary.firstName,
          lastName: conventionWithAssessment.signatories.beneficiary.lastName,
          federatedIdentity:
            conventionWithAssessment.signatories.beneficiary.federatedIdentity,
        },
      };

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [conventionList1],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        },
      });
    });

    it("200 - Successfully gets conventions with assessment completion status filter - to-be-completed", async () => {
      gateways.timeGateway.setNextDate(new Date());
      const jwt = generateConnectedUserJwt({
        userId: validator.id,
        version: currentJwtVersions.connectedUser,
        iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
      });

      const response = await httpClient.getConventionsForAgencyUser({
        headers: { authorization: jwt },
        queryParams: {
          assessmentCompletionStatus: ["to-complete"],
          sortBy: "dateStart",
          page: 1,
          perPage: 10,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        },
      });
    });

    it("200 - Successfully gets conventions with agencyIds filter", async () => {
      gateways.timeGateway.setNextDate(new Date());
      const jwt = generateConnectedUserJwt({
        userId: validator.id,
        version: currentJwtVersions.connectedUser,
        iat: Math.round(gateways.timeGateway.now().getTime() / 1000),
      });

      const response = await httpClient.getConventionsForAgencyUser({
        headers: { authorization: jwt },
        queryParams: {
          agencyIds: [ftAgency.id],
          sortBy: "dateStart",
          page: 1,
          perPage: 10,
        },
      });

      const conventionList1: AgencyUserConventionListDto = {
        id: conventionWithAssessment.id,
        status: conventionWithAssessment.status,
        dateStart: conventionWithAssessment.dateStart,
        dateEnd: conventionWithAssessment.dateEnd,
        businessName: conventionWithAssessment.businessName,
        agencyName: ftAgency.name,
        agencyReferent: conventionWithAssessment.agencyReferent,
        assessment: {
          status: "COMPLETED",
          endedWithAJob: false,
          signedAt: assessmentCreatedAt,
          createdAt: assessmentCreatedAt,
        },
        beneficiary: {
          firstName: conventionWithAssessment.signatories.beneficiary.firstName,
          lastName: conventionWithAssessment.signatories.beneficiary.lastName,
          federatedIdentity:
            conventionWithAssessment.signatories.beneficiary.federatedIdentity,
        },
      };

      const conventionList2: AgencyUserConventionListDto = {
        id: conventionWithoutAssessment.id,
        status: conventionWithoutAssessment.status,
        dateStart: conventionWithoutAssessment.dateStart,
        dateEnd: conventionWithoutAssessment.dateEnd,
        businessName: conventionWithoutAssessment.businessName,
        agencyName: ftAgency.name,
        agencyReferent: conventionWithoutAssessment.agencyReferent,
        assessment: null,
        beneficiary: {
          firstName:
            conventionWithoutAssessment.signatories.beneficiary.firstName,
          lastName:
            conventionWithoutAssessment.signatories.beneficiary.lastName,
          federatedIdentity:
            conventionWithoutAssessment.signatories.beneficiary
              .federatedIdentity,
        },
      };

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [conventionList1, conventionList2],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2,
          },
        },
      });
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.getConventionsWithUnfinalizedAssessment,
  )}`, () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    const ftAgency = new AgencyDtoBuilder()
      .withId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
      .withKind("france-travail")
      .build();

    const convention1 = new ConventionDtoBuilder()
      .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withAgencyId(ftAgency.id)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(new Date("2026-04-01").toISOString())
      .withDateEnd(new Date("2026-06-10").toISOString())
      .withBeneficiaryFirstName("Alice")
      .withBeneficiaryLastName("Dupont")
      .build();

    const convention2 = new ConventionDtoBuilder()
      .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .withAgencyId(ftAgency.id)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(new Date("2026-02-01").toISOString())
      .withDateEnd(new Date("2026-02-10").toISOString())
      .withBeneficiaryFirstName("Bob")
      .withBeneficiaryLastName("Martin")
      .build();

    const toSignAssessmentCreatedAt = addDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      30,
    ).toISOString();

    beforeEach(() => {
      gateways.timeGateway.defaultDate = now;
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(ftAgency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      ];
      inMemoryUow.conventionRepository.setConventions([
        convention1,
        convention2,
      ]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          conventionId: convention2.id,
          status: "COMPLETED",
          endedWithAJob: false,
          establishmentFeedback: "Tout va bien",
          establishmentAdvices: "rien à dire",
          numberOfHoursActuallyMade: 35,
          beneficiaryAgreement: null,
          beneficiaryFeedback: null,
          signedAt: null,
          createdAt: toSignAssessmentCreatedAt,
        },
      ];
    });

    it("401 - Unauthorized when not correctly authenticated", async () => {
      const response = await httpClient.getConventionsWithUnfinalizedAssessment(
        {
          headers: { authorization: "invalid-token" },
          queryParams: { page: 1, perPage: 10 },
        },
      );

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "Provided token is invalid",
        },
      });
    });

    it("200 - returns paginated conventions to-complete and to-sign", async () => {
      const response = await httpClient.getConventionsWithUnfinalizedAssessment(
        {
          headers: {
            authorization: generateConnectedUserJwt({
              userId: validator.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
          queryParams: { page: 1, perPage: 10 },
        },
      );

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [
            {
              id: convention2.id,
              dateEnd: convention2.dateEnd,
              beneficiary: {
                firstname: convention2.signatories.beneficiary.firstName,
                lastname: convention2.signatories.beneficiary.lastName,
              },
              assessment: {
                status: "COMPLETED",
                endedWithAJob: false,
                signedAt: null,
                createdAt: toSignAssessmentCreatedAt,
              },
            },
            {
              id: convention1.id,
              dateEnd: convention1.dateEnd,
              beneficiary: {
                firstname: convention1.signatories.beneficiary.firstName,
                lastname: convention1.signatories.beneficiary.lastName,
              },
              assessment: null,
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2,
          },
        },
      });
    });

    it("200 - filters by assessmentCompletionStatus to-complete", async () => {
      const response = await httpClient.getConventionsWithUnfinalizedAssessment(
        {
          headers: {
            authorization: generateConnectedUserJwt({
              userId: validator.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
          queryParams: {
            page: 1,
            perPage: 10,
            assessmentCompletionStatus: "to-complete",
          },
        },
      );

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [
            {
              id: convention1.id,
              dateEnd: convention1.dateEnd,
              beneficiary: {
                firstname: convention1.signatories.beneficiary.firstName,
                lastname: convention1.signatories.beneficiary.lastName,
              },
              assessment: null,
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        },
      });
    });

    it("200 - filters by assessmentCompletionStatus to-sign", async () => {
      const response = await httpClient.getConventionsWithUnfinalizedAssessment(
        {
          headers: {
            authorization: generateConnectedUserJwt({
              userId: validator.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
          queryParams: {
            page: 1,
            perPage: 10,
            assessmentCompletionStatus: "to-sign",
          },
        },
      );

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [
            {
              id: convention2.id,
              dateEnd: convention2.dateEnd,
              beneficiary: {
                firstname: convention2.signatories.beneficiary.firstName,
                lastname: convention2.signatories.beneficiary.lastName,
              },
              assessment: {
                status: "COMPLETED",
                endedWithAJob: false,
                signedAt: null,
                createdAt: toSignAssessmentCreatedAt,
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        },
      });
    });

    it("400 - rejects invalid assessmentCompletionStatus", async () => {
      const response = await httpClient.getConventionsWithUnfinalizedAssessment(
        {
          headers: {
            authorization: generateConnectedUserJwt({
              userId: validator.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
          queryParams: {
            page: 1,
            perPage: 10,
            assessmentCompletionStatus: "finalized",
          } as any,
        },
      );

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: [
            'assessmentCompletionStatus : Invalid option: expected one of "to-complete"|"to-sign"',
          ],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /conventions-with-unfinalized-assessment",
          status: 400,
        },
      });
    });
  });

  describe("getConventionsWithErroredBroadcastFeedbackForAgencyUser", () => {
    it("200 - Successfully gets empty array oferrored conventions for agency user", async () => {
      const response =
        await httpClient.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
          {
            headers: { authorization: validToken },
            queryParams: {
              page: 1,
              perPage: 10,
            },
          },
        );
      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            numberPerPage: 10,
            totalRecords: 0,
          },
        },
      });
    });

    it("400 - Bad request when missing query params", async () => {
      const response =
        await httpClient.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
          {
            headers: { authorization: validToken },
            queryParams: {} as any,
          },
        );

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: [
            "page : Invalid input: expected number, received NaN",
            "perPage : Invalid input: expected number, received NaN",
          ],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /inclusion-connected/conventions-with-errored-broadcast-feedback",
          status: 400,
        },
      });
    });

    it("401 - Unauthorized with bad token", async () => {
      const response =
        await httpClient.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
          {
            headers: { authorization: "wrong-token" },
            queryParams: {
              page: 1,
              perPage: 10,
            },
          },
        );
      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "Provided token is invalid",
        },
      });
    });

    it("401 - Unauthorized with expired token", async () => {
      const userId = "123";
      const token = generateConnectedUserJwt(
        { userId, version: currentJwtVersions.connectedUser },
        0,
      );
      const response =
        await httpClient.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
          {
            headers: { authorization: token },
            queryParams: {
              page: 1,
              perPage: 10,
            },
          },
        );
      expectHttpResponseToEqual(response, {
        body: { message: authExpiredMessage(), status: 401 },
        status: 401,
      });
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.getConventionTemplatesForCurrentUser,
  )}`, () => {
    it("401 with bad token", async () => {
      const response = await httpClient.getConventionTemplatesForCurrentUser({
        headers: { authorization: "wrong-token" },
      });

      expectHttpResponseToEqual(response, {
        body: { message: invalidTokenMessage, status: 401 },
        status: 401,
      });
    });

    it("401 with expired token", async () => {
      const token = generateConnectedUserJwt(
        { userId: validator.id, version: currentJwtVersions.connectedUser },
        0,
      );

      const response = await httpClient.getConventionTemplatesForCurrentUser({
        headers: { authorization: token },
      });

      expectHttpResponseToEqual(response, {
        body: { message: authExpiredMessage(), status: 401 },
        status: 401,
      });
    });

    it("200 returns convention templates for authenticated user", async () => {
      const template1: ConventionTemplate = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Mon modèle 1",
        internshipKind: "immersion" as const,
        userId: validator.id,
      };
      const template2: ConventionTemplate = {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Mon modèle 2",
        internshipKind: "immersion" as const,
        userId: validator.id,
      };
      inMemoryUow.conventionTemplateQueries.conventionTemplates = [
        template1,
        template2,
      ];

      const response = await httpClient.getConventionTemplatesForCurrentUser({
        headers: { authorization: validToken },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: [template1, template2],
      });
      expect((response.body as ConventionTemplate[]).length).toBe(2);
    });

    it("200 returns empty array when user has no templates", async () => {
      const response = await httpClient.getConventionTemplatesForCurrentUser({
        headers: { authorization: validToken },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: [],
      });
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.createOrUpdateConventionTemplate,
  )}`, () => {
    const validConventionTemplate: ConventionTemplate = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Mon modèle",
      internshipKind: "immersion" as const,
      userId: validator.id,
    };

    it("401 with bad token", async () => {
      const response = await httpClient.createOrUpdateConventionTemplate({
        headers: { authorization: "wrong-token" },
        body: validConventionTemplate,
      });

      expectHttpResponseToEqual(response, {
        body: { message: invalidTokenMessage, status: 401 },
        status: 401,
      });
    });

    it("401 with expired token", async () => {
      const token = generateConnectedUserJwt(
        { userId: validator.id, version: currentJwtVersions.connectedUser },
        0,
      );

      const response = await httpClient.createOrUpdateConventionTemplate({
        headers: { authorization: token },
        body: validConventionTemplate,
      });

      expectHttpResponseToEqual(response, {
        body: { message: authExpiredMessage(), status: 401 },
        status: 401,
      });
    });

    it("400 when request body is invalid", async () => {
      const response = await httpClient.createOrUpdateConventionTemplate({
        headers: { authorization: validToken },
        body: {
          id: validConventionTemplate.id,
          name: "",
          internshipKind: "immersion",
          userId: validator.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          message:
            "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /convention-templates",
          status: 400,
          issues: ["name : Ce champ est obligatoire"],
        },
      });
    });

    it("200 creates or updates convention template when authenticated", async () => {
      const response = await httpClient.createOrUpdateConventionTemplate({
        headers: { authorization: validToken },
        body: validConventionTemplate,
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.deleteConventionTemplate,
  )}`, () => {
    const templateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    it("400 when conventionTemplateId is not a valid UUID", async () => {
      const response = await httpClient.deleteConventionTemplate({
        headers: { authorization: validToken },
        urlParams: { conventionTemplateId: "not-a-valid-uuid" },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          message:
            "Schema validation failed in usecase DeleteConventionTemplate. See issues for details.",
          status: 400,
          issues: [
            "conventionTemplateId : Le format de l'identifiant est invalide",
          ],
        },
      });
    });

    it("401 with bad token", async () => {
      const response = await httpClient.deleteConventionTemplate({
        headers: { authorization: "wrong-token" },
        urlParams: { conventionTemplateId: templateId },
      });

      expectHttpResponseToEqual(response, {
        body: { message: invalidTokenMessage, status: 401 },
        status: 401,
      });
    });

    it("403 when template belongs to another user", async () => {
      const otherUser = new ConnectedUserBuilder()
        .withId("other-user-id")
        .withEmail("other@example.com")
        .buildUser();
      const templateOwnedByOther: ConventionTemplate = {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Template d'un autre utilisateur",
        internshipKind: "immersion" as const,
        userId: otherUser.id,
      };
      inMemoryUow.userRepository.users = [validator, otherUser];
      inMemoryUow.conventionTemplateQueries.conventionTemplates = [
        templateOwnedByOther,
      ];

      const response = await httpClient.deleteConventionTemplate({
        headers: { authorization: validToken },
        urlParams: { conventionTemplateId: templateOwnedByOther.id },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          message: `Vous n'avez pas les droits nécessaires sur le modèle de convention '${templateOwnedByOther.id}'.`,
          status: 403,
        },
      });
      expectToEqual(
        await inMemoryUow.conventionTemplateQueries.get({
          ids: [templateOwnedByOther.id],
        }),
        [templateOwnedByOther],
      );
    });

    it("404 when template does not exist", async () => {
      const response = await httpClient.deleteConventionTemplate({
        headers: { authorization: validToken },
        urlParams: { conventionTemplateId: templateId },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          message: `Aucun modèle de convention trouvé avec l'identifiant '${templateId}'.`,
          status: 404,
        },
      });
    });

    it("200 deletes convention template when it belongs to current user", async () => {
      const template: ConventionTemplate = {
        id: templateId,
        name: "Mon modèle",
        internshipKind: "immersion" as const,
        userId: validator.id,
      };
      inMemoryUow.conventionTemplateQueries.conventionTemplates = [template];

      const response = await httpClient.deleteConventionTemplate({
        headers: { authorization: validToken },
        urlParams: { conventionTemplateId: templateId },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
      expectToEqual(
        await inMemoryUow.conventionTemplateQueries.get({
          ids: [templateId],
        }),
        [],
      );
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.createArchivedConventionRequest,
  )} submits an archived convention access request`, () => {
    const convention = new ConventionDtoBuilder().build();
    it("201 - succeeds with a valid request", async () => {
      const basicUser = new ConnectedUserBuilder()
        .withId("basic-user")
        .buildUser();
      const basicUserJwtPayload: ConnectedUserJwtPayload = {
        version: currentJwtVersions.connectedUser,
        iat: Date.now(),
        exp: addDays(new Date(), 30).getTime(),
        userId: basicUser.id,
      };

      inMemoryUow.userRepository.users = [basicUser];

      const archivedConventionRequestDto: ArchivedConventionRequestDto = {
        id: "11111111-1111-4111-8111-111111111111",
        conventionSearchMethod: "withConventionId",
        conventionId: convention.id,
        reason: "legalDispute",
      };

      const response = await httpClient.createArchivedConventionRequest({
        headers: {
          authorization: generateConnectedUserJwt(basicUserJwtPayload),
        },
        body: archivedConventionRequestDto,
      });

      expectHttpResponseToEqual(response, {
        status: 201,
        body: "",
      });

      expectToEqual(
        inMemoryUow.archivedConventionRequestRepository
          .archivedConventionRequests,
        {
          [archivedConventionRequestDto.id]: {
            ...archivedConventionRequestDto,
            userId: basicUser.id,
            createdAt: gateways.timeGateway.now().toISOString(),
            handledAt: null,
          },
        },
      );
    });

    it("401 - Invalid JWT", async () => {
      const response = await httpClient.createArchivedConventionRequest({
        headers: { authorization: "invalid-token" },
        body: {
          id: "11111111-1111-4111-8111-111111111111",
          conventionSearchMethod: "withConventionId",
          conventionId: convention.id,
          reason: "legalDispute",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: invalidTokenMessage,
        },
      });
    });

    it("401 - Expired JWT", async () => {
      const response = await httpClient.createArchivedConventionRequest({
        headers: {
          authorization: generateConnectedUserJwt(
            {
              userId: "basic-user",
              version: currentJwtVersions.connectedUser,
            },
            0,
          ),
        },
        body: {
          id: "11111111-1111-4111-8111-111111111111",
          conventionSearchMethod: "withConventionId",
          conventionId: convention.id,
          reason: "legalDispute",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: authExpiredMessage(),
        },
      });
    });
  });

  describe(`${displayRouteName(
    authenticatedConventionRoutes.fetchArchivedConventionRequestToReviewList,
  )} submits an archived convention access request`, () => {
    const convention = new ConventionDtoBuilder().build();
    const adminUser = new ConnectedUserBuilder()
      .withId("admin-user")
      .withIsAdmin(true)
      .buildUser();
    const requesterUser = new ConnectedUserBuilder()
      .withId("basic-user")
      .buildUser();

    const archivedConventionRequestEntity: ArchivedConventionRequestEntity = {
      id: "11111111-1111-4111-8111-111111111111",
      conventionSearchMethod: "withConventionId",
      conventionId: convention.id,
      reason: "legalDispute",
      createdAt: new Date().toISOString(),
      handledAt: null,
      userId: requesterUser.id,
    };

    it("200 - succeeds with a valid request", async () => {
      inMemoryUow.userRepository.users = [adminUser, requesterUser];
      queries.archivedConventionRequest.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
        [archivedConventionRequestEntity];

      const response =
        await httpClient.fetchArchivedConventionRequestToReviewList({
          headers: {
            authorization: generateConnectedUserJwt(
              {
                version: currentJwtVersions.connectedUser,
                userId: adminUser.id,
              },
              10,
            ),
          },
        });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: [
          {
            id: archivedConventionRequestEntity.id,
            createdAt: archivedConventionRequestEntity.createdAt,
            reason: archivedConventionRequestEntity.reason,
            requester: {
              email: requesterUser.email,
              firstname: requesterUser.firstName,
              lastname: requesterUser.lastName,
            },
          },
        ],
      });
    });

    it("404 - users not found", async () => {
      inMemoryUow.userRepository.users = [adminUser];
      queries.archivedConventionRequest.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
        [archivedConventionRequestEntity];

      const response =
        await httpClient.fetchArchivedConventionRequestToReviewList({
          headers: {
            authorization: generateConnectedUserJwt({
              version: currentJwtVersions.connectedUser,
              iat: Date.now(),
              exp: addDays(new Date(), 30).getTime(),
              userId: adminUser.id,
            }),
          },
        });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.users.notFound({ userIds: [requesterUser.id] })
            .message,
        },
      });
    });

    it("401 - Invalid JWT", async () => {
      const response =
        await httpClient.fetchArchivedConventionRequestToReviewList({
          headers: { authorization: "invalid-token" },
        });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: invalidTokenMessage,
        },
      });
    });

    it("401 - Expired JWT", async () => {
      const token = generateConnectedUserJwt(
        {
          userId: "basic-user",
          version: currentJwtVersions.connectedUser,
        },
        0,
      );

      const response =
        await httpClient.fetchArchivedConventionRequestToReviewList({
          headers: { authorization: token },
        });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: authExpiredMessage(),
        },
      });
    });
  });
});
