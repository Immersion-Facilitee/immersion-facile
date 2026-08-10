import { subDays, subMonths } from "date-fns";
import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  type AgencyStatus,
  type AgencyWithUsersRights,
  activeAgencyStatuses,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type DelegationAgencyInfo,
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type GeoPositionDto,
  miniStageAgencyKinds,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { InMemoryConventionRepository } from "../../convention/adapters/InMemoryConventionRepository";
import { PgConventionRepository } from "../../convention/adapters/PgConventionRepository";
import { InMemoryUserRepository } from "../../core/authentication/connected-user/adapters/InMemoryUserRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { InMemoryPhoneRepository } from "../../core/phone-number/adapters/InMemoryPhoneRepository";
import { PgPhoneRepository } from "../../core/phone-number/adapters/PgPhoneRepository";
import type { AgencyWithoutRights } from "../ports/AgencyRepository";
import { InMemoryAgencyRepository } from "./InMemoryAgencyRepository";
import { PgAgencyRepository } from "./PgAgencyRepository";

const adapterKind: ("pg" | "inMemory")[] = ["pg", "inMemory"];

describe.each(
  adapterKind,
)("AgencyRepository - with adapter %s", (adapterKind) => {
  const counsellor1 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000001")
    .withEmail("counsellor1@agency1.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();
  const counsellor2 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000002")
    .withEmail("counsellor2@agency1.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();
  const validator1 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000003")
    .withEmail("validator1@agency1.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();
  const validator2 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000004")
    .withEmail("validator2@agency1.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  const admin1 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000005")
    .withEmail("admin1@mail.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  const admin2 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000006")
    .withEmail("admin2@mail.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  const userToReview = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000007")
    .withEmail("userToReview@mail.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  const userToReview2 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000008")
    .withEmail("userToReview2@mail.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  const agency1builder = AgencyDtoBuilder.create(
    "10000000-0000-0000-1111-000000000001",
  )
    .withName("agency1")
    .withKind("pole-emploi")
    .withAddress({
      streetNumberAndAddress: "Agency 1 address",
      city: "Paris",
      postcode: "75001",
      departmentCode: "75",
    })
    .withCoveredDepartments(["75"])
    .withSignature("The team of agency1")
    .withLogoUrl("http://logo.agency1.fr");

  const agency2builder = AgencyDtoBuilder.create(
    "10000000-0000-0000-1111-000000000002",
  )
    .withName("agency2")
    .withKind("mission-locale")
    .withAddress({
      streetNumberAndAddress: "Agency 2 address",
      city: "Paris",
      postcode: "75001",
      departmentCode: "75",
    })
    .withSignature("The team of agency2");

  const needsReviewAgency = AgencyDtoBuilder.create(
    "10000000-0000-0000-1111-000000000003",
  )
    .withStatus("needsReview")
    .withName("NEED REVIEW AGENCY")
    .withPosition(48.7, 6.2)
    .build();

  const safirCode = "AAAAAA";

  let pool: Pool;
  let agencyRepository: PgAgencyRepository | InMemoryAgencyRepository;
  let userRepository: PgUserRepository | InMemoryUserRepository;
  let phoneRepository: PgPhoneRepository | InMemoryPhoneRepository;
  let db: KyselyDb;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    if (adapterKind === "pg") {
      await db.deleteFrom("conventions").execute();
      await db.deleteFrom("convention_drafts").execute();
      await db.deleteFrom("convention_templates").execute();
      await db.deleteFrom("agency_groups__agencies").execute();
      await db.deleteFrom("agency_groups").execute();
      await db.deleteFrom("users_ongoing_oauths").execute();
      await db.deleteFrom("users__agencies").execute();
      await db.deleteFrom("agencies").execute();
      await db.deleteFrom("users").execute();
    }

    const inMemoryPhoneRepo = new InMemoryPhoneRepository();
    phoneRepository =
      adapterKind === "pg" ? new PgPhoneRepository(db) : inMemoryPhoneRepo;

    agencyRepository =
      adapterKind === "pg"
        ? new PgAgencyRepository(db)
        : new InMemoryAgencyRepository([]);
    userRepository =
      adapterKind === "pg"
        ? new PgUserRepository(db)
        : new InMemoryUserRepository();

    await userRepository.save(validator1);
    await userRepository.save(validator2);
    await userRepository.save(counsellor1);
    await userRepository.save(counsellor2);
    await userRepository.save(admin1);
    await userRepository.save(admin2);
    await userRepository.save(userToReview);
    await userRepository.save(userToReview2);
  });

  describe("insert()", () => {
    const agency1 = toAgencyWithRights(agency1builder.build(), {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      [counsellor1.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      [counsellor2.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
    });
    const agency2 = toAgencyWithRights(agency2builder.build(), {
      [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      [counsellor1.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      [counsellor2.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
    });

    it("inserts unknown agencies", async () => {
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      await agencyRepository.insert(agency1);
      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1]);

      await agencyRepository.insert(agency2);
      expectToEqual((await agencyRepository.getAgencies({})).data, [
        agency1,
        agency2,
      ]);
    });

    it("save correct agency right even if user is counsellor and validator", async () => {
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      const agencyWithSameCounsellorAndValidator = toAgencyWithRights(
        agency1builder.build(),
        {
          [validator1.id]: {
            isNotifiedByEmail: true,
            roles: ["counsellor", "validator"],
          },
        },
      );
      await agencyRepository.insert(agencyWithSameCounsellorAndValidator);

      expectToEqual((await agencyRepository.getAgencies({})).data, [
        agencyWithSameCounsellorAndValidator,
      ]);
    });

    it("keeps the acquisitions fields when provided", async () => {
      const agency = toAgencyWithRights(
        agency1builder
          .withAcquisition({
            acquisitionKeyword: "keyword",
            acquisitionCampaign: "campaign",
          })
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agency);

      expectToEqual((await agencyRepository.getAgencies({})).data, [agency]);
    });

    it("doesn't insert entities with existing ids without throwing conflic error", async () => {
      // TODO
      // j'ai du mal à comprendre pourquoi on veut avoir ce type de comportement pour un insert.
      // peut être étudier la notion de save() d'entité complète pour symplifier le repo
      // et adapter la logique métier en conséquence
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      const agency1a = toAgencyWithRights(
        agency1builder.withName("agency1a").build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );
      const agency1b = toAgencyWithRights(
        agency1builder.withName("agency1b").build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agency1a);
      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1a]);

      await expectPromiseToFailWithError(
        agencyRepository.insert(agency1b),
        errors.agency.alreadyExist(agency1b.id),
      );

      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1a]);
    });

    it("inserts agency with delegationAgencyInfo null", async () => {
      const agencyWithNullDelegation = toAgencyWithRights(
        agency1builder.withKind("autre").build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agencyWithNullDelegation);

      const retrievedAgency = await agencyRepository.getById(
        agencyWithNullDelegation.id,
      );
      expectToEqual(retrievedAgency, agencyWithNullDelegation);
    });

    it("inserts two agencies with the same phone number", async () => {
      const phoneNumber = "+33610101010";

      const agency1 = toAgencyWithRights(
        agency1builder
          .withName("agency1")
          .withAgencySiret("11110000111100")
          .withAddress({
            streetNumberAndAddress: "My new adress",
            postcode: "64100",
            departmentCode: "64",
            city: "Bayonne",
          })
          .withPhoneNumber(phoneNumber)
          .withKind("pole-emploi")
          .build(),
        {
          [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );
      const agency2 = toAgencyWithRights(
        agency2builder
          .withName("agency2")
          .withAgencySiret("11110000111105")
          .withAddress({
            streetNumberAndAddress: "My new adress",
            postcode: "64100",
            departmentCode: "64",
            city: "Bayonne",
          })
          .withPhoneNumber(phoneNumber)
          .withKind("pole-emploi")
          .build(),
        {
          [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agency1);
      await agencyRepository.insert(agency2);

      expectToEqual((await agencyRepository.getAgencies({})).data, [
        agency1,
        agency2,
      ]);
    });
  });

  describe("update()", () => {
    const agency1 = toAgencyWithRights(
      agency1builder.withPosition(40, 2).withStatus("active").build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      },
    );

    it("updates the entire entity", async () => {
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      await agencyRepository.insert(agency1);
      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1]);

      const updatedAgency1 = toAgencyWithRights(
        agency1builder
          .withStatus("rejected")
          .withName("Updated agency")
          .withPosition(41, 3)
          .withAgencySiret("11110000111100")
          .withCodeSafir("CODE_123")
          .withAddress({
            streetNumberAndAddress: "My new adress",
            postcode: "64100",
            departmentCode: "64",
            city: "Bayonne",
          })
          .withPhoneNumber("+33610101010")
          .withKind("pole-emploi")
          .withStatusJustification("justification du rejet")
          .withSignature("new signature")
          .withLogoUrl("http://new-logo-url.fr")
          .withAgencySiret("11110000111100")
          .withCodeSafir("CODE_123")
          .build(),
        {
          [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.update(updatedAgency1);
      expectToEqual((await agencyRepository.getAgencies({})).data, [
        updatedAgency1,
      ]);
    });

    it("updates the only some fields", async () => {
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      await agencyRepository.insert(agency1);
      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1]);

      const updatedPhoneNumber = "+33610101011";
      const updatedFields: Partial<AgencyWithoutRights> = {
        status: "rejected",
        statusJustification: "justification du rejet",
        phoneNumber: updatedPhoneNumber,
      };

      await agencyRepository.update({
        id: agency1.id,
        status: agency1.status,
        ...updatedFields,
      });

      expectToEqual((await agencyRepository.getAgencies({})).data, [
        { ...agency1, ...updatedFields },
      ]);

      if (adapterKind === "pg") {
        expect(
          await phoneRepository.getPhoneByNumberForTesting(agency1.phoneNumber),
        ).toBeDefined();
        expect(
          await phoneRepository.getPhoneByNumberForTesting(updatedPhoneNumber),
        ).toBeDefined();
      }
    });

    it("allows closed agencies to have no users", async () => {
      await agencyRepository.insert(agency1);

      await agencyRepository.update({
        id: agency1.id,
        status: "closed",
        usersRights: {},
      });

      expectToEqual((await agencyRepository.getAgencies({})).data, [
        { ...agency1, status: "closed", usersRights: {} },
      ]);
    });

    it("does not allow agencies not closed to have no users", async () => {
      await agencyRepository.insert(agency1);

      await expectPromiseToFailWithError(
        agencyRepository.update({
          id: agency1.id,
          status: "active",
          usersRights: {},
        }),
        errors.agency.noUsers(agency1.id),
      );

      expectToEqual((await agencyRepository.getAgencies({})).data, [agency1]);
    });

    it("switch the counsellor to validator", async () => {
      expectToEqual((await agencyRepository.getAgencies({})).data, []);

      const agencyWithTwoStepValidation = toAgencyWithRights(
        agency1builder.withStatus("active").build(),
        {
          [counsellor1.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
          [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agencyWithTwoStepValidation);
      expectToEqual((await agencyRepository.getAgencies({})).data, [
        agencyWithTwoStepValidation,
      ]);

      const updatedAgencyRights: Partial<AgencyWithUsersRights> = {
        usersRights: {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
          [counsellor1.id]: {
            isNotifiedByEmail: true,
            roles: ["validator", "agency-admin"],
          },
        },
      };

      await agencyRepository.update({
        id: agencyWithTwoStepValidation.id,
        status: agencyWithTwoStepValidation.status,
        ...updatedAgencyRights,
      });
      expectToEqual((await agencyRepository.getAgencies({})).data, [
        { ...agencyWithTwoStepValidation, ...updatedAgencyRights },
      ]);
    });

    it("updates delegationAgencyInfo from null to filled", async () => {
      const agencyWithoutDelegationInfo = toAgencyWithRights(
        agency1builder.withKind("autre").build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agencyWithoutDelegationInfo);

      const delegationInfo = {
        delegationEndDate: new Date("2029-12-31").toISOString(),
        delegationAgencyName: "Mission Locale Paris",
        delegationAgencyKind: "mission-locale" as const,
      };

      await agencyRepository.update({
        id: agencyWithoutDelegationInfo.id,
        status: agencyWithoutDelegationInfo.status,
        delegationAgencyInfo: delegationInfo,
      });

      const retrievedAgency = await agencyRepository.getById(
        agencyWithoutDelegationInfo.id,
      );
      expectToEqual(retrievedAgency, {
        ...agencyWithoutDelegationInfo,
        delegationAgencyInfo: delegationInfo,
      });
    });

    it("updates delegationAgencyInfo", async () => {
      const initialDelegationInfo: DelegationAgencyInfo = {
        delegationEndDate: new Date("2029-01-01").toISOString(),
        delegationAgencyName: "Cap Emploi",
        delegationAgencyKind: "cap-emploi",
      };

      const agencyWithDelegation = toAgencyWithRights(
        agency1builder
          .withKind("autre")
          .withDelegationAgencyInfo(initialDelegationInfo)
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );
      const updatedDelegationInfo: DelegationAgencyInfo = {
        delegationEndDate: new Date("2030-06-15").toISOString(),
        delegationAgencyName: "France Travail",
        delegationAgencyKind: "pole-emploi",
      };

      await agencyRepository.insert(agencyWithDelegation);

      await agencyRepository.update({
        id: agencyWithDelegation.id,
        status: agencyWithDelegation.status,
        delegationAgencyInfo: updatedDelegationInfo,
      });

      const retrievedAgency = await agencyRepository.getById(
        agencyWithDelegation.id,
      );
      expectToEqual(retrievedAgency, {
        ...agencyWithDelegation,
        delegationAgencyInfo: updatedDelegationInfo,
      });
    });

    it("updates contactEmail", async () => {
      const agency = toAgencyWithRights(
        agency1builder.withStatus("active").build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agency);

      const newContactEmail = "new.contact@agency.fr";

      await agencyRepository.update({
        id: agency.id,
        status: agency.status,
        contactEmail: newContactEmail,
      });

      const retrievedAgency = await agencyRepository.getById(agency.id);
      expectToEqual(retrievedAgency, {
        ...agency,
        contactEmail: newContactEmail,
      });
    });
  });

  describe("getById()", () => {
    const agency1 = toAgencyWithRights(agency1builder.build(), {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
    });
    const agency2WithRefersToAgency1 = toAgencyWithRights(
      agency2builder
        .withRefersToAgencyInfo({
          refersToAgencyId: agency1.id,
          refersToAgencyName: agency1.name,
          refersToAgencyContactEmail: agency1.contactEmail,
        })
        .build(),
      {
        [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );
    it("returns undefined when no agency found", async () => {
      expect(await agencyRepository.getById(agency1.id)).toBeUndefined();
    });

    it("returns existing agency", async () => {
      await agencyRepository.insert(agency1);

      const retrievedAgency = await agencyRepository.getById(agency1.id);
      expectToEqual(retrievedAgency, agency1);
    });

    it("returns existing agency, with link to a refering one if it exists", async () => {
      await agencyRepository.insert(agency1);
      await agencyRepository.insert(agency2WithRefersToAgency1);

      expectToEqual(
        await agencyRepository.getById(agency2WithRefersToAgency1.id),
        agency2WithRefersToAgency1,
      );
    });

    it("returns agency with delegationAgencyInfo correctly", async () => {
      const delegationInfo = {
        delegationEndDate: new Date("2029-01-01").toISOString(),
        delegationAgencyName: "France Travail",
        delegationAgencyKind: "pole-emploi" as const,
      };

      const agencyWithDelegation = toAgencyWithRights(
        agency1builder
          .withKind("autre")
          .withDelegationAgencyInfo(delegationInfo)
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(agencyWithDelegation);

      const retrievedAgency = await agencyRepository.getById(
        agencyWithDelegation.id,
      );
      expectToEqual(retrievedAgency, agencyWithDelegation);
      expect(retrievedAgency?.delegationAgencyInfo).toEqual(delegationInfo);
    });
  });
  describe("getAllAgenciesWithUsersToReview()", () => {
    const agency1 = toAgencyWithRights(agency1builder.build(), {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      [admin1.id]: {
        isNotifiedByEmail: false,
        roles: ["agency-admin"],
      },
      [userToReview.id]: { isNotifiedByEmail: false, roles: ["to-review"] },
      [userToReview2.id]: { isNotifiedByEmail: false, roles: ["to-review"] },
    });
    const agency2 = toAgencyWithRights(agency2builder.build(), {
      [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      [admin1.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
      [userToReview.id]: { isNotifiedByEmail: false, roles: ["to-review"] },
    });
    const agency3 = toAgencyWithRights(
      agency1builder.withId("11111111-1111-1111-1111-111111111111").build(),
      {
        [validator2.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        [admin2.id]: { isNotifiedByEmail: false, roles: ["agency-admin"] },
      },
    );

    it("returns empty array when there are no users to review", async () => {
      expectToEqual(
        await agencyRepository.getAllAgenciesWithUsersToReview(),
        [],
      );
    });

    it("returns all agencies with number of user to review > 0", async () => {
      await Promise.all([
        agencyRepository.insert(agency1),
        agencyRepository.insert(agency2),
        agencyRepository.insert(agency3),
      ]);

      expectArraysToEqualIgnoringOrder(
        await agencyRepository.getAllAgenciesWithUsersToReview(),
        [
          {
            agency: agency1,
            numberOfUsersToReview: 2,
          },
          {
            agency: agency2,
            numberOfUsersToReview: 1,
          },
        ],
      );
    });
  });
  describe("getBySafirAndActiveStatus()", () => {
    const agency1WithSafir = toAgencyWithRights(
      agency1builder.withCodeSafir(safirCode).build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    it("returns empty array when no agency found", async () => {
      expectToEqual(
        await agencyRepository.getBySafirAndActiveStatus(safirCode),
        [],
      );
    });

    it("returns existing active agencies with provided safir code", async () => {
      await agencyRepository.insert(agency1WithSafir);
      expectToEqual(
        await agencyRepository.getBySafirAndActiveStatus(safirCode),
        [agency1WithSafir],
      );
    });

    it("returns empty array when agency is not active", async () => {
      await agencyRepository.insert({
        ...agency1WithSafir,
        status: "closed",
      });
      expectToEqual(
        await agencyRepository.getBySafirAndActiveStatus(safirCode),
        [],
      );
    });

    it("returns all active agencies when multiple share the same safir code", async () => {
      const agency2WithSafir = toAgencyWithRights(
        agency2builder.withCodeSafir(safirCode).build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );
      await agencyRepository.insert(agency1WithSafir);
      await agencyRepository.insert(agency2WithSafir);

      const agencies =
        await agencyRepository.getBySafirAndActiveStatus(safirCode);
      expectArraysToEqualIgnoringOrder(agencies, [
        agency1WithSafir,
        agency2WithSafir,
      ]);
    });
  });

  describe("getByIds()", () => {
    const agency1 = toAgencyWithRights(agency1builder.build(), {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
    });
    const agency2 = toAgencyWithRights(agency2builder.build(), {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
    });
    const agency3 = toAgencyWithRights(
      agency1builder.withId("11111111-1111-1111-1111-111111111111").build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    beforeEach(async () => {
      await Promise.all([
        agencyRepository.insert(agency1),
        agencyRepository.insert(agency2),
        agencyRepository.insert(agency3),
      ]);
    });

    it("returns existing agency", async () => {
      expectToEqual(await agencyRepository.getByIds([agency1.id]), [agency1]);
    });

    it("returns all agencies matching ids", async () => {
      expectArraysToEqualIgnoringOrder(
        await agencyRepository.getByIds([agency1.id, agency3.id]),
        [agency3, agency1],
      );
    });

    it("throws when at least one agency is not found", async () => {
      const notExistingAgencyId = "77777777-7777-7777-7777-777777777777";

      await expectPromiseToFailWithError(
        agencyRepository.getByIds([
          agency1.id,
          agency2.id,
          agency3.id,
          notExistingAgencyId,
        ]),
        errors.agencies.notFound({
          missingAgencyIds: [notExistingAgencyId],
          presentAgencyIds: [agency1.id, agency2.id, agency3.id],
        }),
      );
    });
  });

  describe("getAgencies()", () => {
    // TODO Casser le découplage

    const agency1PEVitrySurSeine = toAgencyWithRights(
      agency1builder
        .withId("00000000-0000-0000-0000-000000000001")
        .withAgencySiret("00000000000001")
        .withKind("pole-emploi")
        .withName("Agence Pôle emploi VITRY‐SUR‐SEINE")
        .withCoveredDepartments(["94"])
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );
    const agency2PEVitryLeFrancois = toAgencyWithRights(
      agency1builder
        .withId("00000000-0000-0000-0000-000000000002")
        .withAgencySiret("00000000000002")
        .withKind("pole-emploi")
        .withName("Agence Pôle emploi VITRY-LE-FRANCOIS")
        .withCoveredDepartments(["51"])
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );
    const agency3PEVitrolles = toAgencyWithRights(
      agency1builder
        .withId("00000000-0000-0000-0000-000000000003")
        .withAgencySiret("00000000000003")
        .withKind("pole-emploi")
        .withName("Agence Pôle emploi VITROLLES")
        .withCoveredDepartments(["13"])
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    const agencyMissionLocale = toAgencyWithRights(
      agency2builder
        .withId("00000000-0000-0000-0000-000000000004")
        .withAgencySiret("00000000000004")
        .withKind("mission-locale")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    const agencyAddedFromPeReferenciel = toAgencyWithRights(
      agency1builder
        .withId("00000000-0000-0000-0000-000000000005")
        .withAgencySiret("00000000000005")
        .withName("Agency from PE referenciel")
        .withStatus("from-api-PE")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    const agencyInParisBuilder = new AgencyDtoBuilder().withAddress({
      departmentCode: "75",
      city: "Paris",
      postcode: "75001",
      streetNumberAndAddress: "OSEF",
    });

    const agencyParisCci = toAgencyWithRights(
      agencyInParisBuilder
        .withId("00000000-0000-0000-0000-000000000006")
        .withAgencySiret("00000000000006")
        .withKind("cci")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    const agencyParisChambreAgriculture = toAgencyWithRights(
      agencyInParisBuilder
        .withId("00000000-0000-0000-0000-000000000007")
        .withAgencySiret("00000000000007")
        .withKind("chambre-agriculture")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    const agencyParisCma = toAgencyWithRights(
      agencyInParisBuilder
        .withId("00000000-0000-0000-0000-000000000008")
        .withAgencySiret("00000000000008")
        .withKind("cma")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      },
    );

    it("returns empty list for empty table", async () => {
      const { data: agencies } = await agencyRepository.getAgencies({});
      expect(agencies).toEqual([]);
    });

    describe("filter by agency status", () => {
      it("returns all agencies filtered on activeAgencyStatuses (active and from-api-PE).", async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agencyMissionLocale),
          agencyRepository.insert(agencyAddedFromPeReferenciel),
          agencyRepository.insert(
            toAgencyWithRights(needsReviewAgency, {
              [validator1.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            }),
          ),
        ]);

        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { status: activeAgencyStatuses },
        });
        expectToEqual(agencies, [
          agency1PEVitrySurSeine,
          agencyMissionLocale,
          agencyAddedFromPeReferenciel,
        ]);
      });

      it("returns all agencies filtered on statuses, respecting provided limit and position", async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agency2PEVitryLeFrancois),
          agencyRepository.insert(agencyMissionLocale),
          agencyRepository.insert(agencyAddedFromPeReferenciel),
          agencyRepository.insert(
            toAgencyWithRights(needsReviewAgency, {
              [validator1.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            }),
          ),
        ]);

        expectToEqual(
          (
            await agencyRepository.getAgencies({
              filters: {
                status: activeAgencyStatuses,
                position: {
                  position: { lat: 48.866667, lon: 2.333333 },
                  distance_km: 10,
                },
              },
              pagination: { page: 1, perPage: 2 },
            })
          ).data,
          [agency1PEVitrySurSeine, agency2PEVitryLeFrancois],
        );
      });

      it("with status filter 'closed'", async () => {
        const closedAgency = toAgencyWithRights(
          // TODO : parsing de schema en DB qui peut montrer des incohérences de données d'agence dans les tests d'intégration
          new AgencyDtoBuilder(needsReviewAgency)
            .withStatusJustification(null)
            .withStatus("closed")
            .build(),
          {
            [validator1.id]: {
              isNotifiedByEmail: false,
              roles: ["validator"],
            },
          },
        );

        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agencyMissionLocale),
          agencyRepository.insert(agencyAddedFromPeReferenciel),
          agencyRepository.insert(closedAgency),
        ]);

        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { status: ["closed"] },
        });
        expectToEqual(agencies, [closedAgency]);
      });
    });

    describe("filter agency kinds", () => {
      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agencyParisCci),
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agencyParisChambreAgriculture),
          agencyRepository.insert(agencyParisCma),
        ]);
      });

      it("miniStage kinds", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { kinds: miniStageAgencyKinds },
            })
          ).data,
        ).toEqual([
          agencyParisCci,
          agencyParisChambreAgriculture,
          agencyParisCma,
        ]);
      });

      it("pole emploi kind", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { kinds: ["pole-emploi"] },
            })
          ).data,
        ).toEqual([agency1PEVitrySurSeine]);
      });
    });

    describe("filter nameIncludes", () => {
      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agency2PEVitryLeFrancois),
          agencyRepository.insert(agency3PEVitrolles),
        ]);
      });

      it("returns all agencies filtered by name", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { nameIncludes: "Vitry" },
            })
          ).data,
        ).toEqual([agency1PEVitrySurSeine, agency2PEVitryLeFrancois]);
      });

      it("considers each word separetly with and 'AND' close", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { nameIncludes: "Vi fran" },
            })
          ).data,
        ).toEqual([agency2PEVitryLeFrancois]);
      });

      it("is accent-insensitive", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { nameIncludes: "Pole" },
            })
          ).data,
        ).toEqual([
          agency1PEVitrySurSeine,
          agency2PEVitryLeFrancois,
          agency3PEVitrolles,
        ]);
      });

      it("also supports pasting the uuid of an agency", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { nameIncludes: agency2PEVitryLeFrancois.id },
            })
          ).data,
        ).toEqual([agency2PEVitryLeFrancois]);
      });

      it("returns nothing on no match in names", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { nameIncludes: "Vitre" },
            })
          ).data,
        ).toEqual([]);
      });
    });

    describe("filter sirets", () => {
      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agency2PEVitryLeFrancois),
        ]);
      });

      it("returns all agencies filtered by sirets", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { sirets: [agency1PEVitrySurSeine.agencySiret] },
            })
          ).data,
        ).toEqual([agency1PEVitrySurSeine]);
      });
      it("returns nothing on missing sirets", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { sirets: ["00000000000000"] },
            })
          ).data,
        ).toEqual([]);
      });

      it("returns all on empty sirets", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { sirets: [] },
            })
          ).data,
        ).toEqual([agency1PEVitrySurSeine, agency2PEVitryLeFrancois]);
      });
    });

    describe("pagination", () => {
      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agency2PEVitryLeFrancois),
          agencyRepository.insert(agency3PEVitrolles),
        ]);
      });

      it("returns correct pagination metadata for page 1", async () => {
        const result = await agencyRepository.getAgencies({
          pagination: { page: 1, perPage: 2 },
        });
        expectToEqual(result.data, [
          agency1PEVitrySurSeine,
          agency2PEVitryLeFrancois,
        ]);
        expectToEqual(result.pagination, {
          totalRecords: 3,
          totalPages: 2,
          currentPage: 1,
          numberPerPage: 2,
        });
      });

      it("returns second page with correct data and metadata", async () => {
        const result = await agencyRepository.getAgencies({
          pagination: { page: 2, perPage: 2 },
        });
        expectToEqual(result.data, [agency3PEVitrolles]);
        expectToEqual(result.pagination, {
          totalRecords: 3,
          totalPages: 2,
          currentPage: 2,
          numberPerPage: 2,
        });
      });
    });

    describe("filter departmentCode", () => {
      const agencyWithParisInCoveredDepartments = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("66666666-6666-6666-6666-666666666666")
          .withKind("cci")
          .withAddress({
            departmentCode: "64",
            city: "Bayonne",
            postcode: "64100",
            streetNumberAndAddress: "OSEF",
          })
          .withCoveredDepartments(["64", "75"])
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agency1PEVitrySurSeine),
          agencyRepository.insert(agency2PEVitryLeFrancois),
          agencyRepository.insert(agency3PEVitrolles),
          agencyRepository.insert(agencyParisCci),
          agencyRepository.insert(agencyWithParisInCoveredDepartments),
        ]);
      });

      it("2 on departmentCode 75", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { departmentCode: "75" },
            })
          ).data,
        ).toEqual([agencyParisCci, agencyWithParisInCoveredDepartments]);
      });

      it("1 on departmentCode 51", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { departmentCode: "51" },
            })
          ).data,
        ).toEqual([agency2PEVitryLeFrancois]);
      });

      it("0 on departmentCode 02", async () => {
        expect(
          (
            await agencyRepository.getAgencies({
              filters: { departmentCode: "01" },
            })
          ).data,
        ).toEqual([]);
      });

      describe("to get agencies near by a given department", () => {
        //TODO : tout ce describe est un doublon????????
        it("returns only agencies in department", async () => {
          const cergyAgency = toAgencyWithRights(
            agency1builder
              .withId("11111111-1111-1111-1111-111111111111")
              .withName("Agency Val d'Oise")
              .withAddress({
                departmentCode: "95",
                city: "Cergy",
                postcode: "95000",
                streetNumberAndAddress: "",
              })
              .build(),
            {
              [validator1.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            },
          );

          const parisAgency = toAgencyWithRights(
            agency1builder
              .withId("11111111-1111-1111-1111-111211111112")
              .withName("Agency Val d'Oise")
              .withAddress({
                departmentCode: "75",
                city: "Paris",
                postcode: "75000",
                streetNumberAndAddress: "au fond à droite",
              })
              .build(),
            {
              [validator1.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            },
          );

          await Promise.all([
            agencyRepository.insert(parisAgency),
            agencyRepository.insert(cergyAgency),
          ]);

          expectToEqual(
            (
              await agencyRepository.getAgencies({
                filters: {
                  departmentCode: "95",
                },
              })
            ).data,
            [cergyAgency],
          );
        });
      });
    });

    describe("filter position & statuses", () => {
      const placeStanislasPosition: GeoPositionDto = {
        lat: 48.693339,
        lon: 6.182858,
      };

      it("returns only active agencies which are less than certain distance", async () => {
        const nancyAgency = toAgencyWithRights(
          agency1builder
            .withName("Nancy agency")
            .withPosition(48.697851, 6.20157)
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );

        const epinalAgency = toAgencyWithRights(
          agency2builder
            .withName("Epinal agency")
            .withPosition(48.179552, 6.441447)
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );

        const dijonAgency = toAgencyWithRights(
          AgencyDtoBuilder.create("33333333-3333-3333-3333-333333333333")
            .withName("Dijon agency")
            .withPosition(47.365086, 5.051027)
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );

        await Promise.all([
          agencyRepository.insert(nancyAgency),
          agencyRepository.insert(epinalAgency),
          agencyRepository.insert(dijonAgency),
          agencyRepository.insert(
            toAgencyWithRights(needsReviewAgency, {
              [validator1.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
            }),
          ),
        ]);

        const { data: agencies } = await agencyRepository.getAgencies({
          filters: {
            position: {
              position: placeStanislasPosition,
              distance_km: 100,
            },
            status: activeAgencyStatuses,
          },
        });

        expectToEqual(agencies, [nancyAgency, epinalAgency]);
      });
    });

    describe("doesNotReferToOtherAgency", () => {
      const agency1 = toAgencyWithRights(agency1builder.build(), {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      });
      const agency2WithRefersToAgency1 = toAgencyWithRights(
        agency2builder
          .withRefersToAgencyInfo({
            refersToAgencyId: agency1.id,
            refersToAgencyName: agency1.name,
            refersToAgencyContactEmail: agency1.contactEmail,
          })
          .build(),
        {
          [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );

      beforeEach(async () => {
        await agencyRepository.insert(agency1);
        await agencyRepository.insert(agency2WithRefersToAgency1);
      });

      it("should not return refered agencies when the filter is provided with true", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { doesNotReferToOtherAgency: true },
        });

        expect(agencies).toEqual([agency1]);
      });
    });

    describe("filter createdAtBefore", () => {
      const baseDate = new Date("2024-01-15T10:00:00Z");
      const dateBefore = subDays(baseDate, 5); // 2024-01-10
      const dateAfter = subDays(baseDate, -5); // 2024-01-20

      const agencyCreatedBefore = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000010")
          .withAgencySiret("00000000000010")
          .withCreatedAt(dateBefore.toISOString())
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      const agencyCreatedOnDate = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000011")
          .withAgencySiret("00000000000011")
          .withCreatedAt(baseDate.toISOString())
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      const agencyCreatedAfter = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000012")
          .withAgencySiret("00000000000012")
          .withCreatedAt(dateAfter.toISOString())
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agencyCreatedBefore),
          agencyRepository.insert(agencyCreatedOnDate),
          agencyRepository.insert(agencyCreatedAfter),
        ]);
      });

      it("returns only agencies created before or on the specified date", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { createdAtBefore: baseDate },
        });

        expectToEqual(agencies, [agencyCreatedBefore, agencyCreatedOnDate]);
      });

      it("returns nothing when filter date is before all agencies", async () => {
        const veryOldDate = subDays(dateBefore, 10);
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { createdAtBefore: veryOldDate },
        });

        expect(agencies).toEqual([]);
      });

      it("returns all agencies when filter date is after all agencies", async () => {
        const futureDate = subDays(dateAfter, -10);
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { createdAtBefore: futureDate },
        });

        expectToEqual(agencies, [
          agencyCreatedBefore,
          agencyCreatedOnDate,
          agencyCreatedAfter,
        ]);
      });

      it("works in combination with other filters", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: {
            createdAtBefore: baseDate,
            status: activeAgencyStatuses,
          },
        });

        expectToEqual(agencies, [agencyCreatedBefore, agencyCreatedOnDate]);
      });
    });

    describe("filter userIds", () => {
      const agencyWithUsers_1_2 = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000010")
          .withAgencySiret("00000000000010")
          .build(),
        {
          [counsellor1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
          [counsellor2.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
        },
      );

      const agencyWithUsers_1_3 = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000011")
          .withAgencySiret("00000000000011")
          .build(),
        {
          [counsellor1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      const agencyWithUsers_3 = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000012")
          .withAgencySiret("00000000000012")
          .build(),
        {
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      const agencyWithUsers_1_2_3 = toAgencyWithRights(
        agency1builder
          .withId("00000000-0000-0000-0000-000000000013")
          .withAgencySiret("00000000000013")
          .build(),
        {
          [counsellor1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
          [counsellor2.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
          [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
        },
      );

      beforeEach(async () => {
        await Promise.all([
          agencyRepository.insert(agencyWithUsers_1_3),
          agencyRepository.insert(agencyWithUsers_1_2),
          agencyRepository.insert(agencyWithUsers_3),
          agencyRepository.insert(agencyWithUsers_1_2_3),
        ]);
      });

      it("returns only agencies with rights made to specified userIds only - single user", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { userIds: [validator1.id] },
        });

        expectToEqual(agencies, [
          agencyWithUsers_1_3,
          agencyWithUsers_3,
          agencyWithUsers_1_2_3,
        ]);
      });

      it("returns only agencies with rights made to specified userIds only - multiple users", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { userIds: [counsellor1.id, counsellor2.id] },
        });

        expectToEqual(agencies, [
          agencyWithUsers_1_2,
          agencyWithUsers_1_3,
          agencyWithUsers_1_2_3,
        ]);
      });

      it("returns nothing when user has no rights on agencies", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { userIds: [validator2.id] },
        });

        expect(agencies).toEqual([]);
      });

      it("returns nothing if empty userIds specified", async () => {
        const { data: agencies } = await agencyRepository.getAgencies({
          filters: { userIds: [] },
        });

        expectToEqual(agencies, []);
      });
    });

    describe("filter delegationConventionEndDate", () => {
      it("returns only agencies whose delegation convention ends on the given date", async () => {
        const delegationEndDate = new Date("2031-06-30").toISOString();
        const otherDelegationEndDate = new Date("2031-12-31").toISOString();

        const agencyWithMatchingEndDate = toAgencyWithRights(
          agency1builder
            .withId("00000000-0000-0000-0000-000000000099")
            .withKind("autre")
            .withStatus("active")
            .withDelegationAgencyInfo({
              delegationEndDate,
              delegationAgencyName: "DR France Travail",
              delegationAgencyKind: "pole-emploi",
            })
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );
        const agencyWithOtherEndDate = toAgencyWithRights(
          agency1builder
            .withId("00000000-0000-0000-0000-000000000098")
            .withKind("autre")
            .withStatus("active")
            .withDelegationAgencyInfo({
              delegationEndDate: otherDelegationEndDate,
              delegationAgencyName: "DR France Travail",
              delegationAgencyKind: "pole-emploi",
            })
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );
        const agencyWithoutDelegation = toAgencyWithRights(
          agency1builder
            .withId("00000000-0000-0000-0000-000000000097")
            .withKind("autre")
            .withStatus("active")
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          },
        );

        await agencyRepository.insert(agencyWithMatchingEndDate);
        await agencyRepository.insert(agencyWithOtherEndDate);
        await agencyRepository.insert(agencyWithoutDelegation);

        const { data: agencies } = await agencyRepository.getAgencies({
          filters: {
            kinds: ["autre"],
            status: ["active"],
            delegationConventionEndDate: delegationEndDate,
          },
        });

        expectToEqual(agencies, [agencyWithMatchingEndDate]);
      });
    });
  });

  describe("getAgenciesRelatedToAgency()", () => {
    const agency1 = toAgencyWithRights(agency1builder.build(), {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    });
    const agency2WithRefersToAgency1 = toAgencyWithRights(
      agency2builder
        .withRefersToAgencyInfo({
          refersToAgencyId: agency1.id,
          refersToAgencyName: agency1.name,
          refersToAgencyContactEmail: agency1.contactEmail,
        })
        .build(),
      {
        [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    it("found related agencies", async () => {
      await agencyRepository.insert(agency1);
      await agencyRepository.insert(agency2WithRefersToAgency1);

      expectToEqual(
        await agencyRepository.getAgenciesRelatedToAgency(agency1.id),
        [agency2WithRefersToAgency1],
      );
    });

    it("empty when there is no related agencies", async () => {
      await agencyRepository.insert(agency1);

      expectToEqual(
        await agencyRepository.getAgenciesRelatedToAgency(agency1.id),
        [],
      );
    });
  });

  describe("getImmersionFacileAgencyId()", () => {
    it("returns undefined for missing agency", async () => {
      expect(
        await agencyRepository.getImmersionFacileAgencyId(),
      ).toBeUndefined();
    });

    it("returns agencyId if exist", async () => {
      const immersionFacileAgency = toAgencyWithRights(
        agency1builder.withKind("immersion-facile").build(),
        {
          [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );

      await agencyRepository.insert(immersionFacileAgency);

      expectToEqual(
        await agencyRepository.getImmersionFacileAgencyId(),
        immersionFacileAgency.id,
      );
    });
  });

  describe("getUserIdByFilters()", () => {
    const agency1WithValidatorAndCounsellorRights = toAgencyWithRights(
      agency1builder.build(),
      {
        [validator1.id]: {
          isNotifiedByEmail: true,
          roles: ["validator"],
        },
        [counsellor1.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor"],
        },
      },
    );
    const agency2WithValidator2Rights = toAgencyWithRights(
      agency2builder.build(),
      {
        [validator2.id]: {
          isNotifiedByEmail: false,
          roles: ["validator"],
        },
      },
    );

    beforeEach(async () => {
      await Promise.all([
        agencyRepository.insert(agency1WithValidatorAndCounsellorRights),
        agencyRepository.insert(agency2WithValidator2Rights),
      ]);
    });

    describe("by agencyId", () => {
      it("return all userIds that have rights on agency by agencyId", async () => {
        expectToEqual(
          await agencyRepository.getUserIdWithAgencyRightsByFilters({
            agencyId: agency1WithValidatorAndCounsellorRights.id,
          }),
          [counsellor1.id, validator1.id],
        );
      });
    });

    describe("by agencyRole", () => {
      it("return all userIds that have at least validator rights on any agency in repo", async () => {
        expectToEqual(
          await agencyRepository.getUserIdWithAgencyRightsByFilters({
            agencyRole: "validator",
          }),
          [validator1.id, validator2.id],
        );
      });

      it("return nothing there is no agency with user that have the role", async () => {
        expectToEqual(
          await agencyRepository.getUserIdWithAgencyRightsByFilters({
            agencyRole: "agency-viewer",
          }),
          [],
        );
      });
    });
  });

  describe("getAgenciesRightsByUserId()", () => {
    const agency1WithValidator1Rights = toAgencyWithRights(
      agency1builder.build(),
      {
        [validator1.id]: {
          isNotifiedByEmail: true,
          roles: ["validator", "agency-admin"],
        },
      },
    );

    const agency2WithValidator1AndCounsellor1Rights = toAgencyWithRights(
      agency2builder.build(),
      {
        [validator1.id]: {
          isNotifiedByEmail: false,
          roles: ["validator"],
        },
        [counsellor1.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor"],
        },
      },
    );

    const agencyNeedsReviewWithCounsellor1Rights = toAgencyWithRights(
      needsReviewAgency,
      {
        [counsellor1.id]: {
          isNotifiedByEmail: false,
          roles: ["to-review"],
        },
      },
    );

    beforeEach(async () => {
      await Promise.all([
        agencyRepository.insert(agency1WithValidator1Rights),
        agencyRepository.insert(agency2WithValidator1AndCounsellor1Rights),
        agencyRepository.insert(agencyNeedsReviewWithCounsellor1Rights),
      ]);
    });

    it("get rights of all agencies that have a right of the user with user validator1", async () => {
      expectToEqual(
        await agencyRepository.getAgenciesRightsByUserId(validator1.id),
        [
          {
            agencyId: agency1WithValidator1Rights.id,
            ...agency1WithValidator1Rights.usersRights[validator1.id],
          },
          {
            agencyId: agency2WithValidator1AndCounsellor1Rights.id,
            ...agency2WithValidator1AndCounsellor1Rights.usersRights[
              validator1.id
            ],
          },
        ],
      );
    });

    it("get rights of all agencies that have a right of the user with user counsellor1", async () => {
      expectToEqual(
        await agencyRepository.getAgenciesRightsByUserId(counsellor1.id),
        [
          {
            agencyId: agency2WithValidator1AndCounsellor1Rights.id,
            ...agency2WithValidator1AndCounsellor1Rights.usersRights[
              counsellor1.id
            ],
          },
          {
            agencyId: agencyNeedsReviewWithCounsellor1Rights.id,
            ...agencyNeedsReviewWithCounsellor1Rights.usersRights[
              counsellor1.id
            ],
          },
        ],
      );
    });

    it("get nothing if user have no rights on any agency", async () => {
      expectToEqual(
        await agencyRepository.getAgenciesRightsByUserId(counsellor2.id),
        [],
      );
    });
  });

  describe("alreadyHasActiveAgencyWithSameAddressAndKind()", () => {
    it("return false if no agency exists with given address and kind", async () => {
      const newAgencyId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const hasAlreadySimilarAgency =
        await agencyRepository.alreadyHasActiveAgencyWithSameAddressAndKind({
          address: {
            streetNumberAndAddress: "24 rue des bouchers",
            city: "Strasbourg",
            postcode: "67000",
            departmentCode: "67",
          },
          kind: "cci",
          idToIgnore: newAgencyId,
        });

      expect(hasAlreadySimilarAgency).toBe(false);
    });

    it("return false if matched agencyId is in idToIgnore", async () => {
      const activeAgencyAlreadyInDb = toAgencyWithRights(
        agency1builder.build(),
        {
          [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );
      await agencyRepository.insert(activeAgencyAlreadyInDb);
      const hasAlreadySimilarAgency =
        await agencyRepository.alreadyHasActiveAgencyWithSameAddressAndKind({
          address: activeAgencyAlreadyInDb.address,
          kind: activeAgencyAlreadyInDb.kind,
          idToIgnore: activeAgencyAlreadyInDb.id,
        });

      expect(hasAlreadySimilarAgency).toBe(false);
    });

    it("return false if matched agency has no active or needsReview status", async () => {
      const closedAgencyAlreadyInDb = toAgencyWithRights(
        agency1builder.withStatus("closed").build(),
        {
          [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );
      await agencyRepository.insert(closedAgencyAlreadyInDb);
      const newAgencyId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";

      expect(
        await agencyRepository.alreadyHasActiveAgencyWithSameAddressAndKind({
          address: closedAgencyAlreadyInDb.address,
          kind: closedAgencyAlreadyInDb.kind,
          idToIgnore: newAgencyId,
        }),
      ).toBe(false);
    });

    it.each([
      ...activeAgencyStatuses,
      "needsReview",
    ] as AgencyStatus[])("return true if there is an agency %s with given address and kind", async (status) => {
      const activeAgencyAlreadyInDb = toAgencyWithRights(
        agency1builder.withStatus(status).build(),
        {
          [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        },
      );
      await agencyRepository.insert(activeAgencyAlreadyInDb);
      const newAgencyId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const hasAlreadySimilarAgency =
        await agencyRepository.alreadyHasActiveAgencyWithSameAddressAndKind({
          address: activeAgencyAlreadyInDb.address,
          kind: activeAgencyAlreadyInDb.kind,
          idToIgnore: newAgencyId,
        });

      expect(hasAlreadySimilarAgency).toBe(true);
    });
  });

  describe("findExistingActiveSirets()", () => {
    const activeAgency = new AgencyDtoBuilder()
      .withId("00000000-0000-0000-0000-000000000006")
      .withAgencySiret("00000000000006")
      .build();

    const closedAgency = new AgencyDtoBuilder()
      .withId("00000000-0000-0000-0000-000000000002")
      .withAgencySiret("00000000000002")
      .withStatus("closed")
      .build();

    const activeAgencyWithRights = toAgencyWithRights(activeAgency, {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
    });

    const closedAgencyWithRights = toAgencyWithRights(closedAgency, {
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
    });

    beforeEach(async () => {
      await agencyRepository.insert(activeAgencyWithRights);
      await agencyRepository.insert(closedAgencyWithRights);
    });

    it("returns empty array if requested sirets do not exist or an not active", async () => {
      const sirets = [closedAgency.agencySiret, "random-id"];
      const existingSirets =
        await agencyRepository.getExistingActiveSirets(sirets);
      expect(existingSirets).toEqual([]);
    });

    it("returns the sirets of the active agencies", async () => {
      const sirets = [activeAgency.agencySiret];
      const existingSirets =
        await agencyRepository.getExistingActiveSirets(sirets);
      expect(existingSirets).toEqual([activeAgency.agencySiret]);
    });
  });

  describe("deleteOldAgenciesWithoutConventions", () => {
    const threeMonthsAgo = subMonths(new Date(), 3);
    const oldDate = subMonths(new Date(), 4).toISOString();
    const recentDate = subDays(new Date(), 5).toISOString();

    let conventionRepository:
      | PgConventionRepository
      | InMemoryConventionRepository;

    beforeEach(() => {
      conventionRepository =
        adapterKind === "pg"
          ? new PgConventionRepository(db)
          : new InMemoryConventionRepository();
    });

    const closedAgency1 = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("11111111-1111-4111-9111-111111111111")
        .withStatus("closed")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const rejectedAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("22222222-2222-4222-9222-222222222222")
        .withStatus("rejected")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const closedAgency2 = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("33333333-3333-4333-9333-333333333333")
        .withStatus("closed")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const activeAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("44444444-4444-4444-9444-444444444444")
        .withStatus("active")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const closedAgency3 = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("55555555-5555-4555-9555-555555555555")
        .withStatus("closed")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    if (adapterKind === "pg") {
      it("deletes agencies with status closed or rejected, updated_at older than given date, and without conventions", async () => {
        await Promise.all([
          agencyRepository.insert(closedAgency1, oldDate),
          agencyRepository.insert(rejectedAgency, oldDate),
          agencyRepository.insert(closedAgency2, recentDate),
          agencyRepository.insert(activeAgency, oldDate),
          agencyRepository.insert(closedAgency3, oldDate),
        ]);
        const convention = new ConventionDtoBuilder()
          .withId("cccccccc-cccc-4ccc-9ccc-cccccccccccc")
          .withAgencyId(closedAgency3.id)
          .build();

        await conventionRepository.save(convention);

        const deletedAgencyIds =
          await agencyRepository.deleteOldClosedAgenciesWithoutConventions({
            updatedBefore: threeMonthsAgo,
          });

        expectArraysToEqualIgnoringOrder(deletedAgencyIds, [
          closedAgency1.id,
          rejectedAgency.id,
        ]);

        expect(
          await agencyRepository.getById(closedAgency1.id),
        ).toBeUndefined();
        expect(
          await agencyRepository.getById(rejectedAgency.id),
        ).toBeUndefined();

        const agenciesToKeep = await agencyRepository.getByIds([
          closedAgency2.id,
          activeAgency.id,
          closedAgency3.id,
        ]);

        expectArraysToEqualIgnoringOrder(agenciesToKeep, [
          closedAgency2,
          activeAgency,
          closedAgency3,
        ]);
      });

      it("deletes agencies that refer to a deleted agency via refers_to_agency_id", async () => {
        const agencyReferringToAgencyThatShouldBeDeleted = toAgencyWithRights(
          new AgencyDtoBuilder()
            .withId("bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb")
            .withStatus("active")
            .withRefersToAgencyInfo({
              refersToAgencyId: closedAgency1.id,
              refersToAgencyName: closedAgency1.name,
              refersToAgencyContactEmail: closedAgency1.contactEmail,
            })
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          },
        );

        const agencyNotReferringToDeletedAgency = toAgencyWithRights(
          new AgencyDtoBuilder()
            .withId("cccccccc-cccc-4ccc-9ccc-cccccccccccc")
            .withStatus("active")
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          },
        );

        await agencyRepository.insert(closedAgency1, oldDate);
        await Promise.all([
          agencyRepository.insert(agencyReferringToAgencyThatShouldBeDeleted),
          agencyRepository.insert(agencyNotReferringToDeletedAgency),
        ]);

        const deletedAgencyIds =
          await agencyRepository.deleteOldClosedAgenciesWithoutConventions({
            updatedBefore: threeMonthsAgo,
          });

        expectArraysToEqualIgnoringOrder(deletedAgencyIds, [
          closedAgency1.id,
          agencyReferringToAgencyThatShouldBeDeleted.id,
        ]);

        const agenciesToKeep = await agencyRepository.getByIds([
          agencyNotReferringToDeletedAgency.id,
        ]);

        expectArraysToEqualIgnoringOrder(agenciesToKeep, [
          agencyNotReferringToDeletedAgency,
        ]);
      });

      it("does not delete the agency to delete (nor its referring agencies) if at least one referring agency has conventions", async () => {
        const agencyReferringToDeletedAgencyWithConvention = toAgencyWithRights(
          new AgencyDtoBuilder()
            .withId("dddddddd-dddd-4ddd-9ddd-dddddddddddd")
            .withStatus("active")
            .withRefersToAgencyInfo({
              refersToAgencyId: closedAgency1.id,
              refersToAgencyName: closedAgency1.name,
              refersToAgencyContactEmail: closedAgency1.contactEmail,
            })
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          },
        );
        await agencyRepository.insert(closedAgency1, oldDate);

        await agencyRepository.insert(
          agencyReferringToDeletedAgencyWithConvention,
        );

        const convention = new ConventionDtoBuilder()
          .withId("dddddddd-dddd-4ddd-9ddd-dddddddddddc")
          .withAgencyId(agencyReferringToDeletedAgencyWithConvention.id)
          .build();

        await conventionRepository.save(convention);

        const deletedAgencyIds =
          await agencyRepository.deleteOldClosedAgenciesWithoutConventions({
            updatedBefore: threeMonthsAgo,
          });

        expectArraysToEqualIgnoringOrder(deletedAgencyIds, []);

        expectToEqual(
          await agencyRepository.getById(closedAgency1.id),
          closedAgency1,
        );

        expectToEqual(
          await agencyRepository.getById(
            agencyReferringToDeletedAgencyWithConvention.id,
          ),
          agencyReferringToDeletedAgencyWithConvention,
        );
      });

      it("deletes both agencies when a deletion candidate is referenced by another deletion candidate", async () => {
        const oldClosedAgencyReferrer = toAgencyWithRights(
          new AgencyDtoBuilder()
            .withId("eeeeeeee-eeee-4eee-9eee-eeeeeeeeeeee")
            .withStatus("closed")
            .withRefersToAgencyInfo({
              refersToAgencyId: closedAgency1.id,
              refersToAgencyName: closedAgency1.name,
              refersToAgencyContactEmail: closedAgency1.contactEmail,
            })
            .build(),
          {
            [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
          },
        );

        await agencyRepository.insert(closedAgency1, oldDate);
        await agencyRepository.insert(oldClosedAgencyReferrer, oldDate);

        const deletedAgencyIds =
          await agencyRepository.deleteOldClosedAgenciesWithoutConventions({
            updatedBefore: threeMonthsAgo,
          });

        expectArraysToEqualIgnoringOrder(deletedAgencyIds, [
          closedAgency1.id,
          oldClosedAgencyReferrer.id,
        ]);

        expect(
          await agencyRepository.getById(closedAgency1.id),
        ).toBeUndefined();
        expect(
          await agencyRepository.getById(oldClosedAgencyReferrer.id),
        ).toBeUndefined();
      });
    } else {
      it("throw Not implemented", () => {
        expectPromiseToFailWithError(
          agencyRepository.deleteOldClosedAgenciesWithoutConventions({
            updatedBefore: threeMonthsAgo,
          }),
          new Error("Not implemented"),
        );
      });
    }
  });
});
