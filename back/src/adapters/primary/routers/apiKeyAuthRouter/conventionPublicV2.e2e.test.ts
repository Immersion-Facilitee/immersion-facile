import {
  AgencyDtoBuilder,
  type AssessmentDto,
  ConventionDtoBuilder,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
  makeEmptyLastReminders,
  type Notification,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import { ApiConsumerBuilder } from "../../../../domains/core/api-consumer/adapters/InMemoryApiConsumerRepository";
import type { GenerateApiConsumerJwt } from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { toAgencyWithRights } from "../../../../utils/agency";
import { buildTestApp } from "../../../../utils/buildTestApp";
import type { ConventionReadPublicV2Dto } from "../DtoAndSchemas/v2/input/ConventionReadPublicV2.dto";
import {
  type PublicApiV2ConventionRoutes,
  publicApiV2ConventionRoutes,
} from "./publicApiV2.routes";

describe("Convention routes", () => {
  const agency = new AgencyDtoBuilder().withKind("france-travail").build();

  const convention = new ConventionDtoBuilder().withAgencyId(agency.id).build();
  const conventionReadConsumerWithAgencyIdsScope = new ApiConsumerBuilder()
    .withConventionRight({
      kinds: ["READ"],
      scope: {
        agencyIds: [agency.id],
      },
      subscriptions: [],
    })
    .build();

  const assessment: AssessmentDto = {
    conventionId: convention.id,
    status: "COMPLETED",
    endedWithAJob: false,
    establishmentFeedback: "Ca c'est bien passé",
    establishmentAdvices: "mon conseil",
    beneficiaryAgreement: true,
    beneficiaryFeedback: "Mon commentaire",
    signedAt: new Date("2025-01-01").toISOString(),
    createdAt: new Date("2025-01-01").toISOString(),
  };

  const signatureReminderSentAt = "2025-01-02T10:00:00.000Z";
  const signatureEmailReminder: Notification = {
    id: "signature-email-reminder",
    createdAt: signatureReminderSentAt,
    kind: "email",
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
    },
    templatedContent: {
      kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
      recipients: [convention.signatories.beneficiary.email],
      params: {
        agencyLogoUrl: undefined,
        beneficiaryName: "Beneficiary",
        businessName: convention.businessName,
        conventionId: convention.id,
        establishmentRepresentativeName: "Establishment Rep",
        establishmentTutorName: "Tutor",
        internshipKind: convention.internshipKind,
        conventionSignShortlink: "https://short.link",
        signatoryName: "Signatory",
      },
    },
  };

  const conventionReadConsumerWithNoScope = new ApiConsumerBuilder()
    .withId("convention-read-with-no-scope-id")
    .withConventionRight({
      kinds: ["READ"],
      scope: {
        agencyIds: [],
      },
      subscriptions: [],
    })
    .build();

  const conventionUnauthorizedConsumer = new ApiConsumerBuilder()
    .withId("unauthorized-consumer-id")
    .withConventionRight({
      kinds: [],
      scope: {
        agencyIds: [],
      },
      subscriptions: [],
    })
    .build();

  let request: SuperTest<Test>;
  let generateApiConsumerJwt: GenerateApiConsumerJwt;
  let sharedRequest: HttpClient<PublicApiV2ConventionRoutes>;
  let conventionReadConsumerWithAgencyIdsScopeToken: string;
  let conventionReadConsumerWithNoScopeToken: string;
  let conventionUnauthorizedConsumerToken: string;
  let inMemoryUow: InMemoryUnitOfWork;

  beforeEach(async () => {
    ({ request, generateApiConsumerJwt, inMemoryUow } = await buildTestApp());
    inMemoryUow.apiConsumerRepository.consumers = [
      conventionReadConsumerWithAgencyIdsScope,
      conventionReadConsumerWithNoScope,
      conventionUnauthorizedConsumer,
    ];
    conventionReadConsumerWithAgencyIdsScopeToken = generateApiConsumerJwt({
      id: conventionReadConsumerWithAgencyIdsScope.id,
      version: 1,
    });
    conventionReadConsumerWithNoScopeToken = generateApiConsumerJwt({
      id: conventionReadConsumerWithNoScope.id,
      version: 1,
    });
    conventionUnauthorizedConsumerToken = generateApiConsumerJwt({
      id: conventionUnauthorizedConsumer.id,
      version: 1,
    });
    sharedRequest = createSupertestSharedClient(
      publicApiV2ConventionRoutes,
      request,
    );
  });

  describe(`${displayRouteName(
    publicApiV2ConventionRoutes.getConventionById,
  )} gets a convention from its id`, () => {
    it("401 - fails without apiKey", async () => {
      const { body, status } = await sharedRequest.getConventionById({
        headers: { authorization: "" },
        urlParams: { conventionId: "some-id" },
      });

      expectToEqual(body, { status: 401, message: "unauthenticated" });
      expectToEqual(status, 401);
    });

    it("403 when the apiConsumer has READ access to convention but no scope", async () => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);

      const { body, status } = await sharedRequest.getConventionById({
        headers: { authorization: conventionReadConsumerWithNoScopeToken },
        urlParams: { conventionId: convention.id },
      });

      expectToEqual(body, {
        status: 403,
        message: errors.convention.forbiddenMissingRightsApiConsumer(
          convention.id,
          conventionReadConsumerWithNoScope.id,
        ).message,
      });
      expectToEqual(status, 403);
    });

    it("403 when the consumer has no READ access to convention", async () => {
      const response = await sharedRequest.getConventionById({
        headers: { authorization: conventionUnauthorizedConsumerToken },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: "Accès refusé",
        },
      });
    });

    it("returns 200 with the convention", async () => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: 35,
        },
      ];

      expect(
        displayRouteName(publicApiV2ConventionRoutes.getConventionById),
      ).toBe("GET /v2/conventions/:conventionId -");
      const response = await sharedRequest.getConventionById({
        headers: {
          authorization: conventionReadConsumerWithAgencyIdsScopeToken,
        },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        body: {
          ...convention,
          agencyName: agency.name,
          agencyDepartment: agency.address.departmentCode,
          agencyContactEmail: agency.contactEmail,
          agencyKind: "pole-emploi",
          agencySiret: agency.agencySiret,
          agencyValidationSteps: "validator-only",
          assessment: {
            status: assessment.status,
            endedWithAJob: assessment.endedWithAJob,
            signedAt: assessment.signedAt,
            createdAt: assessment.createdAt,
          },
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        },
        status: 200,
      });
    });
  });

  describe(`${displayRouteName(
    publicApiV2ConventionRoutes.getConventions,
  )} get convention filtered by params`, () => {
    it("401 - fails without apiKey", async () => {
      const response = await sharedRequest.getConventions({
        headers: { authorization: "" },
        queryParams: {},
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          status: 401,
          message: "unauthenticated",
        },
      });
    });

    it("403 when the apiConsumer does not READ access on convention", async () => {
      const response = await sharedRequest.getConventions({
        headers: { authorization: conventionUnauthorizedConsumerToken },
        queryParams: {},
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: "Accès refusé",
        },
      });
    });

    it("400 - fails if unknown keys are provided", async () => {
      const response = await sharedRequest.getConventions({
        headers: { authorization: "whatever" },
        queryParams: { someUnknownKey: "yolo" } as any,
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /v2/conventions",
          issues: [' : Unrecognized key: "someUnknownKey"'],
        },
      });
    });

    it("200 - returns the conventions matching agencyIds in scope", async () => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          ...assessment,
          _entityName: "Assessment",
          numberOfHoursActuallyMade: 35,
        },
      ];
      inMemoryUow.notificationRepository.notifications = [
        signatureEmailReminder,
      ];

      expect(displayRouteName(publicApiV2ConventionRoutes.getConventions)).toBe(
        "GET /v2/conventions -",
      );
      const response = await sharedRequest.getConventions({
        headers: {
          authorization: conventionReadConsumerWithAgencyIdsScopeToken,
        },
        queryParams: {
          startDateGreater: "2024-10-01" as any,
          withStatuses: ["READY_TO_SIGN"],
        },
      });

      const emptyLastReminders = makeEmptyLastReminders();

      expectHttpResponseToEqual(response, {
        body: [
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: "pole-emploi",
            agencyContactEmail: agency.contactEmail,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: {
              ...emptyLastReminders,
              conventionSignatures: {
                ...emptyLastReminders.conventionSignatures,
                beneficiary: {
                  email: signatureReminderSentAt,
                  sms: null,
                },
              },
            },
            isEstablishmentBanned: false,
          },
        ],
        status: 200,
      });
    });

    it("200 - also works when providing only one value in an array expected query param", async () => {
      inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      inMemoryUow.conventionRepository.setConventions([convention]);

      expect(displayRouteName(publicApiV2ConventionRoutes.getConventions)).toBe(
        "GET /v2/conventions -",
      );

      const { body, status } = await request
        .get(publicApiV2ConventionRoutes.getConventions.url)
        .query({ withStatuses: ["READY_TO_SIGN"] })
        .set("Authorization", conventionReadConsumerWithAgencyIdsScopeToken);

      expectToEqual(
        { body, status },
        {
          body: [
            {
              ...convention,
              agencyName: agency.name,
              agencyContactEmail: agency.contactEmail,
              agencyDepartment: agency.address.departmentCode,
              agencyKind: "pole-emploi",
              agencySiret: agency.agencySiret,
              agencyValidationSteps: "validator-only",
              assessment: null,
              lastReminders: makeEmptyLastReminders(),
              isEstablishmentBanned: false,
            } satisfies ConventionReadPublicV2Dto,
          ],
          status: 200,
        },
      );
    });
  });
});
