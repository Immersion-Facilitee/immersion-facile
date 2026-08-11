import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  type AssessmentDto,
  AssessmentDtoBuilder,
  ConnectedUserBuilder,
  type ConnectedUserJwtPayload,
  ConventionDtoBuilder,
  type ConventionJwt,
  type ConventionMagicLinkRoutes,
  conventionMagicLinkRoutes,
  currentJwtVersions,
  displayRouteName,
  errors,
  expectArraysToMatch,
  expectHttpResponseToEqual,
  expectToEqual,
  type LegacyAssessmentDto,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { AssessmentEntity } from "../../../../domains/convention/entities/AssessmentEntity";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
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
import { createConventionMagicLinkPayload } from "../../../../utils/jwt";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("Assessment routes", () => {
  const validator = new ConnectedUserBuilder()
    .withEmail("validator@mail.com")
    .withId("validator")
    .buildUser();
  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin")
    .withIsAdmin(true)
    .buildUser();
  const backofficeAdminJwtPayload: ConnectedUserJwtPayload = {
    version: currentJwtVersions.connectedUser,
    iat: Date.now(),
    exp: addDays(new Date(), 30).getTime(),
    userId: backofficeAdminUser.id,
  };
  const agency = new AgencyDtoBuilder().build();
  const convention = new ConventionDtoBuilder()
    .withAgencyId(agency.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .build();

  let httpClient: HttpClient<ConventionMagicLinkRoutes>;
  let inMemoryUow: InMemoryUnitOfWork;
  let eventCrawler: BasicEventCrawler;
  let gateways: InMemoryGateways;
  let jwt: ConventionJwt;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let generateConventionJwt: GenerateConventionJwt;

  beforeEach(async () => {
    const testAppAndDeps = await buildTestApp();
    ({
      inMemoryUow,
      eventCrawler,
      gateways,
      generateConnectedUserJwt,
      generateConventionJwt,
    } = testAppAndDeps);

    jwt = testAppAndDeps.generateConventionJwt(
      createConventionMagicLinkPayload({
        id: convention.id,
        role: "establishment-tutor",
        email: convention.establishmentTutor.email,
        now: new Date(),
      }),
    );
    httpClient = createSupertestSharedClient(
      conventionMagicLinkRoutes,
      testAppAndDeps.request,
    );

    inMemoryUow.conventionRepository.setConventions([convention]);
    inMemoryUow.agencyRepository.insert(
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );
    inMemoryUow.userRepository.users = [validator, backofficeAdminUser];
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.createAssessment,
  )} to add assessment`, () => {
    it("returns 201 if the jwt is valid", async () => {
      gateways.shortLinkGenerator.addMoreShortLinkIds(["shortLinkAssessment"]);
      inMemoryUow.conventionRepository.setConventions([convention]);

      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "The guy left after one day",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      const response = await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 201,
        body: "",
      });

      await processEventsForEmailToBeSent(eventCrawler);

      expectArraysToMatch(gateways.notification.getSentEmails(), [
        {
          kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          recipients: [convention.signatories.beneficiary.email],
        },
      ]);
    });

    it("fails with 401 if jwt is not valid", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "The guy left after one day",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      const response = await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("fails with 400 if some data is not valid", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      const response = await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: ["establishmentFeedback : Ce champ est obligatoire"],
          message:
            "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /auth/assessment",
          status: 400,
        },
      });
    });

    it("fails with 403 if convention id does not matches the one in token", async () => {
      const anotherConvention = new ConventionDtoBuilder()
        .withId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
        .withAgencyId(agency.id)
        .build();

      inMemoryUow.conventionRepository.setConventions([anotherConvention]);

      const assessment: AssessmentDto = {
        conventionId: anotherConvention.id,
        status: "COMPLETED",
        establishmentFeedback: "mon feedback",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date("2025-01-01").toISOString(),
      };

      const response = await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: jwt },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.conventionIdMismatch().message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.getAssessmentByConventionId,
  )} to get assessment`, () => {
    it("returns 200 if the jwt is valid and assessment is assessmentDto", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "The guy left after one day",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: true,
        beneficiaryFeedback: "Mon commentaire",
        signedAt: new Date("2025-01-01").toISOString(),
        createdAt: new Date("2025-01-01").toISOString(),
      };

      await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: jwt },
      });

      const response = await httpClient.getAssessmentByConventionId({
        headers: { authorization: jwt },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: assessment,
      });
    });

    it("returns 200 if connected beneficiary jwt is valid", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "The guy left after one day",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: true,
        beneficiaryFeedback: "Mon commentaire",
        signedAt: new Date("2025-01-01").toISOString(),
        createdAt: new Date("2025-01-01").toISOString(),
      };
      const beneficiary = new ConnectedUserBuilder()
        .withId("beneficiary")
        .withEmail(convention.signatories.beneficiary.email)
        .buildUser();

      inMemoryUow.userRepository.users = [
        ...inMemoryUow.userRepository.users,
        beneficiary,
      ];
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          numberOfHoursActuallyMade: convention.schedule.totalHours,
          ...assessment,
        },
      ];

      const response = await httpClient.getAssessmentByConventionId({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: assessment,
      });
    });

    it("fails with 403 if connected user email is not linked to the convention", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "The guy left after one day",
        endedWithAJob: false,
        establishmentAdvices: "mon conseil",
        beneficiaryAgreement: true,
        beneficiaryFeedback: "Mon commentaire",
        signedAt: new Date("2025-01-01").toISOString(),
        createdAt: new Date("2025-01-01").toISOString(),
      };
      const unrelatedUser = new ConnectedUserBuilder()
        .withId("unrelated-user")
        .withEmail("unrelated@mail.com")
        .buildUser();

      inMemoryUow.userRepository.users = [
        ...inMemoryUow.userRepository.users,
        unrelatedUser,
      ];
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          numberOfHoursActuallyMade: convention.schedule.totalHours,
          ...assessment,
        },
      ];

      const response = await httpClient.getAssessmentByConventionId({
        headers: {
          authorization: generateConnectedUserJwt({
            userId: unrelatedUser.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.forbidden("GetAssessment").message,
        },
      });
    });

    it("returns 200 if the jwt is valid and assessment is legacyAssessmentDto", async () => {
      const legacyAssessment: LegacyAssessmentDto = {
        conventionId: convention.id,
        status: "FINISHED",
        establishmentFeedback: "The guy left after one day",
        createdAt: new Date("2023-03-11").toISOString(),
      };

      await inMemoryUow.conventionRepository.setConventions([convention]);

      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...legacyAssessment,
        } as AssessmentEntity, // force type to AssessmentEntity to simulate a legacy assessment in DB
      ];

      const response = await httpClient.getAssessmentByConventionId({
        headers: { authorization: jwt },
        urlParams: { conventionId: convention.id },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: legacyAssessment,
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.deleteAssessment,
  )} to delete assessment`, () => {
    it("returns 204 when admin deletes existing assessment", async () => {
      const assessment: AssessmentDto = {
        conventionId: convention.id,
        status: "COMPLETED",
        establishmentFeedback: "Feedback",
        endedWithAJob: false,
        establishmentAdvices: "Conseil",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
      };
      await httpClient.createAssessment({
        body: assessment,
        headers: { authorization: jwt },
      });

      const response = await httpClient.deleteAssessment({
        body: {
          conventionId: convention.id,
          deleteAssessmentJustification: "Justification",
        },
        headers: {
          authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 204,
        body: {},
      });
      expectArraysToMatch(inMemoryUow.assessmentRepository.assessments, []);
    });

    it("fails with 401 if jwt is not valid", async () => {
      const response = await httpClient.deleteAssessment({
        body: {
          conventionId: convention.id,
          deleteAssessmentJustification: "Justification",
        },
        headers: { authorization: "invalid-jwt" },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      });
    });

    it("fails with 403 if user is not admin", async () => {
      const response = await httpClient.deleteAssessment({
        body: {
          conventionId: convention.id,
          deleteAssessmentJustification: "Justification",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            ...backofficeAdminJwtPayload,
            userId: validator.id,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.user.forbidden({ userId: validator.id }).message,
        },
      });
    });

    it("fails with 404 when assessment does not exist", async () => {
      const response = await httpClient.deleteAssessment({
        body: {
          conventionId: convention.id,
          deleteAssessmentJustification: "Justification",
        },
        headers: {
          authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.assessment.notFound(convention.id).message,
        },
      });
    });

    it("fails with 400 if request body is invalid", async () => {
      const response = await httpClient.deleteAssessment({
        body: {
          conventionId: convention.id,
          deleteAssessmentJustification: "",
        },
        headers: {
          authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: expect.arrayContaining([
            expect.stringMatching(/deleteAssessmentJustification/),
          ]),
          message: expect.stringContaining("DELETE /auth/assessment"),
          status: 400,
        },
      });
    });
  });

  describe(`${displayRouteName(
    conventionMagicLinkRoutes.signAssessment,
  )} to sign assessment`, () => {
    const assessment = new AssessmentDtoBuilder()
      .withConventionId(convention.id)
      .build();

    it("200 - connected beneficiary can sign assessment", async () => {
      const beneficiary = new ConnectedUserBuilder()
        .withId("beneficiary")
        .withEmail(convention.signatories.beneficiary.email)
        .buildUser();

      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [
        ...inMemoryUow.userRepository.users,
        beneficiary,
      ];
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...assessment,
          numberOfHoursActuallyMade: 40,
        },
      ];

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: beneficiary.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
      const signedEvent = inMemoryUow.outboxRepository.events.find(
        (event) => event.topic === "AssessmentSignedByBeneficiary",
      );
      if (signedEvent?.topic !== "AssessmentSignedByBeneficiary")
        throw new Error("Expected AssessmentSignedByBeneficiary event");
      expectToEqual(signedEvent.payload.triggeredBy, {
        kind: "connected-user",
        userId: beneficiary.id,
      });
    });

    it("403 - connected user email is not linked to the convention", async () => {
      const UserWithNoRightOnConvention = new ConnectedUserBuilder()
        .withId("user-with-no-right-on-convention")
        .withEmail("user-with-no-right-on-convention@mail.com")
        .buildUser();

      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.userRepository.users = [
        ...inMemoryUow.userRepository.users,
        UserWithNoRightOnConvention,
      ];
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...assessment,
          numberOfHoursActuallyMade: 40,
        },
      ];

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: {
          authorization: generateConnectedUserJwt({
            userId: UserWithNoRightOnConvention.id,
            version: currentJwtVersions.connectedUser,
          }),
        },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.signForbidden().message,
        },
      });
    });

    it("200 - beneficiary with valid JWT can sign assessment", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...assessment,
          numberOfHoursActuallyMade: 40,
        },
      ];

      const beneficiaryJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: { authorization: beneficiaryJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
    });

    it("403 - establishment-tutor cannot sign", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...assessment,
          numberOfHoursActuallyMade: 40,
        },
      ];

      const establishmentTutorJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "establishment-tutor",
          email: convention.establishmentTutor.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: { authorization: establishmentTutorJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: errors.assessment.signForbidden().message,
        },
      });
    });

    it("403 - cannot sign legacy assessment", async () => {
      const legacyAssessment: AssessmentEntity = {
        _entityName: "Assessment",
        conventionId: convention.id,
        status: "FINISHED",
        establishmentFeedback: "Legacy feedback",
        numberOfHoursActuallyMade: null,
        createdAt: new Date("2023-03-11").toISOString(),
      };

      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [legacyAssessment];

      const beneficiaryJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: null,
        },
        headers: { authorization: beneficiaryJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message:
            errors.assessment.signNotAvailableForLegacyAssessment().message,
        },
      });
    });

    it("404 - convention not found", async () => {
      const nonExistentConventionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const beneficiaryJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: nonExistentConventionId,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: nonExistentConventionId,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: { authorization: beneficiaryJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.convention.notFound({
            conventionId: nonExistentConventionId,
          }).message,
        },
      });
    });

    it("404 - assessment not found", async () => {
      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [];

      const beneficiaryJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: { authorization: beneficiaryJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.assessment.notFound(convention.id).message,
        },
      });
    });

    it("409 - assessment already signed", async () => {
      const signedAssessment = new AssessmentDtoBuilder()
        .withConventionId(convention.id)
        .withBeneficiarySignature({
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
          signedAt: "2024-01-01T00:00:00Z",
        })
        .build();

      inMemoryUow.agencyRepository.agencies = [
        toAgencyWithRights(AgencyDtoBuilder.create(agency.id).build()),
      ];
      inMemoryUow.conventionRepository.setConventions([convention]);
      inMemoryUow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          ...signedAssessment,
          numberOfHoursActuallyMade: 40,
        },
      ];

      const beneficiaryJwt = generateConventionJwt(
        createConventionMagicLinkPayload({
          id: convention.id,
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
          now: new Date(),
        }),
      );

      const response = await httpClient.signAssessment({
        body: {
          conventionId: convention.id,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "my feedback",
        },
        headers: { authorization: beneficiaryJwt },
      });

      expectHttpResponseToEqual(response, {
        status: 409,
        body: {
          status: 409,
          message: errors.assessment.alreadySigned(convention.id).message,
        },
      });
    });
  });
});
