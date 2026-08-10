import { addDays, subDays, subMilliseconds, subMonths } from "date-fns";
import { sql } from "kysely";
import type { Pool } from "pg";
import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyKind,
  type AppellationCode,
  ASSESSEMENT_SIGNATURE_RELEASE_DATE,
  type AssessmentDto,
  AssessmentDtoBuilder,
  type BroadcastFeedback,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionLastReminders,
  type ConventionReadDto,
  type ConventionStatus,
  DATE_START,
  type DateString,
  type Email,
  type EmailType,
  expectToEqual,
  makeEmptyLastReminders,
  reasonableSchedule,
  type SearchTextAlphaNumeric,
  type SiretDto,
  type SmsTemplateKind,
  type UserWithAdminRights,
  type WithBannedEstablishmentInformations,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { assesmentEntityToConventionAssessmentFields } from "../../../utils/convention";
import { PgAgencyRepository } from "../../agency/adapters/PgAgencyRepository";
import type { AgencyRepository } from "../../agency/ports/AgencyRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { PgBroadcastFeedbacksRepository } from "../../core/saved-errors/adapters/PgBroadcastFeedbacksRepository";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import {
  type AssessmentEntity,
  createAssessmentEntity,
} from "../entities/AssessmentEntity";
import type { AssessmentRepository } from "../ports/AssessmentRepository";
import type {
  ConventionQueries,
  GetConventionsParams,
} from "../ports/ConventionQueries";
import type { ConventionRepository } from "../ports/ConventionRepository";
import { PgAssessmentRepository } from "./PgAssessmentRepository";
import { PgConventionQueries } from "./PgConventionQueries";
import { PgConventionRepository } from "./PgConventionRepository";

