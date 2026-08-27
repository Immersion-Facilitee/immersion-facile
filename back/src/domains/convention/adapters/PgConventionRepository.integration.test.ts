import { addDays, subDays, subYears } from "date-fns";
import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  type AppellationAndRomeDto,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type DateString,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type FtConnectToken,
  reasonableSchedule,
  type WithAcquisition,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeUniqueUserForTest } from "../../../utils/user";
import { PgAgencyRepository } from "../../agency/adapters/PgAgencyRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import type { ConventionRepository } from "../ports/ConventionRepository";
import { PgConventionRepository } from "./PgConventionRepository";

describe("PgConventionRepository", () => {
  const anyConventionUpdatedAt = new Date("2022-05-20T12:43:11").toISOString();
  const beneficiaryRepresentative: BeneficiaryRepresentative = {
    role: "beneficiary-representative",
    email: "legal@representative.com",
    firstName: "The",
    lastName: "Representative",
    phone: "+33112233445",
  };

  const userFtExternalId = "749dd14f-c82a-48b1-b1bb-fffc5467e4d4";
  const agency = new AgencyDtoBuilder().withId(uuid()).build();
  const styliste: AppellationAndRomeDto = {
    romeCode: "B1805",
    romeLabel: "Stylisme",
    appellationCode: "19540",
    appellationLabel: "Styliste",
  };

  const conventionStylisteBuilder = new ConventionDtoBuilder()
    .withImmersionAppellation(styliste)
    .withUpdatedAt(anyConventionUpdatedAt)
    .withAgencyReferent({
      firstname: "Fredy",
      lastname: "L'ACCOMPAGNATEUR",
    })
    .withAgencyId(agency.id);

  let pool: Pool;
  let conventionRepository: PgConventionRepository;
  let db: KyselyDb;
  let timeGateway: CustomTimeGateway;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);

    const validator = makeUniqueUserForTest(uuid());
    await new PgUserRepository(db).save(validator);
    await new PgAgencyRepository(db).insert(
      toAgencyWithRights(new AgencyDtoBuilder().withId(uuid()).build(), {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );
    timeGateway = new CustomTimeGateway();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    timeGateway = new CustomTimeGateway();
    await db.deleteFrom("conventions__ft_connect_users").execute();
    await db.deleteFrom("ft_connect_users").execute();
    await db.deleteFrom("conventions").execute();
    await db.deleteFrom("actors").execute();
    await db.deleteFrom("conventions__ft_connect_users").execute();
    await db.deleteFrom("ft_connect_users").execute();
    await db.deleteFrom("convention_external_ids").execute();
    await db.deleteFrom("agency_groups__agencies").execute();
    await db.deleteFrom("agency_groups").execute();
    await db.deleteFrom("agencies").execute();
    await db.deleteFrom("banned_establishments").execute();

    const validator = makeUniqueUserForTest(uuid());

    await new PgUserRepository(db).save(validator);
    await new PgAgencyRepository(db).insert(
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );

    conventionRepository = new PgConventionRepository(db);
  });

  describe.each(["Pg", "InMemory"] as const)("%s getById", (adapter) => {
    let repository: ConventionRepository;

    beforeEach(() => {
      if (adapter === "Pg") {
        repository = new PgConventionRepository(db);
      } else {
        const uow = createInMemoryUow();
        repository = uow.conventionRepository;
      }
    });

    it("returns undefined if no convention were found with id", async () => {
      expectToEqual(
        await repository.getById("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa"),
        undefined,
      );
    });

    it("returns the convention dto when it exists", async () => {
      const convention = conventionStylisteBuilder
        .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
        .withEstablishmentNumberOfEmployeesRange("20-49")
        .build();

      await repository.save(convention, anyConventionUpdatedAt);

      expectToEqual(await repository.getById(convention.id), convention);
    });
  });

  it("Adds a new convention", async () => {
    const convention = conventionStylisteBuilder
      .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
      .withEstablishmentNumberOfEmployeesRange("20-49")
      .withAgencyId(agency.id)
      .withFromConventionDraftId(uuid())
      .build();

    expect(await conventionRepository.getById(convention.id)).toBeUndefined();

    const savedExternalId = await conventionRepository.save(
      convention,
      anyConventionUpdatedAt,
    );

    expect(await conventionRepository.getById(convention.id)).toEqual(
      convention,
    );
    expect(savedExternalId).toBeUndefined();
  });

  it("fails to add a convention if it already exists", async () => {
    const convention = new ConventionDtoBuilder()
      .withInternshipKind("immersion")
      .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
      .withAgencyId(agency.id)
      .withDateStart(new Date("2023-01-02").toISOString())
      .withDateEnd(new Date("2023-01-06").toISOString())
      .withSchedule(reasonableSchedule)
      .withAgencyReferent({ firstname: "Fredy", lastname: "L'ACCOMPAGNATEUR" })
      .build();

    await conventionRepository.save(convention);

    await expectPromiseToFailWithError(
      conventionRepository.save(convention),
      errors.convention.conflict({ conventionId: convention.id }),
    );
  });

  it("Adds/Update a new CCI convention, fromConventionDraftId is not updated", async () => {
    const convention = conventionStylisteBuilder
      .withInternshipKind("mini-stage-cci")
      .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
      .withDateStart(new Date("2023-01-02").toISOString())
      .withDateEnd(new Date("2023-01-06").toISOString())
      .withEstablishmentNumberOfEmployeesRange("1-2")
      .withSchedule(reasonableSchedule)
      .build();

    await conventionRepository.save(convention, anyConventionUpdatedAt);

    expectToEqual(
      await conventionRepository.getById(convention.id),
      convention,
    );

    const updatedConvention = new ConventionDtoBuilder(convention)
      .withBeneficiaryFirstName("Marvin")
      .withEstablishmentNumberOfEmployeesRange("20-49")
      .withUpdatedAt(anyConventionUpdatedAt)
      .withRemoteWorkMode("HYBRID")
      .withFromConventionDraftId(uuid())
      .build();

    await conventionRepository.update(
      updatedConvention,
      anyConventionUpdatedAt,
    );

    expectToEqual(await conventionRepository.getById(updatedConvention.id), {
      ...updatedConvention,
      fromConventionDraftId: undefined,
    });
  });

  it("Adds a new convention with field workConditions undefined and no signatories", async () => {
    const convention = conventionStylisteBuilder
      .withoutWorkCondition()
      .notSigned()
      .build();

    await conventionRepository.save(convention, anyConventionUpdatedAt);

    const fetchedConvention = await conventionRepository.getById(convention.id);
    expect(fetchedConvention).toEqual(convention);
  });

  it("Keeps acquisition params when provided", async () => {
    const withAcquisition: WithAcquisition = {
      acquisitionKeyword: "acquisition-keyword",
      acquisitionCampaign: "acquisition-campaign",
    };

    const convention = new ConventionDtoBuilder()
      .withImmersionAppellation(styliste)
      .withoutWorkCondition()
      .withAgencyId(agency.id)
      .withAcquisition(withAcquisition)
      .notSigned()
      .build();

    await conventionRepository.save(convention);

    const result = await db
      .selectFrom("conventions")
      .select(["acquisition_campaign", "acquisition_keyword"])
      .execute();

    expectToEqual(result, [
      {
        acquisition_campaign: "acquisition-campaign",
        acquisition_keyword: "acquisition-keyword",
      },
    ]);
  });

  it("Adds a convention renewed from another one", async () => {
    const existingConvention = conventionStylisteBuilder
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withId("11111111-1111-4111-9111-111111111111")
      .withEstablishmentNumberOfEmployeesRange("20-49")
      .build();

    await conventionRepository.save(existingConvention);

    const renewedConvention = conventionStylisteBuilder
      .withId("22222222-2222-4222-9222-222222222222")
      .withStatus("READY_TO_SIGN")
      .withRenewed({
        from: existingConvention.id,
        justification: "some justification",
      })
      .build();

    await conventionRepository.save(renewedConvention, anyConventionUpdatedAt);

    const fetchedConvention = await conventionRepository.getById(
      renewedConvention.id,
    );
    expectToEqual(fetchedConvention, renewedConvention);
  });

  it("Adds a new convention with beneficiary extra fields", async () => {
    const extraFields = {
      isRqth: false,
      emergencyContact: "jean bon",
      emergencyContactPhone: "+33612345678",
    };
    const convention = new ConventionDtoBuilder()
      .withBeneficiary({
        birthdate: new Date("2000-05-26").toISOString(),
        firstName: "Jean",
        lastName: "Bono",
        role: "beneficiary",
        email: "jean@bono.com",
        phone: "+33836656565",
        ...extraFields,
      })
      .withAgencyId(agency.id)
      .build();

    await conventionRepository.save(convention);

    const conventionRetreived = await conventionRepository.getById(
      convention.id,
    );

    expectToEqual(conventionRetreived?.signatories.beneficiary, {
      ...convention.signatories.beneficiary,
      ...extraFields,
    });

    const { emergencyContactPhone: _, ...extraFieldsWithoutPhone } =
      extraFields;
    const conventionWithoutEmergencyPhone = new ConventionDtoBuilder(convention)
      .withBeneficiary({
        ...convention.signatories.beneficiary,
        ...extraFieldsWithoutPhone,
        emergencyContactPhone: undefined,
      })
      .build();

    await conventionRepository.update(conventionWithoutEmergencyPhone);

    const conventionAfterUpdate = await conventionRepository.getById(
      convention.id,
    );
    expectToEqual(
      conventionAfterUpdate?.signatories.beneficiary.emergencyContactPhone,
      undefined,
    );
  });

  it("Adds a new convention with beneficiary extra fields without isRqth", async () => {
    const extraFields = {
      emergencyContact: "jean bon",
    };
    const convention = new ConventionDtoBuilder()
      .withBeneficiary({
        birthdate: new Date("2000-05-26").toISOString(),
        firstName: "Jean",
        lastName: "Bono",
        role: "beneficiary",
        email: "jean@bono.com",
        phone: "+33836656565",
        ...extraFields,
      })
      .withAgencyId(agency.id)
      .build();

    await conventionRepository.save(convention);

    const conventionRetreived = await conventionRepository.getById(
      convention.id,
    );

    expect(conventionRetreived?.signatories.beneficiary.isRqth).toBeUndefined();
  });

  it("Adds a new convention with a beneficiary having a federatedIdentity with a payload", async () => {
    const extraFields = {
      emergencyContact: "jean bon",
    };
    const convention = new ConventionDtoBuilder()
      .withBeneficiary({
        birthdate: new Date("2000-05-26").toISOString(),
        firstName: "Jean",
        lastName: "Bono",
        role: "beneficiary",
        email: "jean@bono.com",
        phone: "+33836656565",
        ...extraFields,
      })
      .withFederatedIdentity({
        provider: "ftConnect",
        token: userFtExternalId,
        payload: {
          advisor: {
            email: "john@mail.com",
            firstName: "John",
            lastName: "Doe",
            type: "PLACEMENT",
          },
        },
      })
      .withAgencyId(agency.id)
      .build();

    await db
      .insertInto("ft_connect_users")
      .values({
        ft_connect_id: userFtExternalId,
        advisor_email: "john@mail.com",
        advisor_firstname: "John",
        advisor_lastname: "Doe",
        advisor_kind: "PLACEMENT",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    await conventionRepository.save(convention);

    await db
      .insertInto("conventions__ft_connect_users")
      .values({
        convention_id: convention.id,
        ft_connect_id: userFtExternalId,
      })
      .execute();

    const conventionRetreived = await conventionRepository.getById(
      convention.id,
    );

    expect(
      conventionRetreived?.signatories.beneficiary.federatedIdentity,
    ).toStrictEqual({
      provider: "ftConnect",
      token: userFtExternalId,
      payload: {
        advisor: {
          email: "john@mail.com",
          firstName: "John",
          lastName: "Doe",
          type: "PLACEMENT",
        },
      },
    });
  });

  it("Adds a new convention with a beneficiary having a federatedIdentity without a payload", async () => {
    const extraFields = {
      emergencyContact: "jean bon",
    };
    const convention = new ConventionDtoBuilder()
      .withBeneficiary({
        birthdate: new Date("2000-05-26").toISOString(),
        firstName: "Jean",
        lastName: "Bono",
        role: "beneficiary",
        email: "jean@bono.com",
        phone: "+33836656565",
        ...extraFields,
      })
      .withFederatedIdentity({
        provider: "ftConnect",
        token: userFtExternalId,
      })
      .withAgencyId(agency.id)
      .build();

    await db
      .insertInto("ft_connect_users")
      .values({
        ft_connect_id: userFtExternalId,
        advisor_email: null,
        advisor_firstname: null,
        advisor_lastname: null,
        advisor_kind: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    await conventionRepository.save(convention);

    await db
      .insertInto("conventions__ft_connect_users")
      .values({
        convention_id: convention.id,
        ft_connect_id: userFtExternalId,
      })
      .execute();

    const conventionRetreived = await conventionRepository.getById(
      convention.id,
    );

    expect(
      conventionRetreived?.signatories.beneficiary.federatedIdentity,
    ).toStrictEqual({
      provider: "ftConnect",
      token: userFtExternalId,
    });
  });

  it("Only one actor when the convention has same establisment tutor and representative", async () => {
    const email = "tutor123w@mail.com";
    const tutor: EstablishmentTutor = {
      firstName: "Joe",
      lastName: "Doe",
      job: "Chef",
      email,
      phone: "+33111223344",
      role: "establishment-tutor",
    };

    const convention = new ConventionDtoBuilder()
      .withEstablishmentTutor(tutor)
      .withEstablishmentRepresentative({
        ...tutor,
        role: "establishment-representative",
      })
      .withAgencyId(agency.id)
      .build();

    const getEmailBuilder = db
      .selectFrom("actors")
      .select("email")
      .where("email", "=", email);

    const results1 = await getEmailBuilder.execute();
    expectToEqual(results1, []);

    await conventionRepository.save(convention);

    const results2 = await getEmailBuilder.execute();
    expectToEqual(results2, [{ email }]);
  });

  it("clear convention signatories signedAt", async () => {
    const conventionId: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
    const conventionBuilder = conventionStylisteBuilder
      .withId(conventionId)
      .withBeneficiaryRepresentative({
        phone: "+33611221122",
        firstName: "John",
        lastName: "Doe",
        email: "john@email.com",
        role: "beneficiary-representative",
        signedAt: new Date().toISOString(),
      })
      .withStatus("PARTIALLY_SIGNED")
      .signedByBeneficiary("2024-02-02")
      .signedByEstablishmentRepresentative("2024-02-03");

    await conventionRepository.save(conventionBuilder.build());

    const updatedConvention = conventionBuilder
      .withStatus("READY_TO_SIGN")
      .notSigned();

    await conventionRepository.update(updatedConvention.build());

    const conventionInDB = await conventionRepository.getById(conventionId);

    expect(conventionInDB?.signatories.beneficiary.signedAt).toBeUndefined();
    expect(
      conventionInDB?.signatories.beneficiaryRepresentative?.signedAt,
    ).toBeUndefined();
    expect(
      conventionInDB?.signatories.establishmentRepresentative.signedAt,
    ).toBeUndefined();
  });

  it("Retrieves federated identity if exists", async () => {
    const ftConnectId: FtConnectToken = "bbbbac99-9c0b-bbbb-bb6d-6bb9bd38bbbb";
    const convention = conventionStylisteBuilder
      .withFederatedIdentity({
        provider: "ftConnect",
        token: ftConnectId,
        payload: {
          advisor: {
            email: "john@mail.com",
            firstName: "John",
            lastName: "Doe",
            type: "PLACEMENT",
          },
        },
      })
      .build();

    await db
      .insertInto("ft_connect_users")
      .values({
        ft_connect_id: ftConnectId,
        advisor_email: "john@mail.com",
        advisor_firstname: "John",
        advisor_lastname: "Doe",
        advisor_kind: "PLACEMENT",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    await conventionRepository.save(convention, anyConventionUpdatedAt);

    await db
      .insertInto("conventions__ft_connect_users")
      .values({
        convention_id: convention.id,
        ft_connect_id: ftConnectId,
      })
      .execute();

    expectToEqual(
      await conventionRepository.getById(convention.id),
      convention,
    );
  });

  it("Updates an already saved immersion", async () => {
    const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
    const convention = conventionStylisteBuilder
      .withId(idA)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withEstablishmentNumberOfEmployeesRange("20-49")
      .withBusinessNameCustomized("Enseigne Test")
      .build();
    await conventionRepository.save(convention);

    const updatedConvention = conventionStylisteBuilder
      .withId(idA)
      .withStatus("CANCELLED")
      .withBeneficiaryEmail("some.updated@email.com")
      .withStatusJustification("some justification")
      .withDateStart(new Date("2024-10-20").toISOString())
      .withDateEnd(new Date("2024-10-24").toISOString())
      .withEstablishmentNumberOfEmployeesRange("200-249")
      .withBusinessNameCustomized("Enseigne mise à jour")
      .build();

    await conventionRepository.update(
      updatedConvention,
      anyConventionUpdatedAt,
    );

    expect(await conventionRepository.getById(idA)).toEqual(updatedConvention);
  });

  it("Adds a new convention with a beneficiary representative", async () => {
    const convention = conventionStylisteBuilder
      .withId("aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa")
      .withBeneficiaryRepresentative(beneficiaryRepresentative)
      .build();

    await conventionRepository.save(convention, anyConventionUpdatedAt);

    expect(await conventionRepository.getById(convention.id)).toEqual(
      convention,
    );
  });

  describe("Update convention", () => {
    it("Update convention with different tutor and establishment rep", async () => {
      const tutor: EstablishmentTutor = {
        firstName: "Joe",
        lastName: "Doe",
        job: "Tutor",
        email: "tutor123w@mail.com",
        phone: "+33111223344",
        role: "establishment-tutor",
      };

      const conventionId = "40400404-0000-4000-9000-6bb9bd38bbbb";

      const conventionWithSameTutorAndRep = new ConventionDtoBuilder()
        .withId(conventionId)
        .withEstablishmentTutor(tutor)
        .withEstablishmentRepresentative({
          ...tutor,
          role: "establishment-representative",
        })
        .withAgencyId(agency.id)
        .build();

      const conventionWithDiffTutorAndRep = new ConventionDtoBuilder(
        conventionWithSameTutorAndRep,
      )
        .withEstablishmentRepresentative({
          role: "establishment-representative",
          firstName: "Rep",
          lastName: "Rep",
          email: "Rep@rep.com",
          phone: "+33600000000",
        })
        .build();

      //SAVE CONVENTION WITH SAME TUTOR & REP
      await conventionRepository.save(conventionWithSameTutorAndRep);
      await expectTutorAndRepToHaveSameId(conventionId);

      //UPDATE CONVENTION WITH DIFFERENT TUTOR & REP"
      await conventionRepository.update(conventionWithDiffTutorAndRep);
      await expectTutorAndRepToHaveDifferentIds(conventionId);

      //UPDATE CONVENTION WITH SAME TUTOR & REP
      await conventionRepository.update(conventionWithSameTutorAndRep);
      await expectTutorAndRepToHaveSameId(conventionId);
    });

    it("Update convention with beneficiary current employer", async () => {
      const beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer = {
        firstName: "Current",
        lastName: "Employer",
        email: "current.employer@mail.com",
        phone: "+33111223344",
        role: "beneficiary-current-employer",
        businessName: "Entreprise .Inc",
        businessSiret: "01234567891234",
        job: "Boss",
        businessAddress: "Rue des Bouchers 67065 Strasbourg",
      };

      const conventionId = "40400404-0000-4000-9000-6bb9bd38aaaa";

      const conventionWithoutBeneficiaryCurrentEmployer =
        new ConventionDtoBuilder()
          .withId(conventionId)
          .withAgencyId(agency.id)
          .build();

      const conventionWithBeneficiaryCurrentEmployer = new ConventionDtoBuilder(
        conventionWithoutBeneficiaryCurrentEmployer,
      )
        .withBeneficiaryCurrentEmployer(beneficiaryCurrentEmployer)
        .build();

      //SAVE CONVENTION WITHOUT BENEFICIARY CURRENT EMPLOYER
      await conventionRepository.save(
        conventionWithoutBeneficiaryCurrentEmployer,
      );

      await expectConventionHaveBeneficiaryCurrentEmployer(
        conventionRepository,
        conventionId,
        undefined,
      );

      //SAVE CONVENTION WITH BENEFICIARY CURRENT EMPLOYER
      await conventionRepository.update(
        conventionWithBeneficiaryCurrentEmployer,
      );

      await expectConventionHaveBeneficiaryCurrentEmployer(
        conventionRepository,
        conventionId,
        beneficiaryCurrentEmployer,
      );

      //SAVE CONVENTION WITH BENEFICIARY CURRENT EMPLOYER UPDATED
      const newBeneficiaryCurrentEmployer: BeneficiaryCurrentEmployer = {
        businessName: "NEW EMPLOYER .INC",
        businessSiret: "00112233445566",
        email: "boss@employer.com",
        firstName: "NEW",
        lastName: "BOSS",
        job: "Boss",
        phone: "+33112233445",
        role: "beneficiary-current-employer",
        businessAddress: "Rue des Bouchers 67065 Strasbourg",
      };

      await conventionRepository.update(
        new ConventionDtoBuilder(conventionWithBeneficiaryCurrentEmployer)
          .withBeneficiaryCurrentEmployer(newBeneficiaryCurrentEmployer)
          .build(),
      );

      await expectConventionHaveBeneficiaryCurrentEmployer(
        conventionRepository,
        conventionId,
        newBeneficiaryCurrentEmployer,
      );

      //SAVE CONVENTION WITHOUT BENEFICIARY CURRENT EMPLOYER
      await conventionRepository.update(
        conventionWithoutBeneficiaryCurrentEmployer,
      );

      await expectConventionHaveBeneficiaryCurrentEmployer(
        conventionRepository,
        conventionId,
        undefined,
      );
    });

    it("Update convention with validator", async () => {
      const conventionId: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(conventionId)
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .build();
      await conventionRepository.save(convention);

      const updatedConvention = conventionStylisteBuilder
        .withId(conventionId)
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .withValidator({ firstname: "John", lastname: "Doe" })
        .withCounsellor({ firstname: "Billy", lastname: "Idol" })
        .withBeneficiaryEmail("some.updated@email.com")
        .withStatusJustification("some justification")
        .withDateStart(new Date("2024-10-20").toISOString())
        .withDateEnd(new Date("2024-10-24").toISOString())
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(conventionId)).toEqual(
        updatedConvention,
      );
    });

    it("Updates convention beneficiary birthdate", async () => {
      const conventionId = "50500505-0000-4000-9000-6bb9bd38bbbb";
      const initialBirthdate = "2002-10-05";
      const newBirthdate = "1995-03-15";

      const convention = conventionStylisteBuilder
        .withId(conventionId)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withBeneficiaryBirthdate(initialBirthdate)
        .build();

      await conventionRepository.save(convention);

      const updatedConvention = new ConventionDtoBuilder(convention)
        .withBeneficiaryBirthdate(newBirthdate)
        .build();

      await conventionRepository.update(updatedConvention);

      const conventionInDb = await conventionRepository.getById(conventionId);
      expectToEqual(
        conventionInDb?.signatories.beneficiary.birthdate,
        newBirthdate,
      );
    });

    it("Updates the establisment representative", async () => {
      const commonFields = {
        firstName: "Rep",
        lastName: "Rep",
        email: "rep@rep.com",
        phone: "+33584548754",
      };

      const tutor: EstablishmentTutor = {
        ...commonFields,
        role: "establishment-tutor",
        job: "Super tutor",
      };

      const establishmentRepresentative: EstablishmentRepresentative = {
        ...commonFields,
        role: "establishment-representative",
      };

      const signedDate = new Date().toISOString();

      const convention = new ConventionDtoBuilder()
        .withEstablishmentTutor(tutor)
        .withEstablishmentRepresentative(establishmentRepresentative)
        .withAgencyId(agency.id)
        .notSigned()
        .build();

      await conventionRepository.save(convention);

      const updatedConvention: ConventionDto = new ConventionDtoBuilder(
        convention,
      )
        .withEstablishmentRepresentative({
          ...establishmentRepresentative,
          signedAt: signedDate,
        })
        .build();

      await conventionRepository.update(updatedConvention);
      const updatedConventionStored = await conventionRepository.getById(
        updatedConvention.id,
      );
      expectToEqual(
        updatedConventionStored?.signatories.establishmentRepresentative,
        updatedConvention.signatories.establishmentRepresentative,
      );
      await expectTutorAndRepToHaveSameId(updatedConvention.id);

      const toDraftConvention: ConventionDto = new ConventionDtoBuilder(
        convention,
      )
        .withEstablishmentRepresentative(establishmentRepresentative)
        .build();

      await conventionRepository.update(toDraftConvention);
      const toDraftConventionStored = await conventionRepository.getById(
        toDraftConvention.id,
      );
      expectToEqual(
        toDraftConventionStored?.signatories.establishmentRepresentative,
        toDraftConvention.signatories.establishmentRepresentative,
      );
    });

    it("Update the tutor", async () => {
      const tutor: EstablishmentTutor = {
        firstName: "Joe",
        lastName: "Doe",
        job: "Tutor",
        email: "tutor123w@mail.com",
        phone: "+33111223344",
        role: "establishment-tutor",
      };

      const conventionId = "40400404-0000-4000-9000-6bb9bd38bbbb";

      const convention = new ConventionDtoBuilder()
        .withId(conventionId)
        .withEstablishmentTutor(tutor)
        .withAgencyId(agency.id)
        .build();

      const updatedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutor({
          firstName: "updated-Joe",
          lastName: "updated-Doe",
          job: "updated-Job",
          email: "updated-tutor123w@mail.com",
          phone: "+33555600765",
          role: "establishment-tutor",
        })
        .build();
      await conventionRepository.save(convention);

      await conventionRepository.update(updatedConvention);
      const updatedConventionStored = await conventionRepository.getById(
        updatedConvention.id,
      );
      expectToEqual(
        updatedConventionStored?.establishmentTutor,
        updatedConvention.establishmentTutor,
      );
    });

    it("Updates an already saved immersion with a beneficiary representative", async () => {
      const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = conventionStylisteBuilder
        .withId(idA)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withBeneficiaryEmail("some.updated@email.com")
        .withBeneficiaryRepresentative({
          ...beneficiaryRepresentative,
          email: "some@new-representative.com",
        })
        .signedByBeneficiary(new Date().toISOString())
        .signedByEstablishmentRepresentative(new Date().toISOString())
        .signedByBeneficiaryRepresentative(new Date().toISOString())
        .withDateStart(new Date("2024-10-20").toISOString())
        .withDateEnd(new Date("2024-10-24").toISOString())
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(idA)).toEqual(
        updatedConvention,
      );
    });

    it("Updates an already saved immersion if the beneficiary representative is removed", async () => {
      const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(undefined)
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(idA)).toEqual(
        updatedConvention,
      );
    });

    it("Updates the agency referent firstname and lastname of an already saved immersion", async () => {
      const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = conventionStylisteBuilder
        .withId(idA)
        .withAgencyReferent({ firstname: "New", lastname: "REFERENT" })
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(idA)).toEqual(
        updatedConvention,
      );
    });

    it("Clears the agency referent firstname and lastname of an already saved immersion", async () => {
      const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = new ConventionDtoBuilder()
        .withImmersionAppellation(styliste)
        .withUpdatedAt(anyConventionUpdatedAt)
        .withAgencyId(agency.id)
        .withId(idA)
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(idA)).toEqual(
        updatedConvention,
      );
    });

    it("Updates an already saved immersion without beneficiary representative with a beneficiary representative", async () => {
      const idA: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder.withId(idA).build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = conventionStylisteBuilder
        .withId(idA)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(idA)).toEqual(
        updatedConvention,
      );
    });

    it("Update convention with dateApproval and drops it when undefined", async () => {
      const conventionId: ConventionId = "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
      const convention = conventionStylisteBuilder
        .withId(conventionId)
        .withStatus("IN_REVIEW")
        .build();
      await conventionRepository.save(convention, anyConventionUpdatedAt);

      const updatedConvention = conventionStylisteBuilder
        .withId(conventionId)
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .withDateStart(new Date("2024-10-20").toISOString())
        .withDateEnd(new Date("2024-10-24").toISOString())
        .withDateApproval(new Date("2024-10-15").toISOString())
        .build();

      await conventionRepository.update(
        updatedConvention,
        anyConventionUpdatedAt,
      );

      expect(await conventionRepository.getById(conventionId)).toEqual(
        updatedConvention,
      );

      const conventionBackToReadyToSign: ConventionDto = {
        ...updatedConvention,
        status: "READY_TO_SIGN",
        dateApproval: undefined,
      };

      await conventionRepository.update(
        conventionBackToReadyToSign,
        anyConventionUpdatedAt,
      );

      expectToEqual(
        await conventionRepository.getById(conventionId),
        conventionBackToReadyToSign,
      );
    });
  });

  describe("deprecateConventionsWithoutDefinitiveStatusEndedSince", () => {
    it("changes status of convention with date end before given date to deprecated with justification", async () => {
      const dateSince = new Date("2023-08-30");

      const conventionBuilderWithDateInRange = conventionStylisteBuilder
        .withDateStart(subDays(dateSince, 3).toISOString())
        .withDateEnd(subDays(dateSince, 1).toISOString())
        .withSchedule(reasonableSchedule);

      const convention1ToMarkAsDeprecated = conventionBuilderWithDateInRange
        .withId("11111111-1111-4111-9111-111111111111")
        .withStatus("PARTIALLY_SIGNED")
        .build();

      const convention2ToKeepAsIs = conventionStylisteBuilder
        .withId("22221111-1111-4111-9111-111111112222")
        .withDateStart(subDays(dateSince, 2).toISOString())
        .withDateEnd(addDays(dateSince, 1).toISOString())
        .withSchedule(reasonableSchedule)
        .withStatus("PARTIALLY_SIGNED")
        .build();

      const convention3ToKeepAsIs = conventionBuilderWithDateInRange
        .withId("33331111-1111-4111-9111-111111113333")
        .withStatus("ACCEPTED_BY_VALIDATOR")

        .build();

      const convention4ToKeepAsIs = conventionBuilderWithDateInRange
        .withId("44441111-1111-4111-9111-111111114444")
        .withStatus("CANCELLED")
        .build();

      const convention5ToKeepAsIs = conventionBuilderWithDateInRange
        .withId("55551111-1111-4111-9111-111111115555")
        .withStatus("REJECTED")
        .build();

      const convention6ToKeepAsIs = conventionBuilderWithDateInRange
        .withId("66661111-1111-4111-9111-111111116666")
        .withStatus("DEPRECATED")
        .build();

      const convention7ToMarkAsDeprecated = conventionBuilderWithDateInRange
        .withId("77771111-1111-4111-9111-111111117777")
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .build();

      const convention8ToMarkAsDeprecated = conventionBuilderWithDateInRange
        .withId("88881111-1111-4111-9111-111111118888")
        .withStatus("IN_REVIEW")
        .build();

      const convention9ToMarkAsDeprecated = conventionBuilderWithDateInRange
        .withId("99991111-1111-4111-9111-111111119999")
        .withStatus("READY_TO_SIGN")
        .build();

      const originalUpdatedAt = new Date("2022-01-01T00:00:00").toISOString();
      await Promise.all([
        conventionRepository.save(
          convention1ToMarkAsDeprecated,
          originalUpdatedAt,
        ),
        conventionRepository.save(
          convention2ToKeepAsIs,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention3ToKeepAsIs,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention4ToKeepAsIs,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention5ToKeepAsIs,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention6ToKeepAsIs,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention7ToMarkAsDeprecated,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention8ToMarkAsDeprecated,
          anyConventionUpdatedAt,
        ),
        conventionRepository.save(
          convention9ToMarkAsDeprecated,
          anyConventionUpdatedAt,
        ),
      ]);

      const statusJustification = "test-deprecation-justification";
      const updatedAt = timeGateway.now().toISOString();

      const numberOfUpdatedConventions =
        await conventionRepository.deprecateConventionsWithoutDefinitiveStatusEndedSince(
          dateSince,
          statusJustification,
          updatedAt,
        );

      expectArraysToEqualIgnoringOrder(numberOfUpdatedConventions, [
        convention1ToMarkAsDeprecated.id,
        convention7ToMarkAsDeprecated.id,
        convention8ToMarkAsDeprecated.id,
        convention9ToMarkAsDeprecated.id,
      ]);

      await expectConventionInRepoToBeDeprecated(
        convention1ToMarkAsDeprecated,
        updatedAt,
        statusJustification,
      );
      await expectConventionInRepoToBeDeprecated(
        convention7ToMarkAsDeprecated,
        updatedAt,
        statusJustification,
      );
      await expectConventionInRepoToBeDeprecated(
        convention8ToMarkAsDeprecated,
        updatedAt,
        statusJustification,
      );
      await expectConventionInRepoToBeDeprecated(
        convention9ToMarkAsDeprecated,
        updatedAt,
        statusJustification,
      );
      await expectConventionInRepoToEqual(convention2ToKeepAsIs);
      await expectConventionInRepoToEqual(convention3ToKeepAsIs);
      await expectConventionInRepoToEqual(convention4ToKeepAsIs);
      await expectConventionInRepoToEqual(convention5ToKeepAsIs);
      await expectConventionInRepoToEqual(convention6ToKeepAsIs);
    });
  });

  describe("deleteOldConventions", () => {
    it("deletes conventions with updated_at older than given date and status DEPRECATED, CANCELLED, or REJECTED", async () => {
      const updatedBefore = subYears(new Date(), 2);
      const oldDate = subYears(new Date(), 3).toISOString();
      const recentDate = subDays(new Date(), 5).toISOString();

      const convention1ToDelete = conventionStylisteBuilder
        .withId("11111111-1111-4111-9111-111111111111")
        .withStatus("DEPRECATED")
        .withUpdatedAt(oldDate)
        .build();

      const convention2ToDelete = conventionStylisteBuilder
        .withId("22222222-2222-4222-9222-222222222222")
        .withStatus("CANCELLED")
        .withUpdatedAt(oldDate)
        .build();

      const convention3ToDelete = conventionStylisteBuilder
        .withId("33333333-3333-4333-9333-333333333333")
        .withStatus("REJECTED")
        .withUpdatedAt(oldDate)
        .build();

      const convention4ToKeep = conventionStylisteBuilder
        .withId("44444444-4444-4444-9444-444444444444")
        .withStatus("DEPRECATED")
        .withUpdatedAt(recentDate)
        .build();

      const convention5ToKeep = conventionStylisteBuilder
        .withId("55555555-5555-4555-9555-555555555555")
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withUpdatedAt(oldDate)
        .build();

      const convention6ToKeep = conventionStylisteBuilder
        .withId("66666666-6666-4666-9666-666666666666")
        .withStatus("PARTIALLY_SIGNED")
        .withUpdatedAt(oldDate)
        .build();

      await Promise.all([
        conventionRepository.save(convention1ToDelete, oldDate),
        conventionRepository.save(convention2ToDelete, oldDate),
        conventionRepository.save(convention3ToDelete, oldDate),
        conventionRepository.save(convention4ToKeep, recentDate),
        conventionRepository.save(convention5ToKeep, oldDate),
        conventionRepository.save(convention6ToKeep, oldDate),
      ]);

      const deletedConventionIds =
        await conventionRepository.deleteOldConventions({ updatedBefore });

      expectArraysToEqualIgnoringOrder(deletedConventionIds, [
        convention1ToDelete.id,
        convention2ToDelete.id,
        convention3ToDelete.id,
      ]);

      expect(
        await conventionRepository.getById(convention1ToDelete.id),
      ).toBeUndefined();
      expect(
        await conventionRepository.getById(convention2ToDelete.id),
      ).toBeUndefined();
      expect(
        await conventionRepository.getById(convention3ToDelete.id),
      ).toBeUndefined();
      expectToEqual(
        await conventionRepository.getById(convention4ToKeep.id),
        convention4ToKeep,
      );
      expectToEqual(
        await conventionRepository.getById(convention5ToKeep.id),
        convention5ToKeep,
      );
      expectToEqual(
        await conventionRepository.getById(convention6ToKeep.id),
        convention6ToKeep,
      );
    });

    it("does not delete conventions that are referenced by renewed_from even if they meet deletion criteria", async () => {
      const updatedBefore = subYears(new Date(), 2);
      const oldDate = subYears(new Date(), 3).toISOString();

      const conventionReferencedByRenewed = conventionStylisteBuilder
        .withId("77777777-7777-4777-9777-777777777777")
        .withStatus("DEPRECATED")
        .withUpdatedAt(oldDate)
        .build();

      const conventionWithRenewedFrom = conventionStylisteBuilder
        .withId("88888888-8888-4888-9888-888888888888")
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withRenewed({
          from: conventionReferencedByRenewed.id,
          justification: "Renewed from old convention",
        })
        .withUpdatedAt(subDays(new Date(), 5).toISOString())
        .build();

      const conventionToDelete = conventionStylisteBuilder
        .withId("99999999-9999-4999-9999-999999999999")
        .withStatus("CANCELLED")
        .withUpdatedAt(oldDate)
        .build();

      const conventionToKeep = conventionStylisteBuilder
        .withId("10101010-1010-4101-9101-101010101010")
        .withStatus("CANCELLED")
        .withUpdatedAt(subDays(new Date(), 5).toISOString())
        .build();

      await conventionRepository.save(conventionReferencedByRenewed, oldDate);
      await Promise.all([
        conventionRepository.save(conventionWithRenewedFrom),
        conventionRepository.save(conventionToDelete, oldDate),
        conventionRepository.save(conventionToKeep),
      ]);

      const deletedConventionIds =
        await conventionRepository.deleteOldConventions({ updatedBefore });

      expectArraysToEqualIgnoringOrder(deletedConventionIds, [
        conventionToDelete.id,
      ]);
    });
  });

  const expectConventionHaveBeneficiaryCurrentEmployer = async (
    conventionRepository: PgConventionRepository,
    conventionId: ConventionId,
    expectedBeneficiaryCurrentEmployer: BeneficiaryCurrentEmployer | undefined,
  ) => {
    const convention = await conventionRepository.getById(conventionId);
    if (!convention) throw errors.generic.testError("No result");
    expectToEqual(
      convention.signatories.beneficiaryCurrentEmployer,
      expectedBeneficiaryCurrentEmployer,
    );
  };

  const tutorIdAndRepIdFromConventionId = (conventionId: ConventionId) =>
    db
      .selectFrom("conventions")
      .where("id", "=", conventionId)
      .select(["establishment_tutor_id", "establishment_representative_id"])
      .executeTakeFirst();

  const expectTutorAndRepToHaveSameId = async (conventionId: ConventionId) => {
    const result = await tutorIdAndRepIdFromConventionId(conventionId);
    if (!result) throw errors.generic.testError("No result");
    expectToEqual(
      result.establishment_representative_id,
      result.establishment_tutor_id,
    );
  };

  const expectTutorAndRepToHaveDifferentIds = async (
    conventionId: ConventionId,
  ) => {
    const result = await tutorIdAndRepIdFromConventionId(conventionId);
    if (!result) throw errors.generic.testError("No result");
    expect(
      result.establishment_representative_id !== result.establishment_tutor_id,
    ).toBe(true);
  };

  const expectConventionInRepoToEqual = async (convention: ConventionDto) => {
    expectToEqual(
      await conventionRepository.getById(convention.id),
      convention,
    );
  };

  const expectConventionInRepoToBeDeprecated = async (
    convention: ConventionDto,
    updatedAt: DateString,
    statusJustification: string,
  ) => {
    expectToEqual(await conventionRepository.getById(convention.id), {
      ...convention,
      status: "DEPRECATED",
      statusJustification,
      updatedAt,
    });
  };
});
