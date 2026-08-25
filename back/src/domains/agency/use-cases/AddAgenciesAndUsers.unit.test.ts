import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  expectArraysToMatch,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { InMemoryAddressGateway } from "../../core/address/adapters/InMemoryAddressGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type AddAgenciesAndUsers,
  type ImportedAgencyAndUserRow,
  makeAddAgenciesAndUsers,
} from "./AddAgenciesAndUsers";

describe("AddAgenciesAndUsers", () => {
  const siret1 = "12345678901111";
  const siret2 = "12345678902222";
  const user1Email = "user1@test.com";
  const user2Email = "user2@test.com";

  let uuidGenerator: TestUuidGenerator;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let addAgenciesAndUsers: AddAgenciesAndUsers;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.agencyRepository.agencies = [];
    uow.userRepository.users = [];
    timeGateway = new CustomTimeGateway();
    uuidGenerator = new TestUuidGenerator();
    addAgenciesAndUsers = makeAddAgenciesAndUsers({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        uuidGenerator,
        addressGateway: new InMemoryAddressGateway(),
      },
    });
  });

  describe("sirets already in IF", () => {
    const rows: ImportedAgencyAndUserRow[] = [
      {
        ID: "1",
        "Contact structure": "contact-structure-1@mail.com",
        SIRET: siret1,
        "Type structure": "AI",
        "Nom structure": "Structure avec user existant sur IF",
        "E-mail authentification": user1Email,
        "Adresse ligne 1": "Adresse ligne 1",
        "Adresse ligne 2": "Adresse ligne 2",
        Ville: "Ville",
        "Code postal": "75000",
        Coordonées: {
          lat: 23,
          lon: 12,
        },
        Téléphone: "+33600000000",
      },
      {
        ID: "2",
        "Contact structure": "contact-structure-2@mail.com",
        SIRET: siret2,
        "Type structure": "EI",
        "Nom structure": "Structure avec user non existant sur IF",
        "E-mail authentification": user2Email,
        "Adresse ligne 1": "Adresse ligne 1",
        "Adresse ligne 2": "Adresse ligne 2",
        Ville: "Ville",
        "Code postal": "75000",
        Coordonées: {
          lat: 23,
          lon: 12,
        },
        Téléphone: "+33600000000",
      },
    ];

    it("should add and update users with role agency-admin and validator", async () => {
      const user1 = new ConnectedUserBuilder()
        .withId("10000000-0000-0000-0000-000000000021")
        .withEmail(user1Email)
        .buildUser();
      const agency1 = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("10000000-0000-0000-0000-000000000011")
          .withAgencySiret(siret1)
          .build(),
        {
          [user1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
        },
      );
      const agency2 = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("10000000-0000-0000-0000-0000000000012")
          .withAgencySiret(siret2)
          .build(),
        {
          [user1.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        },
      );

      await uow.userRepository.save(user1);
      uow.agencyRepository.agencies = [agency1, agency2];

      const newUserId = "10000000-0000-0000-0000-000000000022";
      uuidGenerator.setNextUuids([newUserId, newUserId]);

      const result = await addAgenciesAndUsers.execute(rows);

      expect(result).toEqual({
        siretAlreadyInIFCount: 2,
        createdAgenciesCount: 0,
        createdUsersCount: 1,
        usersAlreadyInIFCount: 1,
        usecaseErrors: {},
      });
      expect(uow.agencyRepository.agencies).toEqual([
        {
          ...agency1,
          updatedAt: timeGateway.now().toISOString(),
          usersRights: {
            [user1.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor", "agency-admin", "validator"],
            },
          },
        },
        {
          ...agency2,
          updatedAt: timeGateway.now().toISOString(),
          usersRights: {
            ...agency2.usersRights,
            [newUserId]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
          },
        },
      ]);
      expect(uow.userRepository.users).toEqual([
        user1,
        {
          id: newUserId,
          firstName: "",
          lastName: "",
          email: user2Email,
          createdAt: timeGateway.now().toISOString(),
          proConnect: null,
        },
      ]);
    });

    it("should add users if two rows with the same siret that already exist in DB", async () => {
      const userAlreadyInDB = new ConnectedUserBuilder()
        .withId("10000000-0000-0000-0000-000000000021")
        .withEmail("user-already-in-db@mail.fr")
        .buildUser();
      const agencyAlreadyInDB = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("10000000-0000-0000-0000-000000000011")
          .withAgencySiret(siret1)
          .build(),
        {
          [userAlreadyInDB.id]: {
            isNotifiedByEmail: false,
            roles: ["counsellor"],
          },
        },
      );
      await uow.userRepository.save(userAlreadyInDB);
      uow.agencyRepository.agencies = [agencyAlreadyInDB];

      const newUserId1 = "10000000-0000-0000-0000-000000000022";
      const newUserId2 = "10000000-0000-0000-0000-000000000023";
      uuidGenerator.setNextUuids([newUserId1, newUserId2]);
      const result = await addAgenciesAndUsers.execute([
        { ...rows[0], "E-mail authentification": user1Email },
        { ...rows[0], "E-mail authentification": user2Email },
      ]);

      expect(result).toEqual({
        siretAlreadyInIFCount: 1,
        createdAgenciesCount: 0,
        createdUsersCount: 2,
        usersAlreadyInIFCount: 0,
        usecaseErrors: {},
      });
    });
  });

  describe("rows with duplicates (same siret + nom structure + e-mail authentification + coordonnées + téléphone)", () => {
    const row = {
      ID: "1",
      "Contact structure": "contact-structure@mail.com",
      SIRET: siret1,
      "Type structure": "AI",
      "Nom structure": "Structure Avec User Existant",
      "E-mail authentification": user1Email,
      "Adresse ligne 1": "adresse ligne 1",
      "Adresse ligne 2": "adresse ligne 2",
      Ville: "Ville",
      "Code postal": "75000",
      Coordonées: {
        lat: 23,
        lon: 12,
      },
      Téléphone: "+33600000000",
    };
    const rowsWithDuplicates: ImportedAgencyAndUserRow[] = [
      row,
      {
        ...row,
        ID: "2",
        "Type structure": "EI",
        "Nom structure": row["Nom structure"].toLowerCase(),
        "E-mail authentification": row["E-mail authentification"].toUpperCase(),
        Téléphone: "+336 00 00 00 00",
      },
    ];

    it("should create only one agency per duplicate", async () => {
      const newUserId = "10000000-0000-0000-0000-000000000011";
      const newAgencyId = "20000000-0000-0000-0000-000000000011";
      uuidGenerator.setNextUuids([newUserId, newAgencyId]);
      const result = await addAgenciesAndUsers.execute(rowsWithDuplicates);

      expect(result).toEqual({
        siretAlreadyInIFCount: 0,
        createdAgenciesCount: 1,
        createdUsersCount: 1,
        usersAlreadyInIFCount: 0,
        usecaseErrors: {},
      });
      expect(uow.userRepository.users).toEqual([
        {
          id: newUserId,
          firstName: "",
          lastName: "",
          email: user1Email,
          createdAt: timeGateway.now().toISOString(),
          proConnect: null,
        },
      ]);
      expectArraysToMatch(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder()
            .withId(newAgencyId)
            .withKind("structure-IAE")
            .withAgencySiret(siret1)
            .withAddress({
              streetNumberAndAddress: row["Adresse ligne 1"],
              postcode: row["Code postal"],
              city: row.Ville,
              departmentCode: row["Code postal"].slice(0, 2),
            })
            .withCoveredDepartments(["75"])
            .withPosition(23, 12)
            .withName(row["Nom structure"])
            .withSignature("L'équipe")
            .withCreatedAt(timeGateway.now().toISOString())
            .withUpdatedAt(timeGateway.now())
            .withAgencyContactEmail(row["Contact structure"])
            .build(),
          {
            [newUserId]: {
              isNotifiedByEmail: true,
              roles: ["agency-admin", "validator"],
            },
          },
        ),
      ]);
    });
  });

  describe("rows without duplicates", () => {
    const row = {
      ID: "1",
      "Contact structure": "contact-structure@mail.com",
      SIRET: siret1,
      "Type structure": "ACI",
      "Nom structure": "Nom Structure",
      "E-mail authentification": user1Email,
      "Adresse ligne 1": "adresse ligne 1",
      "Adresse ligne 2": "adresse ligne 2",
      Ville: "Ville",
      "Code postal": "75000",
      Coordonées: {
        lat: 23,
        lon: 12,
      },
      Téléphone: "+33600000000",
    };
    const rows: ImportedAgencyAndUserRow[] = [
      row,
      {
        ...row,
        ID: "2",
        "Type structure": "EI",
        Téléphone: "+33611111111",
      },
    ];

    it("should created one agency per row with kind suffixed to agency name if multiple siret", async () => {
      const newUserId = "10000000-0000-0000-0000-000000000011";
      const newAgencyId1 = "20000000-0000-0000-0000-000000000011";
      const newAgencyId2 = "20000000-0000-0000-0000-000000000012";
      uuidGenerator.setNextUuids([newUserId, newAgencyId1, newAgencyId2]);

      const result = await addAgenciesAndUsers.execute(rows);

      const agency1 = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId(newAgencyId1)
          .withKind("structure-IAE")
          .withAgencySiret(row.SIRET)
          .withAddress({
            streetNumberAndAddress: row["Adresse ligne 1"],
            postcode: row["Code postal"],
            city: row.Ville,
            departmentCode: row["Code postal"].slice(0, 2),
          })
          .withCoveredDepartments(["75"])
          .withPosition(23, 12)
          .withSignature("L'équipe")
          .withCreatedAt(timeGateway.now().toISOString())
          .withAgencyContactEmail(row["Contact structure"])
          .build(),
        {
          [newUserId]: {
            isNotifiedByEmail: true,
            roles: ["agency-admin", "validator"],
          },
        },
      );
      expect(result).toEqual({
        siretAlreadyInIFCount: 0,
        createdAgenciesCount: 2,
        createdUsersCount: 1,
        usersAlreadyInIFCount: 0,
        usecaseErrors: {},
      });
      expectArraysToMatch(uow.agencyRepository.agencies, [
        {
          ...agency1,
          updatedAt: timeGateway.now().toISOString(),
          name: `${row["Nom structure"]} - ACI`,
        },
        {
          ...agency1,
          updatedAt: timeGateway.now().toISOString(),
          id: newAgencyId2,
          name: `${row["Nom structure"]} - EI`,
          phoneNumber: rows[1].Téléphone,
        },
      ]);
    });
  });
});
