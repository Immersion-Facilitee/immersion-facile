import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionJwt,
  type ConventionRole,
  type Email,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  frontRoutes,
  type RenewExpiredJwtRequestDto,
  type ShortLinkId,
} from "shared";
import { v4 as uuid } from "uuid";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../../utils/agency";
import {
  createConnectedUserJwtPayload,
  createConventionMagicLinkPayload,
  createEmailAuthCodeJwtPayload,
} from "../../../../../utils/jwt";
import {
  fakeGenerateConnectedUserUrlFn,
  fakeGenerateEmailAuthCodeUrlFn,
  fakeGenerateMagicLinkUrlFn,
} from "../../../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../../events/ports/EventBus";
import { makeGenerateJwtES256 } from "../../../jwt";
import { makeSaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import type { OngoingOAuth } from "../entities/OngoingOAuth";
import { makeRenewExpiredJwt, type RenewExpiredJwt } from "./RenewExpiredJwt";

describe("RenewExpiredJwt use case", () => {
  const validator = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("validator@mail.com")
    .buildUser();

  const counsellor = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("counsellor@mail.com")
    .buildUser();

  const defaultAgency = AgencyDtoBuilder.create().build();

  const validConvention: ConventionDto = new ConventionDtoBuilder()
    .withAgencyId(defaultAgency.id)
    .withBeneficiaryCurrentEmployer({
      email: "currentemployer@mail.com",
      businessName: "Current Employer SARL",
      businessSiret: "12345678901234",
      firstName: "Jean",
      lastName: "Dupont",
      job: "Manager",
      role: "beneficiary-current-employer",
      phone: "+33601010102",
      businessAddress: "Rue des Bouchers 67065 Strasbourg",
    })
    .withBeneficiaryRepresentative({
      email: "beneficiaryrepresentative@mail.com",
      firstName: "Marie",
      lastName: "Dupont",
      phone: "+33601010101",
      role: "beneficiary-representative",
    })
    .build();

  const config: AppConfig = new AppConfigBuilder()
    .withTestPresetPreviousKeys()
    .build();

  const timeGateway = new CustomTimeGateway(new Date());

  let uow: InMemoryUnitOfWork;
  let useCase: RenewExpiredJwt;
  let shortLinkIdGeneratorGateway: DeterministShortLinkIdGeneratorGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let createNewEvent: CreateNewEvent;

  beforeEach(() => {
    const uuidGenerator = new TestUuidGenerator();
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    createNewEvent = makeCreateNewEvent({ uuidGenerator, timeGateway });
    shortLinkIdGeneratorGateway = new DeterministShortLinkIdGeneratorGateway();
    useCase = makeRenewExpiredJwt({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
        generateConnectedUserLoginUrl: fakeGenerateConnectedUserUrlFn,
        generateEmailAuthCodeUrl: fakeGenerateEmailAuthCodeUrlFn,
        config,
        timeGateway,
        shortLinkIdGeneratorGateway,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          uuidGenerator,
          timeGateway,
        ),
        createNewEvent,
      },
    });

    uow.agencyRepository.agencies = [
      toAgencyWithRights(defaultAgency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      }),
    ];
    uow.conventionRepository.setConventions([validConvention]);
    uow.userRepository.users = [validator, counsellor];
  });

  describe("With convention JWT", () => {
    const generateConventionJwt = makeGenerateJwtES256<"convention">(
      config.jwtPrivateKey,
      undefined,
    );

    describe("Right paths", () => {
      it.each<[ConventionRole, Email]>([
        ["beneficiary", validConvention.signatories.beneficiary.email],
        [
          "beneficiary-current-employer",
          // biome-ignore lint/style/noNonNullAssertion: provided
          validConvention.signatories.beneficiaryCurrentEmployer!.email,
        ],
        [
          "beneficiary-representative",
          // biome-ignore lint/style/noNonNullAssertion: provided
          validConvention.signatories.beneficiaryRepresentative!.email,
        ],
        [
          "establishment-representative",
          validConvention.signatories.establishmentRepresentative.email,
        ],
        ["establishment-tutor", validConvention.establishmentTutor.email],
        ["counsellor", counsellor.email],
        ["validator", validator.email],
      ])("Posts an event to deliver a correct JWT for correct responses for role %s", async (expectedRole, expectedEmail) => {
        const expiredPayload = createConventionMagicLinkPayload({
          id: validConvention.id,
          role: expectedRole,
          email: expectedEmail,
          now: timeGateway.now(),
        });

        const shortLinks = ["shortLink1", "shortLink2"];
        shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinks);

        await useCase.execute({
          kind: "convention",
          originalUrl: "http://immersionfacile.fr/verifier-et-signer?jwt=toto",
          expiredJwt: generateConventionJwt(expiredPayload),
        });

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "MAGIC_LINK_RENEWAL",
              params: {
                conventionId: validConvention.id,
                internshipKind: validConvention.internshipKind,
                magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinks[0]}`,
              },
              recipients: [expectedEmail],
            },
          ],
        });

        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: shortLinks[0],
            url: fakeGenerateMagicLinkUrlFn({
              id: validConvention.id,
              role: expectedRole,
              email: expectedEmail,
              now: timeGateway.now(),
              targetRoute: "conventionToSign",
            }),
            lastUsedAt: null,
          },
        ]);
      });

      it("Also work when using encoded Url", async () => {
        const shortLinkId = "shortLink1";
        shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLinkId]);
        const expiredPayload = createConventionMagicLinkPayload({
          id: validConvention.id,
          role: "beneficiary",
          email: validConvention.signatories.beneficiary.email,
          now: timeGateway.now(),
        });

        await useCase.execute({
          kind: "convention",
          originalUrl: encodeURIComponent(
            "http://immersionfacile.fr/verifier-et-signer?jwt=toto",
          ),
          expiredJwt: generateConventionJwt(expiredPayload),
        });

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "MAGIC_LINK_RENEWAL",
              params: {
                conventionId: validConvention.id,
                internshipKind: validConvention.internshipKind,
                magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinkId}`,
              },
              recipients: [validConvention.signatories.beneficiary.email],
            },
          ],
        });
      });

      it("Also work when having mixed up params in the url", async () => {
        const shortLinkId = "shortLink1";
        shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLinkId]);
        const expiredPayload = createConventionMagicLinkPayload({
          id: validConvention.id,
          role: "beneficiary",
          email: validConvention.signatories.beneficiary.email,
          now: timeGateway.now(),
        });

        await useCase.execute({
          kind: "convention",
          originalUrl: encodeURIComponent(
            "http://immersionfacile.fr/verifier-et-signer?mtm_campaign=test&jwt=toto",
          ),
          expiredJwt: generateConventionJwt(expiredPayload),
        });
        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "MAGIC_LINK_RENEWAL",
              params: {
                conventionId: validConvention.id,
                internshipKind: validConvention.internshipKind,
                magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinkId}`,
              },
              recipients: [validConvention.signatories.beneficiary.email],
            },
          ],
        });
      });
    });

    describe("Wrong paths", () => {
      it("requires a valid application id", async () => {
        const invalidConventionId: ConventionId = "not-a-valid-id";

        const request: RenewExpiredJwtRequestDto = {
          kind: "convention",
          originalUrl: "https://immersionfacile.com/%jwt%",
          expiredJwt: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: invalidConventionId,
              role: "counsellor",
              email: counsellor.email,
              now: timeGateway.now(),
            }),
          ),
        };

        await expectPromiseToFailWithError(
          useCase.execute(request),
          errors.convention.notFound({ conventionId: invalidConventionId }),
        );
      });

      it("requires a known agency id", async () => {
        const storedUnknownId = "some unknown agency id";
        const convention = new ConventionDtoBuilder()
          .withAgencyId(storedUnknownId)
          .build();
        uow.conventionRepository.setConventions([convention]);

        const request: RenewExpiredJwtRequestDto = {
          kind: "convention",
          originalUrl: "https://immersionfacile.com/%jwt%",
          expiredJwt: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: convention.id,
              role: "counsellor",
              email: counsellor.email,
              now: timeGateway.now(),
            }),
          ),
        };

        await expectPromiseToFailWithError(
          useCase.execute(request),
          errors.agency.notFound({ agencyId: storedUnknownId }),
        );
      });

      // Admins use non-magic-link based authentication, so no need to renew these.
      it("Refuses to generate backoffice magic links", async () => {
        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "convention",
            originalUrl:
              "http://immersionfacile.fr/verifier-et-signer?jwt=toto",
            expiredJwt: generateConventionJwt(
              createConventionMagicLinkPayload({
                id: validConvention.id,
                role: "back-office" as ConventionRole,
                email: counsellor.email,
                now: timeGateway.now(),
              }),
            ),
          }),
          errors.convention.roleHasNoMagicLink({ role: "back-office" }),
        );
      });

      it("does not accept to renew links from url that are not supported", async () => {
        const request: RenewExpiredJwtRequestDto = {
          kind: "convention",
          originalUrl: "immersionfacile.com/",
          expiredJwt: generateConventionJwt(
            createConventionMagicLinkPayload({
              id: validConvention.id,
              role: "counsellor",
              email: counsellor.email,
              now: timeGateway.now(),
            }),
          ),
        };

        await expectPromiseToFailWithError(
          useCase.execute(request),
          errors.convention.unsupportedRenewRoute({
            originalUrl: request.originalUrl,
            supportedRenewRoutes: [
              frontRoutes.conventionToSign({ jwt: "" }).href,
              frontRoutes.manageConvention({ jwt: "" }).href,
              frontRoutes.assessment({ jwt: "" }).href,
              frontRoutes.assessmentDocument({ jwt: "" }).href,
              frontRoutes.conventionImmersion({ jwt: "" }).href,
              frontRoutes.unregisterEstablishmentLead({ jwt: "" }).href,
              frontRoutes.conventionDocument({ jwt: "" }).href,
            ],
          }),
        );
      });

      it("on missing short link", async () => {
        const expiredPayload = createConventionMagicLinkPayload({
          id: validConvention.id,
          role: "beneficiary",
          email: validConvention.signatories.beneficiary.email,
          now: timeGateway.now(),
        });

        const shortLinkId: ShortLinkId = "missing";

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId,
            expiredJwt: generateConventionJwt(expiredPayload),
          }),
          errors.shortLink.notFound({ shortLinkId }),
        );
      });
    });
  });

  describe("With conventionFromShortLink", () => {
    const generateConventionJwt = makeGenerateJwtES256<"convention">(
      config.jwtPrivateKey,
      undefined,
    );

    const existingShortLinkId = "already-used-short-link";
    const originalUrl = "http://immersionfacile.fr/verifier-et-signer?jwt=toto";

    beforeEach(() => {
      uow.shortLinkQuery.setShortLinks([
        {
          id: existingShortLinkId,
          url: originalUrl,
          lastUsedAt: new Date("2026-02-11"),
        },
      ]);
    });

    describe("Right paths", () => {
      it.each<[ConventionRole, Email]>([
        ["beneficiary", validConvention.signatories.beneficiary.email],
        [
          "beneficiary-current-employer",
          // biome-ignore lint/style/noNonNullAssertion: provided
          validConvention.signatories.beneficiaryCurrentEmployer!.email,
        ],
        [
          "beneficiary-representative",
          // biome-ignore lint/style/noNonNullAssertion: provided
          validConvention.signatories.beneficiaryRepresentative!.email,
        ],
        [
          "establishment-representative",
          validConvention.signatories.establishmentRepresentative.email,
        ],
        ["establishment-tutor", validConvention.establishmentTutor.email],
        ["counsellor", counsellor.email],
        ["validator", validator.email],
      ])("posts an event to deliver a correct JWT for role %s using shortLink originalUrl", async (expectedRole, expectedEmail) => {
        const shortLinks = ["shortLink1", "shortLink2"];
        shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinks);

        const expiredPayload = createConventionMagicLinkPayload({
          id: validConvention.id,
          role: expectedRole,
          email: expectedEmail,
          now: timeGateway.now(),
        });

        await useCase.execute({
          kind: "conventionFromShortLink",
          shortLinkId: existingShortLinkId,
          expiredJwt: generateConventionJwt(expiredPayload),
        });

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "MAGIC_LINK_RENEWAL",
              params: {
                conventionId: validConvention.id,
                internshipKind: validConvention.internshipKind,
                magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinks[0]}`,
              },
              recipients: [expectedEmail],
            },
          ],
        });

        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: existingShortLinkId,
            url: originalUrl,
            lastUsedAt: new Date("2026-02-11"),
          },
          {
            id: shortLinks[0],
            url: fakeGenerateMagicLinkUrlFn({
              id: validConvention.id,
              role: expectedRole,
              email: expectedEmail,
              now: timeGateway.now(),
              targetRoute: "conventionToSign",
            }),
            lastUsedAt: null,
          },
        ]);
      });
    });

    describe("Wrong paths", () => {
      it("throws when short link not found", async () => {
        const unknownShortLinkId = "unknown-short-link";
        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId: unknownShortLinkId,
            expiredJwt: generateConventionJwt(
              createConventionMagicLinkPayload({
                id: validConvention.id,
                role: "beneficiary",
                email: validConvention.signatories.beneficiary.email,
                now: timeGateway.now(),
              }),
            ),
          }),
          errors.shortLink.notFound({ shortLinkId: unknownShortLinkId }),
        );
      });

      it("requires a valid application id", async () => {
        const invalidConventionId: ConventionId = "not-a-valid-id";

        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId: existingShortLinkId,
            expiredJwt: generateConventionJwt(
              createConventionMagicLinkPayload({
                id: invalidConventionId,
                role: "counsellor",
                email: counsellor.email,
                now: timeGateway.now(),
              }),
            ),
          }),
          errors.convention.notFound({ conventionId: invalidConventionId }),
        );
      });

      it("requires a known agency id", async () => {
        const storedUnknownId = "some unknown agency id";
        const convention = new ConventionDtoBuilder()
          .withAgencyId(storedUnknownId)
          .build();
        uow.conventionRepository.setConventions([convention]);

        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId: existingShortLinkId,
            expiredJwt: generateConventionJwt(
              createConventionMagicLinkPayload({
                id: convention.id,
                role: "counsellor",
                email: counsellor.email,
                now: timeGateway.now(),
              }),
            ),
          }),
          errors.agency.notFound({ agencyId: storedUnknownId }),
        );
      });

      it("refuses to generate backoffice magic links", async () => {
        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId: existingShortLinkId,
            expiredJwt: generateConventionJwt(
              createConventionMagicLinkPayload({
                id: validConvention.id,
                role: "back-office" as ConventionRole,
                email: counsellor.email,
                now: timeGateway.now(),
              }),
            ),
          }),
          errors.convention.roleHasNoMagicLink({ role: "back-office" }),
        );
      });

      it("throws when JWT is not a convention payload", async () => {
        const generateConnectedUserJwt = makeGenerateJwtES256<"connectedUser">(
          config.jwtPrivateKey,
          undefined,
        );
        const user = new ConnectedUserBuilder().buildUser();
        uow.userRepository.users = [user];

        const connectedUserJwt = generateConnectedUserJwt(
          createConnectedUserJwtPayload({
            userId: user.id,
            durationHours: 1,
            now: timeGateway.now(),
          }),
        );

        await expectPromiseToFailWithError(
          useCase.execute({
            kind: "conventionFromShortLink",
            shortLinkId: existingShortLinkId,
            expiredJwt: connectedUserJwt as ConventionJwt,
          }),
          errors.user.unsupportedJwtPayload(),
        );
      });
    });
  });

  describe("With ConnectedUser Jwt", () => {
    const generateConnectedUserJwt = makeGenerateJwtES256<"connectedUser">(
      config.jwtPrivateKey,
      undefined,
    );
    const user = new ConnectedUserBuilder().buildUser();
    const onGoingOAuthFromUri =
      "/tableau-de-bord-etablissement/discussions/00000000-0000-0000-0000-000000000000";

    const expiredPayload = createConnectedUserJwtPayload({
      userId: user.id,
      durationHours: 1,
      now: timeGateway.now(),
    });

    const emailUsedOnGoingOAuth: OngoingOAuth = {
      email: user.email,
      userId: user.id,
      fromUri: onGoingOAuthFromUri,
      nonce: "fake-nonce",
      provider: "email",
      state: "fake-state",
      usedAt: new Date(),
    };

    beforeEach(() => {
      uow.userRepository.users = [user];
      uow.ongoingOAuthRepository.ongoingOAuths = [emailUsedOnGoingOAuth];
    });

    it("Sends a magiclink renewal email including a shortlink mapped to ConnectedUserUrl with renewed JWT", async () => {
      const shortLinks = ["shortLink1"];
      shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinks);

      await useCase.execute({
        kind: "connectedUser",
        expiredJwt: generateConnectedUserJwt(expiredPayload),
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "MAGIC_LINK_RENEWAL",
            params: {
              magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinks[0]}`,
            },
            recipients: [user.email],
          },
        ],
      });

      expectToEqual(uow.shortLinkQuery.getShortLinks(), [
        {
          id: shortLinks[0],
          url: fakeGenerateConnectedUserUrlFn({
            user,
            ongoingOAuth: emailUsedOnGoingOAuth,
            now: timeGateway.now(),
          }),
          lastUsedAt: null,
        },
      ]);
    });

    describe("Wrong paths", () => {
      it("with missing user", async () => {
        uow.userRepository.users = [];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "connectedUser",
            expiredJwt: generateConnectedUserJwt(expiredPayload),
          }),
          errors.user.notFound({ userId: user.id }),
        );
      });

      it("with unused ongoingOAuth", () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [
          {
            ...emailUsedOnGoingOAuth,
            usedAt: null,
          },
        ];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "connectedUser",
            expiredJwt: generateConnectedUserJwt(expiredPayload),
          }),
          errors.auth.unusedOAuth(),
        );
      });

      it("with ongoingOAuth that have a unsupported provider : ProConnect", () => {
        const unsupportedOngoingOAuth: OngoingOAuth = {
          ...emailUsedOnGoingOAuth,
          idToken: null,
          provider: "proConnect",
        };

        uow.ongoingOAuthRepository.ongoingOAuths = [unsupportedOngoingOAuth];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "connectedUser",
            expiredJwt: generateConnectedUserJwt(expiredPayload),
          }),
          errors.auth.otherRenewalNotSupported(
            unsupportedOngoingOAuth.provider,
          ),
        );
      });

      it("with missing onGoingOAuth", () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "connectedUser",
            expiredJwt: generateConnectedUserJwt(expiredPayload),
          }),
          errors.auth.missingOAuth({}),
        );
      });
    });
  });

  describe("With EmailAuthCode Jwt", () => {
    const generateEmailAuthCodeJwt = makeGenerateJwtES256<"emailAuthCode">(
      config.jwtPrivateKey,
      undefined,
    );

    const user = new ConnectedUserBuilder().buildUser();
    const onGoingOAuthFromUri =
      "/tableau-de-bord-etablissement/discussions/00000000-0000-0000-0000-000000000000";

    const expiredPayload = createEmailAuthCodeJwtPayload({
      emailAuthCode: true,
      durationMinutes: 1,
      now: timeGateway.now(),
    });

    const emailUnusedOnGoingOAuth: OngoingOAuth = {
      email: user.email,
      userId: user.id,
      fromUri: onGoingOAuthFromUri,
      nonce: "fake-nonce",
      provider: "email",
      state: "fake-state",
      usedAt: null,
    };

    beforeEach(() => {
      uow.userRepository.users = [user];
      uow.ongoingOAuthRepository.ongoingOAuths = [emailUnusedOnGoingOAuth];
    });

    it("on unused oAuth, sends a magiclink renewal email including a shortlink mapped to ConnectedUserUrl with renewed JWT", async () => {
      const shortLinks = ["shortLink1"];
      shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinks);

      await useCase.execute({
        kind: "emailAuthCode",
        state: emailUnusedOnGoingOAuth.state,
        expiredJwt: generateEmailAuthCodeJwt(expiredPayload),
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "MAGIC_LINK_RENEWAL",
            params: {
              magicLink: `${config.immersionFacileBaseUrl}/api/to/${shortLinks[0]}`,
            },
            recipients: [user.email],
          },
        ],
      });

      expectToEqual(uow.shortLinkQuery.getShortLinks(), [
        {
          id: shortLinks[0],
          url: fakeGenerateEmailAuthCodeUrlFn({
            email: user.email,
            state: emailUnusedOnGoingOAuth.state,
            targetRoute: "magicLinkInterstitial",
            now: timeGateway.now(),
          }),
          lastUsedAt: null,
        },
      ]);
    });

    it("on already used oauth, sends a 'UserAuthenticationByEmailRequested' event", async () => {
      uow.ongoingOAuthRepository.ongoingOAuths = [
        {
          ...emailUnusedOnGoingOAuth,
          usedAt: new Date(),
        },
      ];

      await useCase.execute({
        kind: "emailAuthCode",
        state: emailUnusedOnGoingOAuth.state,
        expiredJwt: generateEmailAuthCodeJwt(expiredPayload),
      });

      expectSavedNotificationsAndEvents({
        emails: [],
      });

      expectToEqual(uow.shortLinkQuery.getShortLinks(), []);

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "UserAuthenticationByEmailRequested",
          payload: {
            email: emailUnusedOnGoingOAuth.email,
            redirectUri: emailUnusedOnGoingOAuth.fromUri,
          },
        },
      ]);
    });

    describe("Wrong paths", () => {
      it("unsupported oauth provider", () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [
          {
            ...emailUnusedOnGoingOAuth,
            idToken: null,
            provider: "proConnect",
          },
        ];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "emailAuthCode",
            state: emailUnusedOnGoingOAuth.state,
            expiredJwt: generateEmailAuthCodeJwt(expiredPayload),
          }),
          errors.auth.otherRenewalNotSupported("proConnect"),
        );
      });

      it("missing oauth", () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [];

        expectPromiseToFailWithError(
          useCase.execute({
            kind: "emailAuthCode",
            state: emailUnusedOnGoingOAuth.state,
            expiredJwt: generateEmailAuthCodeJwt(expiredPayload),
          }),
          errors.auth.missingOAuth({ state: emailUnusedOnGoingOAuth.state }),
        );
      });
    });
  });
});
