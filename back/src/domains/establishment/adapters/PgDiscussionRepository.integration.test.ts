import { addDays, addHours, subDays, subMonths } from "date-fns";
import type { Pool } from "pg";
import {
  type AppellationAndRomeDto,
  type ContactMode,
  DiscussionBuilder,
  type DiscussionDto,
  type DiscussionInList,
  discussionToExchangesData,
  type Exchange,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type ImmersionObjective,
  type SpecificExchangeSender,
  UserBuilder,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { phoneNumberExist } from "../../core/phone-number/adapters/pgPhoneHelper";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  EstablishmentAggregateBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import type { HasDiscussionMatchingParams } from "../ports/DiscussionRepository";
import {
  type DiscussionsStat,
  PgDiscussionRepository,
} from "./PgDiscussionRepository";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";

describe("PgDiscussionRepository", () => {
  const styliste: AppellationAndRomeDto = {
    romeCode: "B1805",
    romeLabel: "Stylisme",
    appellationCode: "19540",
    appellationLabel: "Styliste",
  };
  const secretariat: AppellationAndRomeDto = {
    romeCode: "M1607",
    romeLabel: "Secrétariat",
    appellationCode: "19364",
    appellationLabel: "Secrétaire",
  };

  const stylisteOffer = new OfferEntityBuilder()
    .withRomeCode(styliste.romeCode)
    .withAppellationCode(styliste.appellationCode)
    .withAppellationLabel(styliste.appellationLabel)
    .build();

  const secretariatOffer = new OfferEntityBuilder()
    .withRomeCode(secretariat.romeCode)
    .withAppellationCode(secretariat.appellationCode)
    .withAppellationLabel(secretariat.appellationLabel)
    .build();

  const date = new Date("2023-07-07");

  let pool: Pool;
  let pgDiscussionRepository: PgDiscussionRepository;
  let establishmentAggregateRepo: PgEstablishmentAggregateRepository;
  let db: KyselyDb;

  const user = new UserBuilder()
    .withId(new UuidV4Generator().new())
    .withEmail("user@test.com")
    .build();

  const bothPotentialBeneficiaryAndEstablishmentUser = new UserBuilder()
    .withId(new UuidV4Generator().new())
    .withEmail("both-potential-beneficiary-and-establishment-user@test.com")
    .build();

  const pendingUser = new UserBuilder()
    .withId(new UuidV4Generator().new())
    .withEmail("pending-user@test.com")
    .build();

  beforeAll(async () => {
    pool = makeTestPgPool();
  });

  beforeEach(async () => {
    db = makeKyselyDb(pool);
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("discussions").execute();
    await db.deleteFrom("discussions_archives").execute();
    await db.deleteFrom("exchanges").execute();
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("users").execute();
    await db.deleteFrom("banned_establishments").execute();

    pgDiscussionRepository = new PgDiscussionRepository(db);
    establishmentAggregateRepo = new PgEstablishmentAggregateRepository(db);

    const userRepo = new PgUserRepository(db);
    await userRepo.save(user);
    await userRepo.save(bothPotentialBeneficiaryAndEstablishmentUser);
    await userRepo.save(pendingUser);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("commands", () => {
    describe("insert/update/getById", () => {
      describe("insert", () => {
        const tests: { discussion: DiscussionDto; title: string }[] = [
          {
            title: "insert with acquisitionCampaign and acquisitionKeyword",
            discussion: new DiscussionBuilder()
              .withAcquisition({
                acquisitionCampaign: "campagne",
                acquisitionKeyword: "mot-clé",
              })
              .build(),
          },
          {
            title: "insert with status and conventionId",
            discussion: new DiscussionBuilder()
              .withStatus({ status: "ACCEPTED", candidateWarnedMethod: null })
              .withConventionId("some-convention-id")
              .build(),
          },
          {
            title: "insert with more exchanges cases",
            discussion: new DiscussionBuilder()
              .withStatus({ status: "ACCEPTED", candidateWarnedMethod: null })
              .withExchanges([
                {
                  sender: "potentialBeneficiary",
                  message: "TEST message",
                  subject: "Subject",
                  attachments: [],
                  sentAt: subDays(new Date(), 10).toISOString(),
                },
                {
                  sender: "establishment",
                  message: "",
                  subject: "",
                  firstname: "",
                  lastname: "",
                  email: "",
                  attachments: [],
                  sentAt: subDays(new Date(), 9).toISOString(),
                },
                {
                  sender: "potentialBeneficiary",
                  message: "",
                  subject: "",
                  attachments: [],
                  sentAt: subDays(new Date(), 8).toISOString(),
                },
                {
                  sender: "establishment",
                  message: `Ignosco necessario alicuius fuisse aliquid hac iudices si est si humanissimo Atratino est necessitati acerbo
                  sed humanissimo Si volueritis aetatis quemquam intolerabili intolerabili est etiam vel qui nec utrum Sed qui
                  est aliquid necessitati ego vellet ignoscendum spei intolerabili tribuo vel necessario pueritiae volueritis 
                  aliquid odio de iudices tribuo ego cum causa cui Si Sed constituetis iussus fuisse speravit habiturum habet 
                  volueritis vel modo de iussus ignosco necessitati vere habiturum necessario ad utrum resistendum voluit vel 
                  liceret intolerabili volueritis si fuisse volueritis causa sic alicuius nisi optimo utrum Ceteris qui vel 
                  necessario tribuo existimare accusare existimare vel hac meo descendisset.`,
                  subject: "ESTABLISHMENT LARGE subject",
                  firstname: "Nilly",
                  lastname: "Nyolo",
                  email: "sdmlkdif@mail.com",
                  attachments: [
                    {
                      link: "http://www.google.fr",
                      name: "Billy.doc",
                    },
                    {
                      link: "http://www.kiki.fr",
                      name: "POTO.pdf",
                    },
                  ],
                  sentAt: subDays(new Date(), 7).toISOString(),
                },
                {
                  sender: "potentialBeneficiary",
                  message: `Est post mercenariae nomine incredibile sexus incredibile ardore discessura statum hastam est discessura 
                  semper ut marito in tabernaculum illis quo apud statum id est semper si dotis est futura eos mercenariae conductae 
                  sexus si in statum offert fuga conductae semper et ardore illis illis in est nomine fuga apud apud in nomine solvitur 
                  id atque eos elegerit atque marito incredibile ardore ut marito offert quo sexus mercenariae est apud in est ardore 
                  post coniunx post matrimonii est diem est conductae solvitur species in incredibile futura venerem offert tempus 
                  species id atque futura tabernaculum venerem mercenariae uxoresque in pacto statum id.`,
                  subject: "Beneficiary LOARGE SUBJECTTTSDD",
                  attachments: [],
                  sentAt: subDays(new Date(), 6).toISOString(),
                },
              ])
              .build(),
          },
          {
            title: "insert with kind IF and contact mode EMAIL",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("IF")
              .withContactMode("EMAIL")
              .build(),
          },
          {
            title:
              "insert with kind IF and contact mode EMAIL and empty datePreference",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("IF")
              .withContactMode("EMAIL")
              .withDatePreference("")
              .build(),
          },
          {
            title: "insert with kind IF and contact mode PHONE",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("IF")
              .withContactMode("PHONE")
              .withExchanges([])
              .build(),
          },
          {
            title: "insert with kind IF and contact mode IN_PERSON",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("IF")
              .withContactMode("IN_PERSON")
              .withExchanges([])
              .build(),
          },
          {
            title: "insert with kind 1_ELEVE_1_STAGE and contact mode EMAIL",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("1_ELEVE_1_STAGE")
              .withContactMode("EMAIL")
              .build(),
          },
          {
            title: "insert with kind 1_ELEVE_1_STAGE and contact mode PHONE",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("1_ELEVE_1_STAGE")
              .withContactMode("PHONE")
              .withExchanges([])
              .build(),
          },
          {
            title:
              "insert with kind 1_ELEVE_1_STAGE and contact mode IN_PERSON",
            discussion: new DiscussionBuilder()
              .withDiscussionKind("1_ELEVE_1_STAGE")
              .withContactMode("IN_PERSON")
              .withExchanges([])
              .build(),
          },
        ];
        it.each(tests)("$title", async ({ discussion }) => {
          await pgDiscussionRepository.insert(discussion);

          expectToEqual(
            await pgDiscussionRepository.getById(discussion.id),
            discussion,
          );
        });
      });

      describe("update", () => {
        it("update with status REJECTED, conventionId and a candidate warn method", async () => {
          const siret = "01234567891011";
          const discussion = new DiscussionBuilder()
            .withSiret(siret)
            .withCreatedAt(new Date("2023-07-07"))
            .withStatus({ status: "PENDING" })
            .build();

          await pgDiscussionRepository.insert(discussion);

          const updatedDiscussion = new DiscussionBuilder(discussion)
            .withStatus({
              status: "REJECTED",
              rejectionKind: "CANDIDATE_ALREADY_WARNED",
              candidateWarnedMethod: "phone",
            })
            .withConventionId("some-other-convention-id")
            .build();

          await pgDiscussionRepository.update(updatedDiscussion);

          expectToEqual(
            await db
              .selectFrom("discussions")
              .select([
                "status",
                "convention_id",
                "rejection_kind",
                "candidate_warned_method",
              ])
              .executeTakeFirst(),
            {
              status: "REJECTED",
              convention_id: "some-other-convention-id",
              rejection_kind: "CANDIDATE_ALREADY_WARNED",
              candidate_warned_method: "phone",
            },
          );
        });

        it("update with status REJECTED with reason", async () => {
          const siret = "01234567891011";
          const discussion = new DiscussionBuilder()
            .withSiret(siret)
            .withCreatedAt(new Date("2023-07-07"))
            .withStatus({ status: "PENDING" })
            .build();

          await pgDiscussionRepository.insert(discussion);

          const updatedDiscussion = new DiscussionBuilder(discussion)
            .withStatus({
              status: "REJECTED",
              rejectionKind: "OTHER",
              rejectionReason: "my custom reason",
            })
            .build();

          await pgDiscussionRepository.update(updatedDiscussion);

          expectToEqual(
            await db
              .selectFrom("discussions")
              .select(["status", "rejection_reason"])
              .executeTakeFirst(),
            {
              status: "REJECTED",
              rejection_reason: "my custom reason",
            },
          );
        });

        it("update with status ACCEPTED", async () => {
          const siret = "01234567891011";
          const discussion = new DiscussionBuilder()
            .withSiret(siret)
            .withCreatedAt(new Date("2023-07-07"))
            .withStatus({ status: "PENDING" })
            .build();

          await pgDiscussionRepository.insert(discussion);

          const updatedDiscussion = new DiscussionBuilder(discussion)
            .withStatus({ status: "ACCEPTED", candidateWarnedMethod: null })
            .build();

          await pgDiscussionRepository.update(updatedDiscussion);

          expectToEqual(
            await db
              .selectFrom("discussions")
              .select(["status"])
              .executeTakeFirst(),
            {
              status: "ACCEPTED",
            },
          );
        });

        it("update with new phone number", async () => {
          const siret = "01234567891011";
          const phoneNumber = "+33606060606";

          const discussion = new DiscussionBuilder()
            .withSiret(siret)
            .withCreatedAt(new Date("2023-07-07"))
            .withStatus({ status: "PENDING" })
            .withPotentialBeneficiaryEmail(phoneNumber)
            .build();

          await pgDiscussionRepository.insert(discussion);

          const updatedPhoneNumber = "+33606060607";
          const updatedDiscussion = new DiscussionBuilder(discussion)
            .withPotentialBeneficiaryPhone(updatedPhoneNumber)
            .build();

          await pgDiscussionRepository.update(updatedDiscussion);

          expectToEqual(
            await pgDiscussionRepository.getById(discussion.id),
            updatedDiscussion,
          );

          expect(
            await phoneNumberExist(db, discussion.potentialBeneficiary.phone),
          ).toBe(true);
        });
      });

      it("getById undefined when there is no discussion", async () => {
        expectToEqual(await pgDiscussionRepository.getById(uuid()), undefined);
      });

      it("getById returns isEstablishmentBanned: false when establishment is not banned", async () => {
        const discussion = new DiscussionBuilder()
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120098")
          .withSiret("11112222333300")
          .build();

        await pgDiscussionRepository.insert(discussion);

        expectToEqual(await pgDiscussionRepository.getById(discussion.id), {
          ...discussion,
          isEstablishmentBanned: false,
        });
      });

      it("getById fills isEstablishmentBanned and establishmentBannishmentJustification when establishment is banned", async () => {
        const siret = "11112222333300";
        const bannishmentJustification = "Fraude détectée lors d'un contrôle";
        const discussion = new DiscussionBuilder()
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120099")
          .withSiret(siret)
          .build();

        await pgDiscussionRepository.insert(discussion);
        await db
          .insertInto("banned_establishments")
          .values({
            siret,
            bannishment_justification: bannishmentJustification,
          })
          .execute();

        expectToEqual(await pgDiscussionRepository.getById(discussion.id), {
          ...discussion,
          isEstablishmentBanned: true,
          establishmentBannishmentJustification: bannishmentJustification,
        });
      });
    });

    describe("deleteOldMessages", () => {
      it("Deletes messages from old discussions", async () => {
        const siret = "12212222333344";
        const since = new Date("2023-03-05");

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret)
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .withOffers([stylisteOffer])
            .build(),
        );

        const discussionWithRecentExchange = new DiscussionBuilder()
          .withSiret(siret)
          .withId("bcbbbd2c-6f02-11ec-90d6-0242ac120104")
          .withCreatedAt(new Date("2023-11-11"))
          .withExchanges([
            {
              subject: "mon nouveau sujet",
              message: "mon nouveau message",
              sentAt: new Date("2023-11-11").toISOString(),
              sender: "establishment",
              email: "",
              firstname: "",
              lastname: "",
              attachments: [],
            },
          ])
          .build();

        const discussionWithOldExchange = new DiscussionBuilder()
          .withSiret(siret)
          .withId("bcbbbd2c-6f02-11ec-90d6-0242ac120103")
          .withCreatedAt(new Date("2022-11-11"))
          .withExchanges([
            {
              subject: "mon nouveau sujet",
              message: "mon nouveau message",
              sentAt: new Date("2022-11-11").toISOString(),
              sender: "establishment",
              email: "",
              firstname: "",
              lastname: "",
              attachments: [
                {
                  link: "dlskfjsdmlfsdmlfjsdmlfj",
                  name: "pj",
                },
              ],
            },
          ])
          .build();

        await Promise.all([
          pgDiscussionRepository.insert(discussionWithRecentExchange),
          pgDiscussionRepository.insert(discussionWithOldExchange),
        ]);

        const numberOfUpdatedMessages =
          await pgDiscussionRepository.deleteOldMessages(since);

        expectToEqual(numberOfUpdatedMessages, 1);

        expectToEqual(
          await pgDiscussionRepository.getById(discussionWithRecentExchange.id),
          discussionWithRecentExchange,
        );

        expectToEqual(
          await pgDiscussionRepository.getById(discussionWithOldExchange.id),
          new DiscussionBuilder(discussionWithOldExchange)
            .withExchanges([
              {
                ...discussionWithOldExchange.exchanges[0],
                message: "Supprimé car trop ancien",
                attachments: [],
              },
            ])
            .build(),
        );
      });
    });

    describe("archiveDiscussions", () => {
      const createDate = "2023-02-14";
      const createdAt = new Date(`${createDate}T00:00:00`);
      const acceptedDiscussion = new DiscussionBuilder()
        .withId(uuid())
        .withCreatedAt(createdAt)
        .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "email" })
        .withUpdatedAt(new Date("2025-01-01"))
        .build();
      const pendingDiscussion = new DiscussionBuilder()
        .withId(uuid())
        .withCreatedAt(createdAt)
        .withStatus({ status: "PENDING" })
        .withUpdatedAt(new Date("2025-01-02"))
        .build();
      const rejectedDiscussion = new DiscussionBuilder()
        .withId(uuid())
        .withCreatedAt(createdAt)
        .withStatus({
          status: "REJECTED",
          candidateWarnedMethod: "email",
          rejectionKind: "CANDIDATE_ALREADY_WARNED",
        })
        .withUpdatedAt(new Date("2025-01-03"))
        .build();

      it("when no discussion ids, do nothing", async () => {
        await insertDiscussions(pgDiscussionRepository, [
          acceptedDiscussion,
          pendingDiscussion,
          rejectedDiscussion,
        ]);

        const initialStats: DiscussionsStat[] = [
          {
            appellation_code: 10245,
            candidate_firstname: "billy",
            contact_method: "email",
            creation_date: "2025-10-02",
            department_code: "95",
            discussions_answered_by_establishment: 44,
            discussions_total: 0,
            discussions_with_convention: 0,
            immersion_objective: "Confirmer un projet professionnel",
            kind: "1_ELEVE_1_STAGE",
            siret: "12345678901234",
            status: "ACCEPTED",
          },
        ];
        await pgDiscussionRepository.__test_setDiscussionsStats(initialStats);

        await pgDiscussionRepository.archiveDiscussions([]);

        expectToEqual(await pgDiscussionRepository.__test_getAllDiscussions(), [
          rejectedDiscussion,
          pendingDiscussion,
          acceptedDiscussion,
        ]);

        expectToEqual(
          await pgDiscussionRepository.__test_getDiscussionsStats(),
          initialStats,
        );
      });

      describe("discussion deletion process", () => {
        it("when id provided and discussion exist, the discussion does not exist anymore", async () => {
          await insertDiscussions(pgDiscussionRepository, [
            acceptedDiscussion,
            pendingDiscussion,
            rejectedDiscussion,
          ]);

          await pgDiscussionRepository.archiveDiscussions([
            acceptedDiscussion.id,
          ]);
          expectToEqual(
            await pgDiscussionRepository.__test_getAllDiscussions(),
            [rejectedDiscussion, pendingDiscussion],
          );
        });

        it("when ids provided and discussions exist, discussions do not exist anymore", async () => {
          await insertDiscussions(pgDiscussionRepository, [
            acceptedDiscussion,
            pendingDiscussion,
            rejectedDiscussion,
          ]);

          await pgDiscussionRepository.archiveDiscussions([
            acceptedDiscussion.id,
            pendingDiscussion.id,
          ]);
          expectToEqual(
            await pgDiscussionRepository.__test_getAllDiscussions(),
            [rejectedDiscussion],
          );
        });

        it("when ids provided and discussions not exist, throw an error", async () => {
          const missingDiscussionId = acceptedDiscussion.id;

          await expectPromiseToFailWithError(
            pgDiscussionRepository.archiveDiscussions([missingDiscussionId]),
            errors.discussion.missingNotDeleted([missingDiscussionId]),
          );
        });

        it("when ids provided and one discussion doesn't exist, throw an error", async () => {
          const missingDiscussionId = acceptedDiscussion.id;

          await insertDiscussions(pgDiscussionRepository, [rejectedDiscussion]);

          await expectPromiseToFailWithError(
            pgDiscussionRepository.archiveDiscussions([
              missingDiscussionId,
              rejectedDiscussion.id,
            ]),
            errors.discussion.missingNotDeleted([missingDiscussionId]),
          );
        });
      });

      describe("discussion archiving process", () => {
        const exchangeFromEstablishment: Exchange = {
          email: "",
          firstname: "",
          lastname: "",
          sender: "establishment",
          message: "",
          subject: "",
          sentAt: new Date().toISOString(),
          attachments: [],
        };
        it("Add or update lines of stats based on status aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            acceptedDiscussion,
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withConventionId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
            pendingDiscussion,
            new DiscussionBuilder(pendingDiscussion)
              .withId(uuid())
              .withConventionId(uuid())
              .withExchanges([
                ...pendingDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
            rejectedDiscussion,
            new DiscussionBuilder(rejectedDiscussion)
              .withId(uuid())
              .withConventionId(uuid())
              .withExchanges([
                ...rejectedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
            new DiscussionBuilder(rejectedDiscussion)
              .withId(uuid())
              .withConventionId(uuid())
              .withExchanges([
                ...rejectedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                siret: acceptedDiscussion.siret,
                discussions_total: 4,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
                status: "ACCEPTED",
              },
              {
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                siret: acceptedDiscussion.siret,
                discussions_total: 2,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
                status: "PENDING",
              },
              {
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                siret: acceptedDiscussion.siret,
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
                status: "REJECTED",
              },
            ],
          );
        });

        it("Add or update lines of stats based on appellationCode aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withAppellationCode("38745")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withAppellationCode("20686")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                appellation_code: 11704,
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                appellation_code: 38745,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                appellation_code: 20686,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                appellation_code,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                appellation_code,
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                siret: acceptedDiscussion.siret,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
                status: acceptedDiscussion.status,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on siret aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withSiret("77777777777777")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withSiret("88888888888888")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                siret: "12345671234567",
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                siret: "77777777777777",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                siret: "88888888888888",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                siret,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
                status: acceptedDiscussion.status,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on candidate_firstname aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withPotentialBeneficiaryFirstname("Billy Joel")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withPotentialBeneficiaryFirstname("Warren-Bite")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                candidate_firstname: "ali",
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                candidate_firstname: "billy joel",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                candidate_firstname: "warren-bite",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                candidate_firstname,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname,
                contact_method: acceptedDiscussion.contactMode,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
                status: acceptedDiscussion.status,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on contact_method aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withContactMode("IN_PERSON")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withContactMode("PHONE")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                contact_method: "EMAIL",
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                contact_method: "IN_PERSON",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                contact_method: "PHONE",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                contact_method,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                contact_method,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
                status: acceptedDiscussion.status,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on department_code aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withAddress({
                city: "Roulans",
                departmentCode: "25",
                postcode: "25640",
                streetNumberAndAddress: "34 Grande Rue",
              })
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withAddress({
                city: "Montval-sur-Loir",
                departmentCode: "72",
                postcode: "72500",
                streetNumberAndAddress: "11 Pl. des Halles",
              })
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                department_code: "75",
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                department_code: "25",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                department_code: "72",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                department_code,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                department_code,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                creation_date: createDate,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on creation_date aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withCreatedAt(new Date("2025-01-02T00:00:00"))
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withCreatedAt(new Date("2025-07-03T00:00:00"))
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                creation_date: "2023-02-14",
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                creation_date: "2025-01-02",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                creation_date: "2025-07-03",
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ].map(
              ({
                creation_date,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }) => ({
                creation_date,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                immersion_objective:
                  acceptedDiscussion.potentialBeneficiary.immersionObjective,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total,
                discussions_answered_by_establishment,
                discussions_with_convention,
              }),
            ),
          );
        });

        it("Add or update lines of stats based on immersion_objective aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withImmersionObjective("Confirmer un projet professionnel")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withImmersionObjective(
                "Découvrir un métier ou un secteur d'activité",
              )
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withImmersionObjective("Initier une démarche de recrutement")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withImmersionObjective(null)
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                acceptedDiscussion.potentialBeneficiary.immersionObjective,
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                immersion_objective: "Confirmer un projet professionnel",
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                immersion_objective:
                  "Découvrir un métier ou un secteur d'activité",
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
              {
                immersion_objective: "Initier une démarche de recrutement",
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
              {
                immersion_objective: null,
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: acceptedDiscussion.kind,
                status: acceptedDiscussion.status,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 0,
              },
            ],
          );
        });

        it("Add or update lines of stats based on kind aggregation criteria with incrementing discussions qtys", async () => {
          const discussions = [
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withDiscussionKind("IF")
              .withImmersionObjective(
                "Découvrir un métier ou un secteur d'activité",
              )
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
            new DiscussionBuilder(acceptedDiscussion)
              .withId(uuid())
              .withDiscussionKind("1_ELEVE_1_STAGE")
              .withExchanges([
                ...acceptedDiscussion.exchanges,
                exchangeFromEstablishment,
              ])
              .withConventionId(uuid())
              .build(),
          ];

          await insertDiscussions(pgDiscussionRepository, discussions);
          await pgDiscussionRepository.__test_setDiscussionsStats([
            {
              appellation_code: Number(acceptedDiscussion.appellationCode),
              candidate_firstname:
                acceptedDiscussion.potentialBeneficiary.firstName,
              contact_method: acceptedDiscussion.contactMode,
              creation_date: createDate,
              department_code: acceptedDiscussion.address.departmentCode,
              immersion_objective:
                "Découvrir un métier ou un secteur d'activité",
              kind: acceptedDiscussion.kind,
              siret: acceptedDiscussion.siret,
              status: acceptedDiscussion.status,
              discussions_total: 2,
              discussions_answered_by_establishment: 1,
              discussions_with_convention: 1,
            },
          ]);

          await pgDiscussionRepository.archiveDiscussions(
            discussions.map(({ id }) => id),
          );

          expectToEqual(
            await pgDiscussionRepository.__test_getDiscussionsStats(),
            [
              {
                immersion_objective:
                  "Découvrir un métier ou un secteur d'activité",
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: "IF",
                status: acceptedDiscussion.status,
                discussions_total: 3,
                discussions_answered_by_establishment: 2,
                discussions_with_convention: 2,
              },
              {
                immersion_objective:
                  "Découvrir un métier ou un secteur d'activité",
                creation_date: createDate,
                department_code: acceptedDiscussion.address.departmentCode,
                contact_method: acceptedDiscussion.contactMode,
                siret: acceptedDiscussion.siret,
                appellation_code: Number(acceptedDiscussion.appellationCode),
                candidate_firstname:
                  acceptedDiscussion.potentialBeneficiary.firstName,
                kind: "1_ELEVE_1_STAGE",
                status: acceptedDiscussion.status,
                discussions_total: 1,
                discussions_answered_by_establishment: 1,
                discussions_with_convention: 1,
              },
            ],
          );
        });
      });
    });
  });

  describe("queries", () => {
    describe("getDiscussionIds", () => {
      const pendingDiscussionUpdated20230101 = new DiscussionBuilder()
        .withId(uuid())
        .withStatus({ status: "PENDING" })
        .withUpdatedAt(new Date("2023-01-01"))
        .build();
      const acceptedDiscussionUpdated20230102 = new DiscussionBuilder()
        .withId(uuid())
        .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "email" })
        .withUpdatedAt(new Date("2023-01-02"))
        .build();
      const acceptedDiscussionUpdated20240101 = new DiscussionBuilder()
        .withId(uuid())
        .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "email" })
        .withUpdatedAt(new Date("2024-01-01"))
        .build();
      const rejectedDiscussionUpdated20250101 = new DiscussionBuilder()
        .withId(uuid())
        .withStatus({ status: "REJECTED", rejectionKind: "DEPRECATED" })
        .withUpdatedAt(new Date("2025-01-01"))
        .build();

      beforeEach(async () => {
        await pgDiscussionRepository.insert(pendingDiscussionUpdated20230101);
        await pgDiscussionRepository.insert(acceptedDiscussionUpdated20230102);
        await pgDiscussionRepository.insert(acceptedDiscussionUpdated20240101);
        await pgDiscussionRepository.insert(rejectedDiscussionUpdated20250101);
      });

      describe("unit filter param & limit", () => {
        describe("statuses filter", () => {
          it("when no statuses filter, get all discussions", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  statuses: [],
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [
                pendingDiscussionUpdated20230101.id,
                acceptedDiscussionUpdated20230102.id,
                acceptedDiscussionUpdated20240101.id,
                rejectedDiscussionUpdated20250101.id,
              ],
            );
          });

          it("when statuses PENDING only, get pending discussions", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  statuses: ["PENDING"],
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [pendingDiscussionUpdated20230101.id],
            );
          });

          it("when statuses REJECTED and ACCEPTED only, get rejected and accepted discussions", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  statuses: ["REJECTED", "ACCEPTED"],
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [
                acceptedDiscussionUpdated20230102.id,
                acceptedDiscussionUpdated20240101.id,
                rejectedDiscussionUpdated20250101.id,
              ],
            );
          });
        });

        describe("updatedBetween filter", () => {
          it("when no updatedBetween filter, get all discussions", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: {},
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [
                pendingDiscussionUpdated20230101.id,
                acceptedDiscussionUpdated20230102.id,
                acceptedDiscussionUpdated20240101.id,
                rejectedDiscussionUpdated20250101.id,
              ],
            );
          });

          it("when updatedBetween filter with to 2023-12-31, get only discussions with updateDate before 2023-12-31", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: { to: new Date("2023-12-31") },
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [
                pendingDiscussionUpdated20230101.id,
                acceptedDiscussionUpdated20230102.id,
              ],
            );
          });

          it("when updatedBetween filter with from 2024-01-01, get only discussions with updateDate after 2024-01-01", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: { from: new Date("2024-01-01") },
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [
                acceptedDiscussionUpdated20240101.id,
                rejectedDiscussionUpdated20250101.id,
              ],
            );
          });

          it("when updatedBetween filter with from 2024-01-01 and to 2024-12-31, get only discussions with updateDate from 2024-01-01 and to 2024-12-31", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: {
                    from: new Date("2024-01-01"),
                    to: new Date("2024-12-31"),
                  },
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [acceptedDiscussionUpdated20240101.id],
            );
          });

          it("when updatedBetween filter with from 2024-01-02 and to 2024-12-31, get not discussions with updateDate from 2024-01-02 and to 2024-12-31", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: {
                    from: new Date("2024-01-02"),
                    to: new Date("2024-12-31"),
                  },
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              [],
            );
          });

          it("when updatedBetween filter with to 2023-12-31 and from 2025-01-01, throw badDateRange error", async () => {
            const range = {
              to: new Date("2023-12-31"),
              from: new Date("2025-01-01"),
            };

            await expectPromiseToFailWithError(
              pgDiscussionRepository.getDiscussionIds({
                filters: {
                  updatedBetween: range,
                },
                orderBy: "updatedAt",
                limit: 5,
              }),
              errors.generic.badDateRange(range),
            );
          });
        });

        describe("limit param", () => {
          it("when limit param is 2, get 2 discussions", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussionIds({
                filters: {},
                orderBy: "updatedAt",
                limit: 2,
              }),
              [
                pendingDiscussionUpdated20230101.id,
                acceptedDiscussionUpdated20230102.id,
              ],
            );
          });

          it.each([
            10_001, 1.01, 0, -1,
          ])("when limit param %s, throws an error", async (limit) => {
            await expectPromiseToFailWithError(
              pgDiscussionRepository.getDiscussionIds({
                filters: {},
                orderBy: "updatedAt",
                limit,
              }),
              errors.generic.unsupportedLimit(limit),
            );
          });
        });
      });

      describe("combo filters & limit param", () => {
        it("get discussions accepted and updated between 2023-11-01 and 2024-01-31", async () => {
          expectToEqual(
            await pgDiscussionRepository.getDiscussionIds({
              filters: {
                statuses: ["ACCEPTED"],
                updatedBetween: {
                  from: new Date("2023-11-01"),
                  to: new Date("2024-01-31"),
                },
              },
              orderBy: "updatedAt",
              limit: 2,
            }),
            [acceptedDiscussionUpdated20240101.id],
          );
        });

        it("get discussions rejected/pending and updated between 2023-01-01 and 2025-12-31, with limit 5", async () => {
          expectToEqual(
            await pgDiscussionRepository.getDiscussionIds({
              filters: {
                statuses: ["REJECTED", "PENDING"],
                updatedBetween: {
                  from: new Date("2023-01-01"),
                  to: new Date("2025-12-31"),
                },
              },
              orderBy: "updatedAt",
              limit: 5,
            }),
            [
              pendingDiscussionUpdated20230101.id,
              rejectedDiscussionUpdated20250101.id,
            ],
          );
        });

        it("get discussions rejected/pending and updated between 2023-01-01 and 2025-12-31, with limit 1", async () => {
          expectToEqual(
            await pgDiscussionRepository.getDiscussionIds({
              filters: {
                statuses: ["REJECTED", "PENDING"],
                updatedBetween: {
                  from: new Date("2023-01-01"),
                  to: new Date("2025-12-31"),
                },
              },
              orderBy: "updatedAt",
              limit: 1,
            }),
            [pendingDiscussionUpdated20230101.id],
          );
        });
      });
    });

    describe("getDiscussions", () => {
      describe("unit filter param", () => {
        describe("siret filter param", () => {
          const discussionWithSiret1 = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-01-01"))
            .withSiret("00000000000001")
            .build();
          const discussionWithSiret2 = new DiscussionBuilder(
            discussionWithSiret1,
          )
            .withId(uuid())
            .withCreatedAt(new Date("2024-01-02"))
            .build();
          const discussionWithoutSiret = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-01-03"))
            .withSiret("00000000000002")
            .build();
          beforeEach(async () => {
            await pgDiscussionRepository.insert(discussionWithSiret1);
            await pgDiscussionRepository.insert(discussionWithSiret2);
            await pgDiscussionRepository.insert(discussionWithoutSiret);
          });

          it("exclude discussion that do not have siret in filter", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  sirets: [discussionWithSiret1.siret],
                },
                limit: 5,
              }),
              [discussionWithSiret2, discussionWithSiret1],
            );
          });

          it("include all discussions that have sirets in filter", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  sirets: [
                    discussionWithSiret1.siret,
                    discussionWithoutSiret.siret,
                  ],
                },
                limit: 5,
              }),
              [
                discussionWithoutSiret,
                discussionWithSiret2,
                discussionWithSiret1,
              ],
            );
          });

          it("exclude all discussions if siret in filter does not match any discussion siret", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  sirets: ["99999999999999"],
                },
                limit: 5,
              }),
              [],
            );
          });

          it("throws if siret filter is provided but empty", async () => {
            await expectPromiseToFailWithError(
              pgDiscussionRepository.getDiscussions({
                filters: {
                  sirets: [],
                },
                limit: 5,
              }),
              errors.discussion.badSiretFilter(),
            );
          });
        });

        describe("contactMode filter param", () => {
          const discussionWithContactModeEmail1 = new DiscussionBuilder()
            .withId("83c91c93-deda-4c4b-9b8d-ed1825ee62d9")
            .withContactMode("EMAIL")
            .build();
          const discussionWithContactModeEmail2 = new DiscussionBuilder()
            .withId("958e4ce1-0ed6-4b2c-803b-fa297206ad3a")
            .withContactMode("EMAIL")
            .build();
          const discussionWithContactModeInPerson = new DiscussionBuilder()
            .withId("af11e307-b798-4d8c-9c7d-af5c1f527457")
            .withContactMode("IN_PERSON")
            .build();

          beforeEach(async () => {
            await pgDiscussionRepository.insert(
              discussionWithContactModeEmail1,
            );
            await pgDiscussionRepository.insert(
              discussionWithContactModeEmail2,
            );
            await pgDiscussionRepository.insert(
              discussionWithContactModeInPerson,
            );
          });

          it.each([
            {
              title: "include discussions that have contact mode by email",
              contactMode: "EMAIL",
              expectedDiscussions: [
                discussionWithContactModeEmail1,
                discussionWithContactModeEmail2,
              ],
            },
            {
              title: "include discussions that have contact mode in person",
              contactMode: "IN_PERSON",
              expectedDiscussions: [discussionWithContactModeInPerson],
            },
            {
              title:
                "exclude all discussions if no discussions with contact mode by phone",
              contactMode: "PHONE",
              expectedDiscussions: [],
            },
          ] satisfies {
            title: string;
            expectedDiscussions: DiscussionDto[];
            contactMode: ContactMode;
          }[])("%title", async ({ contactMode, expectedDiscussions }) => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  contactMode,
                },
                limit: 5,
              }),
              expectedDiscussions,
            );
          });
        });

        describe("createdSince filter param", () => {
          const discussionCreatedSince1 = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-01-01"))
            .build();
          const discussionCreatedSince2 = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-01-02"))
            .build();
          const discussionCreatedBefore = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2023-12-31"))
            .build();

          beforeEach(async () => {
            await pgDiscussionRepository.insert(discussionCreatedSince1);
            await pgDiscussionRepository.insert(discussionCreatedSince2);
            await pgDiscussionRepository.insert(discussionCreatedBefore);
          });

          it("exclude discussions created before", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdSince: new Date(discussionCreatedSince1.createdAt),
                },
                limit: 10,
              }),
              [discussionCreatedSince2, discussionCreatedSince1],
            );
          });
          it("include all discussions if created since date is the creation date of the oldest discussion", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdSince: new Date(discussionCreatedBefore.createdAt),
                },
                limit: 10,
              }),
              [
                discussionCreatedSince2,
                discussionCreatedSince1,
                discussionCreatedBefore,
              ],
            );
          });
          it("exclude all discussions if created since date is after of the most recent discussion", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdSince: new Date("2024-01-03"),
                },
                limit: 10,
              }),
              [],
            );
          });
        });

        describe("createdBetween filter param", () => {
          const discussionCreatedBefore = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-08-01 23:59:59"))
            .build();
          const discussionCreatedBetween1 = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-08-02 00:00:00"))
            .build();
          const discussionCreatedBetween2 = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-08-03 00:00:00"))
            .build();
          const discussionCreatedAfter = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(new Date("2024-08-03 00:00:01"))
            .build();

          beforeEach(async () => {
            await pgDiscussionRepository.insert(discussionCreatedBefore);
            await pgDiscussionRepository.insert(discussionCreatedBetween1);
            await pgDiscussionRepository.insert(discussionCreatedBetween2);
            await pgDiscussionRepository.insert(discussionCreatedAfter);
          });

          it("include discussion with created at exactly of created between ranges", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdBetween: {
                    from: new Date("2024-08-02 00:00:00"),
                    to: new Date("2024-08-03 00:00:00"),
                  },
                },
                limit: 5,
              }),
              [discussionCreatedBetween2, discussionCreatedBetween1],
            );
          });
          it("include discussion with created at very close of created between range", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdBetween: {
                    from: new Date("2024-08-01 23:59:59:999"),
                    to: new Date("2024-08-02 00:00:00:001"),
                  },
                },
                limit: 5,
              }),
              [discussionCreatedBetween1],
            );
          });
          it("exclude all discussions with created between range out of discussions created at", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  createdBetween: {
                    from: new Date("2024-08-03 00:00:01:001"),
                    to: new Date("2024-08-04 00:00:00"),
                  },
                },
                limit: 5,
              }),
              [],
            );
          });
        });

        describe("answeredByEstablishment filter param", () => {
          const discussionNotAnsweredByEstablishment = new DiscussionBuilder()
            .withId(uuid())
            .withExchanges([
              {
                sender: "potentialBeneficiary",
                message: "",
                attachments: [],
                sentAt: new Date().toISOString(),
                subject: "",
              },
            ])
            .build();
          const discussionAnsweredByEstablishment = new DiscussionBuilder()
            .withId(uuid())
            .withExchanges([
              {
                sender: "establishment",
                email: "",
                firstname: "",
                lastname: "",
                message: "",
                attachments: [],
                sentAt: new Date().toISOString(),
                subject: "",
              },
            ])
            .build();

          beforeEach(async () => {
            await pgDiscussionRepository.insert(
              discussionAnsweredByEstablishment,
            );
            await pgDiscussionRepository.insert(
              discussionNotAnsweredByEstablishment,
            );
          });

          it("include only discussions answered by establishment", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  answeredByEstablishment: true,
                },
                limit: 5,
              }),
              [discussionAnsweredByEstablishment],
            );
          });

          it("include only discussions not answered by establishment", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: {
                  answeredByEstablishment: false,
                },
                limit: 5,
              }),
              [discussionNotAnsweredByEstablishment],
            );
          });
        });
        describe("status filter param", () => {
          const discussionWithStatusPending = new DiscussionBuilder()
            .withId(uuid())
            .withStatus({ status: "PENDING" })
            .build();
          const discussionWithStatusAccepted = new DiscussionBuilder()
            .withId(uuid())
            .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "email" })
            .build();
          const discussionWithStatusRejected = new DiscussionBuilder()
            .withId(uuid())
            .withStatus({ status: "REJECTED", rejectionKind: "NO_TIME" })
            .build();

          beforeEach(async () => {
            await pgDiscussionRepository.insert(discussionWithStatusPending);
            await pgDiscussionRepository.insert(discussionWithStatusAccepted);
            await pgDiscussionRepository.insert(discussionWithStatusRejected);
          });

          it("include discussions with status PENDING", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: { status: "PENDING" },
                limit: 5,
              }),
              [discussionWithStatusPending],
            );
          });
          it("include discussions with status ACCEPTED", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: { status: "ACCEPTED" },
                limit: 5,
              }),
              [discussionWithStatusAccepted],
            );
          });
          it("exclude discussions with status REJECTED", async () => {
            expectToEqual(
              await pgDiscussionRepository.getDiscussions({
                filters: { status: "REJECTED" },
                limit: 5,
              }),
              [discussionWithStatusRejected],
            );
          });
        });
      });
      describe("combo filters", () => {
        it("exclude discussions that does not match filters", async () => {
          const sentByBeneficiary: SpecificExchangeSender<"potentialBeneficiary"> =
            {
              sender: "potentialBeneficiary",
            };
          const sentByEstablishment: SpecificExchangeSender<"establishment"> = {
            sender: "establishment",
            email: "mail@mail.com",
            firstname: "billy",
            lastname: "idol",
          };

          const date = new Date("2024-08-02 00:00:00");
          const discussionToMatchWithLotOfExchanges = new DiscussionBuilder()
            .withId(uuid())
            .withCreatedAt(date)
            .withStatus({ status: "PENDING" })
            .withExchanges(
              [
                sentByBeneficiary,
                sentByEstablishment,
                sentByBeneficiary,
                sentByBeneficiary,
                sentByEstablishment,
                sentByEstablishment,
                sentByBeneficiary,
                sentByBeneficiary,
                sentByBeneficiary,
                sentByBeneficiary,
                sentByEstablishment,
              ].map((rest, index) => ({
                ...rest,
                message: "",
                subject: "",
                attachments: [],
                sentAt: addHours(new Date(date), index).toISOString(),
              })),
            )
            .build();
          const discussionToMatchWithOneExchangeOfEach = new DiscussionBuilder(
            discussionToMatchWithLotOfExchanges,
          )
            .withId(uuid())
            .withExchanges(
              [sentByBeneficiary, sentByEstablishment].map((rest, index) => ({
                ...rest,
                message: "",
                subject: "",
                attachments: [],
                sentAt: addHours(new Date(date), index).toISOString(),
              })),
            )
            .withCreatedAt(
              addHours(
                new Date(discussionToMatchWithLotOfExchanges.createdAt),
                1,
              ),
            )
            .build();
          const discussionBadSiret = new DiscussionBuilder(
            discussionToMatchWithLotOfExchanges,
          )
            .withId(uuid())
            .withSiret("99999999999999")
            .build();
          const discussionCreatedAtBelowRange = new DiscussionBuilder(
            discussionToMatchWithLotOfExchanges,
          )
            .withId(uuid())
            .withCreatedAt(subDays(new Date(discussionBadSiret.createdAt), 1))
            .build();
          const discussionCreatedAfterRange = new DiscussionBuilder(
            discussionToMatchWithLotOfExchanges,
          )
            .withId(uuid())
            .withCreatedAt(addDays(new Date(discussionBadSiret.createdAt), 1))
            .build();
          const discussionNotAnsweredByEstablishment = new DiscussionBuilder(
            discussionToMatchWithLotOfExchanges,
          )
            .withId(uuid())
            .withExchanges([
              {
                attachments: [],
                message: "",
                subject: "",
                sentAt: new Date().toISOString(),
                sender: "potentialBeneficiary",
              },
            ])
            .build();

          await pgDiscussionRepository.insert(
            discussionToMatchWithLotOfExchanges,
          );
          await pgDiscussionRepository.insert(
            discussionToMatchWithOneExchangeOfEach,
          );
          await pgDiscussionRepository.insert(discussionBadSiret);
          await pgDiscussionRepository.insert(discussionCreatedAtBelowRange);
          await pgDiscussionRepository.insert(discussionCreatedAfterRange);
          await pgDiscussionRepository.insert(
            discussionNotAnsweredByEstablishment,
          );

          expectToEqual(
            await pgDiscussionRepository.getDiscussions({
              filters: {
                answeredByEstablishment: true,
                status: discussionToMatchWithLotOfExchanges.status,
                createdBetween: {
                  from: new Date(discussionToMatchWithLotOfExchanges.createdAt),
                  to: new Date(
                    discussionToMatchWithOneExchangeOfEach.createdAt,
                  ),
                },
                sirets: [discussionToMatchWithLotOfExchanges.siret],
                createdSince: new Date(
                  discussionToMatchWithLotOfExchanges.createdAt,
                ),
              },
              limit: 5,
            }),
            [
              discussionToMatchWithOneExchangeOfEach,
              discussionToMatchWithLotOfExchanges,
            ],
          );
        });
      });
    });

    describe("getPaginatedDiscussionsForUser", () => {
      const discussion1 = new DiscussionBuilder()
        .withId(uuid())
        .withSiret("00000000000001")
        .withCreatedAt(new Date("2025-05-18"))
        .withStatus({ status: "PENDING" })
        .build();

      const discussion2Objective: ImmersionObjective =
        "Confirmer un projet professionnel";

      const potentialBeneficiaryPhone = "+33606060606";
      const discussion2 = new DiscussionBuilder()
        .withId(uuid())
        .withSiret("00000000000002")
        .withContactMode("PHONE")
        .withPotentialBeneficiaryPhone(potentialBeneficiaryPhone)
        .withPotentialBeneficiaryLastName("Smith")
        .withCreatedAt(new Date("2025-05-19"))
        .withAppellationCode(secretariat.appellationCode)
        .withImmersionObjective(discussion2Objective)
        .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "phone" })
        .withExchanges([])
        .build();

      const discussion3Objective: ImmersionObjective =
        "Initier une démarche de recrutement";

      const discussion3 = new DiscussionBuilder()
        .withId(uuid())
        .withSiret("00000000000003")
        .withPotentialBeneficiaryFirstname("Mark")
        .withBusinessName("Something different")
        .withAppellationCode(styliste.appellationCode)
        .withPotentialBeneficiaryPhone(potentialBeneficiaryPhone)
        .withCreatedAt(new Date("2025-05-20"))
        .withImmersionObjective(discussion3Objective)
        .withStatus({ status: "REJECTED", rejectionKind: "UNABLE_TO_HELP" })
        .build();

      const discussion4Objective: ImmersionObjective =
        "Initier une démarche de recrutement";

      const discussion4 = new DiscussionBuilder()
        .withId(uuid())
        .withSiret("00000000000004")
        .withPotentialBeneficiaryFirstname("John")
        .withBusinessName("Something else")
        .withAppellationCode(styliste.appellationCode)
        .withPotentialBeneficiaryPhone(potentialBeneficiaryPhone)
        .withCreatedAt(new Date("2025-05-21"))
        .withImmersionObjective(discussion4Objective)
        .withStatus({ status: "PENDING" })
        .build();

      const discussion2InList: DiscussionInList = {
        id: discussion2.id,
        siret: discussion2.siret,
        status: discussion2.status,
        appellation: secretariat,
        businessName: discussion2.businessName,
        createdAt: discussion2.createdAt,
        updatedAt: discussion2.updatedAt,
        contactMode: discussion2.contactMode,
        kind: discussion2.kind,
        isEstablishmentBanned: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
        potentialBeneficiary: {
          firstName: discussion2.potentialBeneficiary.firstName,
          lastName: discussion2.potentialBeneficiary.lastName,
          phone: potentialBeneficiaryPhone,
        },
        city: discussion2.address.city,
        immersionObjective: discussion2Objective,
        exchangesData: discussionToExchangesData(discussion2),
      };

      const discussion3InList: DiscussionInList = {
        id: discussion3.id,
        siret: discussion3.siret,
        status: discussion3.status,
        appellation: styliste,
        businessName: discussion3.businessName,
        createdAt: discussion3.createdAt,
        updatedAt: discussion3.updatedAt,
        contactMode: discussion3.contactMode,
        kind: discussion3.kind,
        isEstablishmentBanned: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
        potentialBeneficiary: {
          firstName: discussion3.potentialBeneficiary.firstName,
          lastName: discussion3.potentialBeneficiary.lastName,
          phone: potentialBeneficiaryPhone,
        },
        city: discussion3.address.city,
        immersionObjective: discussion3Objective,
        exchangesData: discussionToExchangesData(discussion3),
      };

      const discussion4InList: DiscussionInList = {
        id: discussion4.id,
        siret: discussion4.siret,
        status: discussion4.status,
        appellation: styliste,
        businessName: discussion4.businessName,
        createdAt: discussion4.createdAt,
        updatedAt: discussion4.updatedAt,
        contactMode: discussion4.contactMode,
        kind: discussion4.kind,
        isEstablishmentBanned: false,
        isEstablishmentReachableByPhoneAfter15Days: false,
        potentialBeneficiary: {
          firstName: discussion4.potentialBeneficiary.firstName,
          lastName: discussion4.potentialBeneficiary.lastName,
          phone: potentialBeneficiaryPhone,
        },
        city: discussion4.address.city,
        immersionObjective: discussion4Objective,
        exchangesData: discussionToExchangesData(discussion4),
      };

      beforeEach(async () => {
        await pgDiscussionRepository.insert(discussion1);
        await pgDiscussionRepository.insert(discussion2);
        await pgDiscussionRepository.insert(discussion3);
        await pgDiscussionRepository.insert(discussion4);

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussion2.siret)
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "PENDING",
                userId: pendingUser.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .withOffers([secretariatOffer])
            .build(),
        );

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussion3.siret)
            .withLocationId(uuid())
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-admin",
                status: "PENDING",
                userId: pendingUser.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .withOffers([stylisteOffer])
            .build(),
        );
      });

      it("returns no discussions if user has no ACCEPTED status on any establishment right", async () => {
        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: pendingUser.id,
            userRole: "establishment",
          });

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 0,
            totalRecords: 0,
          },
        });
      });

      it("filters out discussions on establishment user right with status PENDING and keeps discussions on establishment user right with status ACCEPTED", async () => {
        const userOnlyAcceptedOnDiscussion4 = pendingUser;
        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussion4.siret)
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: userOnlyAcceptedOnDiscussion4.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
                job: "",
                phone: "+33600000000",
              },
            ])
            .withLocationId(uuid())
            .withOffers([stylisteOffer])
            .build(),
        );

        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: userOnlyAcceptedOnDiscussion4.id,
            userRole: "establishment",
          });

        expectToEqual(
          (
            await establishmentAggregateRepo.getAllEstablishmentAggregatesForTest()
          ).length,
          3,
        );

        expectToEqual(result, {
          data: [discussion4InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 1,
          },
        });
      });

      it("gets all conventions of a user without filters, and supports ordering by createdAt", async () => {
        const resultWithDefaultOrder =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(resultWithDefaultOrder, {
          data: [discussion3InList, discussion2InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 2,
          },
        });

        const resultWithAscOrder =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "asc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(resultWithAscOrder, {
          data: [discussion2InList, discussion3InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 2,
          },
        });
      });

      it("returns hasEstablishmentAnswered: true when discussion has an exchange with a sender establishment", async () => {
        const createdAt = new Date("2024-06-23T12:00:00.000");
        const discussionWithEstablishmentExchange = new DiscussionBuilder()
          .withId(uuid())
          .withSiret("00000000000009")
          .withContactMode("EMAIL")
          .withAppellationCode(styliste.appellationCode)
          .withCreatedAt(new Date("2025-05-22"))
          .withStatus({ status: "PENDING" })
          .withExchanges([
            {
              subject: "Sujet de discussion",
              sentAt: createdAt.toISOString(),
              sender: "potentialBeneficiary",
              message: "default message",
              attachments: [],
            },
            {
              subject: "Sujet de discussion",
              sentAt: addDays(createdAt, 1).toISOString(),
              sender: "establishment",
              message: "default message",
              email: "fake@mail.com",
              firstname: "Fake",
              lastname: "Person",
              attachments: [],
            },
          ])
          .build();

        await pgDiscussionRepository.insert(
          discussionWithEstablishmentExchange,
        );

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussionWithEstablishmentExchange.siret)
            .withLocationId(uuid())
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: true,
              },
            ])
            .withOffers([stylisteOffer])
            .build(),
        );

        const discussionWithEstablishmentExchangeInList: DiscussionInList = {
          id: discussionWithEstablishmentExchange.id,
          siret: discussionWithEstablishmentExchange.siret,
          status: discussionWithEstablishmentExchange.status,
          appellation: styliste,
          businessName: discussionWithEstablishmentExchange.businessName,
          createdAt: discussionWithEstablishmentExchange.createdAt,
          updatedAt: discussionWithEstablishmentExchange.updatedAt,
          contactMode: discussionWithEstablishmentExchange.contactMode,
          kind: discussionWithEstablishmentExchange.kind,
          isEstablishmentBanned: false,
          isEstablishmentReachableByPhoneAfter15Days: true,
          potentialBeneficiary: {
            firstName:
              discussionWithEstablishmentExchange.potentialBeneficiary
                .firstName,
            lastName:
              discussionWithEstablishmentExchange.potentialBeneficiary.lastName,
            phone:
              discussionWithEstablishmentExchange.potentialBeneficiary.phone,
          },
          city: discussionWithEstablishmentExchange.address.city,
          immersionObjective:
            discussionWithEstablishmentExchange.potentialBeneficiary
              .immersionObjective,
          exchangesData: {
            ...discussionToExchangesData(discussionWithEstablishmentExchange),
            hasEstablishmentAnswered: true,
          },
        };

        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(result, {
          data: [
            discussionWithEstablishmentExchangeInList,
            discussion3InList,
            discussion2InList,
          ],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 3,
          },
        });
      });

      it("returns hasEstablishmentAnswered: true when discussion has an exchange with a sender establishment", async () => {
        const createdAt = new Date("2024-06-23T12:00:00.000");
        const discussionWithEstablishmentExchange = new DiscussionBuilder()
          .withId(uuid())
          .withSiret("00000000000009")
          .withContactMode("EMAIL")
          .withAppellationCode(styliste.appellationCode)
          .withCreatedAt(new Date("2025-05-22"))
          .withStatus({ status: "PENDING" })
          .withExchanges([
            {
              subject: "Sujet de discussion",
              sentAt: createdAt.toISOString(),
              sender: "potentialBeneficiary",
              message: "default message",
              attachments: [],
            },
            {
              subject: "Sujet de discussion",
              sentAt: addDays(createdAt, 1).toISOString(),
              sender: "potentialBeneficiary",
              message: "default message",
              attachments: [],
            },
          ])
          .build();

        await pgDiscussionRepository.insert(
          discussionWithEstablishmentExchange,
        );

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussionWithEstablishmentExchange.siret)
            .withLocationId(uuid())
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: true,
              },
            ])
            .withOffers([stylisteOffer])
            .build(),
        );

        const discussionWithEstablishmentExchangeInList: DiscussionInList = {
          id: discussionWithEstablishmentExchange.id,
          siret: discussionWithEstablishmentExchange.siret,
          status: discussionWithEstablishmentExchange.status,
          appellation: styliste,
          businessName: discussionWithEstablishmentExchange.businessName,
          createdAt: discussionWithEstablishmentExchange.createdAt,
          updatedAt: discussionWithEstablishmentExchange.updatedAt,
          contactMode: discussionWithEstablishmentExchange.contactMode,
          kind: discussionWithEstablishmentExchange.kind,
          isEstablishmentBanned: false,
          isEstablishmentReachableByPhoneAfter15Days: true,
          potentialBeneficiary: {
            firstName:
              discussionWithEstablishmentExchange.potentialBeneficiary
                .firstName,
            lastName:
              discussionWithEstablishmentExchange.potentialBeneficiary.lastName,
            phone:
              discussionWithEstablishmentExchange.potentialBeneficiary.phone,
          },
          city: discussionWithEstablishmentExchange.address.city,
          immersionObjective:
            discussionWithEstablishmentExchange.potentialBeneficiary
              .immersionObjective,
          exchangesData: {
            ...discussionToExchangesData(discussionWithEstablishmentExchange),
            hasEstablishmentAnswered: false,
          },
        };

        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(result, {
          data: [
            discussionWithEstablishmentExchangeInList,
            discussion3InList,
            discussion2InList,
          ],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 3,
          },
        });
      });

      it("returns isEstablishmentReachableByPhoneAfter15Days: true when establishment contact mode is EMAIL and a user right is main contact by phone", async () => {
        const discussion5 = new DiscussionBuilder()
          .withId(uuid())
          .withSiret("00000000000009")
          .withContactMode("EMAIL")
          .withAppellationCode(styliste.appellationCode)
          .withCreatedAt(new Date("2025-05-22"))
          .withStatus({ status: "PENDING" })
          .build();

        await pgDiscussionRepository.insert(discussion5);

        await establishmentAggregateRepo.insertEstablishmentAggregate(
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(discussion5.siret)
            .withLocationId(uuid())
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: user.id,
                job: "",
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: true,
              },
            ])
            .withOffers([stylisteOffer])
            .build(),
        );

        const discussion5InList: DiscussionInList = {
          id: discussion5.id,
          siret: discussion5.siret,
          status: discussion5.status,
          appellation: styliste,
          businessName: discussion5.businessName,
          createdAt: discussion5.createdAt,
          updatedAt: discussion5.updatedAt,
          contactMode: discussion5.contactMode,
          kind: discussion5.kind,
          isEstablishmentBanned: false,
          isEstablishmentReachableByPhoneAfter15Days: true,
          potentialBeneficiary: {
            firstName: discussion5.potentialBeneficiary.firstName,
            lastName: discussion5.potentialBeneficiary.lastName,
            phone: discussion5.potentialBeneficiary.phone,
          },
          city: discussion5.address.city,
          immersionObjective:
            discussion5.potentialBeneficiary.immersionObjective,
          exchangesData: discussionToExchangesData(discussion5),
        };

        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(result, {
          data: [discussion5InList, discussion3InList, discussion2InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 3,
          },
        });
      });

      describe("filters on user role", () => {
        const discussionWhereUserIsPotentialBeneficiary =
          new DiscussionBuilder()
            .withId(uuid())
            .withSiret("00000000000005")
            .withPotentialBeneficiaryEmail(
              bothPotentialBeneficiaryAndEstablishmentUser.email,
            )
            .withPotentialBeneficiaryFirstname(
              bothPotentialBeneficiaryAndEstablishmentUser.firstName,
            )
            .withPotentialBeneficiaryLastName(
              bothPotentialBeneficiaryAndEstablishmentUser.lastName,
            )
            .withBusinessName("Something else")
            .withAppellationCode(styliste.appellationCode)
            .withPotentialBeneficiaryPhone(potentialBeneficiaryPhone)
            .withCreatedAt(new Date("2025-05-21"))
            .withImmersionObjective(discussion4Objective)
            .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "phone" })
            .build();

        const discussionWhereUserIsEstablishment = new DiscussionBuilder()
          .withId(uuid())
          .withSiret("00000000000006")
          .withBusinessName("Something else")
          .withAppellationCode(styliste.appellationCode)
          .withPotentialBeneficiaryPhone(potentialBeneficiaryPhone)
          .withCreatedAt(new Date("2025-05-21"))
          .withImmersionObjective(discussion4Objective)
          .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "phone" })
          .build();

        const discussionWhereUserIsEstablishmentInList: DiscussionInList = {
          id: discussionWhereUserIsEstablishment.id,
          siret: discussionWhereUserIsEstablishment.siret,
          status: discussionWhereUserIsEstablishment.status,
          appellation: styliste,
          businessName: discussionWhereUserIsEstablishment.businessName,
          createdAt: discussionWhereUserIsEstablishment.createdAt,
          updatedAt: discussionWhereUserIsEstablishment.updatedAt,
          contactMode: discussionWhereUserIsEstablishment.contactMode,
          kind: discussionWhereUserIsEstablishment.kind,
          isEstablishmentBanned: false,
          isEstablishmentReachableByPhoneAfter15Days: false,
          potentialBeneficiary: {
            firstName:
              discussionWhereUserIsEstablishment.potentialBeneficiary.firstName,
            lastName:
              discussionWhereUserIsEstablishment.potentialBeneficiary.lastName,
            phone: potentialBeneficiaryPhone,
          },
          city: discussionWhereUserIsEstablishment.address.city,
          immersionObjective: "Initier une démarche de recrutement",
          exchangesData: discussionToExchangesData(
            discussionWhereUserIsEstablishment,
          ),
        };

        const discussionForPotentialBeneficiaryInList: DiscussionInList = {
          id: discussionWhereUserIsPotentialBeneficiary.id,
          siret: discussionWhereUserIsPotentialBeneficiary.siret,
          status: discussionWhereUserIsPotentialBeneficiary.status,
          appellation: styliste,
          businessName: discussionWhereUserIsPotentialBeneficiary.businessName,
          createdAt: discussionWhereUserIsPotentialBeneficiary.createdAt,
          updatedAt: discussionWhereUserIsPotentialBeneficiary.updatedAt,
          contactMode: discussionWhereUserIsPotentialBeneficiary.contactMode,
          kind: discussionWhereUserIsPotentialBeneficiary.kind,
          isEstablishmentBanned: false,
          isEstablishmentReachableByPhoneAfter15Days: false,
          potentialBeneficiary: {
            firstName:
              discussionWhereUserIsPotentialBeneficiary.potentialBeneficiary
                .firstName,
            lastName:
              discussionWhereUserIsPotentialBeneficiary.potentialBeneficiary
                .lastName,
            phone: potentialBeneficiaryPhone,
          },
          city: discussionWhereUserIsPotentialBeneficiary.address.city,
          immersionObjective: "Initier une démarche de recrutement",
          exchangesData: discussionToExchangesData(
            discussionWhereUserIsPotentialBeneficiary,
          ),
        };

        beforeEach(async () => {
          await pgDiscussionRepository.insert(
            discussionWhereUserIsPotentialBeneficiary,
          );
          await pgDiscussionRepository.insert(
            discussionWhereUserIsEstablishment,
          );

          await establishmentAggregateRepo.insertEstablishmentAggregate(
            new EstablishmentAggregateBuilder()
              .withEstablishmentSiret(
                discussionWhereUserIsPotentialBeneficiary.siret,
              )
              .withUserRights([
                {
                  role: "establishment-admin",
                  status: "ACCEPTED",
                  userId: user.id,
                  shouldReceiveDiscussionNotifications: true,
                  isMainContactByPhone: false,
                  job: "",
                  phone: "+33600000000",
                },
              ])
              .withLocationId(uuid())
              .withOffers([stylisteOffer])
              .build(),
          );

          await establishmentAggregateRepo.insertEstablishmentAggregate(
            new EstablishmentAggregateBuilder()
              .withEstablishmentSiret(discussionWhereUserIsEstablishment.siret)
              .withUserRights([
                {
                  role: "establishment-admin",
                  status: "ACCEPTED",
                  userId: bothPotentialBeneficiaryAndEstablishmentUser.id,
                  shouldReceiveDiscussionNotifications: true,
                  isMainContactByPhone: false,
                  job: "",
                  phone: "+33600000000",
                },
              ])
              .withLocationId(uuid())
              .withOffers([stylisteOffer])
              .build(),
          );
        });

        it("filters on establishment role", async () => {
          const resultWithEstablishmentRole =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              userRole: "establishment",
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: bothPotentialBeneficiaryAndEstablishmentUser.id,
            });

          expectToEqual(resultWithEstablishmentRole, {
            data: [discussionWhereUserIsEstablishmentInList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on potential beneficiary role", async () => {
          const resultWithPotentialBeneficiaryRole =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              userRole: "potentialBeneficiary",
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: bothPotentialBeneficiaryAndEstablishmentUser.id,
            });

          expectToEqual(resultWithPotentialBeneficiaryRole, {
            data: [discussionForPotentialBeneficiaryInList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });
      });

      it("filters on statuses", async () => {
        const result =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            filters: {
              statuses: ["ACCEPTED"],
            },
            pagination: {
              page: 1,
              perPage: 10,
            },
            sort: { by: "createdAt", direction: "desc" },
            userId: user.id,
            userRole: "establishment",
          });

        expectToEqual(result, {
          data: [discussion2InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 1,
          },
        });
      });

      describe("search", () => {
        it("filters on sirets in search", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: discussion3.siret.slice(-6), // last 6 digits of the siret (but would also work with the SIREN)
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion3InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on the business name in search", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: discussion3.businessName.slice(0, 4),
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion3InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on the potential beneficiary first name", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: discussion2.potentialBeneficiary.firstName.slice(0, 3),
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion2InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on the potential beneficiary last name", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: discussion3.potentialBeneficiary.lastName.slice(0, 3),
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion3InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on the immersion objective", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: discussion3Objective.slice(0, 3),
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion3InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });

        it("filters on the appellation label", async () => {
          const result =
            await pgDiscussionRepository.getPaginatedDiscussionsForUser({
              filters: {
                search: secretariat.appellationLabel.slice(0, 5), // "Secré"
              },
              pagination: {
                page: 1,
                perPage: 10,
              },
              sort: { by: "createdAt", direction: "desc" },
              userId: user.id,
              userRole: "establishment",
            });

          expectToEqual(result, {
            data: [discussion2InList],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          });
        });
      });

      it("supports pagination", async () => {
        const resultPage1 =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 1,
              perPage: 1,
            },
            userId: user.id,
            sort: { by: "createdAt", direction: "desc" },
            userRole: "establishment",
          });

        expectToEqual(resultPage1, {
          data: [discussion3InList],
          pagination: {
            currentPage: 1,
            numberPerPage: 1,
            totalPages: 2,
            totalRecords: 2,
          },
        });

        const resultPage2 =
          await pgDiscussionRepository.getPaginatedDiscussionsForUser({
            pagination: {
              page: 2,
              perPage: 1,
            },
            userId: user.id,
            sort: { by: "createdAt", direction: "desc" },
            userRole: "establishment",
          });

        expectToEqual(resultPage2, {
          data: [discussion2InList],
          pagination: {
            currentPage: 2,
            numberPerPage: 1,
            totalPages: 2,
            totalRecords: 2,
          },
        });
      });
    });

    describe("hasDiscussionMatching", () => {
      const discussionWithLastExchangeByPotentialBeneficiary1 =
        new DiscussionBuilder()
          .withId(uuid())
          .withSiret("00000000000001")
          .withExchanges([
            {
              message: "",
              sender: "potentialBeneficiary",
              sentAt: new Date("2023-07-07").toISOString(),
              subject: "exchange with potentialBeneficiary 1",
              attachments: [
                {
                  link: "magicTokenBrevo",
                  name: "monPdf.pdf",
                },
              ],
            },
          ])
          .withCreatedAt(new Date("2023-07-07"))
          .build();

      const discussionWithoutExchanges3 = new DiscussionBuilder()
        .withId(uuid())
        .withSiret("00000000000002")
        .withExchanges([])
        .withConventionId("some-convention-id")
        .withCreatedAt(new Date("2023-07-05"))
        .build();

      it.each([
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            siret: discussionWithLastExchangeByPotentialBeneficiary1.siret,
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            siret: discussionWithoutExchanges3.siret,
          },
          result: false,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            appellationCode:
              discussionWithLastExchangeByPotentialBeneficiary1.appellationCode,
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            potentialBeneficiaryEmail:
              discussionWithLastExchangeByPotentialBeneficiary1
                .potentialBeneficiary.email,
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            since: new Date(
              discussionWithLastExchangeByPotentialBeneficiary1.createdAt,
            ),
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            siret: discussionWithLastExchangeByPotentialBeneficiary1.siret,
            appellationCode:
              discussionWithLastExchangeByPotentialBeneficiary1.appellationCode,
            potentialBeneficiaryEmail:
              discussionWithLastExchangeByPotentialBeneficiary1
                .potentialBeneficiary.email,
            since: date,
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithLastExchangeByPotentialBeneficiary1,
          params: {
            siret: discussionWithLastExchangeByPotentialBeneficiary1.siret,
            appellationCode:
              discussionWithLastExchangeByPotentialBeneficiary1.appellationCode,
            potentialBeneficiaryEmail:
              discussionWithLastExchangeByPotentialBeneficiary1
                .potentialBeneficiary.email,
            since: addDays(date, 1),
          },
          result: false,
        },
        {
          discussionInRepo: discussionWithoutExchanges3,
          params: {
            siret: discussionWithoutExchanges3.siret,
            appellationCode: discussionWithoutExchanges3.appellationCode,
            potentialBeneficiaryEmail:
              discussionWithoutExchanges3.potentialBeneficiary.email,
            since: new Date(discussionWithoutExchanges3.createdAt),
          },
          result: true,
        },
        {
          discussionInRepo: discussionWithoutExchanges3,
          params: {
            siret: discussionWithLastExchangeByPotentialBeneficiary1.siret,
            appellationCode:
              discussionWithLastExchangeByPotentialBeneficiary1.appellationCode,
            potentialBeneficiaryEmail:
              discussionWithLastExchangeByPotentialBeneficiary1
                .potentialBeneficiary.email,
            since: addDays(new Date(discussionWithoutExchanges3.createdAt), 1),
          },
          result: false,
        },
      ] satisfies {
        discussionInRepo: DiscussionDto;
        params: Partial<HasDiscussionMatchingParams>;
        result: boolean;
      }[])(`hasDiscussionMatching '$result'
          with params: '$params'`, async ({
        discussionInRepo,
        params,
        result,
      }) => {
        await pgDiscussionRepository.insert(discussionInRepo);

        expectToEqual(
          await pgDiscussionRepository.hasDiscussionMatching(params),
          result,
        );
      });

      it("throws when no params provided", async () => {
        await expectPromiseToFailWithError(
          pgDiscussionRepository.hasDiscussionMatching({}),
          errors.discussion.hasDiscussionMissingParams(),
        );
      });

      it("when there is no discussion", async () => {
        expectToEqual(
          await pgDiscussionRepository.hasDiscussionMatching({
            siret: discussionWithoutExchanges3.siret,
          }),
          false,
        );
      });
    });

    describe("countDiscussionsForSiretSince", () => {
      const establishmentAggregate = new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11112222333344")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            userId: user.id,
            job: "",
            phone: "+33600000000",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .withOffers([stylisteOffer])
        .build();

      beforeEach(async () => {
        await establishmentAggregateRepo.insertEstablishmentAggregate(
          establishmentAggregate,
        );

        const discussion1 = new DiscussionBuilder()
          .withSiret(establishmentAggregate.establishment.siret)
          .withId("bbbbbd2c-6f02-11ec-90d6-0242ac120003")
          .withCreatedAt(new Date("2023-03-05"))
          .build();

        const discussion2 = new DiscussionBuilder()
          .withSiret(establishmentAggregate.establishment.siret)
          .withId("cccccd2c-6f02-11ec-90d6-0242ac120003")
          .withCreatedAt(new Date("2023-03-07"))
          .build();

        const discussionToOld = new DiscussionBuilder()
          .withSiret(establishmentAggregate.establishment.siret)
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120003")
          .withCreatedAt(new Date("2023-03-04"))
          .build();

        await Promise.all([
          pgDiscussionRepository.insert(discussion1),
          pgDiscussionRepository.insert(discussion2),
          pgDiscussionRepository.insert(discussionToOld),
        ]);
      });

      it("right path with 2", async () => {
        expectToEqual(
          await pgDiscussionRepository.countDiscussionsForSiretSince(
            establishmentAggregate.establishment.siret,
            new Date("2023-03-05"),
          ),
          2,
        );
      });

      it("right path with 0", async () => {
        expectToEqual(
          await pgDiscussionRepository.countDiscussionsForSiretSince(
            establishmentAggregate.establishment.siret,
            new Date("2023-03-08"),
          ),
          0,
        );
      });
    });

    describe("getObsoleteDiscussions", () => {
      const now = new Date();
      const discussionFrom2YearsAgoWithoutExchangesResponse =
        new DiscussionBuilder()
          .withSiret("11112222333344")
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120003")
          .withCreatedAt(subMonths(now, 24))
          .withExchanges([
            {
              subject: "Mise en relation initiale",
              message:
                "Bonjour, je souhaite m'informer sur l'immersion professionnelle",
              sentAt: subMonths(now, 24).toISOString(),
              sender: "potentialBeneficiary",
              attachments: [],
            },
          ])
          .build();

      const discussionFrom1YearAgoWithExchangesResponse =
        new DiscussionBuilder()
          .withSiret("11112222333344")
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120004")
          .withCreatedAt(subMonths(now, 12))
          .withExchanges([
            {
              subject: "Mise en relation initiale",
              message:
                "Bonjour, je souhaite m'informer sur l'immersion professionnelle",
              sentAt: subMonths(now, 12).toISOString(),
              sender: "potentialBeneficiary",
              attachments: [],
            },
            {
              subject: "Réponse de l'entreprise",
              message:
                "Super, je vais vous envoyer un mail avec les informations",
              sentAt: subMonths(now, 12).toISOString(),
              sender: "establishment",
              email: "ladalle@estamineyyyyy.com",
              firstname: "Vianey",
              lastname: "Du Maroille",
              attachments: [],
            },
          ])
          .build();

      const discussionFrom6MonthsAgoWithoutExchangesResponse =
        new DiscussionBuilder()
          .withSiret("11112222333344")
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120005")
          .withCreatedAt(subMonths(now, 6))
          .withExchanges([
            {
              subject: "Mise en relation initiale",
              message:
                "Bonjour, je souhaite m'informer sur l'immersion professionnelle",
              sentAt: subMonths(now, 6).toISOString(),
              sender: "potentialBeneficiary",
              attachments: [],
            },
          ])
          .build();

      const discussionFrom4MonthsAgoWithExchangesResponse =
        new DiscussionBuilder()
          .withSiret("11112222333344")
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120006")
          .withCreatedAt(subMonths(now, 4))
          .withExchanges([
            {
              subject: "Mise en relation initiale",
              message:
                "Bonjour, je souhaite m'informer sur l'immersion professionnelle",
              sentAt: subMonths(now, 4).toISOString(),
              sender: "potentialBeneficiary",
              attachments: [],
            },
            {
              subject: "Réponse de l'entreprise",
              message:
                "Super, je vais vous envoyer un mail avec les informations",
              sentAt: subMonths(now, 4).toISOString(),
              sender: "establishment",
              email: "ladalle@estamineyyyyy.com",
              firstname: "Vianey",
              lastname: "Du Maroille",
              attachments: [],
            },
          ])
          .build();

      const discussionFrom6MonthsAgoWithoutExchangesResponseAndStatusAccepted =
        new DiscussionBuilder()
          .withSiret("11112222333344")
          .withId("aaaaad2c-6f02-11ec-90d6-0242ac120008")
          .withCreatedAt(subMonths(now, 6))
          .withStatus({
            status: "ACCEPTED",
            candidateWarnedMethod: null,
          })
          .withExchanges([
            {
              subject: "Mise en relation initiale",
              message:
                "Bonjour, je souhaite m'informer sur l'immersion professionnelle",
              sentAt: subMonths(now, 6).toISOString(),
              sender: "potentialBeneficiary",
              attachments: [],
            },
          ])
          .build();

      const discussionFrom2MonthsAgo = new DiscussionBuilder()
        .withSiret("11112222333344")
        .withId("aaaaad2c-6f02-11ec-90d6-0242ac120007")
        .withCreatedAt(subMonths(now, 2))
        .build();

      beforeEach(async () => {
        await Promise.all([
          pgDiscussionRepository.insert(
            discussionFrom2YearsAgoWithoutExchangesResponse,
          ),
          pgDiscussionRepository.insert(
            discussionFrom1YearAgoWithExchangesResponse,
          ),
          pgDiscussionRepository.insert(
            discussionFrom6MonthsAgoWithoutExchangesResponse,
          ),
          pgDiscussionRepository.insert(
            discussionFrom4MonthsAgoWithExchangesResponse,
          ),
          pgDiscussionRepository.insert(
            discussionFrom6MonthsAgoWithoutExchangesResponseAndStatusAccepted,
          ),
          pgDiscussionRepository.insert(discussionFrom2MonthsAgo),
        ]);
      });

      it("returns the discussions that are obsolete, oldest first", async () => {
        const threeMonthsAgo = subMonths(now, 3);
        const obsoleteDiscussions =
          await pgDiscussionRepository.getObsoleteDiscussions({
            olderThan: threeMonthsAgo,
          });

        expectToEqual(obsoleteDiscussions, [
          discussionFrom2YearsAgoWithoutExchangesResponse.id,
          discussionFrom6MonthsAgoWithoutExchangesResponse.id,
        ]);
      });
    });
  });

  describe("getUserIdsWithNoRecentExchange", () => {
    it("returns empty array when given no users", async () => {
      expectToEqual(
        await pgDiscussionRepository.getUserIdsWithNoRecentExchange({
          userIds: [],
          since: new Date("2024-01-01"),
        }),
        [],
      );
    });

    it("returns only users with no recent establishment exchange since the given date", async () => {
      const since = new Date("2025-01-01");

      const userA = new UserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000001")
        .withEmail("userA-disc@test.com")
        .build();
      const userB = new UserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000002")
        .withEmail("userB-disc@test.com")
        .build();
      const userC = new UserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000003")
        .withEmail("userC-disc@test.com")
        .build();
      const userD = new UserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000004")
        .withEmail("userD-disc@test.com")
        .build();

      const userRepo = new PgUserRepository(db);
      await Promise.all([
        userRepo.save(userA),
        userRepo.save(userB),
        userRepo.save(userC),
        userRepo.save(userD),
      ]);

      const recentExchangeWhereUserAIsEstablishment = new DiscussionBuilder()
        .withId("11111111-1111-4111-a111-111111111111")
        .withPotentialBeneficiaryEmail("candidate-a@test.com")
        .withExchanges([
          {
            subject: "Recent",
            message: "Hello",
            sentAt: addDays(since, 1).toISOString(),
            sender: "establishment",
            firstname: "Estab",
            lastname: "Contact",
            email: userA.email,
            attachments: [],
          },
        ])
        .build();

      const oldExchangeWhereUserBIsEstablishment = new DiscussionBuilder()
        .withId("22222222-2222-4222-a222-222222222222")
        .withSiret("11111111111112")
        .withPotentialBeneficiaryEmail("candidate-b@test.com")
        .withExchanges([
          {
            subject: "Old",
            message: "Hello",
            sentAt: addDays(since, -1).toISOString(),
            sender: "establishment",
            firstname: "Estab",
            lastname: "Contact",
            email: userB.email,
            attachments: [],
          },
        ])
        .build();

      const recentDiscussionWhereUserDIsCandidateOnly = new DiscussionBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .withSiret("11111111111113")
        .withPotentialBeneficiaryEmail(userD.email)
        .withExchanges([
          {
            subject: "Candidate sent",
            message: "Hello",
            sentAt: addDays(since, 1).toISOString(),
            sender: "potentialBeneficiary",
            attachments: [],
          },
        ])
        .build();

      await Promise.all([
        pgDiscussionRepository.insert(recentExchangeWhereUserAIsEstablishment),
        pgDiscussionRepository.insert(oldExchangeWhereUserBIsEstablishment),
        pgDiscussionRepository.insert(
          recentDiscussionWhereUserDIsCandidateOnly,
        ),
      ]);

      const result =
        await pgDiscussionRepository.getUserIdsWithNoRecentExchange({
          userIds: [userA.id, userB.id, userC.id, userD.id],
          since,
        });

      expectToEqual(result.sort(), [userB.id, userC.id, userD.id].sort());
    });
  });
});

const insertDiscussions = async (
  pgDiscussionRepository: PgDiscussionRepository,
  discussions: DiscussionDto[],
): Promise<void> => {
  for (const discussion of discussions) {
    await pgDiscussionRepository.insert(discussion);
  }
};
