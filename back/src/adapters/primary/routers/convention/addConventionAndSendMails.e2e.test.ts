import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  conventionMagicLinkRoutes,
  currentJwtVersions,
  expectArraysToEqualIgnoringOrder,
  expectEmailOfType,
  expectToEqual,
  frontRoutes,
  makeRouteAbsoluteUrl,
  type Signatories,
  type UpdateConventionStatusRequestDto,
  unauthenticatedConventionRoutes,
  VALID_EMAILS,
} from "shared";
import type supertest from "supertest";
import type { InMemoryOutboxRepository } from "../../../../domains/core/events/adapters/InMemoryOutboxRepository";
import type { DomainEvent } from "../../../../domains/core/events/events";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type TestAppAndDeps,
} from "../../../../utils/buildTestApp";
import { createConventionMagicLinkPayload } from "../../../../utils/jwt";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("Add Convention Notifications, then checks the mails are sent (trigerred by events)", () => {
  const validator = new ConnectedUserBuilder()
    .withEmail("validator@mail.com")
    .withId("validator")
    .buildUser();

  const beneficiarySubmitDate = new Date();
  beneficiarySubmitDate.setDate(beneficiarySubmitDate.getDate() - 3);
  const beneficiarySignDate = new Date();
  beneficiarySignDate.setDate(beneficiarySignDate.getDate() - 2);
  const establishmentRepresentativeSignDate = new Date();
  establishmentRepresentativeSignDate.setDate(
    establishmentRepresentativeSignDate.getDate() - 1,
  );
  const validationDate = new Date();
  const externalId = "00000000005";

  it("saves valid convention in repository with full express app", async () => {
    const validConvention = new ConventionDtoBuilder().build();
    const { request, gateways, eventCrawler, inMemoryUow } =
      await buildTestApp();

    gateways.shortLinkGenerator.addMoreShortLinkIds([
      "shortLink1",
      "shortLink2",
      "shortLink3",
      "shortLink4",
      "shortLink5",
      "shortLink6",
    ]);

    inMemoryUow.agencyRepository.agencies = [
      toAgencyWithRights(
        new AgencyDtoBuilder().withId(validConvention.agencyId).build(),
        {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      ),
    ];
    inMemoryUow.userRepository.users = [validator];

    const res = await request
      .post(unauthenticatedConventionRoutes.createConvention.url)
      .send({ convention: validConvention });

    expectResponseBody(res, { id: validConvention.id });
    expect(
      await inMemoryUow.conventionRepository.getById(validConvention.id),
    ).toEqual(validConvention);
    expectEventsInOutbox(inMemoryUow.outboxRepository, [
      {
        topic: "ConventionSubmittedByBeneficiary",
        payload: { convention: validConvention, triggeredBy: null },
        publications: [],
      },
    ]);

    await processEventsForEmailToBeSent(eventCrawler);

    expectArraysToEqualIgnoringOrder(
      gateways.notification.getSentEmails().map((email) => email.kind),
      [
        "NEW_CONVENTION_AGENCY_NOTIFICATION",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
      ],
    );
  });

  it("Scenario: convention submitted, then signed, then validated", async () => {
    const ftAgency = new AgencyDtoBuilder().withKind("france-travail").build();

    const initialConvention = new ConventionDtoBuilder()
      .withAgencyId(ftAgency.id)
      .notSigned()
      .withStatus("READY_TO_SIGN")
      .withoutDateValidation()
      .withFederatedIdentity({ provider: "ftConnect", token: "fake" })
      .build();

    const appAndDeps = await buildTestApp();
    appAndDeps.gateways.timeGateway.defaultDate = new Date();
    appAndDeps.gateways.shortLinkGenerator.addMoreShortLinkIds([
      "link1",
      "link2",
      "link3",
      "link4",
      "link5",
      "link6",
      "link7",
      "link8",
    ]);

    appAndDeps.inMemoryUow.agencyRepository.agencies = [
      toAgencyWithRights(ftAgency, {
        [validator.id]: { roles: ["validator"], isNotifiedByEmail: true },
      }),
    ];
    appAndDeps.inMemoryUow.userRepository.users = [validator];

    appAndDeps.inMemoryUow.conventionExternalIdRepository.nextExternalId =
      externalId;

    const { beneficiarySignJwt, establishmentSignJwt } =
      await beneficiarySubmitsApplicationForTheFirstTime(
        appAndDeps,
        initialConvention,
        beneficiarySubmitDate,
      );

    await beneficiarySignsApplication(
      appAndDeps,
      beneficiarySignJwt,
      initialConvention,
    );

    await establishmentSignsApplication(
      appAndDeps,
      establishmentSignJwt,
      initialConvention,
    );
    const now = appAndDeps.gateways.timeGateway.now();
    const validatorReviewJwt = appAndDeps.generateConnectedUserJwt({
      userId: validator.id,
      version: currentJwtVersions.connectedUser,
      iat: Math.round(now.getTime() / 1000),
      exp: Math.round(addDays(now, 30).getTime() / 1000),
    });

    await validatorValidatesApplicationWhichTriggersConventionToBeSent(
      appAndDeps,
      validatorReviewJwt,
      initialConvention,
    );
  });

  const expectEventsInOutbox = (
    outbox: InMemoryOutboxRepository,
    events: Partial<DomainEvent>[],
  ) => {
    expect(outbox.events).toMatchObject(events);
  };

  const expectResponseBody = (
    res: supertest.Response,
    body: Record<string, unknown>,
  ) => {
    expect(res.body).toEqual(body);
    expect(res.status).toBe(200);
  };

  const numberOfEmailInitialySent = 4;

  const beneficiarySubmitsApplicationForTheFirstTime = async (
    {
      request,
      gateways,
      eventCrawler,
      inMemoryUow,
      generateConventionJwt,
      appConfig,
    }: TestAppAndDeps,
    convention: ConventionDto,
    submitDate: Date,
  ) => {
    gateways.timeGateway.setNextDate(submitDate);
    gateways.shortLinkGenerator.addMoreShortLinkIds([
      "shortLink1",
      "shortLink2",
      "shortLink3",
      "shortLink4",
    ]);

    const result = await request
      .post(unauthenticatedConventionRoutes.createConvention.url)
      .send({ convention });

    expect(result.status).toBe(200);

    expectToEqual(
      await inMemoryUow.conventionRepository.getById(convention.id),
      convention,
    );

    await processEventsForEmailToBeSent(eventCrawler);

    expect(inMemoryUow.notificationRepository.notifications).toHaveLength(3);
    const ftNotification =
      gateways.franceTravailGateway.broadcastParamsCalls[0];
    expectToEqual(ftNotification.eventType, "CONVENTION_UPDATED");
    expectToEqual(ftNotification.convention.id, convention.id);
    expectToEqual(ftNotification.convention.status, "READY_TO_SIGN");
    expectToEqual(
      ftNotification.convention.signatories.beneficiary.email,
      convention.signatories.beneficiary.email,
    );
    const sentEmails = gateways.notification.getSentEmails();
    expect(sentEmails).toHaveLength(numberOfEmailInitialySent - 1);
    expectArraysToEqualIgnoringOrder(
      sentEmails.map((e) => e.recipients),
      [[VALID_EMAILS[2]], [VALID_EMAILS[0]], [VALID_EMAILS[1]]],
    );

    const beneficiarySignEmail = expectEmailOfType(
      // biome-ignore lint/style/noNonNullAssertion: email is found by recipient
      sentEmails.find((email) =>
        email.recipients.includes(convention.signatories.beneficiary.email),
      )!,
      "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
    );
    expectToEqual(
      beneficiarySignEmail.params.conventionSignatureLink,
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: convention.id,
          loginPersona: "beneficiary",
          at_campaign: "email-signature-link",
        }),
        baseUrl: appConfig.immersionFacileBaseUrl,
      }),
    );

    const establishmentSignEmail = expectEmailOfType(
      // biome-ignore lint/style/noNonNullAssertion: email is found by recipient
      sentEmails.find((email) =>
        email.recipients.includes(
          convention.signatories.establishmentRepresentative.email,
        ),
      )!,
      "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
    );
    expectToEqual(
      establishmentSignEmail.params.conventionSignatureLink,
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: convention.id,
          loginPersona: "professional",
          at_campaign: "email-signature-link",
        }),
        baseUrl: appConfig.immersionFacileBaseUrl,
      }),
    );

    const now = gateways.timeGateway.now();
    const beneficiarySignJwt = generateConventionJwt(
      createConventionMagicLinkPayload({
        id: convention.id,
        role: convention.signatories.beneficiary.role,
        email: convention.signatories.beneficiary.email,
        now,
      }),
    );
    const establishmentSignJwt = generateConventionJwt(
      createConventionMagicLinkPayload({
        id: convention.id,
        role: convention.signatories.establishmentRepresentative.role,
        email: convention.signatories.establishmentRepresentative.email,
        now,
      }),
    );

    return {
      beneficiarySignJwt,
      establishmentSignJwt,
    };
  };

  const beneficiarySignsApplication = async (
    { request, gateways, eventCrawler, inMemoryUow }: TestAppAndDeps,
    beneficiarySignJwt: string,
    initialConvention: ConventionDto,
  ) => {
    gateways.timeGateway.setNextDate(beneficiarySignDate);

    const response = await request
      .post(
        conventionMagicLinkRoutes.signConvention.url.replace(
          ":conventionId",
          initialConvention.id,
        ),
      )
      .set("Authorization", beneficiarySignJwt);

    expect(response.status).toBe(200);

    expectToEqual(
      await inMemoryUow.conventionRepository.getById(initialConvention.id),
      {
        ...initialConvention,
        status: "PARTIALLY_SIGNED",
        signatories: makeSignatories(initialConvention, {
          beneficiarySignedAt: beneficiarySignDate.toISOString(),
        }),
      },
    );

    await processEventsForEmailToBeSent(eventCrawler);

    const sentEmails = gateways.notification.getSentEmails();
    expect(sentEmails).toHaveLength(numberOfEmailInitialySent);
  };

  const establishmentSignsApplication = async (
    { request, gateways, eventCrawler, inMemoryUow, appConfig }: TestAppAndDeps,
    establishmentSignJwt: string,
    initialConvention: ConventionDto,
  ) => {
    gateways.timeGateway.setNextDate(establishmentRepresentativeSignDate);

    await request
      .post(
        conventionMagicLinkRoutes.signConvention.url.replace(
          ":conventionId",
          initialConvention.id,
        ),
      )
      .set("Authorization", establishmentSignJwt)
      .expect(200);

    expectToEqual(
      await inMemoryUow.conventionRepository.getById(initialConvention.id),
      {
        ...initialConvention,
        status: "IN_REVIEW",
        signatories: makeSignatories(initialConvention, {
          beneficiarySignedAt: beneficiarySignDate.toISOString(),
          establishmentRepresentativeSignedAt:
            establishmentRepresentativeSignDate.toISOString(),
        }),
      },
    );

    await processEventsForEmailToBeSent(eventCrawler);

    const sentEmails = gateways.notification.getSentEmails();
    expectArraysToEqualIgnoringOrder(
      sentEmails.map((email) => email.kind),
      [
        "NEW_CONVENTION_AGENCY_NOTIFICATION",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
        "SIGNEE_HAS_SIGNED_CONVENTION",
        "SIGNEE_HAS_SIGNED_CONVENTION",
        "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
      ],
    );

    const manageConventionUrl = (
      loginPersona: "beneficiary" | "professional",
    ) =>
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: initialConvention.id,
          loginPersona,
        }),
        baseUrl: appConfig.immersionFacileBaseUrl,
      });

    expectArraysToEqualIgnoringOrder(
      sentEmails
        .filter((email) => email.kind === "SIGNEE_HAS_SIGNED_CONVENTION")
        .map((email) => ({
          recipients: email.recipients,
          magicLink: email.params.magicLink,
        })),
      [
        {
          recipients: [initialConvention.signatories.beneficiary.email],
          magicLink: manageConventionUrl("beneficiary"),
        },
        {
          recipients: [
            initialConvention.signatories.establishmentRepresentative.email,
          ],
          magicLink: manageConventionUrl("professional"),
        },
      ],
    );

    const needsReviewEmail = expectEmailOfType(
      sentEmails[sentEmails.length - 1],
      "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
    );
    expect(needsReviewEmail.recipients).toEqual([validator.email]);

    expect(needsReviewEmail.params.manageConventionLink).toBe(
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: initialConvention.id,
        }),
        baseUrl: appConfig.immersionFacileBaseUrl,
      }),
    );
  };

  const validatorValidatesApplicationWhichTriggersConventionToBeSent = async (
    { request, gateways, eventCrawler, inMemoryUow, appConfig }: TestAppAndDeps,
    validatorReviewJwt: string,
    initialConvention: ConventionDto,
  ) => {
    const params: UpdateConventionStatusRequestDto = {
      status: "ACCEPTED_BY_VALIDATOR",
      conventionId: initialConvention.id,
      firstname: "John",
      lastname: "Doe",
    };

    gateways.timeGateway.setNextDate(validationDate);
    gateways.shortLinkGenerator.addMoreShortLinkIds(["shortlinkId"]);

    await request
      .post(
        conventionMagicLinkRoutes.updateConventionStatus.url.replace(
          ":conventionId",
          initialConvention.id,
        ),
      )
      .set("Authorization", validatorReviewJwt)
      .send(params)
      .expect(200);

    expectToEqual(
      await inMemoryUow.conventionRepository.getById(initialConvention.id),
      {
        ...initialConvention,
        status: "ACCEPTED_BY_VALIDATOR",
        dateValidation: validationDate.toISOString(),
        signatories: makeSignatories(initialConvention, {
          beneficiarySignedAt: beneficiarySignDate.toISOString(),
          establishmentRepresentativeSignedAt:
            establishmentRepresentativeSignDate.toISOString(),
        }),
        validators: {
          agencyValidator: {
            firstname: params.firstname,
            lastname: params.lastname,
          },
        },
        statusJustification: undefined,
      },
    );

    await processEventsForEmailToBeSent(eventCrawler);

    const sentEmails = gateways.notification.getSentEmails();
    expectArraysToEqualIgnoringOrder(
      sentEmails.map((email) => email.kind),
      [
        "NEW_CONVENTION_AGENCY_NOTIFICATION",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
        "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
        "SIGNEE_HAS_SIGNED_CONVENTION",
        "SIGNEE_HAS_SIGNED_CONVENTION",
        "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
        "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
      ],
    );

    const manageConventionUrl = (
      loginPersona: "beneficiary" | "professional",
    ) =>
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: initialConvention.id,
          loginPersona,
        }),
        baseUrl: appConfig.immersionFacileBaseUrl,
      });

    expectArraysToEqualIgnoringOrder(
      sentEmails
        .filter(
          (email) => email.kind === "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        )
        .map((email) => ({
          recipients: email.recipients,
          magicLink: email.params.magicLink,
        })),
      [
        {
          recipients: [initialConvention.signatories.beneficiary.email],
          magicLink: manageConventionUrl("beneficiary"),
        },
        {
          recipients: [
            initialConvention.signatories.establishmentRepresentative.email,
          ],
          magicLink: manageConventionUrl("professional"),
        },
        {
          recipients: [validator.email],
          magicLink: manageConventionUrl("professional"),
        },
      ],
    );
  };

  const makeSignatories = (
    convention: ConventionDto,
    {
      establishmentRepresentativeSignedAt,
      beneficiarySignedAt,
    }: {
      establishmentRepresentativeSignedAt?: string;
      beneficiarySignedAt?: string;
    },
  ): Signatories<typeof convention.internshipKind> => ({
    beneficiary: {
      ...convention.signatories.beneficiary,
      signedAt: beneficiarySignedAt,
    },
    establishmentRepresentative: {
      ...convention.signatories.establishmentRepresentative,
      signedAt: establishmentRepresentativeSignedAt,
    },
  });
});
