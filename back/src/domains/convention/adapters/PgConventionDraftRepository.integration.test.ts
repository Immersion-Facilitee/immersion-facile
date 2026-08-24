import { subDays, subMilliseconds } from "date-fns";
import type { Pool } from "pg";
import { type ConventionDraftDto, expectToEqual } from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgConventionDraftRepository } from "./PgConventionDraftRepository";

describe("PgConventionDraftRepository", () => {
  const now = "2024-10-08T00:00:00.000Z";
  let pool: Pool;
  let pgConventionDraftRepository: PgConventionDraftRepository;
  let db: KyselyDb;

  const conventionDraft: ConventionDraftDto = {
    id: uuid(),
    dateStart: "2024-10-08T00:00:00.000Z",
    dateEnd: "2024-10-17T00:00:00.000Z",
    siret: "12345678901234",
    businessName: "Test Business",
    individualProtection: true,
    individualProtectionDescription: "casque et lunettes",
    sanitaryPrevention: true,
    sanitaryPreventionDescription: "fourniture de gel",
    remoteWorkMode: "FULL_REMOTE",
    immersionAddress: "169 boulevard de la villette, 75010 Paris",
    immersionObjective: "Confirmer un projet professionnel",
    immersionActivities: "Piloter un automobile",
    immersionSkills: "Utilisation des pneus optimale",
    workConditions: "Travail en équipe",
    internshipKind: "immersion",
    businessAdvantages: "Prise en charge du panier repas",
    acquisitionCampaign: "campaign-2024",
    acquisitionKeyword: "emploi",
    acquisitionMedium: "website-if",
    establishmentNumberEmployeesRange: "10-19",
    agencyReferent: {
      firstname: "Sophie",
      lastname: "Durand",
    },
    immersionAppellation: {
      appellationCode: "11573",
      appellationLabel: "Boulanger / Boulangère",
      romeCode: "D1102",
      romeLabel: "Boulangerie - viennoiserie",
    },
    schedule: {
      totalHours: 35,
      workedDays: 5,
      isSimple: true,
      complexSchedule: [
        {
          date: "2024-10-08",
          timePeriods: [{ start: "09:00", end: "17:00" }],
        },
      ],
    },
    establishmentTutor: {
      role: "establishment-tutor",
      email: "tutor@example.com",
      phone: "+33123456789",
      firstName: "Jean",
      lastName: "Dupont",
      job: "Manager",
    },
    signatories: {
      beneficiary: {
        role: "beneficiary",
        email: "beneficiary@example.com",
        firstName: "Marie",
        lastName: "Martin",
      },
      establishmentRepresentative: {
        role: "establishment-representative",
        email: "rep@example.com",
        firstName: "Pierre",
        lastName: "Bernard",
      },
    },
  };

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await db.deleteFrom("convention_drafts").execute();
    pgConventionDraftRepository = new PgConventionDraftRepository(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("save", () => {
    it("create a minimal convention draft", async () => {
      const conventionDraft: ConventionDraftDto = {
        id: uuid(),
        internshipKind: "immersion",
      };

      await pgConventionDraftRepository.save(conventionDraft, now);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );
      expectToEqual(result, {
        id: conventionDraft.id,
        internshipKind: "immersion",
        updatedAt: now,
      });
    });

    it("create a convention draft with more fields", async () => {
      const conventionDraft: ConventionDraftDto = {
        id: uuid(),
        agencyKind: "mission-locale",
        agencyDepartment: "75",
        dateStart: "2024-10-08T00:00:00.000Z",
        dateEnd: "2024-10-17T00:00:00.000Z",
        siret: "12345678901234",
        businessName: "Test Business",
        businessNameCustomized: "Enseigne Test",
        individualProtection: true,
        individualProtectionDescription: "casque et lunettes",
        sanitaryPrevention: true,
        sanitaryPreventionDescription: "fourniture de gel",
        immersionAddress: "169 boulevard de la villette, 75010 Paris",
        immersionObjective: "Confirmer un projet professionnel",
        immersionActivities: "Piloter un automobile",
        immersionSkills: "Utilisation des pneus optimale",
        workConditions: "Travail en équipe",
        internshipKind: "immersion",
        businessAdvantages: "Prise en charge du panier repas",
        acquisitionCampaign: "campaign-2024",
        acquisitionKeyword: "emploi",
        acquisitionMedium: "website-if",
        establishmentNumberEmployeesRange: "10-19",
        agencyReferent: {
          firstname: "Sophie",
          lastname: "Durand",
        },
        immersionAppellation: {
          appellationCode: "11573",
          appellationLabel: "Boulanger / Boulangère",
          romeCode: "D1102",
          romeLabel: "Boulangerie - viennoiserie",
        },
      };

      await pgConventionDraftRepository.save(conventionDraft, now);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );

      expectToEqual(result, {
        ...conventionDraft,
        updatedAt: now,
      });
    });

    it("create a convention draft with jsonb fields", async () => {
      const conventionDraft: ConventionDraftDto = {
        id: uuid(),
        internshipKind: "immersion",
        establishmentTutor: {
          role: "establishment-tutor",
          email: "tutor@example.com",
          phone: "+33123456789",
          firstName: "Jean",
          lastName: "Dupont",
          job: "Manager",
        },
        schedule: {
          totalHours: 35,
          workedDays: 5,
          isSimple: true,
          complexSchedule: [
            {
              date: "2024-10-08",
              timePeriods: [{ start: "09:00", end: "17:00" }],
            },
          ],
        },
        signatories: {
          beneficiary: {
            role: "beneficiary",
            email: "beneficiary@example.com",
            firstName: "Marie",
            lastName: "Martin",
          },
          establishmentRepresentative: {
            role: "establishment-representative",
            email: "rep@example.com",
            firstName: "Pierre",
            lastName: "Bernard",
          },
        },
      };

      await pgConventionDraftRepository.save(conventionDraft, now);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );
      expectToEqual(result, {
        ...conventionDraft,
        updatedAt: now,
      });
    });

    it("update a convention draft without overwriting acquisition params", async () => {
      const conventionDraft: ConventionDraftDto = {
        id: uuid(),
        internshipKind: "immersion",
        businessName: "Test Business",
        businessNameCustomized: "Enseigne Test",
        acquisitionCampaign: "campaign-2024",
        acquisitionKeyword: "emploi",
        acquisitionMedium: "website-if",
      };

      await pgConventionDraftRepository.save(conventionDraft, now);

      const updatedConventionDraft: ConventionDraftDto = {
        id: conventionDraft.id,
        internshipKind: "immersion",
        businessName: "Updated Test Business",
        businessNameCustomized: "Enseigne mise à jour",
        acquisitionCampaign: "other-campaign",
        acquisitionKeyword: "other-keyword",
        acquisitionMedium: "other-medium",
      };

      await pgConventionDraftRepository.save(updatedConventionDraft, now);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );
      expectToEqual(result, {
        ...updatedConventionDraft,
        acquisitionCampaign: conventionDraft.acquisitionCampaign,
        acquisitionKeyword: conventionDraft.acquisitionKeyword,
        acquisitionMedium: conventionDraft.acquisitionMedium,
        updatedAt: now,
      });
    });
  });

  describe("getById", () => {
    it("returns undefined when draft does not exist", async () => {
      const result = await pgConventionDraftRepository.getById(uuid());
      expect(result).toBeUndefined();
    });

    it("returns the convention draft with all fields properly mapped", async () => {
      await pgConventionDraftRepository.save(conventionDraft, now);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );

      expectToEqual(result, {
        ...conventionDraft,
        updatedAt: now,
      });
    });
  });

  describe("getConventionDraftIdsByFilters", () => {
    const thirtyDaysAgo = subDays(new Date(now), 30);
    const thirtyDaysAgoMinus1ms = subMilliseconds(thirtyDaysAgo, -1);

    const recentConventionDraft: ConventionDraftDto = {
      ...conventionDraft,
      id: uuid(),
      updatedAt: thirtyDaysAgoMinus1ms.toISOString(),
    };
    const oldConventionDraft: ConventionDraftDto = {
      ...conventionDraft,
      id: uuid(),
      updatedAt: thirtyDaysAgo.toISOString(),
    };

    it("should return all ids when no filters are provided", async () => {
      const conventionDraft2: ConventionDraftDto = {
        ...conventionDraft,
        id: uuid(),
      };

      await pgConventionDraftRepository.save(conventionDraft, now);
      await pgConventionDraftRepository.save(conventionDraft2, now);

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({});

      expectToEqual(result, [conventionDraft.id, conventionDraft2.id]);
    });

    it("should return only the ids matching the provided ids filter", async () => {
      const conventionDraft2: ConventionDraftDto = {
        ...conventionDraft,
        id: uuid(),
      };

      await pgConventionDraftRepository.save(conventionDraft, now);
      await pgConventionDraftRepository.save(conventionDraft2, now);

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          ids: [conventionDraft.id],
        });

      expectToEqual(result, [conventionDraft.id]);
    });

    it("should return only ids not updated after the provided lastUpdatedAt date", async () => {
      await pgConventionDraftRepository.save(
        recentConventionDraft,
        thirtyDaysAgoMinus1ms.toISOString(),
      );
      await pgConventionDraftRepository.save(
        oldConventionDraft,
        thirtyDaysAgo.toISOString(),
      );

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          lastUpdatedAt: thirtyDaysAgo,
        });

      expectToEqual(result, [oldConventionDraft.id]);
    });

    it("should return ids matching both ids and lastUpdatedAt filters", async () => {
      const sixtyDaysAgo = subDays(thirtyDaysAgo, 30);
      const veryOldConventionDraft: ConventionDraftDto = {
        ...conventionDraft,
        id: uuid(),
        updatedAt: sixtyDaysAgo.toISOString(),
      };

      await pgConventionDraftRepository.save(
        recentConventionDraft,
        thirtyDaysAgoMinus1ms.toISOString(),
      );
      await pgConventionDraftRepository.save(
        oldConventionDraft,
        thirtyDaysAgo.toISOString(),
      );
      await pgConventionDraftRepository.save(
        veryOldConventionDraft,
        sixtyDaysAgo.toISOString(),
      );

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          ids: [recentConventionDraft.id, oldConventionDraft.id],
          lastUpdatedAt: new Date(thirtyDaysAgo),
        });

      expectToEqual(result, [oldConventionDraft.id]);
    });

    it("should return an empty array when no drafts match the filters", async () => {
      await pgConventionDraftRepository.save(conventionDraft, now);

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          ids: [conventionDraft.id],
          lastUpdatedAt: new Date(thirtyDaysAgo),
        });

      expectToEqual(result, []);
    });

    it("should return an empty array when no drafts match lastUpdatedAt filter", async () => {
      await pgConventionDraftRepository.save(recentConventionDraft, now);

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          lastUpdatedAt: new Date(thirtyDaysAgo),
        });

      expectToEqual(result, []);
    });

    it("should return an empty array when no drafts match ids filter", async () => {
      await pgConventionDraftRepository.save(conventionDraft, now);

      const nonExistingId = uuid();

      const result =
        await pgConventionDraftRepository.getConventionDraftIdsByFilters({
          ids: [nonExistingId],
        });

      expectToEqual(result, []);
    });
  });

  describe("delete", () => {
    it("deletes a convention draft", async () => {
      await pgConventionDraftRepository.save(conventionDraft, now);

      await pgConventionDraftRepository.delete([conventionDraft.id]);

      const result = await pgConventionDraftRepository.getById(
        conventionDraft.id,
      );
      expect(result).toBeUndefined();
    });

    it("do nothing when convention draft is not found", async () => {
      const nonExistentConventionDraftId = uuid();

      await pgConventionDraftRepository.save(conventionDraft, now);

      await expectToEqual(
        await pgConventionDraftRepository.getById(conventionDraft.id),
        { ...conventionDraft, updatedAt: now },
      );

      await pgConventionDraftRepository.delete([nonExistentConventionDraftId]);

      await expectToEqual(
        await pgConventionDraftRepository.getById(conventionDraft.id),
        { ...conventionDraft, updatedAt: now },
      );
    });
  });
});