describe("Pg implementation of ConventionQueries", () => {
  const conventionIdA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
  const conventionIdB: ConventionId = "bbbbbc99-9c0b-1bbb-bb6d-6bb9bd38bbbb";
  const agencyIdA: AgencyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const agencyIdB: AgencyId = "bbbbbbbb-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const anyConventionUpdatedAt = new Date("2022-05-20T12:43:11").toISOString();

  const validator = new ConnectedUserBuilder()
    .withEmail("validator@mail.com")
    .withId(uuid())
    .buildUser();
  const counsellor = new ConnectedUserBuilder()
    .withEmail("counsellor@mail.com")
    .withId(uuid())
    .buildUser();

  let pool: Pool;
  let conventionQueries: PgConventionQueries;
  let agencyRepo: PgAgencyRepository;
  let assessmentRepo: PgAssessmentRepository;
  let conventionRepository: PgConventionRepository;
  let broadcastFeedbacksRepository: PgBroadcastFeedbacksRepository;
  let db: KyselyDb;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await db.deleteFrom("conventions").execute();
    await db.deleteFrom("convention_drafts").execute();
    await db.deleteFrom("convention_templates").execute();
    await sql`TRUNCATE TABLE convention_external_ids RESTART IDENTITY;`.execute(
      db,
    );
    await db.deleteFrom("agency_groups__agencies").execute();
    await db.deleteFrom("agency_groups").execute();
    await db.deleteFrom("broadcast_feedbacks").execute();
    await db.deleteFrom("agencies").execute();
    await db.deleteFrom("notifications_email_recipients").execute();
    await db.deleteFrom("notifications_email").execute();
    await db.deleteFrom("notifications_sms").execute();
    await db.deleteFrom("immersion_assessments").execute();
    await db.deleteFrom("users").execute();

    conventionQueries = new PgConventionQueries(db);
    agencyRepo = new PgAgencyRepository(db);
    assessmentRepo = new PgAssessmentRepository(db);
    conventionRepository = new PgConventionRepository(db);
    broadcastFeedbacksRepository = new PgBroadcastFeedbacksRepository(db);

    const userRepository = new PgUserRepository(db);
    await userRepository.save(validator);
    await userRepository.save(counsellor);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe.each([
    "Pg",
    "InMemory",
  ] as const)("%s getConventionById", (adapter) => {
    let conventionQueries: ConventionQueries;
    let agencyRepo: AgencyRepository;
    let conventionRepository: ConventionRepository;

    beforeEach(() => {
      if (adapter === "Pg") {
        conventionQueries = new PgConventionQueries(db);
        agencyRepo = new PgAgencyRepository(db);
        conventionRepository = new PgConventionRepository(db);
      } else {
        const uow = createInMemoryUow();
        conventionQueries = uow.conventionQueries;
        agencyRepo = uow.agencyRepository;
        conventionRepository = uow.conventionRepository;
      }
    });

    it("Returns undefined if no convention with such id", async () => {
      expect(
        await conventionQueries.getConventionById(conventionIdA),
      ).toBeUndefined();
    });

    it("Retrieves a convention by id exists", async () => {
      const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

      const convention = new ConventionDtoBuilder()
        .withId(conventionIdA)
        .withAgencyId(agency.id)
        .withUpdatedAt(anyConventionUpdatedAt)
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      expectToEqual(
        await conventionQueries.getConventionById(conventionIdA),
        convention,
      );
    });
  });

  describe("getConventionsByScope", () => {
    let franceTravailConvention: ConventionReadDto;
    let cciConvention: ConventionReadDto;

    beforeEach(async () => {
      franceTravailConvention = await insertAgencyAndConvention({
        conventionId: conventionIdA,
        agencyId: agencyIdA,
        agencyName: "agency PE",
        agencyContactEmail: "pe-contact@mail.com",
        agencyDepartment: "75",
        agencyKind: "pole-emploi",
        agencySiret: "11112222000044",
        conventionStartDate: new Date("2021-01-10").toISOString(),
        conventionStatus: "IN_REVIEW",
        conventionUpdatedAt: anyConventionUpdatedAt,
        validatorUser: validator,
        withBannedEstablishmentInformations: { isEstablishmentBanned: false },
      });
      cciConvention = await insertAgencyAndConvention({
        conventionId: conventionIdB,
        agencyId: agencyIdB,
        agencyName: "agency CCI",
        agencyContactEmail: "cci-contact@mail.com",
        agencyDepartment: "75",
        agencyKind: "cci",
        agencySiret: "11112222000055",
        conventionStartDate: new Date("2021-01-15").toISOString(),
        conventionStatus: "READY_TO_SIGN",
        conventionUpdatedAt: anyConventionUpdatedAt,
        validatorUser: validator,
        withBannedEstablishmentInformations: { isEstablishmentBanned: false },
      });
      await insertAgencyAndConvention({
        conventionId: "cccccc99-9c0b-1bbb-bb6d-6bb9bd38bbbb",
        agencyId: "cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        agencyName: "agency Mission Locale",
        agencyContactEmail: "mission-locale-contact@mail.com",
        agencyDepartment: "75",
        agencyKind: "mission-locale",
        agencySiret: "11112222000066",
        conventionStartDate: new Date("2021-01-12").toISOString(),
        conventionStatus: "IN_REVIEW",
        conventionUpdatedAt: anyConventionUpdatedAt,
        validatorUser: validator,
        withBannedEstablishmentInformations: { isEstablishmentBanned: false },
      });
    });

    describe("when no scope", () => {
      it("returns empty array if scope is empty", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyKinds: [],
          },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, []);
      });
    });

    describe("when only agencyKinds", () => {
      it("return empty array when no convention matching agencyKinds", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyKinds: ["conseil-departemental"],
          },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, []);
      });

      it("return conventions matching agencyKinds", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyKinds: ["pole-emploi", "cci"],
          },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, [cciConvention, franceTravailConvention]);
      });

      it("return conventions matching agencyKinds and status", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyKinds: ["pole-emploi", "cci"],
          },
          limit: 5,
          filters: {
            withStatuses: ["IN_REVIEW"],
          },
        });

        expectToEqual(result, [franceTravailConvention]);
      });
    });

    describe("when only agencyIds", () => {
      it("return empty array when no convention matching agencyIds", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyIds: ["ccaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
          },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, []);
      });

      it("return conventions matching agencyIds", async () => {
        const result = await conventionQueries.getConventionsByScope({
          scope: {
            agencyIds: [agencyIdA, agencyIdB],
          },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, [cciConvention, franceTravailConvention]);
      });
    });

    it("should limit number of conventions returned", async () => {
      const result = await conventionQueries.getConventionsByScope({
        scope: {
          agencyKinds: ["pole-emploi", "cci"],
        },
        limit: 1,
        filters: {},
      });

      expectToEqual(result, [cciConvention]);
    });

    describe("lastReminders", () => {
      it("returns last signature reminder dates when notifications exist", async () => {
        const emailSentAt = new Date("2025-01-06T08:00:00.000Z");
        const smsSentAt = new Date("2025-01-06T09:00:00.000Z");

        await insertEmailReminder({
          conventionId: conventionIdA,
          emailKind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
          recipientEmail: franceTravailConvention.signatories.beneficiary.email,
          createdAt: emailSentAt,
        });
        await insertSmsReminder({
          conventionId: conventionIdB,
          smsKind: "ReminderForSignatories",
          recipientPhone: cciConvention.signatories.beneficiary.phone,
          createdAt: smsSentAt,
        });

        const result = await conventionQueries.getConventionsByScope({
          scope: { agencyKinds: ["pole-emploi", "cci"] },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, [
          {
            ...cciConvention,
            lastReminders: {
              conventionSignatures: {
                beneficiary: { email: null, sms: smsSentAt.toISOString() },
                "establishment-representative": { email: null, sms: null },
                "beneficiary-representative": { email: null, sms: null },
                "beneficiary-current-employer": { email: null, sms: null },
              },
              assessmentCompletion: { email: null, sms: null },
              assessmentSignature: { email: null, sms: null },
            },
          },
          {
            ...franceTravailConvention,
            lastReminders: {
              conventionSignatures: {
                beneficiary: { email: emailSentAt.toISOString(), sms: null },
                "establishment-representative": { email: null, sms: null },
                "beneficiary-representative": { email: null, sms: null },
                "beneficiary-current-employer": { email: null, sms: null },
              },
              assessmentCompletion: { email: null, sms: null },
              assessmentSignature: { email: null, sms: null },
            },
          },
        ]);
      });

      it("returns last assessment completion reminder dates when notifications exist", async () => {
        const emailSentAt = new Date("2025-01-07T08:00:00.000Z");
        const smsSentAt = new Date("2025-01-07T09:00:00.000Z");

        await insertEmailReminder({
          conventionId: conventionIdA,
          emailKind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
          recipientEmail: franceTravailConvention.establishmentTutor.email,
          createdAt: emailSentAt,
        });
        await insertSmsReminder({
          conventionId: conventionIdA,
          smsKind: "ReminderForAssessment",
          recipientPhone: franceTravailConvention.establishmentTutor.phone,
          createdAt: smsSentAt,
        });

        const result = await conventionQueries.getConventionsByScope({
          scope: { agencyKinds: ["pole-emploi"] },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, [
          {
            ...franceTravailConvention,
            lastReminders: {
              conventionSignatures: {
                beneficiary: { email: null, sms: null },
                "establishment-representative": { email: null, sms: null },
                "beneficiary-representative": { email: null, sms: null },
                "beneficiary-current-employer": { email: null, sms: null },
              },
              assessmentCompletion: {
                email: emailSentAt.toISOString(),
                sms: smsSentAt.toISOString(),
              },
              assessmentSignature: { email: null, sms: null },
            },
          },
        ]);
      });

      it("returns last assessment signature reminder dates when notifications exist", async () => {
        const emailSentAt = new Date("2025-01-08T08:00:00.000Z");
        const smsSentAt = new Date("2025-01-08T09:00:00.000Z");

        await insertEmailReminder({
          conventionId: conventionIdA,
          emailKind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          recipientEmail: franceTravailConvention.signatories.beneficiary.email,
          createdAt: emailSentAt,
        });
        await insertSmsReminder({
          conventionId: conventionIdA,
          smsKind: "ReminderForAssessmentSignature",
          recipientPhone: franceTravailConvention.signatories.beneficiary.phone,
          createdAt: smsSentAt,
        });

        const result = await conventionQueries.getConventionsByScope({
          scope: { agencyKinds: ["pole-emploi"] },
          limit: 5,
          filters: {},
        });

        expectToEqual(result, [
          {
            ...franceTravailConvention,
            lastReminders: {
              conventionSignatures: {
                beneficiary: { email: null, sms: null },
                "establishment-representative": { email: null, sms: null },
                "beneficiary-representative": { email: null, sms: null },
                "beneficiary-current-employer": { email: null, sms: null },
              },
              assessmentCompletion: { email: null, sms: null },
              assessmentSignature: {
                email: emailSentAt.toISOString(),
                sms: smsSentAt.toISOString(),
              },
            },
          },
        ]);
      });
    });
  });

  describe("getConventions", () => {
    const agency = AgencyDtoBuilder.create()
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aaff")
      .build();

    const otherAgency = AgencyDtoBuilder.create()
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aadd")
      .build();

    const conventionCancelledAndDateStart20230327 = new ConventionDtoBuilder()
      .withSiret("11111111111111")
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aa01")
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .withDateStart(new Date("2023-03-27").toISOString())
      .withDateEnd(new Date("2023-03-28").toISOString())
      .withSchedule(reasonableSchedule)
      .withStatus("CANCELLED")
      .withAgencyId(agency.id)
      .withUpdatedAt(new Date("2023-03-28").toISOString())
      .build();

    const conventionReadyToSignAndDateStart20230330 = new ConventionDtoBuilder()
      .withSiret("11111111111112")
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aa02")
      .withBeneficiaryEmail("other-beneficiary@mail.com")
      .withDateSubmission(new Date("2023-03-05").toISOString())
      .withDateStart(new Date("2023-03-30").toISOString())
      .withDateEnd(new Date("2023-03-31").toISOString())
      .withSchedule(reasonableSchedule)
      .withStatus("READY_TO_SIGN")
      .withAgencyId(agency.id)
      .withUpdatedAt(new Date("2023-03-31").toISOString())
      .build();

    const firstValidatedConvention = new ConventionDtoBuilder()
      .withSiret("11111111111113")
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aa03")
      .withBeneficiaryEmail("beneficiary@mail.com")
      .withDateSubmission(new Date("2024-06-20").toISOString())
      .withDateStart(new Date("2024-07-01").toISOString())
      .withDateEnd(new Date("2024-07-02").toISOString())
      .withSchedule(reasonableSchedule)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .validated()
      .withDateValidation(new Date("2024-06-25").toISOString())
      .withAgencyId(agency.id)
      .withUpdatedAt(new Date("2025-01-01").toISOString())
      .build();

    const secondValidatedConvention = new ConventionDtoBuilder()
      .withSiret("11111111111114")
      .withId("bbbbbc15-9c0a-1aaa-aa6d-6aa9ad38aa04")
      .withBeneficiaryEmail("beneficiary@mail.com")
      .withDateSubmission(new Date("2024-06-21").toISOString())
      .withDateStart(new Date("2024-07-02").toISOString())
      .withDateEnd(new Date("2024-07-03").toISOString())
      .withSchedule(reasonableSchedule)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .validated()
      .withDateValidation(new Date("2024-06-29").toISOString())
      .withAgencyId(otherAgency.id)
      .withUpdatedAt(new Date("2024-07-03").toISOString())
      .build();

    beforeEach(async () => {
      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );
      await agencyRepo.insert(
        toAgencyWithRights(otherAgency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

      await Promise.all(
        [
          conventionCancelledAndDateStart20230327,
          conventionReadyToSignAndDateStart20230330,
          firstValidatedConvention,
          secondValidatedConvention,
        ].map((convention) =>
          conventionRepository.save(convention, convention.updatedAt),
        ),
      );
    });

    it.each([
      {
        testName: "with filter agencyIds",
        params: {
          filters: { agencyIds: [otherAgency.id] },
          sortBy: "dateStart",
        },
        expectedConventions: [secondValidatedConvention],
      },
      {
        testName: "with filter ids",
        params: {
          filters: {
            ids: [conventionCancelledAndDateStart20230327.id],
          },
          sortBy: "dateStart",
        },
        expectedConventions: [conventionCancelledAndDateStart20230327],
      },
      {
        testName: "with filter dateSubmissionEqual",
        params: {
          filters: {
            dateSubmissionEqual: new Date(
              conventionCancelledAndDateStart20230327.dateSubmission,
            ),
          },
          sortBy: "dateStart",
        },
        expectedConventions: [conventionCancelledAndDateStart20230327],
      },
      {
        testName: "with filter withStatuses [READY_TO_SIGN]",
        params: {
          filters: {
            withStatuses: ["READY_TO_SIGN"],
          },
          sortBy: "dateStart",
        },
        expectedConventions: [conventionReadyToSignAndDateStart20230330],
      },
      {
        testName: "with filter startDateGreater 2023-03-26",
        params: {
          filters: {
            startDateGreater: addDays(
              new Date(conventionCancelledAndDateStart20230327.dateStart),
              -1,
            ),
          },
          sortBy: "dateStart",
        },
        expectedConventions: [
          secondValidatedConvention,
          firstValidatedConvention,
          conventionReadyToSignAndDateStart20230330,
          conventionCancelledAndDateStart20230327,
        ],
      },
      {
        testName: "with filter startDateLessOrEqual 2023-03-27",
        params: {
          filters: {
            startDateLessOrEqual: new Date(
              conventionCancelledAndDateStart20230327.dateStart,
            ),
          },
          sortBy: "dateStart",
        },
        expectedConventions: [conventionCancelledAndDateStart20230327],
      },
      {
        testName: "with filter withSirets",
        params: {
          filters: {
            withSirets: [
              firstValidatedConvention.siret,
              secondValidatedConvention.siret,
            ],
          },
          sortBy: "dateStart",
        },
        expectedConventions: [
          secondValidatedConvention,
          firstValidatedConvention,
        ],
      },
      {
        testName: "with filter withBeneficiary email",
        params: {
          filters: {
            withBeneficiary: { email: "beneficiary@mail.com" },
          },
          sortBy: "dateStart",
        },
        expectedConventions: [
          secondValidatedConvention,
          firstValidatedConvention,
        ],
      },
      {
        testName: "with filter withBeneficiary email and no result",
        params: {
          filters: {
            withBeneficiary: { email: "unknown-beneficiary@mail.com" },
          },
          sortBy: "dateStart",
        },
        expectedConventions: [],
      },
      {
        testName: "with filter endDate",
        params: {
          filters: {
            endDate: {
              from: new Date(firstValidatedConvention.dateEnd),
              to: new Date(firstValidatedConvention.dateEnd),
            },
          },
          sortBy: "dateStart",
        },
        expectedConventions: [firstValidatedConvention],
      },
      {
        testName: "with filter updateDate from + to",
        params: {
          filters: {
            updateDate: {
              // biome-ignore lint/style/noNonNullAssertion: applied on convention
              from: new Date(firstValidatedConvention.updatedAt!),
              // biome-ignore lint/style/noNonNullAssertion: applied on convention
              to: new Date(firstValidatedConvention.updatedAt!),
            },
          },
          sortBy: "dateStart",
        },
        expectedConventions: [firstValidatedConvention],
      },
      {
        testName: "with filter updateDate to only",
        params: {
          filters: {
            updateDate: {
              // biome-ignore lint/style/noNonNullAssertion: applied on convention
              to: subDays(new Date(firstValidatedConvention.updatedAt!), 1),
            },
          },
          sortBy: "dateStart",
        },
        expectedConventions: [
          secondValidatedConvention,
          conventionReadyToSignAndDateStart20230330,
          conventionCancelledAndDateStart20230327,
        ],
      },
      {
        testName: `with filters:
          - startDateGreater 2023-03-26
          - startDateLessOrEqual 2023-03-27
          - withStatuses ["READY_TO_SIGN"]`,
        params: {
          filters: {
            startDateGreater: addDays(
              new Date(conventionCancelledAndDateStart20230327.dateStart),
              -1,
            ),
            startDateLessOrEqual: new Date(
              conventionCancelledAndDateStart20230327.dateStart,
            ),
            withStatuses: [conventionCancelledAndDateStart20230327.status],
          },
          sortBy: "dateStart",
        },
        expectedConventions: [conventionCancelledAndDateStart20230327],
      },
      {
        testName: `with filters:
          - startDateGreater 2023-03-30'
          - startDateLessOrEqual 2023-03-31`,
        params: {
          filters: {
            startDateGreater: new Date("2023-03-30"),
            startDateLessOrEqual: new Date("2023-03-31"),
          },
          sortBy: "dateStart",
        },
        expectedConventions: [],
      },
      {
        testName: `with filters :
          - withStatuses ["ACCEPTED-BY-VALIDATOR"]
          - sort by "date_validation"`,
        params: {
          filters: {
            withStatuses: [firstValidatedConvention.status],
          },
          sortBy: "dateValidation",
        },
        expectedConventions: [
          secondValidatedConvention,
          firstValidatedConvention,
        ],
      },
    ] satisfies {
      testName: string;
      params: GetConventionsParams;
      expectedConventions: ConventionDto[];
    }[])("$testName", async ({ params, expectedConventions }) => {
      expectToEqual(
        await conventionQueries.getConventions(params),
        expectedConventions,
      );
    });
  });

  describe("getConventionIdsByFilters", () => {
    const agency = AgencyDtoBuilder.create().build();
    beforeEach(async () => {
      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );
    });

    describe("similar conventions", () => {
      const matchingSiret: SiretDto = "11112222333344";
      const matchingAppellation: AppellationCode = "140927";
      const matchingBirthDate = new Date("1992-01-01").toISOString();
      const matchingBeneficiaryLastname = "M'GOMA";
      const matchingDateStart = new Date("2021-01-09");
      const someMatchingStatus = "READY_TO_SIGN";
      const conventionMatchingIdA: ConventionId =
        "aaaa1111-1111-4111-9111-11111111aaaa";
      const conventionMatchingIdB: ConventionId =
        "bbbb1111-1111-4111-9111-11111111bbbb";

      const numberOfDaysTolerance = 7;

      beforeEach(async () => {
        const conventionBuilderInitialMatching = new ConventionDtoBuilder()
          .withAgencyId(agency.id)
          .withSiret(matchingSiret)
          .withImmersionAppellation({
            appellationCode: matchingAppellation,
            romeCode: "11111",
            appellationLabel: "osef",
            romeLabel: "osef",
          })
          .withBeneficiaryBirthdate(matchingBirthDate)
          .withBeneficiaryLastName(matchingBeneficiaryLastname)
          .withDateStart(matchingDateStart.toISOString())
          .withDateEnd(new Date("2021-01-25").toISOString())
          .withStatus(someMatchingStatus);

        const conventionMatchingA = conventionBuilderInitialMatching
          .withId(conventionMatchingIdA)
          .build();

        const conventionMatchingB = conventionBuilderInitialMatching
          .withId(conventionMatchingIdB)
          .withDateStart(new Date("2021-01-10").toISOString())
          .build();

        const conventionWithWrongSiret = conventionBuilderInitialMatching
          .withId("22222222-2222-4222-9222-222222222222")
          .withSiret("40400000000404")
          .build();

        const conventionWithWrongAppellation = conventionBuilderInitialMatching
          .withId("33333333-3333-4333-3333-333333333333")
          .withImmersionAppellation({
            appellationCode: "17010",
            romeCode: "11111",
            appellationLabel: "osef",
            romeLabel: "osef",
          })
          .build();

        const conventionWithWrongBeneficiaryBirthdate =
          conventionBuilderInitialMatching
            .withId("44444444-4444-4444-4444-444444444444")
            .withBeneficiaryBirthdate(new Date("1993-03-03").toISOString())
            .build();

        const conventionWithWrongBeneficiaryLastname =
          conventionBuilderInitialMatching
            .withId("55555555-5555-4555-5555-555555555555")
            .withBeneficiaryLastName("Test")
            .build();

        const conventionWithDateStartToLate = conventionBuilderInitialMatching
          .withId("66666666-6666-4666-6666-666666666666")
          .withDateStart(new Date("2021-01-18").toISOString())
          .build();

        const conventionWithDateStartToEarly = conventionBuilderInitialMatching
          .withId("66660000-0000-4666-6666-000066660000")
          .withDateStart(new Date("2021-01-01").toISOString())
          .build();

        const conventionDeprecated = conventionBuilderInitialMatching
          .withId("77777777-7777-4777-7777-777777777777")
          .withStatus("DEPRECATED")
          .build();
        const conventionRejected = conventionBuilderInitialMatching
          .withId("88888888-8888-4888-8888-888888888888")
          .withStatus("REJECTED")
          .build();
        const conventionCancelled = conventionBuilderInitialMatching
          .withId("99999999-9999-4999-9999-999999999999")
          .withStatus("CANCELLED")
          .build();

        await Promise.all([
          conventionRepository.save(conventionWithWrongSiret),
          conventionRepository.save(conventionWithWrongAppellation),
          conventionRepository.save(conventionWithWrongBeneficiaryBirthdate),
          conventionRepository.save(conventionWithWrongBeneficiaryLastname),
          conventionRepository.save(conventionWithDateStartToEarly),
          conventionRepository.save(conventionWithDateStartToLate),
          conventionRepository.save(conventionDeprecated),
          conventionRepository.save(conventionRejected),
          conventionRepository.save(conventionCancelled),
          conventionRepository.save(conventionMatchingA),
          conventionRepository.save(conventionMatchingB),
        ]);
      });

      it("finds no similar conventions when there is no convention matching", async () => {
        const dateStartToMatch = new Date("2021-01-01");

        const similarConventionIdsFound =
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withDateStart: {
                from: subDays(dateStartToMatch, numberOfDaysTolerance),
                to: addDays(dateStartToMatch, numberOfDaysTolerance),
              },
              withSirets: ["12345678901234"],
              withBeneficiary: {
                birthdate: new Date("1990-01-01").toISOString(),
                lastName: "Dupont",
              },
              withAppelationCodes: ["1234567"],
              withStatuses: [
                "ACCEPTED_BY_COUNSELLOR",
                "ACCEPTED_BY_VALIDATOR",
                "IN_REVIEW",
                "PARTIALLY_SIGNED",
                "READY_TO_SIGN",
              ],
            },
          });

        expectToEqual(similarConventionIdsFound, []);
      });

      it("finds similar conventions", async () => {
        const similarConventionIdsFound =
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withDateStart: {
                from: subDays(matchingDateStart, numberOfDaysTolerance),
                to: addDays(matchingDateStart, numberOfDaysTolerance),
              },
              withSirets: [matchingSiret],
              withBeneficiary: {
                birthdate: matchingBirthDate,
                lastName: matchingBeneficiaryLastname,
              },
              withAppelationCodes: [matchingAppellation],
              withStatuses: [
                "ACCEPTED_BY_COUNSELLOR",
                "ACCEPTED_BY_VALIDATOR",
                "IN_REVIEW",
                "PARTIALLY_SIGNED",
                "READY_TO_SIGN",
              ],
            },
          });

        expectToEqual(similarConventionIdsFound, [
          conventionMatchingIdB,
          conventionMatchingIdA,
        ]);
      });
    });

    describe("withEstablishmentRepresentativeEmail Filter", () => {
      const email = "mail@mail.com";
      const convention = new ConventionDtoBuilder()
        .withEstablishmentRepresentativeEmail(email)
        .build();

      beforeEach(async () => {
        await conventionRepository.save(convention, anyConventionUpdatedAt);
      });
      it("Match convention with email", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withEstablishmentRepresentative: { email },
            },
          }),
          [convention.id],
        );
      });

      it("Without convention with email", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withEstablishmentRepresentative: {
                email: "notEmail@emauil.ciom",
              },
            },
          }),
          [],
        );
      });
    });

    describe("withEstablishmentTutorEmail Filter", () => {
      const email = "mail@mail.com";
      const convention = new ConventionDtoBuilder()
        .withEstablishmentTutorEmail(email)
        .build();

      beforeEach(async () => {
        await conventionRepository.save(convention, anyConventionUpdatedAt);
      });

      it("retrieve convention id when tutor email match", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withEstablishmentTutor: { email },
            },
          }),
          [convention.id],
        );
      });

      it("Doesn't retrieve convention when tutor email doesn't match", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withEstablishmentTutor: { email: "notEmail@emauil.ciom" },
            },
          }),
          [],
        );
      });
    });

    describe("with date filters", () => {
      const conventionFrom15To25 = new ConventionDtoBuilder()
        .withId("a56ce4c4-0fe9-49f8-b1fb-e84d9994a1f0")
        .withAgencyId(agency.id)
        .withDateStart("2026-01-15")
        .withDateEnd("2026-01-25")
        .build();
      const conventionFrom10To20 = new ConventionDtoBuilder()
        .withId("dc5d0d4f-6f49-4658-9075-6f4ff7f0d4ca")
        .withAgencyId(agency.id)
        .withDateStart("2026-01-10")
        .withDateEnd("2026-01-20")
        .build();
      const conventionFrom20To30 = new ConventionDtoBuilder()
        .withId("5e7eb66f-854f-4e99-83e9-f348ac767f45")
        .withAgencyId(agency.id)
        .withDateStart("2026-01-20")
        .withDateEnd("2026-01-30")
        .build();

      beforeEach(async () => {
        await conventionRepository.save(
          conventionFrom10To20,
          new Date("2026-01-11T00:00:00.000Z").toISOString(),
        );
        await conventionRepository.save(
          conventionFrom15To25,
          new Date("2026-01-16T00:00:00.000Z").toISOString(),
        );
        await conventionRepository.save(
          conventionFrom20To30,
          new Date("2026-01-21T00:00:00.000Z").toISOString(),
        );
      });

      it("filters by withDateStart range", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withDateStart: {
                from: new Date("2026-01-12"),
                to: new Date("2026-01-18"),
              },
            },
          }),
          [conventionFrom15To25.id],
        );
      });

      it("filters by withEndDate range", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withEndDate: {
                from: new Date("2026-01-18"),
                to: new Date("2026-01-26"),
              },
            },
          }),
          [conventionFrom15To25.id, conventionFrom10To20.id],
        );
      });

      it("filters by withUpdateDate range", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withUpdateDate: {
                from: new Date("2026-01-15"),
                to: new Date("2026-01-18"),
              },
            },
          }),
          [conventionFrom15To25.id],
        );
      });
    });

    describe("withAgencyIds filter", () => {
      const otherAgency = AgencyDtoBuilder.create(uuid())
        .withName("Other agency")
        .build();

      const conventionOnAgency = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(agency.id)
        .withDateStart("2026-02-01")
        .build();

      const conventionOnOtherAgency = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(otherAgency.id)
        .withDateStart("2026-02-02")
        .build();

      beforeEach(async () => {
        await agencyRepo.insert(
          toAgencyWithRights(otherAgency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(conventionOnAgency);
        await conventionRepository.save(conventionOnOtherAgency);
      });

      it("returns conventions matching a single agency id", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: { withAgencyIds: [agency.id] },
          }),
          [conventionOnAgency.id],
        );
      });

      it("returns conventions matching multiple agency ids", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: { withAgencyIds: [agency.id, otherAgency.id] },
          }),
          [conventionOnOtherAgency.id, conventionOnAgency.id],
        );
      });

      it("returns empty when no convention matches agency ids", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: { withAgencyIds: [uuid()] },
          }),
          [],
        );
      });
    });

    describe("withDateSubmission filter", () => {
      const submissionFrom = new Date("2026-01-15T00:00:00.000Z");

      const recentConvention = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(agency.id)
        .withDateSubmission("2026-01-20T10:00:00.000Z")
        .withDateStart("2026-02-01")
        .build();

      const oldConvention = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(agency.id)
        .withDateSubmission("2026-01-10T10:00:00.000Z")
        .withDateStart("2026-01-12")
        .build();

      beforeEach(async () => {
        await conventionRepository.save(recentConvention);
        await conventionRepository.save(oldConvention);
      });

      it("returns conventions submitted on or after from", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: { withDateSubmission: { from: submissionFrom } },
          }),
          [recentConvention.id],
        );
      });

      it("includes conventions submitted exactly on from", async () => {
        const conventionSubmittedOnFromDate = new ConventionDtoBuilder()
          .withId(uuid())
          .withAgencyId(agency.id)
          .withDateSubmission("2026-01-15T08:00:00.000Z")
          .withDateStart("2026-01-20")
          .build();

        await conventionRepository.save(conventionSubmittedOnFromDate);

        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: { withDateSubmission: { from: submissionFrom } },
          }),
          [recentConvention.id, conventionSubmittedOnFromDate.id],
        );
      });

      it("filters by withDateSubmission range", async () => {
        const midConvention = new ConventionDtoBuilder()
          .withId(uuid())
          .withAgencyId(agency.id)
          .withDateSubmission("2026-01-16T10:00:00.000Z")
          .withDateStart("2026-01-25")
          .build();

        await conventionRepository.save(midConvention);

        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {
              withDateSubmission: {
                from: new Date("2026-01-12T00:00:00.000Z"),
                to: new Date("2026-01-18T00:00:00.000Z"),
              },
            },
          }),
          [midConvention.id],
        );
      });
    });

    describe("limit", () => {
      const convention1 = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(agency.id)
        .withDateStart("2026-01-01")
        .build();
      const convention2 = new ConventionDtoBuilder()
        .withId(uuid())
        .withAgencyId(agency.id)
        .withDateStart("2026-01-02")
        .build();

      beforeEach(async () => {
        await conventionRepository.save(convention1);
        await conventionRepository.save(convention2);
      });

      it("without limit get all convention Ids", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({ filters: {} }),
          [convention2.id, convention1.id],
        );
      });

      it("with limit 1 get convention id with highest start date", async () => {
        expectToEqual(
          await conventionQueries.getConventionIdsByFilters({
            filters: {},
            limit: 1,
          }),
          [convention2.id],
        );
      });
    });
  });

  describe.each([
    "Pg",
    "InMemory",
  ] as const)("%s getPaginatedConventions", (adapter) => {
    const agencyId = "cccccc99-9c0b-1bbb-bb6d-6bb9bd38cccc";
    const agency = new AgencyDtoBuilder()
      .withId(agencyId)
      .withName("Test Agency")
      .withAddress({
        city: "Paris",
        departmentCode: "75",
        postcode: "75017",
        streetNumberAndAddress: "Avenue des champs Elysées",
      })
      .build();

    const differentAgencyId = "dddddddd-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const differentAgency = new AgencyDtoBuilder()
      .withId(differentAgencyId)
      .withName("Different Agency")
      .withAddress({
        city: "Lyon",
        departmentCode: "69",
        postcode: "69001",
        streetNumberAndAddress: "Rue de la République",
      })
      .build();

    const conventionA = new ConventionDtoBuilder()
      .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withSiret("12345678901235")
      .withAgencyId(agencyId)
      .withBeneficiaryEmail("beneficiary@convention-a.com")
      .withStatus("READY_TO_SIGN")
      .withDateStart(new Date("2023-01-15").toISOString())
      .withDateEnd(new Date("2023-01-20").toISOString())
      .withDateSubmission(new Date("2023-01-10").toISOString())
      .withBeneficiaryFirstName("John")
      .withBeneficiaryLastName("Doe")
      .withBusinessName("Business A")
      .withAgencyReferent({
        firstname: "Marie",
        lastname: "Dupont",
      })
      .withUpdatedAt(anyConventionUpdatedAt)
      .build();

    const conventionB = new ConventionDtoBuilder()
      .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .withAgencyId(agencyId)
      .withStatus("IN_REVIEW")
      .withDateStart(new Date("2023-02-15").toISOString())
      .withDateEnd(new Date("2023-02-20").toISOString())
      .withDateSubmission(new Date("2023-02-10").toISOString())
      .withBeneficiaryFirstName("Jane")
      .withBeneficiaryLastName("Smith")
      .withBusinessName("Business B")
      .withAgencyReferent({
        firstname: "Pierre",
        lastname: "Martin",
      })
      .withUpdatedAt(anyConventionUpdatedAt)
      .build();

    const conventionC = new ConventionDtoBuilder()
      .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
      .withAgencyId(agencyId)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(new Date("2023-03-15").toISOString())
      .withDateEnd(new Date("2023-03-20").toISOString())
      .withDateSubmission(new Date("2023-03-10").toISOString())
      .withBeneficiaryFirstName("Alice")
      .withBeneficiaryLastName("Johnson")
      .withBusinessName("Business C")
      .withUpdatedAt(anyConventionUpdatedAt)
      .build();

    const conventionD = new ConventionDtoBuilder()
      .withId("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
      .withAgencyId(differentAgencyId)
      .withStatus("READY_TO_SIGN")
      .withDateStart(new Date("2023-04-15").toISOString())
      .withDateEnd(new Date("2023-04-20").toISOString())
      .withDateSubmission(new Date("2023-04-10").toISOString())
      .withBeneficiaryFirstName("Bob")
      .withBeneficiaryLastName("Brown")
      .withBusinessName("Business D")
      .withUpdatedAt(anyConventionUpdatedAt)
      .build();

    const completedAssessment = new AssessmentDtoBuilder()
      .withConventionId(conventionC.id)
      .withCreatedAt(
        addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 2).toISOString(),
      )
      .build();

    let conventionQueries: ConventionQueries;
    let agencyRepo: AgencyRepository;
    let assessmentRepo: AssessmentRepository;
    let conventionRepository: ConventionRepository;

    beforeEach(async () => {
      if (adapter === "Pg") {
        conventionQueries = new PgConventionQueries(db);
        agencyRepo = new PgAgencyRepository(db);
        assessmentRepo = new PgAssessmentRepository(db);
        conventionRepository = new PgConventionRepository(db);
      } else {
        const uow = createInMemoryUow();
        conventionQueries = uow.conventionQueries;
        agencyRepo = uow.agencyRepository;
        assessmentRepo = uow.assessmentRepository;
        conventionRepository = uow.conventionRepository;
      }

      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

      await agencyRepo.insert(
        toAgencyWithRights(differentAgency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        }),
      );

      await Promise.all([
        conventionRepository.save(conventionA, anyConventionUpdatedAt),
        conventionRepository.save(conventionB, anyConventionUpdatedAt),
        conventionRepository.save(conventionC, anyConventionUpdatedAt),
        conventionRepository.save(conventionD, anyConventionUpdatedAt),
      ]);

      await assessmentRepo.save(
        createAssessmentEntity(completedAssessment, conventionC),
      );
    });

    it("should return conventions with pagination", async () => {
      const resultPage1 = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 2 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expect(resultPage1.pagination).toEqual({
        currentPage: 1,
        totalPages: 2,
        numberPerPage: 2,
        totalRecords: 4,
      });
      expectToEqual(resultPage1.data, [conventionD, conventionC]);

      const resultPage2 = await conventionQueries.getPaginatedConventions({
        pagination: { page: 2, perPage: 2 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(resultPage2.data, [conventionB, conventionA]);
      expectToEqual(resultPage2.pagination, {
        currentPage: 2,
        totalPages: 2,
        numberPerPage: 2,
        totalRecords: 4,
      });
    });

    it("should not filter by agency when agencyIds is undefined", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [
        conventionD,
        conventionC,
        conventionB,
        conventionA,
      ]);
      expectToEqual(result.pagination, {
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
        totalRecords: 4,
      });
    });

    it("should return correct data when accessing a non-first page", async () => {
      const resultPage3 = await conventionQueries.getPaginatedConventions({
        pagination: { page: 3, perPage: 1 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(resultPage3, {
        data: [conventionB],
        pagination: {
          currentPage: 3,
          totalPages: 4,
          numberPerPage: 1,
          totalRecords: 4,
        },
      });
    });

    it("should filter conventions by status", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          statuses: ["READY_TO_SIGN"],
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionD, conventionA]);
    });

    it("should filter conventions by beneficiary name", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { search: "John" },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expect(result.data.length).toBe(2);
    });

    it("should filter conventions by beneficiary fullname", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { search: "John D" },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expect(result.data.length).toBe(1);
      expectToEqual(result.data[0].signatories.beneficiary.lastName, "Doe");
      expectToEqual(result.data[0].signatories.beneficiary.firstName, "John");
    });

    it("should filter conventions by establishment name", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          search: "Business B",
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionB]);
    });

    it("should filter conventions by establishment SIRET", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          search: conventionA.siret,
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });
      expectToEqual(result.data, [conventionA]);
    });

    it("should filter conventions by convention ID", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          search: conventionA.id,
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionA]);
    });

    it("should return no results for non-existent convention ID", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          search: "00000000-0000-0000-0000-000000000000",
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, []);
    });

    it("should filter conventions by agency referent first name", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { search: "Marie" },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionA]);
    });

    it("should filter conventions by agency referent last name", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { search: "Martin" },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionB]);
    });

    it("should filter conventions by agency referent fullname", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          search: "Pierre Martin",
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionB]);
    });

    it("should filter conventions by date range", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          dateStart: {
            from: "2023-02-01",
            to: "2023-03-31",
          },
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionC, conventionB]);
    });
    it("should filter conventions by date range with only from", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          dateEnd: {
            from: "2023-03-01",
          },
        },
        sort: {
          by: "dateEnd",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionD, conventionC]);
    });

    describe("assessment completion status filter", () => {
      describe("assessment filter is 'finalized'", () => {
        it(`should return old convention with assessment created before ${ASSESSEMENT_SIGNATURE_RELEASE_DATE.toISOString()}`, async () => {
          const oldAssessmentCreatedAt = subMonths(
            ASSESSEMENT_SIGNATURE_RELEASE_DATE,
            1,
          ).toISOString();

          const conventionWithOldAssessment: ConventionDto = {
            ...conventionB,
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            status: "ACCEPTED_BY_VALIDATOR",
          };

          const oldAssessmentWithoutSignature: AssessmentDto = {
            ...completedAssessment,
            conventionId: conventionWithOldAssessment.id,
            createdAt: oldAssessmentCreatedAt,
            signedAt: null,
          };

          await conventionRepository.save(
            conventionWithOldAssessment,
            anyConventionUpdatedAt,
          );
          await assessmentRepo.save(
            createAssessmentEntity(
              oldAssessmentWithoutSignature,
              conventionWithOldAssessment,
            ),
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["finalized"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionWithOldAssessment]);
        });

        it(`should return convention with assessment signed and created after ${ASSESSEMENT_SIGNATURE_RELEASE_DATE.toISOString()}`, async () => {
          const signedAssessment: AssessmentDto = {
            ...completedAssessment,
            conventionId: conventionC.id,
            createdAt: addDays(
              ASSESSEMENT_SIGNATURE_RELEASE_DATE,
              2,
            ).toISOString(),
            signedAt: addDays(
              ASSESSEMENT_SIGNATURE_RELEASE_DATE,
              2,
            ).toISOString(),
          };

          await assessmentRepo.update({
            ...signedAssessment,
            _entityName: "Assessment",
            numberOfHoursActuallyMade: null,
          });

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["finalized"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionC]);
        });
      });

      describe("assessment filter is 'to-sign'", () => {
        it(`should return convention when assessment is created after ${ASSESSEMENT_SIGNATURE_RELEASE_DATE.toISOString()}`, async () => {
          const oldAssessmentCreatedAt = subMonths(
            ASSESSEMENT_SIGNATURE_RELEASE_DATE,
            1,
          ).toISOString();

          const conventionWithOldAssessment: ConventionDto = {
            ...conventionB,
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            status: "ACCEPTED_BY_VALIDATOR",
          };

          const oldAssessment: AssessmentDto = {
            ...completedAssessment,
            conventionId: conventionWithOldAssessment.id,
            createdAt: oldAssessmentCreatedAt,
          };

          await conventionRepository.save(
            conventionWithOldAssessment,
            anyConventionUpdatedAt,
          );
          await assessmentRepo.save(
            createAssessmentEntity(oldAssessment, conventionWithOldAssessment),
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-sign"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionC]);
        });
      });

      describe("assessment filter is 'to-complete'", () => {
        it("should return convention when missing assessment", async () => {
          const oldConventionWithoutAssessment: ConventionDto = {
            ...conventionB,
            status: "ACCEPTED_BY_VALIDATOR",
            updatedAt: anyConventionUpdatedAt,
          };
          const recentConventionWithoutAssessment = new ConventionDtoBuilder(
            conventionA,
          )
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .withDateStart(new Date("2023-03-15").toISOString())
            .withDateEnd(new Date("2023-03-20").toISOString())
            .withDateSubmission(new Date("2023-03-10").toISOString())
            .withSchedule(reasonableSchedule)
            .withUpdatedAt(anyConventionUpdatedAt)
            .build();
          await conventionRepository.update(
            oldConventionWithoutAssessment,
            anyConventionUpdatedAt,
          );
          await conventionRepository.update(
            recentConventionWithoutAssessment,
            anyConventionUpdatedAt,
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-complete"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [
            recentConventionWithoutAssessment,
            oldConventionWithoutAssessment,
          ]);
        });

        it("should return empty array when assessment completion status to-complete does not match any convention", async () => {
          const validatedConvention: ConventionDto = {
            ...conventionB,
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
            status: "ACCEPTED_BY_VALIDATOR",
          };
          const signedAt = new Date().toISOString();
          const signedAssessment = new AssessmentDtoBuilder()
            .withConventionId(validatedConvention.id)
            .withBeneficiarySignature({
              beneficiaryAgreement: true,
              beneficiaryFeedback: "feedback",
              signedAt,
            })
            .build();

          await conventionRepository.save(
            validatedConvention,
            anyConventionUpdatedAt,
          );
          await assessmentRepo.save(
            createAssessmentEntity(signedAssessment, validatedConvention),
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-complete"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, []);
        });

        it("should exclude convention without assessment when dateEnd is in more than one day", async () => {
          const now = new Date();
          const conventionEndingInMoreThanOneDay = new ConventionDtoBuilder()
            .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3")
            .withSiret("12345678901236")
            .withAgencyId(agencyId)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .withDateStart(subDays(now, 10).toISOString())
            .withDateEnd(addDays(now, 5).toISOString())
            .withSchedule(reasonableSchedule)
            .withUpdatedAt(anyConventionUpdatedAt)
            .build();

          const conventionWithAssessmentToComplete = new ConventionDtoBuilder()
            .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5")
            .withSiret("12345678901238")
            .withAgencyId(agencyId)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .withDateStart(subDays(now, 5).toISOString())
            .withDateEnd(subDays(now, 1).toISOString())
            .withSchedule(reasonableSchedule)
            .withUpdatedAt(anyConventionUpdatedAt)
            .build();

          await conventionRepository.save(
            conventionEndingInMoreThanOneDay,
            anyConventionUpdatedAt,
          );
          await conventionRepository.save(
            conventionWithAssessmentToComplete,
            anyConventionUpdatedAt,
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-complete"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionWithAssessmentToComplete]);
        });

        it("should return convention without assessment when dateEnd is within one day", async () => {
          const now = new Date();
          const conventionEndingWithinOneDay = new ConventionDtoBuilder()
            .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4")
            .withSiret("12345678901237")
            .withAgencyId(agencyId)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .withDateStart(subDays(now, 5).toISOString())
            .withDateEnd(addDays(now, 1).toISOString())
            .withSchedule(reasonableSchedule)
            .withUpdatedAt(anyConventionUpdatedAt)
            .build();

          await conventionRepository.save(
            conventionEndingWithinOneDay,
            anyConventionUpdatedAt,
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-complete"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionEndingWithinOneDay]);
        });
      });

      describe("when multiple filters", () => {
        it("should filter conventions by assessment completion statuses to-complete + to-sign", async () => {
          const validatedConventionWithoutAssessment: ConventionDto = {
            ...conventionB,
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
            status: "ACCEPTED_BY_VALIDATOR",
          };
          await conventionRepository.save(
            validatedConventionWithoutAssessment,
            anyConventionUpdatedAt,
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["to-complete", "to-sign"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [
            conventionC,
            validatedConventionWithoutAssessment,
          ]);
        });

        it("should filter conventions by multiple assessment completion statuses signed + to-sign", async () => {
          const anotherValidatedConvention: ConventionDto = {
            ...conventionB,
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
            status: "ACCEPTED_BY_VALIDATOR",
          };
          const signedAt = new Date().toISOString();
          const signedAssessment = new AssessmentDtoBuilder()
            .withConventionId(anotherValidatedConvention.id)
            .withBeneficiarySignature({
              beneficiaryAgreement: true,
              beneficiaryFeedback: "feedback",
              signedAt,
            })
            .build();

          await conventionRepository.save(
            anotherValidatedConvention,
            anyConventionUpdatedAt,
          );
          await assessmentRepo.save(
            createAssessmentEntity(
              signedAssessment,
              anotherValidatedConvention,
            ),
          );

          const result = await conventionQueries.getPaginatedConventions({
            pagination: { page: 1, perPage: 10 },
            filters: {
              assessmentCompletionStatus: ["finalized", "to-sign"],
            },
            sort: {
              by: "dateSubmission",
              direction: "desc",
            },
          });

          expectToEqual(result.data, [conventionC, anotherValidatedConvention]);
        });
      });

      it("should not filter conventions by assessment completion statuses if the convention is not accepted by validator", async () => {
        const result = await conventionQueries.getPaginatedConventions({
          pagination: { page: 1, perPage: 10 },
          filters: {
            assessmentCompletionStatus: ["to-complete"],
          },
          sort: {
            by: "dateSubmission",
            direction: "desc",
          },
        });

        expectToEqual(result.data, []);
      });
    });

    it("should sort conventions by dateStart, then conventionId", async () => {
      const sameDateStartConvention = {
        ...conventionA,
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      };
      await conventionRepository.save(
        sameDateStartConvention,
        anyConventionUpdatedAt,
      );

      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        sort: {
          by: "dateStart",
          direction: "asc",
        },
      });

      expectToEqual(result.data, [
        conventionA,
        sameDateStartConvention,
        conventionB,
        conventionC,
        conventionD,
      ]);
    });

    it("should respect pagination limits", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 2 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionD, conventionC]);
    });

    it("should filter by multiple criteria", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          statuses: ["READY_TO_SIGN", "IN_REVIEW"],
          dateSubmission: {
            from: "2023-01-01",
            to: "2023-02-15",
          },
          search: "@convention-a.com",
        },
        sort: {
          by: "dateStart",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionA]);
    });

    it("should return empty page when agencyIds is empty", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        filters: { agencyIds: [] },
        pagination: { page: 1, perPage: 10 },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result, {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 0,
        },
      });
    });

    it("should filter conventions by agencyIds", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { agencyIds: [agencyId] },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionC, conventionB, conventionA]);

      // Verify all returned conventions belong to the specified agency
      const allConventionsBelongToSpecifiedAgency = result.data.every(
        (convention) => convention.agencyId === agencyId,
      );
      expect(allConventionsBelongToSpecifiedAgency).toBe(true);
    });

    it("should filter conventions by multiple agencyIds", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: { agencyIds: [agencyId, differentAgencyId] },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [
        conventionD,
        conventionC,
        conventionB,
        conventionA,
      ]);
    });

    it("should filter conventions by agencyIds combined with other filters", async () => {
      const result = await conventionQueries.getPaginatedConventions({
        pagination: { page: 1, perPage: 10 },
        filters: {
          agencyIds: [agencyId],
          statuses: ["READY_TO_SIGN"],
        },
        sort: {
          by: "dateSubmission",
          direction: "desc",
        },
      });

      expectToEqual(result.data, [conventionA]);
    });
  });

  describe("getConventionsWithErroredBroadcastFeedbackForAgencyUser", () => {
    describe("when no conventions with errored broadcast feedback for the agency user", () => {
      it("should return empty array with pagination info", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
              pagination: { page: 1, perPage: 10 },
            },
          );

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        });
      });
    });

    describe("when conventions have multiple errored broadcast feedbacks for the agency user", () => {
      it("should return conventions with the last errored broadcast feedback for the agency user with pagination", async () => {
        const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
        const convention = new ConventionDtoBuilder()
          .withId(conventionIdA)
          .withAgencyId(agencyIdA)
          .withDateSubmission("2025-01-02T00:00:00.000Z")
          .build();
        const firstBroadcast: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: conventionIdA,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-01T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: conventionIdA,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message-1",
            error: { code: "ANY_ERROR_CODE_1" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE_1" },
          },
        };
        const lastBroadcast: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: convention.id,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-30T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: convention.id,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message-2",
            error: { code: "ANY_ERROR_CODE_2" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE_2" },
          },
        };
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(convention);
        await broadcastFeedbacksRepository.save(firstBroadcast);
        await broadcastFeedbacksRepository.save(lastBroadcast);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: convention.id,
              status: "READY_TO_SIGN",
              beneficiary: {
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...lastBroadcast,
                subscriberErrorFeedback: {
                  message: lastBroadcast.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    lastBroadcast.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("when convention broadcast finally succeeded, it should not be returned", async () => {
        const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
        const convention = new ConventionDtoBuilder()
          .withId(conventionIdA)
          .withAgencyId(agencyIdA)
          .withDateSubmission("2025-01-02T00:00:00.000Z")
          .build();
        const firstBroadcast: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: conventionIdA,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-01T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: conventionIdA,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message-1",
            error: { code: "ANY_ERROR_CODE_1" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE_1" },
          },
        };
        const lastBroadcast: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: convention.id,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-30T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: convention.id,
            conventionStatus: "READY_TO_SIGN",
          },
          response: {
            httpStatus: 200,
          },
        };
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(convention);
        await broadcastFeedbacksRepository.save(firstBroadcast);
        await broadcastFeedbacksRepository.save(lastBroadcast);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
            },
          );

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        });
      });
    });

    describe("unvalidated convention status and prior successful broadcast (SQL filter)", () => {
      const cancelledConventionId: ConventionId =
        "33333333-3333-4333-8333-333333333333";

      const cancelledConvention: ConventionDto = new ConventionDtoBuilder()
        .withId(cancelledConventionId)
        .withAgencyId(agencyIdA)
        .withStatus("CANCELLED")
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();

      const errorBroadcast: BroadcastFeedback = {
        consumerId: null,
        consumerName: "any-consumer-name",
        conventionId: cancelledConventionId,
        agencyId: agencyIdA,
        serviceName:
          "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
        occurredAt: "2024-07-01T00:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: cancelledConventionId,
          conventionStatus: "CANCELLED",
        },
        subscriberErrorFeedback: {
          message: "Aucun dossier trouvé pour les critères d'identité transmis",
          error: { code: "ANY_FUNCTIONAL_ERROR" },
        },
        response: {
          httpStatus: 500,
          body: { error: "ANY_FUNCTIONAL_ERROR" },
        },
      };

      const agency = new AgencyDtoBuilder().withId(agencyIdA).build();

      beforeEach(async () => {
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(cancelledConvention);
        await broadcastFeedbacksRepository.save(errorBroadcast);
      });

      it("includes convention in unvalidated status when a prior broadcast succeeded", async () => {
        const priorSuccessBroadcast: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: cancelledConventionId,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-06-01T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: cancelledConventionId,
            conventionStatus: "CANCELLED",
          },
          response: {
            httpStatus: 200,
          },
        };

        await broadcastFeedbacksRepository.save(priorSuccessBroadcast);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { broadcastErrorKind: "functional" },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: cancelledConvention.id,
              status: "CANCELLED",
              beneficiary: {
                firstname:
                  cancelledConvention.signatories.beneficiary.firstName,
                lastname: cancelledConvention.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...errorBroadcast,
                subscriberErrorFeedback: {
                  message:
                    errorBroadcast.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    errorBroadcast.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("excludes convention in unvalidated status when every broadcast errored", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { broadcastErrorKind: "functional" },
            },
          );

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        });
      });
    });

    describe("when there are conventions with handled broadcast errors", () => {
      const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
      const defaultPagination = { page: 1, perPage: 10 };

      beforeEach(async () => {
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
      });

      it("should not return conventions where the latest errored broadcast feedback is handled", async () => {
        const conventionA = new ConventionDtoBuilder()
          .withId(conventionIdA)
          .withAgencyId(agencyIdA)
          .withDateSubmission("2025-01-02T00:00:00.000Z")
          .build();
        const conventionB = new ConventionDtoBuilder()
          .withId(conventionIdB)
          .withAgencyId(agencyIdA)
          .withDateSubmission("2025-01-02T00:00:00.000Z")
          .build();

        const handledErrorFeedback: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: conventionA.id,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-01T00:00:00.000Z",
          handledByAgency: true,
          requestParams: {
            conventionId: conventionA.id,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message",
            error: { code: "ANY_ERROR_CODE" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE" },
          },
        };
        const unhandledErrorFeedback: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: conventionB.id,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-02T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: conventionB.id,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message",
            error: { code: "ANY_ERROR_CODE" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE" },
          },
        };

        await conventionRepository.save(conventionA);
        await conventionRepository.save(conventionB);
        await broadcastFeedbacksRepository.save(handledErrorFeedback);
        await broadcastFeedbacksRepository.save(unhandledErrorFeedback);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: defaultPagination,
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionB.id,
              status: conventionB.status,
              beneficiary: {
                firstname: conventionB.signatories.beneficiary.firstName,
                lastname: conventionB.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...unhandledErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    unhandledErrorFeedback.subscriberErrorFeedback?.message ??
                    "",
                  error: JSON.stringify(
                    unhandledErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });

        const handledConventionInResults = result.data.some(
          (convention) => convention.id === conventionA.id,
        );
        expect(handledConventionInResults).toBe(false);
      });

      it("should not return conventions where the latest broadcast feedback is handled, even if earlier ones were unhandled", async () => {
        const convention = new ConventionDtoBuilder()
          .withId(conventionIdA)
          .withAgencyId(agencyIdA)
          .build();

        const unhandledErrorFeedback: BroadcastFeedback = {
          consumerId: null,
          consumerName: "any-consumer-name",
          conventionId: convention.id,
          agencyId: agencyIdA,
          serviceName:
            "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
          occurredAt: "2024-07-01T00:00:00.000Z",
          handledByAgency: false,
          requestParams: {
            conventionId: convention.id,
            conventionStatus: "READY_TO_SIGN",
          },
          subscriberErrorFeedback: {
            message: "any-error-message-1",
            error: { code: "ANY_ERROR_CODE_1" },
          },
          response: {
            httpStatus: 500,
            body: { error: "ANY_ERROR_CODE_1" },
          },
        };
        const handledErrorFeedback: BroadcastFeedback = {
          ...unhandledErrorFeedback,
          occurredAt: "2024-07-30T00:00:00.000Z",
          handledByAgency: true,
        };

        await conventionRepository.save(convention);
        await broadcastFeedbacksRepository.save(unhandledErrorFeedback);
        await broadcastFeedbacksRepository.save(handledErrorFeedback);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: defaultPagination,
            },
          );

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        });
      });
    });

    describe("when there are several conventions with errored broadcast feedback", () => {
      const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
      const convention1 = new ConventionDtoBuilder()
        .withId(conventionIdA)
        .withAgencyId(agencyIdA)
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();
      const convention2 = new ConventionDtoBuilder()
        .withId(conventionIdB)
        .withAgencyId(agencyIdA)
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();
      const convention3 = new ConventionDtoBuilder()
        .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
        .withAgencyId(agencyIdA)
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();
      const broadcast1: BroadcastFeedback = {
        consumerId: null,
        consumerName: "any-consumer-name",
        conventionId: convention1.id,
        agencyId: agencyIdA,
        serviceName:
          "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
        occurredAt: "2024-07-01T00:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: convention1.id,
          conventionStatus: "READY_TO_SIGN",
        },
        subscriberErrorFeedback: {
          message: "any-error-message-1",
          error: { code: "ANY_ERROR_CODE_1" },
        },
        response: {
          httpStatus: 500,
          body: { error: "ANY_ERROR_CODE_1" },
        },
      };
      const broadcast2: BroadcastFeedback = {
        ...broadcast1,
        conventionId: convention2.id,
        occurredAt: "2024-07-02T00:00:00.000Z",
        requestParams: {
          conventionId: convention2.id,
          conventionStatus: "READY_TO_SIGN",
        },
      };
      const broadcast3: BroadcastFeedback = {
        ...broadcast1,
        conventionId: convention3.id,
        occurredAt: "2024-07-03T00:00:00.000Z",
        requestParams: {
          conventionId: convention3.id,
          conventionStatus: "READY_TO_SIGN",
        },
      };

      beforeEach(async () => {
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(convention1);
        await conventionRepository.save(convention2);
        await conventionRepository.save(convention3);
        await broadcastFeedbacksRepository.save(broadcast2);
        await broadcastFeedbacksRepository.save(broadcast1);
        await broadcastFeedbacksRepository.save(broadcast3);
      });

      it.each([
        {
          requestedPagination: { page: 3, perPage: 1 },
          expectedResult: {
            data: [
              {
                id: convention1.id,
                status: convention1.status,
                beneficiary: {
                  firstname: convention1.signatories.beneficiary.firstName,
                  lastname: convention1.signatories.beneficiary.lastName,
                },
                lastBroadcastFeedback: {
                  ...broadcast1,
                  subscriberErrorFeedback: {
                    message: broadcast1.subscriberErrorFeedback?.message ?? "",
                    error: JSON.stringify(
                      broadcast1.subscriberErrorFeedback?.error,
                    ),
                  },
                },
              },
            ],
            pagination: {
              currentPage: 3,
              totalPages: 3,
              numberPerPage: 1,
              totalRecords: 3,
            },
          },
        },
        {
          requestedPagination: { page: 1, perPage: 10 },
          expectedResult: {
            data: [
              {
                id: convention3.id,
                status: convention3.status,
                beneficiary: {
                  firstname: convention3.signatories.beneficiary.firstName,
                  lastname: convention3.signatories.beneficiary.lastName,
                },
                lastBroadcastFeedback: {
                  ...broadcast3,
                  subscriberErrorFeedback: {
                    message: broadcast3.subscriberErrorFeedback?.message ?? "",
                    error: JSON.stringify(
                      broadcast3.subscriberErrorFeedback?.error,
                    ),
                  },
                },
              },
              {
                id: convention2.id,
                status: convention2.status,
                beneficiary: {
                  firstname: convention2.signatories.beneficiary.firstName,
                  lastname: convention2.signatories.beneficiary.lastName,
                },
                lastBroadcastFeedback: {
                  ...broadcast2,
                  subscriberErrorFeedback: {
                    message: broadcast2.subscriberErrorFeedback?.message ?? "",
                    error: JSON.stringify(
                      broadcast2.subscriberErrorFeedback?.error,
                    ),
                  },
                },
              },
              {
                id: convention1.id,
                status: convention1.status,
                beneficiary: {
                  firstname: convention1.signatories.beneficiary.firstName,
                  lastname: convention1.signatories.beneficiary.lastName,
                },
                lastBroadcastFeedback: {
                  ...broadcast1,
                  subscriberErrorFeedback: {
                    message: broadcast1.subscriberErrorFeedback?.message ?? "",
                    error: JSON.stringify(
                      broadcast1.subscriberErrorFeedback?.error,
                    ),
                  },
                },
              },
            ],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 3,
            },
          },
        },
        {
          requestedPagination: { page: 2, perPage: 2 },
          expectedResult: {
            data: [
              {
                id: convention1.id,
                status: convention1.status,
                beneficiary: {
                  firstname: convention1.signatories.beneficiary.firstName,
                  lastname: convention1.signatories.beneficiary.lastName,
                },
                lastBroadcastFeedback: {
                  ...broadcast1,
                  subscriberErrorFeedback: {
                    message: broadcast1.subscriberErrorFeedback?.message ?? "",
                    error: JSON.stringify(
                      broadcast1.subscriberErrorFeedback?.error,
                    ),
                  },
                },
              },
            ],
            pagination: {
              currentPage: 2,
              totalPages: 2,
              numberPerPage: 2,
              totalRecords: 3,
            },
          },
        },
      ])("results are ordered by occurredtAt desc and paginated", async ({
        requestedPagination,
        expectedResult,
      }) => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agency.id],
              pagination: requestedPagination,
            },
          );

        expectToEqual(result, expectedResult);
      });
    });

    describe("filters", () => {
      const agency = new AgencyDtoBuilder().withId(agencyIdA).build();
      const conventionWithManagedError = new ConventionDtoBuilder()
        .withId(conventionIdA)
        .withAgencyId(agencyIdA)
        .withStatus("READY_TO_SIGN")
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();
      const conventionWithUnmanagedError = new ConventionDtoBuilder()
        .withId(conventionIdB)
        .withAgencyId(agencyIdA)
        .withStatus("READY_TO_SIGN")
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();
      const conventionInReviewWithManagedError = new ConventionDtoBuilder()
        .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
        .withAgencyId(agencyIdA)
        .withStatus("IN_REVIEW")
        .withDateSubmission("2025-01-02T00:00:00.000Z")
        .build();

      const managedErrorFeedback: BroadcastFeedback = {
        consumerId: null,
        consumerName: "any-consumer-name",
        conventionId: conventionWithManagedError.id,
        agencyId: agencyIdA,
        serviceName:
          "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
        occurredAt: "2024-07-01T00:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: conventionWithManagedError.id,
          conventionStatus: "READY_TO_SIGN",
        },
        subscriberErrorFeedback: {
          message: "Aucun dossier trouvé pour les critères d'identité transmis",
          error: { code: "MANAGED_ERROR" },
        },
        response: {
          httpStatus: 500,
          body: { error: "MANAGED_ERROR" },
        },
      };

      const unmanagedErrorFeedback: BroadcastFeedback = {
        consumerId: null,
        consumerName: "any-consumer-name",
        conventionId: conventionWithUnmanagedError.id,
        agencyId: agencyIdA,
        serviceName:
          "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
        occurredAt: "2024-07-02T00:00:00.000Z",
        handledByAgency: false,
        requestParams: {
          conventionId: conventionWithUnmanagedError.id,
          conventionStatus: "READY_TO_SIGN",
        },
        subscriberErrorFeedback: {
          message: "Some unmanaged error message",
          error: { code: "UNMANAGED_ERROR" },
        },
        response: {
          httpStatus: 500,
          body: { error: "UNMANAGED_ERROR" },
        },
      };

      const managedErrorFeedbackInReview: BroadcastFeedback = {
        ...managedErrorFeedback,
        conventionId: conventionInReviewWithManagedError.id,
        occurredAt: "2024-07-03T00:00:00.000Z",
        requestParams: {
          conventionId: conventionInReviewWithManagedError.id,
          conventionStatus: "IN_REVIEW",
        },
      };

      beforeEach(async () => {
        await agencyRepo.insert(
          toAgencyWithRights(agency, {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          }),
        );
        await conventionRepository.save(conventionWithManagedError);
        await conventionRepository.save(conventionWithUnmanagedError);
        await conventionRepository.save(conventionInReviewWithManagedError);
        await broadcastFeedbacksRepository.save(managedErrorFeedback);
        await broadcastFeedbacksRepository.save(unmanagedErrorFeedback);
        await broadcastFeedbacksRepository.save(managedErrorFeedbackInReview);
      });

      it("should return only functional errors when broadcastErrorKind is 'functional'", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { broadcastErrorKind: "functional" },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionInReviewWithManagedError.id,
              status: conventionInReviewWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .firstName,
                lastname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedbackInReview,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedbackInReview.subscriberErrorFeedback
                      ?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedbackInReview.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
            {
              id: conventionWithManagedError.id,
              status: conventionWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionWithManagedError.signatories.beneficiary.firstName,
                lastname:
                  conventionWithManagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedback.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2,
          },
        });
      });

      it("should return only technical errors when broadcastErrorKind is 'technical'", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { broadcastErrorKind: "technical" },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionWithUnmanagedError.id,
              status: conventionWithUnmanagedError.status,
              beneficiary: {
                firstname:
                  conventionWithUnmanagedError.signatories.beneficiary
                    .firstName,
                lastname:
                  conventionWithUnmanagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...unmanagedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    unmanagedErrorFeedback.subscriberErrorFeedback?.message ??
                    "",
                  error: JSON.stringify(
                    unmanagedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("should filter by conventionStatus", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { conventionStatus: ["IN_REVIEW"] },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionInReviewWithManagedError.id,
              status: conventionInReviewWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .firstName,
                lastname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedbackInReview,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedbackInReview.subscriberErrorFeedback
                      ?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedbackInReview.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("should filter by both broadcastErrorKind and conventionStatus", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: {
                broadcastErrorKind: "functional",
                conventionStatus: ["READY_TO_SIGN"],
              },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionWithManagedError.id,
              status: conventionWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionWithManagedError.signatories.beneficiary.firstName,
                lastname:
                  conventionWithManagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedback.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("should filter by search (convention ID)", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: {
                search: conventionWithManagedError.id as SearchTextAlphaNumeric,
              },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionWithManagedError.id,
              status: conventionWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionWithManagedError.signatories.beneficiary.firstName,
                lastname:
                  conventionWithManagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedback.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("should return empty result when search does not match any convention ID", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: { search: "00000000-0000-0000-0000-000000000000" },
            },
          );

        expectToEqual(result, {
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 0,
          },
        });
      });

      it("should filter by search combined with other filters", async () => {
        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
              filters: {
                search: conventionWithManagedError.id as SearchTextAlphaNumeric,
                broadcastErrorKind: "functional",
                conventionStatus: ["READY_TO_SIGN"],
              },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionWithManagedError.id,
              status: conventionWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionWithManagedError.signatories.beneficiary.firstName,
                lastname:
                  conventionWithManagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedback.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          },
        });
      });

      it("should exclude conventions with date_submission before 2025", async () => {
        const conventionBefore2025 = new ConventionDtoBuilder()
          .withId("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
          .withAgencyId(agencyIdA)
          .withStatus("READY_TO_SIGN")
          .withDateSubmission("2024-12-31T23:59:59.000Z")
          .build();
        const conventionAfter2025 = new ConventionDtoBuilder()
          .withId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
          .withAgencyId(agencyIdA)
          .withStatus("READY_TO_SIGN")
          .withDateSubmission("2025-01-15T00:00:00.000Z")
          .build();
        const conventionOn2025 = new ConventionDtoBuilder()
          .withId("ffffffff-ffff-4fff-8fff-ffffffffffff")
          .withAgencyId(agencyIdA)
          .withStatus("READY_TO_SIGN")
          .withDateSubmission("2025-01-01T00:00:00.000Z")
          .build();

        const errorFeedbackWithConventionSubmitedBefore2025: BroadcastFeedback =
          {
            consumerId: null,
            consumerName: "any-consumer-name",
            conventionId: conventionBefore2025.id,
            agencyId: agencyIdA,
            serviceName:
              "FranceTravailGateway.notifyOnConventionUpdatedOrAssessmentCreated",
            occurredAt: "2024-07-01T00:00:00.000Z",
            handledByAgency: false,
            requestParams: {
              conventionId: conventionBefore2025.id,
              conventionStatus: "READY_TO_SIGN",
            },
            subscriberErrorFeedback: {
              message: "any-error-message",
              error: { code: "ANY_ERROR_CODE" },
            },
            response: {
              httpStatus: 500,
              body: { error: "ANY_ERROR_CODE" },
            },
          };

        const errorFeedbackAfter2025: BroadcastFeedback = {
          ...errorFeedbackWithConventionSubmitedBefore2025,
          conventionId: conventionAfter2025.id,
          occurredAt: "2025-07-01T00:00:00.000Z",
          requestParams: {
            conventionId: conventionAfter2025.id,
            conventionStatus: "READY_TO_SIGN",
          },
        };

        await conventionRepository.save(conventionBefore2025);
        await conventionRepository.save(conventionAfter2025);
        await conventionRepository.save(conventionOn2025);
        await broadcastFeedbacksRepository.save(
          errorFeedbackWithConventionSubmitedBefore2025,
        );
        await broadcastFeedbacksRepository.save(errorFeedbackAfter2025);

        const result =
          await conventionQueries.getConventionsWithErroredBroadcastFeedbackForAgencyUser(
            {
              userAgencyIds: [agencyIdA],
              pagination: { page: 1, perPage: 10 },
            },
          );

        expectToEqual(result, {
          data: [
            {
              id: conventionAfter2025.id,
              status: conventionAfter2025.status,
              beneficiary: {
                firstname:
                  conventionAfter2025.signatories.beneficiary.firstName,
                lastname: conventionAfter2025.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...errorFeedbackAfter2025,
                subscriberErrorFeedback: {
                  message:
                    errorFeedbackAfter2025.subscriberErrorFeedback?.message ??
                    "",
                  error: JSON.stringify(
                    errorFeedbackAfter2025.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
            {
              id: conventionInReviewWithManagedError.id,
              status: conventionInReviewWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .firstName,
                lastname:
                  conventionInReviewWithManagedError.signatories.beneficiary
                    .lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedbackInReview,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedbackInReview.subscriberErrorFeedback
                      ?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedbackInReview.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
            {
              id: conventionWithUnmanagedError.id,
              status: conventionWithUnmanagedError.status,
              beneficiary: {
                firstname:
                  conventionWithUnmanagedError.signatories.beneficiary
                    .firstName,
                lastname:
                  conventionWithUnmanagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...unmanagedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    unmanagedErrorFeedback.subscriberErrorFeedback?.message ??
                    "",
                  error: JSON.stringify(
                    unmanagedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
            {
              id: conventionWithManagedError.id,
              status: conventionWithManagedError.status,
              beneficiary: {
                firstname:
                  conventionWithManagedError.signatories.beneficiary.firstName,
                lastname:
                  conventionWithManagedError.signatories.beneficiary.lastName,
              },
              lastBroadcastFeedback: {
                ...managedErrorFeedback,
                subscriberErrorFeedback: {
                  message:
                    managedErrorFeedback.subscriberErrorFeedback?.message ?? "",
                  error: JSON.stringify(
                    managedErrorFeedback.subscriberErrorFeedback?.error,
                  ),
                },
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 4,
          },
        });
      });
    });
  });

  describe("getConventionsWithUnfinalizedAssessmentForAgencyUser", () => {
    const now = new Date("2026-06-15T10:00:00Z");
    const threeMonthsAgo = subMonths(now, 3);
    const twoDaysAgo = subDays(now, 2);
    const lessThanThreeMonthsAgo = addDays(threeMonthsAgo, 2);
    const moreThanThreeMonthsAgo = subDays(threeMonthsAgo, 2);
    const afterSignatureRelease = addDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      10,
    );
    const beforeSignatureRelease = subDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      1,
    );

    const validatedConventionEnded5DaysAgo = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withAgencyId(agencyIdA)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(subDays(now, 30).toISOString())
      .withDateEnd(subDays(now, 5).toISOString())
      .build();

    const validatedConventionEndedMoreThanThreeMonthsAgo =
      new ConventionDtoBuilder()
        .withId("22222222-2222-4222-8222-222222222222")
        .withAgencyId(agencyIdA)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(moreThanThreeMonthsAgo.toISOString())
        .build();

    const validatedConventionEndedInTheFuture = new ConventionDtoBuilder()
      .withId("33333333-3333-4333-8333-333333333333")
      .withAgencyId(agencyIdA)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateEnd(addDays(now, 5).toISOString())
      .build();

    beforeEach(async () => {
      await agencyRepo.insert(
        toAgencyWithRights(
          new AgencyDtoBuilder().withId(agencyIdA).withName("agency A").build(),
          {
            [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          },
        ),
      );
    });

    it("returns to-complete conventions whose dateEnd is within the last 3 months", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [
          {
            id: validatedConventionEnded5DaysAgo.id,
            dateEnd: validatedConventionEnded5DaysAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .firstName,
              lastname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .lastName,
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
      });
    });

    it("excludes to-complete conventions ended more than 3 months ago", async () => {
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 0,
        },
      });
    });

    it("excludes to-complete conventions whose dateEnd is in the future", async () => {
      await conventionRepository.save(validatedConventionEndedInTheFuture);

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 0,
        },
      });
    });

    it("returns to-sign conventions with assessment created within last 3 months and after signature release", async () => {
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );

      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(
          assessment,
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [
          {
            id: validatedConventionEndedMoreThanThreeMonthsAgo.id,
            dateEnd: validatedConventionEndedMoreThanThreeMonthsAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.firstName,
              lastname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.lastName,
            },
            assessment: {
              status: "COMPLETED",
              endedWithAJob: false,
              signedAt: null,
              createdAt: assessment.createdAt,
            },
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 1,
        },
      });
    });

    it("excludes assessments created more than 3 months ago", async () => {
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );

      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(moreThanThreeMonthsAgo.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(
          assessment,
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 0,
        },
      });
    });

    it("excludes assessments created before the signature release date", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEnded5DaysAgo.id)
        .withCreatedAt(beforeSignatureRelease.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(assessment, validatedConventionEnded5DaysAgo),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result.data, []);
    });

    it("excludes assessments created two days ago", async () => {
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEnded5DaysAgo.id)
        .withCreatedAt(twoDaysAgo.toISOString())
        .build();

      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      await assessmentRepo.save(
        createAssessmentEntity(assessment, validatedConventionEnded5DaysAgo),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result.data, []);
    });

    it("include assessments created just before two days ago", async () => {
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEnded5DaysAgo.id)
        .withCreatedAt(subMilliseconds(twoDaysAgo, 1).toISOString())
        .build();

      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      await assessmentRepo.save(
        createAssessmentEntity(assessment, validatedConventionEnded5DaysAgo),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result.data, [
        {
          assessment: {
            createdAt: assessment.createdAt,
            endedWithAJob: assessment.endedWithAJob,
            signedAt: assessment.signedAt,
            status: assessment.status,
          },
          beneficiary: {
            firstname:
              validatedConventionEnded5DaysAgo.signatories.beneficiary
                .firstName,
            lastname:
              validatedConventionEnded5DaysAgo.signatories.beneficiary.lastName,
          },
          dateEnd: validatedConventionEnded5DaysAgo.dateEnd,
          id: validatedConventionEnded5DaysAgo.id,
        },
      ]);
    });

    it("excludes assessments already signed (finalized)", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEnded5DaysAgo.id)
        .withCreatedAt(afterSignatureRelease.toISOString())
        .withBeneficiarySignature({
          beneficiaryAgreement: true,
          beneficiaryFeedback: "ok",
          signedAt: addDays(afterSignatureRelease, 1).toISOString(),
        })
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(assessment, validatedConventionEnded5DaysAgo),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result.data, []);
    });

    it("excludes DID_NOT_SHOW assessments", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      const assessment: AssessmentDto = {
        conventionId: validatedConventionEnded5DaysAgo.id,
        status: "DID_NOT_SHOW",
        endedWithAJob: false,
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        establishmentFeedback: "no-show",
        establishmentAdvices: "n/a",
        signedAt: null,
        createdAt: lessThanThreeMonthsAgo.toISOString(),
      };
      await assessmentRepo.save(
        createAssessmentEntity(assessment, validatedConventionEnded5DaysAgo),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result.data, []);
    });

    it("excludes conventions whose status is not ACCEPTED_BY_VALIDATOR", async () => {
      const conventionReadyToSign = new ConventionDtoBuilder()
        .withId("99999999-9999-4999-8999-999999999999")
        .withAgencyId(agencyIdA)
        .withStatus("READY_TO_SIGN")
        .withDateEnd(subDays(now, 10).toISOString())
        .build();

      await conventionRepository.save(conventionReadyToSign);

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
          },
        );

      expectToEqual(result, {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 0,
        },
      });
    });

    it("paginates results sorted by dateEnd ASC", async () => {
      const conventionEarliest = new ConventionDtoBuilder()
        .withId("11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        .withAgencyId(agencyIdA)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart(subDays(now, 60).toISOString())
        .withDateEnd(subDays(now, 30).toISOString())
        .build();
      const conventionMiddle = new ConventionDtoBuilder()
        .withId("22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        .withAgencyId(agencyIdA)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart(subDays(now, 45).toISOString())
        .withDateEnd(subDays(now, 15).toISOString())
        .build();
      const conventionLatest = new ConventionDtoBuilder()
        .withId("33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        .withAgencyId(agencyIdA)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateStart(subDays(now, 25).toISOString())
        .withDateEnd(subDays(now, 5).toISOString())
        .build();

      await Promise.all([
        conventionRepository.save(conventionEarliest),
        conventionRepository.save(conventionMiddle),
        conventionRepository.save(conventionLatest),
      ]);

      const page1 =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 2 },
            now,
          },
        );
      const page2 =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 2, perPage: 2 },
            now,
          },
        );

      expectToEqual(page1, {
        data: [
          {
            id: conventionEarliest.id,
            dateEnd: conventionEarliest.dateEnd,
            beneficiary: {
              firstname: conventionEarliest.signatories.beneficiary.firstName,
              lastname: conventionEarliest.signatories.beneficiary.lastName,
            },
            assessment: null,
          },
          {
            id: conventionMiddle.id,
            dateEnd: conventionMiddle.dateEnd,
            beneficiary: {
              firstname: conventionMiddle.signatories.beneficiary.firstName,
              lastname: conventionMiddle.signatories.beneficiary.lastName,
            },
            assessment: null,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 2,
          numberPerPage: 2,
          totalRecords: 3,
        },
      });

      expectToEqual(page2, {
        data: [
          {
            id: conventionLatest.id,
            dateEnd: conventionLatest.dateEnd,
            beneficiary: {
              firstname: conventionLatest.signatories.beneficiary.firstName,
              lastname: conventionLatest.signatories.beneficiary.lastName,
            },
            assessment: null,
          },
        ],
        pagination: {
          currentPage: 2,
          totalPages: 2,
          numberPerPage: 2,
          totalRecords: 3,
        },
      });
    });

    it("filters by assessmentCompletionStatus to-complete", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(
          assessment,
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
            filters: { assessmentCompletionStatus: "to-complete" },
          },
        );

      expectToEqual(result, {
        data: [
          {
            id: validatedConventionEnded5DaysAgo.id,
            dateEnd: validatedConventionEnded5DaysAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .firstName,
              lastname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .lastName,
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
      });
    });

    it("filters by assessmentCompletionStatus to-sign", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(
          assessment,
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
            filters: { assessmentCompletionStatus: "to-sign" },
          },
        );

      expectToEqual(result, {
        data: [
          {
            id: validatedConventionEndedMoreThanThreeMonthsAgo.id,
            dateEnd: validatedConventionEndedMoreThanThreeMonthsAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.firstName,
              lastname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.lastName,
            },
            assessment: {
              status: "COMPLETED",
              endedWithAJob: false,
              signedAt: null,
              createdAt: assessment.createdAt,
            },
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 1,
        },
      });
    });

    it("returns to-complete and to-sign when filters is undefined", async () => {
      await conventionRepository.save(validatedConventionEnded5DaysAgo);
      await conventionRepository.save(
        validatedConventionEndedMoreThanThreeMonthsAgo,
      );
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      await assessmentRepo.save(
        createAssessmentEntity(
          assessment,
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
      );

      const result =
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 10 },
            now,
            filters: undefined,
          },
        );

      expectToEqual(result, {
        data: [
          {
            id: validatedConventionEndedMoreThanThreeMonthsAgo.id,
            dateEnd: validatedConventionEndedMoreThanThreeMonthsAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.firstName,
              lastname:
                validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                  .beneficiary.lastName,
            },
            assessment: {
              status: "COMPLETED",
              endedWithAJob: false,
              signedAt: null,
              createdAt: assessment.createdAt,
            },
          },
          {
            id: validatedConventionEnded5DaysAgo.id,
            dateEnd: validatedConventionEnded5DaysAgo.dateEnd,
            beneficiary: {
              firstname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .firstName,
              lastname:
                validatedConventionEnded5DaysAgo.signatories.beneficiary
                  .lastName,
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
      });
    });

    it("paginates filtered to-sign results", async () => {
      const assessmentOldest = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedMoreThanThreeMonthsAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      const assessmentMiddle = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEnded5DaysAgo.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();
      const assessmentLatest = new AssessmentDtoBuilder()
        .withConventionId(validatedConventionEndedInTheFuture.id)
        .withCreatedAt(lessThanThreeMonthsAgo.toISOString())
        .build();

      await Promise.all([
        conventionRepository.save(
          validatedConventionEndedMoreThanThreeMonthsAgo,
        ),
        conventionRepository.save(validatedConventionEnded5DaysAgo),
        conventionRepository.save(validatedConventionEndedInTheFuture),
      ]);

      await Promise.all([
        assessmentRepo.save(
          createAssessmentEntity(
            assessmentOldest,
            validatedConventionEndedMoreThanThreeMonthsAgo,
          ),
        ),
        assessmentRepo.save(
          createAssessmentEntity(
            assessmentMiddle,
            validatedConventionEnded5DaysAgo,
          ),
        ),
        assessmentRepo.save(
          createAssessmentEntity(
            assessmentLatest,
            validatedConventionEndedInTheFuture,
          ),
        ),
      ]);

      expectToEqual(
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 1, perPage: 2 },
            now,
            filters: { assessmentCompletionStatus: "to-sign" },
          },
        ),
        {
          data: [
            {
              id: validatedConventionEndedMoreThanThreeMonthsAgo.id,
              dateEnd: validatedConventionEndedMoreThanThreeMonthsAgo.dateEnd,
              beneficiary: {
                firstname:
                  validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                    .beneficiary.firstName,
                lastname:
                  validatedConventionEndedMoreThanThreeMonthsAgo.signatories
                    .beneficiary.lastName,
              },
              assessment: {
                status: "COMPLETED",
                endedWithAJob: false,
                signedAt: null,
                createdAt: assessmentOldest.createdAt,
              },
            },
            {
              id: validatedConventionEnded5DaysAgo.id,
              dateEnd: validatedConventionEnded5DaysAgo.dateEnd,
              beneficiary: {
                firstname:
                  validatedConventionEnded5DaysAgo.signatories.beneficiary
                    .firstName,
                lastname:
                  validatedConventionEnded5DaysAgo.signatories.beneficiary
                    .lastName,
              },
              assessment: {
                status: "COMPLETED",
                endedWithAJob: false,
                signedAt: null,
                createdAt: assessmentMiddle.createdAt,
              },
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 2,
            numberPerPage: 2,
            totalRecords: 3,
          },
        },
      );

      expectToEqual(
        await conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
          {
            userAgencyIds: [agencyIdA],
            pagination: { page: 2, perPage: 2 },
            now,
            filters: { assessmentCompletionStatus: "to-sign" },
          },
        ),
        {
          data: [
            {
              id: validatedConventionEndedInTheFuture.id,
              dateEnd: validatedConventionEndedInTheFuture.dateEnd,
              beneficiary: {
                firstname:
                  validatedConventionEndedInTheFuture.signatories.beneficiary
                    .firstName,
                lastname:
                  validatedConventionEndedInTheFuture.signatories.beneficiary
                    .lastName,
              },
              assessment: {
                status: "COMPLETED",
                endedWithAJob: false,
                signedAt: null,
                createdAt: assessmentLatest.createdAt,
              },
            },
          ],
          pagination: {
            currentPage: 2,
            totalPages: 2,
            numberPerPage: 2,
            totalRecords: 3,
          },
        },
      );
    });
  });

  describe("getUserIdsWithNoActiveConvention", () => {
    it("returns empty array when given no users", async () => {
      expectToEqual(
        await conventionQueries.getUserIdsWithNoActiveConvention({
          userIds: [],
          since: new Date("2024-01-01"),
        }),
        [],
      );
    });

    it("returns only users with no active convention since the given date", async () => {
      const since = new Date("2025-01-01");

      const userA = new ConnectedUserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000001")
        .withEmail("userA@test.com")
        .buildUser();
      const userB = new ConnectedUserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000002")
        .withEmail("userB@test.com")
        .buildUser();
      const userC = new ConnectedUserBuilder()
        .withId("aaaa0000-0000-4000-a000-000000000003")
        .withEmail("userC@test.com")
        .buildUser();

      const userRepo = new PgUserRepository(db);
      await Promise.all([
        userRepo.save(userA),
        userRepo.save(userB),
        userRepo.save(userC),
      ]);

      const agency = AgencyDtoBuilder.create(agencyIdA).build();
      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      );

      const activeConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-a111-111111111111")
        .withAgencyId(agencyIdA)
        .withBeneficiaryEmail(userA.email)
        .withDateStart(new Date("2025-03-01").toISOString())
        .withDateEnd(new Date("2025-03-10").toISOString())
        .withSchedule(reasonableSchedule)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      await conventionRepository.save(activeConvention);

      const expiredConvention = new ConventionDtoBuilder()
        .withId("22222222-2222-4222-a222-222222222222")
        .withAgencyId(agencyIdA)
        .withSiret("11111111111112")
        .withBeneficiaryEmail(userB.email)
        .withDateStart(new Date("2024-06-01").toISOString())
        .withDateEnd(new Date("2024-06-10").toISOString())
        .withSchedule(reasonableSchedule)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .build();
      await conventionRepository.save(expiredConvention);

      const result = await conventionQueries.getUserIdsWithNoActiveConvention({
        userIds: [userA.id, userB.id, userC.id],
        since,
      });

      expectToEqual(result.sort(), [userB.id, userC.id]);
    });

    it("ignores conventions whose status does not demonstrate user activity", async () => {
      const since = new Date("2025-01-01");

      const makeStatusUser = (idx: number, slug: string) =>
        new ConnectedUserBuilder()
          .withId(`bbbb0000-0000-4000-a000-${String(idx).padStart(12, "0")}`)
          .withEmail(`status-${slug}@test.com`)
          .buildUser();

      const userReadyToSign = makeStatusUser(0, "ready-to-sign");
      const userPartiallySigned = makeStatusUser(1, "partially-signed");
      const userRejected = makeStatusUser(2, "rejected");
      const userDeprecated = makeStatusUser(3, "deprecated");
      const userInReview = makeStatusUser(4, "in-review");
      const userCancelled = makeStatusUser(5, "cancelled");
      const userAcceptedByCounsellor = makeStatusUser(
        6,
        "accepted-by-counsellor",
      );
      const userAcceptedByValidator = makeStatusUser(
        7,
        "accepted-by-validator",
      );

      const usersWithStatus: {
        user: UserWithAdminRights;
        status: ConventionStatus;
      }[] = [
        { user: userReadyToSign, status: "READY_TO_SIGN" },
        { user: userPartiallySigned, status: "PARTIALLY_SIGNED" },
        { user: userRejected, status: "REJECTED" },
        { user: userDeprecated, status: "DEPRECATED" },
        { user: userInReview, status: "IN_REVIEW" },
        { user: userCancelled, status: "CANCELLED" },
        { user: userAcceptedByCounsellor, status: "ACCEPTED_BY_COUNSELLOR" },
        { user: userAcceptedByValidator, status: "ACCEPTED_BY_VALIDATOR" },
      ];

      const userRepo = new PgUserRepository(db);
      await Promise.all(usersWithStatus.map(({ user }) => userRepo.save(user)));

      const agency = AgencyDtoBuilder.create(agencyIdA).build();
      await agencyRepo.insert(
        toAgencyWithRights(agency, {
          [validator.id]: { roles: ["validator"], isNotifiedByEmail: false },
        }),
      );

      await Promise.all(
        usersWithStatus.map(({ user, status }, idx) =>
          conventionRepository.save(
            new ConventionDtoBuilder()
              .withId(
                `cccc0000-0000-4000-a000-${String(idx).padStart(12, "0")}`,
              )
              .withAgencyId(agencyIdA)
              .withSiret(`1234567890${String(idx).padStart(4, "0")}`)
              .withBeneficiaryEmail(user.email)
              .withDateStart(new Date("2025-03-01").toISOString())
              .withDateEnd(new Date("2025-03-10").toISOString())
              .withSchedule(reasonableSchedule)
              .withStatus(status)
              .build(),
          ),
        ),
      );

      const result = await conventionQueries.getUserIdsWithNoActiveConvention({
        userIds: usersWithStatus.map(({ user }) => user.id),
        since,
      });

      expectToEqual(
        result.sort(),
        [
          userReadyToSign.id,
          userPartiallySigned.id,
          userRejected.id,
          userDeprecated.id,
        ].sort(),
      );
    });
  });

  const insertEmailReminder = async ({
    conventionId,
    emailKind,
    recipientEmail,
    createdAt,
  }: {
    conventionId: ConventionId;
    emailKind: EmailType;
    recipientEmail: Email;
    createdAt: Date;
  }) => {
    const emailId = uuid();
    await db
      .insertInto("notifications_email")
      .values({
        id: emailId,
        email_kind: emailKind,
        convention_id: conventionId,
        created_at: createdAt.toISOString(),
      })
      .execute();
    await db
      .insertInto("notifications_email_recipients")
      .values({
        notifications_email_id: emailId,
        email: recipientEmail,
        recipient_type: "to",
      })
      .execute();
  };

  const insertSmsReminder = async ({
    conventionId,
    smsKind,
    recipientPhone,
    createdAt,
  }: {
    conventionId: ConventionId;
    smsKind: SmsTemplateKind;
    recipientPhone: string;
    createdAt: Date;
  }) =>
    db
      .insertInto("notifications_sms")
      .values({
        id: uuid(),
        sms_kind: smsKind,
        convention_id: conventionId,
        recipient_phone: recipientPhone,
        created_at: createdAt.toISOString(),
      })
      .execute();

  const insertAgencyAndConvention = async ({
    conventionId,
    agencyId,
    agencyContactEmail,
    agencyName,
    agencyDepartment,
    agencyKind,
    agencySiret,
    withRefersToAgency,
    conventionStartDate = DATE_START,
    conventionStatus = "READY_TO_SIGN",
    conventionUpdatedAt,
    validatorUser,
    assessment,
    withBannedEstablishmentInformations,
    withLastReminders,
  }: {
    conventionId: ConventionId;
    agencyId: string;
    agencyContactEmail: Email;
    agencyName: string;
    agencyDepartment: string;
    agencyKind: AgencyKind;
    agencySiret: SiretDto;
    withRefersToAgency?: AgencyDto;
    conventionStartDate?: string;
    conventionStatus?: ConventionStatus;
    conventionUpdatedAt: DateString;
    validatorUser: UserWithAdminRights;
    assessment?: AssessmentEntity;
    withBannedEstablishmentInformations: WithBannedEstablishmentInformations;
    withLastReminders?: ConventionLastReminders;
  }): Promise<ConventionReadDto> => {
    const convention = new ConventionDtoBuilder()
      .withAgencyId(agencyId)
      .withId(conventionId)
      .withStatus(conventionStatus)
      .withStatusJustification("JUSTIF...")
      .notSigned()
      .withBeneficiary({
        firstName: "benef",
        lastName: "beneficiary",
        email: "benef@r.com",
        phone: "+33112233440",
        role: "beneficiary",
        birthdate: "1990-02-21T00:00:00.000Z",
        emergencyContact: "Billy",
        emergencyContactPhone: "+33112233445",
        emergencyContactEmail: "billy@emergencycontact.com",
        signedAt: new Date().toISOString(),
        isRqth: false,
      })
      .withBeneficiaryCurrentEmployer({
        firstName: "a",
        lastName: "a",
        businessName: "business",
        businessSiret: "01234567890123",
        email: "a@a.com",
        job: "job",
        phone: "+33112233441",
        role: "beneficiary-current-employer",
        signedAt: new Date().toISOString(),
        businessAddress: "Rue des Bouchers 67065 Strasbourg",
      })
      .withBeneficiaryRepresentative({
        email: "rep@rep.com",
        firstName: "beneficiary",
        lastName: "Rep",
        phone: "+33112233442",
        role: "beneficiary-representative",
        signedAt: new Date().toISOString(),
      })
      .withEstablishmentRepresentative({
        email: "est@rep.com",
        firstName: "Establishment",
        lastName: "Rep",
        phone: "+33112233443",
        role: "establishment-representative",
        signedAt: new Date().toISOString(),
      })
      .withDateStart(conventionStartDate)
      .withDateEnd(addDays(new Date(conventionStartDate), 5).toISOString())
      .build();

    const agency = AgencyDtoBuilder.create()
      .withId(agencyId)
      .withName(agencyName)
      .withAddress({
        city: "Paris",
        departmentCode: agencyDepartment,
        postcode: "75017",
        streetNumberAndAddress: "Avenue des champs Elysées",
      })
      .withAgencySiret(agencySiret)
      .withKind(agencyKind)
      .withAgencyContactEmail(agencyContactEmail)
      .withRefersToAgencyInfo(
        withRefersToAgency
          ? {
              refersToAgencyId: withRefersToAgency.id,
              refersToAgencyName: withRefersToAgency.name,
              refersToAgencyContactEmail: withRefersToAgency.contactEmail,
            }
          : null,
      )
      .build();

    if (withRefersToAgency)
      await agencyRepo.insert(
        toAgencyWithRights(withRefersToAgency, {
          [validatorUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

    await agencyRepo.insert(
      toAgencyWithRights(agency, {
        [validatorUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );

    await conventionRepository.save(convention, conventionUpdatedAt);

    if (assessment) await assessmentRepo.save(assessment);

    return {
      ...convention,
      agencyName,
      agencyDepartment,
      agencyContactEmail,
      agencyKind,
      agencySiret,
      agencyRefersTo: withRefersToAgency && {
        id: withRefersToAgency.id,
        name: withRefersToAgency.name,
        contactEmail: withRefersToAgency.contactEmail,
        kind: withRefersToAgency.kind,
        siret: withRefersToAgency.agencySiret,
      },
      agencyValidationSteps: "validator-only",
      updatedAt: conventionUpdatedAt,
      ...assesmentEntityToConventionAssessmentFields(assessment),
      ...withBannedEstablishmentInformations,
      lastReminders: withLastReminders ?? makeEmptyLastReminders(),
    } satisfies ConventionReadDto;
  };
});
