import { addHours } from "date-fns";
import subDays from "date-fns/subDays";
import {
  type BanEstablishmentPayload,
  type CommonDiscussionDto,
  type CreateDiscussion1Eleve1StageDto,
  type CreateDiscussionDto,
  type CreateDiscussionIFDto,
  DiscussionBuilder,
  type DiscussionDto,
  errors,
  expectArraysToEqual,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type Location,
  UserBuilder,
} from "shared";
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
import type {
  EstablishmentAdminRight,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import {
  type ContactEstablishment,
  makeContactEstablishment,
} from "./ContactEstablishment";

describe("ContactEstablishment", () => {
  const minimumNumberOfDaysBetweenSimilarContactRequests = 3;

  const location: Location = {
    id: "11111111-1111-4444-1111-111111111111",
    address: {
      streetNumberAndAddress: "24 rue des bouchers",
      city: "Strasbourg",
      postcode: "67000",
      departmentCode: "67",
    },
    position: {
      lat: 48.584614,
      lon: 7.750712,
    },
  };

  const immersionOffer = new OfferEntityBuilder().build();

  const adminUser = new UserBuilder()
    .withId("establishment.admin")
    .withEmail("admin@establishment.com")
    .withFirstName("Admin")
    .withLastName("Dupond")
    .build();
  const contactUser = new UserBuilder()
    .withId("establishment.contact")
    .withEmail("contact@establishment.com")
    .withFirstName("Contact")
    .withLastName("Despres")
    .build();

  const establishmentAdminRight: EstablishmentAdminRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    userId: adminUser.id,
    job: "",
    phone: "",
    shouldReceiveDiscussionNotifications: true,
    isMainContactByPhone: false,
  };

  const userRights: EstablishmentUserRight[] = [
    establishmentAdminRight,
    {
      role: "establishment-contact",
      status: "ACCEPTED",
      userId: contactUser.id,
      shouldReceiveDiscussionNotifications: true,
    },
  ];

  const establishmentEmailWithSiret = new EstablishmentEntityBuilder()
    .withSiret("11112222333344")
    .withContactMode("EMAIL")
    .withLocations([location])
    .build();

  const establishmentAggregateWithEmail = new EstablishmentAggregateBuilder()
    .withEstablishment(establishmentEmailWithSiret)
    .withOffers([immersionOffer])
    .withUserRights(userRights)
    .build();

  const validPhoneRequest: CreateDiscussionIFDto = {
    appellationCode: immersionOffer.appellationCode,
    siret: establishmentEmailWithSiret.siret,
    contactMode: "PHONE",
    datePreferences: "fake date preferences",
    potentialBeneficiaryPhone: "+33654783402",
    immersionObjective: "Confirmer un projet professionnel",
    immersionDuration: "oneWeek",
    motivation: "Je sais faire des crêpes",
    kind: "IF",
    potentialBeneficiaryFirstName: "billy",
    potentialBeneficiaryLastName: "idol",
    potentialBeneficiaryEmail: "potential_beneficiary@email.fr",
    locationId: location.id,
    experienceAdditionalInformation: "other stuff",
  };

  const validEmailRequest: CreateDiscussionIFDto = {
    ...validPhoneRequest,
    contactMode: "EMAIL",
    datePreferences: "fake date preferences",
    experienceAdditionalInformation: "fake experience additional information",
    immersionObjective: "Confirmer un projet professionnel",
    potentialBeneficiaryPhone: "+33654783402",
  };

  const discussionId = "discussion_id";
  const eventId = "contact_event_id";

  let contactEstablishment: ContactEstablishment;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(new Date("2022-01-10T12:00:00.000"));
    uuidGenerator = new TestUuidGenerator();
    contactEstablishment = makeContactEstablishment({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator,
        }),
        immersionFacileBaseUrl: "http://if.fr",
        minimumNumberOfDaysBetweenSimilarContactRequests,
        timeGateway,
        uuidGenerator,
      },
    });

    uow.romeRepository.appellations = [
      {
        appellationCode: immersionOffer.appellationCode,
        appellationLabel: immersionOffer.appellationLabel,
        romeCode: immersionOffer.romeCode,
        romeLabel: immersionOffer.romeLabel,
      },
    ];
    uow.userRepository.users = [adminUser, contactUser];
    uuidGenerator.setNextUuids([discussionId, eventId]);
  });

  describe("Right paths", () => {
    describe("schedule event", () => {
      it("schedules event for valid EMAIL contact request", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentAggregateWithEmail,
        ];

        await contactEstablishment.execute(validEmailRequest);

        expectArraysToEqual(uow.outboxRepository.events, [
          {
            id: eventId,
            occurredAt: timeGateway.now().toISOString(),
            topic: "ContactRequestedByBeneficiary",
            payload: {
              siret: establishmentAggregateWithEmail.establishment.siret,
              discussionId,
              triggeredBy: null,
              isLegacy: false,
            },
            status: "never-published",
            publications: [],
            wasQuarantined: false,
            priority: defaultPriority,
          },
        ]);
      });

      it("schedules event for valid PHONE contact request", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder(establishmentEmailWithSiret)
              .withContactMode("PHONE")
              .build(),
          )
          .withOffers([immersionOffer])
          .withUserRights(userRights)
          .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishment,
        ];

        await contactEstablishment.execute(validPhoneRequest);

        expectArraysToEqual(uow.outboxRepository.events, [
          {
            id: eventId,
            occurredAt: timeGateway.now().toISOString(),
            topic: "ContactRequestedByBeneficiary",
            payload: {
              siret: establishment.establishment.siret,
              discussionId,
              triggeredBy: null,
              isLegacy: false,
            },
            publications: [],
            status: "never-published",
            wasQuarantined: false,
            priority: defaultPriority,
          },
        ]);
      });

      it("schedules event for valid IN_PERSON contact requests", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder(establishmentEmailWithSiret)
              .withContactMode("IN_PERSON")
              .withWelcomeAddress({
                address: {
                  streetNumberAndAddress: "24 rue des bouchers",
                  city: "Strasbourg",
                  postcode: "67000",
                  departmentCode: "67",
                },
                position: {
                  lat: 48.584614,
                  lon: 7.750712,
                },
              })
              .build(),
          )
          .withOffers([immersionOffer])
          .withUserRights(userRights)
          .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishment,
        ];

        await contactEstablishment.execute({
          ...validPhoneRequest,
          contactMode: "IN_PERSON",
        });

        expectArraysToEqual(uow.outboxRepository.events, [
          {
            id: eventId,
            occurredAt: timeGateway.now().toISOString(),
            topic: "ContactRequestedByBeneficiary",
            payload: {
              siret: establishment.establishment.siret,
              discussionId,
              triggeredBy: null,
              isLegacy: false,
            },
            publications: [],
            status: "never-published",
            wasQuarantined: false,
            priority: defaultPriority,
          },
        ]);
      });
    });

    describe("creates a Discussion Aggregate and adds in to repo", () => {
      const makeExpectedCommon = (now: Date): CommonDiscussionDto => ({
        id: discussionId,
        siret: validEmailRequest.siret,
        businessName:
          establishmentAggregateWithEmail.establishment.customizedName ||
          establishmentAggregateWithEmail.establishment.name,
        address:
          establishmentAggregateWithEmail.establishment.locations[0].address,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        status: "PENDING",
        locationId: validEmailRequest.locationId,
        ...(establishmentAggregateWithEmail.establishment.isEstablishmentBanned
          ? {
              isEstablishmentBanned:
                establishmentAggregateWithEmail.establishment
                  .isEstablishmentBanned,
              establishmentBannishmentJustification:
                establishmentAggregateWithEmail.establishment
                  .establishmentBannishmentJustification,
            }
          : {
              isEstablishmentBanned:
                establishmentAggregateWithEmail.establishment
                  .isEstablishmentBanned,
            }),
      });

      describe("with discussion kind IF", () => {
        it("and contact mode EMAIL", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            establishmentAggregateWithEmail,
          ];

          await contactEstablishment.execute(validEmailRequest);

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              contactMode: "EMAIL",
              kind: "IF",
              potentialBeneficiary: {
                firstName: validEmailRequest.potentialBeneficiaryFirstName,
                lastName: validEmailRequest.potentialBeneficiaryLastName,
                email: validEmailRequest.potentialBeneficiaryEmail,
                phone: validEmailRequest.potentialBeneficiaryPhone,
                resumeLink: validEmailRequest.potentialBeneficiaryResumeLink,
                experienceAdditionalInformation:
                  validEmailRequest.experienceAdditionalInformation,
                motivation: validEmailRequest.motivation,
                immersionDuration: validEmailRequest.immersionDuration,
                datePreferences: validEmailRequest.datePreferences,
                immersionObjective: "Confirmer un projet professionnel",
              },
              exchanges: [
                {
                  subject: `Billy IDOL vous contacte pour une demande d'immersion sur le métier de ${immersionOffer.appellationLabel}`,
                  sentAt: timeGateway.now().toISOString(),
                  message: `<p>Bonjour,</p>
              
<table width="600">
  <tr>
    <td>
      <p>Un candidat souhaite faire une immersion dans votre entreprise Company inside repository (24 rue des bouchers 67000 Strasbourg).<br/><br/><strong>Immersion souhaitée :</strong><br/>• Métier : ${immersionOffer.appellationLabel}.<br/>• Dates d’immersion envisagées : fake date preferences.<br/>• But de l'immersion : Je compte me former à ce métier.<br/><br/><strong>Profil du candidat :</strong><br/>• Informations supplémentaires sur l'expérience du candidat : fake experience additional information.</p>
    </td>
  </tr>
</table>
              
<table width="600">
  <tr>
    <td>
      <p><strong>Si la connexion ne fonctionne pas et que vous ne recevez pas le lien de réinitialisation du mot de passe, c'est que vous n'avez pas encore créé votre compte</strong>.<br/>Créer votre compte avec le même mail que celui avec lequel les candidats vous contactent.<br/><br/><br/>Bonne journée,<br/>L'équipe Immersion Facilitée</p>
    </td>
  </tr>
</table>`,
                  sender: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
          ]);
        });

        it("and contact mode PHONE", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            new EstablishmentAggregateBuilder(establishmentAggregateWithEmail)
              .withContactMode("PHONE")
              .build(),
          ];

          await contactEstablishment.execute(validPhoneRequest);

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              exchanges: [],
              contactMode: "PHONE",
              kind: "IF",
              potentialBeneficiary: {
                firstName: validPhoneRequest.potentialBeneficiaryFirstName,
                lastName: validPhoneRequest.potentialBeneficiaryLastName,
                email: validPhoneRequest.potentialBeneficiaryEmail,
                phone: validPhoneRequest.potentialBeneficiaryPhone,
                resumeLink: validPhoneRequest.potentialBeneficiaryResumeLink,
                experienceAdditionalInformation:
                  validPhoneRequest.experienceAdditionalInformation,
                motivation: validPhoneRequest.motivation,
                immersionDuration: validPhoneRequest.immersionDuration,
                datePreferences: validPhoneRequest.datePreferences,
                immersionObjective: "Confirmer un projet professionnel",
              },
            },
          ]);
        });

        it("and contact mode IN_PERSON", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            new EstablishmentAggregateBuilder({
              ...establishmentAggregateWithEmail,
              establishment: {
                ...establishmentAggregateWithEmail.establishment,
                potentialBeneficiaryWelcomeAddress: {
                  address: {
                    streetNumberAndAddress: "24 rue des bouchers",
                    city: "Strasbourg",
                    postcode: "67000",
                    departmentCode: "67",
                  },
                  position: {
                    lat: 48.584614,
                    lon: 7.750712,
                  },
                },
              },
            })
              .withContactMode("IN_PERSON")
              .build(),
          ];

          await contactEstablishment.execute({
            ...validPhoneRequest,
            contactMode: "IN_PERSON",
          });

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              exchanges: [],
              contactMode: "IN_PERSON",
              kind: "IF",
              potentialBeneficiary: {
                firstName: validPhoneRequest.potentialBeneficiaryFirstName,
                lastName: validPhoneRequest.potentialBeneficiaryLastName,
                email: validPhoneRequest.potentialBeneficiaryEmail,
                phone: validPhoneRequest.potentialBeneficiaryPhone,
                resumeLink: validPhoneRequest.potentialBeneficiaryResumeLink,
                experienceAdditionalInformation:
                  validPhoneRequest.experienceAdditionalInformation,
                motivation: validPhoneRequest.motivation,
                immersionDuration: validPhoneRequest.immersionDuration,
                datePreferences: validPhoneRequest.datePreferences,
                immersionObjective: "Confirmer un projet professionnel",
              },
            },
          ]);
        });
      });

      describe("with discussion kind 1_ELEVE_1_STAGE", () => {
        it("and contact mode EMAIL", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            establishmentAggregateWithEmail,
          ];

          const valid1J1SEmailRequest: CreateDiscussion1Eleve1StageDto = {
            ...validEmailRequest,
            kind: "1_ELEVE_1_STAGE",
            levelOfEducation: "2nde",
            immersionObjective: "Découvrir un métier ou un secteur d'activité",
          };
          await contactEstablishment.execute(valid1J1SEmailRequest);

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              contactMode: "EMAIL",
              kind: "1_ELEVE_1_STAGE",
              potentialBeneficiary: {
                firstName: valid1J1SEmailRequest.potentialBeneficiaryFirstName,
                lastName: valid1J1SEmailRequest.potentialBeneficiaryLastName,
                email: valid1J1SEmailRequest.potentialBeneficiaryEmail,
                phone: valid1J1SEmailRequest.potentialBeneficiaryPhone,
                datePreferences: valid1J1SEmailRequest.datePreferences,
                immersionObjective: valid1J1SEmailRequest.immersionObjective,
                levelOfEducation: valid1J1SEmailRequest.levelOfEducation,
              },
              exchanges: [
                {
                  subject: `Billy IDOL vous contacte pour une demande d'immersion sur le métier de ${immersionOffer.appellationLabel}`,
                  sentAt: timeGateway.now().toISOString(),
                  message: `<p>Bonjour,</p>
              
<table width="600">
  <tr>
    <td>
      <p>Un candidat souhaite faire une immersion dans votre entreprise Company inside repository (24 rue des bouchers 67000 Strasbourg).<br/><br/><strong>Immersion souhaitée :</strong><br/>• Métier : ${immersionOffer.appellationLabel}.<br/>• Dates d’immersion envisagées : fake date preferences.<br/>• But de l'immersion : J'en suis au premier stade de mon orientation et je veux en savoir plus sur ce métier.<br/><br/><strong>Profil du candidat :</strong><br/>• Je suis en 2nde.</p>
    </td>
  </tr>
</table>
              
<table width="600">
  <tr>
    <td>
      <p><strong>Si la connexion ne fonctionne pas et que vous ne recevez pas le lien de réinitialisation du mot de passe, c'est que vous n'avez pas encore créé votre compte</strong>.<br/>Créer votre compte avec le même mail que celui avec lequel les candidats vous contactent.<br/><br/><br/>Bonne journée,<br/>L'équipe Immersion Facilitée</p>
    </td>
  </tr>
</table>`,
                  sender: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
          ]);
        });

        it("and contact mode PHONE", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            new EstablishmentAggregateBuilder(establishmentAggregateWithEmail)
              .withContactMode("PHONE")
              .build(),
          ];

          const validPhone1E1SRequest: CreateDiscussion1Eleve1StageDto = {
            ...validPhoneRequest,
            kind: "1_ELEVE_1_STAGE",
            levelOfEducation: "2nde",
            immersionObjective: "Découvrir un métier ou un secteur d'activité",
          };

          await contactEstablishment.execute(validPhone1E1SRequest);

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              exchanges: [],
              contactMode: "PHONE",
              kind: "1_ELEVE_1_STAGE",
              potentialBeneficiary: {
                firstName: validPhone1E1SRequest.potentialBeneficiaryFirstName,
                lastName: validPhone1E1SRequest.potentialBeneficiaryLastName,
                email: validPhone1E1SRequest.potentialBeneficiaryEmail,
                phone: validPhone1E1SRequest.potentialBeneficiaryPhone,
                datePreferences: validPhone1E1SRequest.datePreferences,
                immersionObjective:
                  "Découvrir un métier ou un secteur d'activité",
                levelOfEducation: validPhone1E1SRequest.levelOfEducation,
              },
            },
          ]);
        });

        it("and contact mode IN_PERSON", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            new EstablishmentAggregateBuilder({
              ...establishmentAggregateWithEmail,
              establishment: {
                ...establishmentAggregateWithEmail.establishment,
                potentialBeneficiaryWelcomeAddress: {
                  address: {
                    streetNumberAndAddress: "24 rue des bouchers",
                    city: "Strasbourg",
                    postcode: "67000",
                    departmentCode: "67",
                  },
                  position: {
                    lat: 48.584614,
                    lon: 7.750712,
                  },
                },
              },
            })
              .withContactMode("IN_PERSON")
              .build(),
          ];

          const validInPerson1E1SRequest: CreateDiscussion1Eleve1StageDto = {
            ...validPhoneRequest,
            contactMode: "IN_PERSON",
            kind: "1_ELEVE_1_STAGE",
            levelOfEducation: "2nde",
            immersionObjective: "Découvrir un métier ou un secteur d'activité",
          };

          await contactEstablishment.execute(validInPerson1E1SRequest);

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...makeExpectedCommon(timeGateway.now()),
              appellationCode: immersionOffer.appellationCode,
              exchanges: [],
              contactMode: "IN_PERSON",
              kind: "1_ELEVE_1_STAGE",
              potentialBeneficiary: {
                firstName:
                  validInPerson1E1SRequest.potentialBeneficiaryFirstName,
                lastName: validInPerson1E1SRequest.potentialBeneficiaryLastName,
                email: validInPerson1E1SRequest.potentialBeneficiaryEmail,
                phone: validInPerson1E1SRequest.potentialBeneficiaryPhone,
                levelOfEducation: validInPerson1E1SRequest.levelOfEducation,
                datePreferences: validInPerson1E1SRequest.datePreferences,
                immersionObjective:
                  "Découvrir un métier ou un secteur d'activité",
              },
            },
          ]);
        });
      });
    });

    describe("switches establishment is searchable to false", () => {
      it("when the max contacts per month is reached", async () => {
        const establishmentAggregate = new EstablishmentAggregateBuilder(
          establishmentAggregateWithEmail,
        )
          .withIsMaxDiscussionsForPeriodReached(false)
          .withMaxContactsPerMonth(2)
          .withOffers([immersionOffer])
          .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentAggregate,
        ];

        const discussionTooOld = new DiscussionBuilder()
          .withId("tooOld")
          .withSiret(establishmentAggregate.establishment.siret)
          .withCreatedAt(new Date("2022-01-02T12:00:00.000"))
          .build();
        const discussionInLastMonth = new DiscussionBuilder()
          .withId("inLastMonth")
          .withSiret(establishmentAggregate.establishment.siret)
          .withCreatedAt(new Date("2022-01-09T12:00:00.000"))
          .build();

        uow.discussionRepository.discussions = [
          discussionTooOld,
          discussionInLastMonth,
        ];

        await contactEstablishment.execute({
          appellationCode: immersionOffer.appellationCode,
          siret: establishmentAggregate.establishment.siret,
          potentialBeneficiaryFirstName: "Bob",
          potentialBeneficiaryLastName: "Marley",
          potentialBeneficiaryEmail: "bob.marley@email.com",
          contactMode: "EMAIL",
          immersionObjective: "Confirmer un projet professionnel",
          potentialBeneficiaryPhone: "+33654783402",
          locationId: establishmentAggregate.establishment.locations[0].id,
          datePreferences: "fake date preferences",
          immersionDuration: "oneWeek",
          motivation: "Je sais faire des crêpes",
          experienceAdditionalInformation:
            "fake experience additional information",
          kind: "IF",
        });

        expectArraysToMatch(uow.discussionRepository.discussions, [
          {
            id: discussionTooOld.id,
          },
          {
            id: discussionInLastMonth.id,
          },
          {
            id: "discussion_id",
          },
        ]);

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishmentAggregate)
              .withIsMaxDiscussionsForPeriodReached(true)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .build(),
          ],
        );
      });

      it("when the max contacts per week is reached", async () => {
        const establishmentAggregate = new EstablishmentAggregateBuilder(
          establishmentAggregateWithEmail,
        )
          .withIsMaxDiscussionsForPeriodReached(false)
          .withMaxContactsPerMonth(8) // Setting monthly limit to 8, which means weekly limit is 2 (8/4)
          .withOffers([immersionOffer])
          .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentAggregate,
        ];

        const discussionWithinPastWeek1: DiscussionDto = new DiscussionBuilder()
          .withId("discussionInLastWeek1")
          .withSiret(establishmentAggregate.establishment.siret)
          .withCreatedAt(new Date("2022-01-09T12:00:00.000"))
          .build();
        const discussionWithinPastWeek2: DiscussionDto = new DiscussionBuilder()
          .withId("discussionInLastWeek2")
          .withSiret(establishmentAggregate.establishment.siret)
          .withCreatedAt(new Date("2022-01-08T12:00:00.000"))
          .build();

        uow.discussionRepository.discussions = [
          discussionWithinPastWeek1,
          discussionWithinPastWeek2,
        ];

        timeGateway.setNextDate(new Date("2022-01-10T12:00:00.000"));

        await contactEstablishment.execute({
          appellationCode: immersionOffer.appellationCode,
          siret: establishmentAggregate.establishment.siret,
          potentialBeneficiaryFirstName: "Marie",
          potentialBeneficiaryLastName: "Martin",
          potentialBeneficiaryEmail: "marie.martin@email.com",
          contactMode: "EMAIL",
          immersionObjective: "Confirmer un projet professionnel",
          potentialBeneficiaryPhone: "+33654783404",
          locationId: establishmentAggregate.establishment.locations[0].id,
          datePreferences: "fake date preferences",
          immersionDuration: "oneWeek",
          motivation: "Je sais faire des crêpes",
          experienceAdditionalInformation:
            "fake experience additional information",
          kind: "IF",
        });

        expectArraysToMatch(uow.discussionRepository.discussions, [
          {
            id: discussionWithinPastWeek1.id,
          },
          {
            id: discussionWithinPastWeek2.id,
          },
          {
            id: "discussion_id",
          },
        ]);

        expectToEqual(
          uow.establishmentAggregateRepository.establishmentAggregates,
          [
            new EstablishmentAggregateBuilder(establishmentAggregate)
              .withEstablishmentUpdatedAt(timeGateway.now())
              .withIsMaxDiscussionsForPeriodReached(true)
              .build(),
          ],
        );
      });
      it("uses the welcome address for in person contact requests", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder(establishmentEmailWithSiret)
              .withContactMode("IN_PERSON")
              .withWelcomeAddress({
                address: {
                  streetNumberAndAddress: "24 rue des bouchers",
                  city: "Strasbourg",
                  postcode: "67000",
                  departmentCode: "67",
                },
                position: {
                  lat: 48.584614,
                  lon: 7.750712,
                },
              })
              .build(),
          )
          .withUserRights([
            {
              role: "establishment-admin",
              status: "ACCEPTED",
              userId: adminUser.id,
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
              job: "job",
              phone: "+33654783402",
            },
            {
              role: "establishment-contact",
              status: "ACCEPTED",
              userId: contactUser.id,
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
              job: "job",
              phone: "+33654783402",
            },
          ])
          .withLocations([location])
          .build();

        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishment,
        ];

        await contactEstablishment.execute({
          ...validEmailRequest,
          contactMode: "IN_PERSON",
        });

        expectToEqual(uow.discussionRepository.discussions, [
          {
            id: discussionId,
            status: "PENDING",
            appellationCode: immersionOffer.appellationCode,
            exchanges: [],
            siret: establishment.establishment.siret,
            businessName: establishment.establishment.name,
            createdAt: timeGateway.now().toISOString(),
            updatedAt: timeGateway.now().toISOString(),
            address: establishment.establishment
              .potentialBeneficiaryWelcomeAddress?.address ?? {
              streetNumberAndAddress: "",
              city: "",
              postcode: "",
              departmentCode: "",
            },
            contactMode: "IN_PERSON",
            kind: "IF",
            potentialBeneficiary: {
              firstName: validEmailRequest.potentialBeneficiaryFirstName,
              lastName: validEmailRequest.potentialBeneficiaryLastName,
              email: validEmailRequest.potentialBeneficiaryEmail,
              phone: validEmailRequest.potentialBeneficiaryPhone,
              datePreferences: validEmailRequest.datePreferences,
              immersionObjective: "Confirmer un projet professionnel",
              experienceAdditionalInformation:
                validEmailRequest.experienceAdditionalInformation,
              motivation: validEmailRequest.motivation,
              immersionDuration: validEmailRequest.immersionDuration,
              resumeLink: validEmailRequest.potentialBeneficiaryResumeLink,
            },
            locationId: validEmailRequest.locationId,
            isEstablishmentBanned: false,
          },
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "ContactRequestedByBeneficiary",
            payload: {
              discussionId,
              siret: establishment.establishment.siret,
              triggeredBy: null,
            },
          },
        ]);
      });
    });
  });

  describe("Wrong paths", () => {
    it("throws ConflictError if a recent contact requests already exists for the same potential beneficiary email, siret and appellation", async () => {
      const establishmentAggregate = new EstablishmentAggregateBuilder(
        establishmentAggregateWithEmail,
      )
        .withEstablishmentSiret(validEmailRequest.siret)
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate,
      ];

      const contactDate = new Date("2022-01-01T12:00:00.000Z");
      timeGateway.setNextDate(contactDate);

      uow.discussionRepository.discussions = [
        new DiscussionBuilder()
          .withAppellationCode(validEmailRequest.appellationCode)
          .withSiret(validEmailRequest.siret)
          .withPotentialBeneficiaryEmail(
            validEmailRequest.potentialBeneficiaryEmail,
          )
          .withCreatedAt(subDays(contactDate, 2))
          .build(),
      ];

      const discussionId = "someDiscussionUuid";
      uuidGenerator.setNextUuid(discussionId);

      await expectPromiseToFailWithError(
        contactEstablishment.execute(validEmailRequest),
        errors.establishment.contactRequestConflict({
          appellationCode: validEmailRequest.appellationCode,
          siret: validEmailRequest.siret,
          minimumNumberOfDaysBetweenSimilarContactRequests,
        }),
      );
    });

    it("throws BadRequestError for contact mode mismatch", async () => {
      const establishment = new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder(establishmentEmailWithSiret)
            .withContactMode("EMAIL")
            .build(),
        )
        .withOffers([immersionOffer])
        .withUserRights(userRights)
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishment,
      ];

      const params: CreateDiscussionDto = {
        ...validPhoneRequest,
        contactMode: "IN_PERSON",
      };

      await expectPromiseToFailWithError(
        contactEstablishment.execute(params),
        errors.establishment.contactRequestContactModeMismatch({
          siret: establishment.establishment.siret,
          contactModes: {
            inParams: params.contactMode,
            inRepo: establishment.establishment.contactMode,
          },
        }),
      );
    });

    it("throws NotFoundError when no establishments found with given siret", async () => {
      await expectPromiseToFailWithError(
        contactEstablishment.execute({
          ...validPhoneRequest,
          contactMode: "PHONE",
        }),
        errors.establishment.notFound({ siret: validPhoneRequest.siret }),
      );
    });

    it("throws BadRequestError when no offers found in establishment with given appellationCode", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder(establishmentEmailWithSiret)
              .withContactMode("PHONE")
              .build(),
          )
          .withUserRights(userRights)
          .withOffers([
            new OfferEntityBuilder().withAppellationCode("wrong").build(),
          ])
          .build(),
      ];

      await expectPromiseToFailWithError(
        contactEstablishment.execute({
          ...validPhoneRequest,
          contactMode: "PHONE",
        }),
        errors.establishment.offerMissing({
          appellationCode: validPhoneRequest.appellationCode,
          siret: validPhoneRequest.siret,
          mode: "bad request",
        }),
      );
    });

    it("throws ForbidenError when establishment is not currently available", async () => {
      const establishmentAggregate = new EstablishmentAggregateBuilder(
        establishmentAggregateWithEmail,
      )
        .withIsMaxDiscussionsForPeriodReached(false)
        .withMaxContactsPerMonth(2)
        .withEstablishmentNextAvailabilityDate(addHours(timeGateway.now(), 1))
        .withOffers([immersionOffer])
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate,
      ];

      await expectPromiseToFailWithError(
        contactEstablishment.execute({
          ...validEmailRequest,
        }),
        errors.establishment.forbiddenUnavailable({
          siret: validEmailRequest.siret,
        }),
      );
    });

    it("throws ForbidenError when establishment is not currently available", async () => {
      const establishmentAggregate = new EstablishmentAggregateBuilder(
        establishmentAggregateWithEmail,
      )
        .withIsMaxDiscussionsForPeriodReached(true)
        .withOffers([immersionOffer])
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate,
      ];

      await expectPromiseToFailWithError(
        contactEstablishment.execute({
          ...validEmailRequest,
        }),
        errors.establishment.forbiddenUnavailable({
          siret: validEmailRequest.siret,
        }),
      );
    });

    it("throw ForbiddenError when establishment is banned", async () => {
      const banEstablishmentPayload: BanEstablishmentPayload = {
        siret: establishmentAggregateWithEmail.establishment.siret,
        establishmentBannishmentJustification:
          "L'entreprise a délocalisé sa production hors de Pont-Labbé",
      };
      const establishmentAggregate = new EstablishmentAggregateBuilder(
        establishmentAggregateWithEmail,
      )
        .withOffers([immersionOffer])
        .withBannishmentInformations({
          isEstablishmentBanned: true,
          establishmentBannishmentJustification:
            banEstablishmentPayload.establishmentBannishmentJustification,
        })
        .build();

      uow.bannedEstablishmentRepository.bannedEstablishments = [
        banEstablishmentPayload,
      ];
      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate,
      ];

      await expectPromiseToFailWithError(
        contactEstablishment.execute({
          ...validEmailRequest,
        }),
        errors.establishment.bannedEstablishment({
          siret: validEmailRequest.siret,
        }),
      );
    });
  });
});
