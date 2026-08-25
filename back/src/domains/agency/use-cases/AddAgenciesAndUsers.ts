import { flatten, keys, splitEvery, uniq, values } from "ramda";
import {
  type AgencyRole,
  type AgencyUsersRights,
  type DepartmentCode,
  type Email,
  emailSchema,
  errors,
  executeInSequence,
  type GeoPositionDto,
  geoPositionSchema,
  NotFoundError,
  type PhoneNumber,
  phoneNumberSchema,
  removeSpaces,
  type SiretDto,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import { getUserByEmailAndCreateIfMissing } from "../../connected-users/helpers/connectedUser.helper";
import type { AddressGateway } from "../../core/address/ports/AddressGateway";
import type { UserRepository } from "../../core/authentication/connected-user/port/UserRepository";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { UuidGenerator } from "../../core/uuid-generator/ports/UuidGenerator";
import type { AgencyRepository } from "../ports/AgencyRepository";

export type ImportedAgencyAndUserRow = {
  ID: string;
  "Contact structure": Email;
  SIRET: string;
  "Type structure": string;
  "Nom structure": string;
  "E-mail authentification": string;
  "Adresse ligne 1": string;
  "Adresse ligne 2": string;
  Ville: string;
  "Code postal": string;
  Coordonées: GeoPositionDto;
  Téléphone: PhoneNumber;
};

export const importedAgencyAndUserRowSchema: z.Schema<ImportedAgencyAndUserRow> =
  z.object({
    ID: z.string(),
    "Contact structure": emailSchema,
    SIRET: z.string(),
    "Type structure": z.string(),
    "Nom structure": z.string(),
    "E-mail authentification": z.string(),
    "Adresse ligne 1": z.string(),
    "Adresse ligne 2": z.string(),
    Ville: z.string(),
    Coordonées: z.preprocess((val) => {
      if (typeof val === "string") {
        const [lat, lon] = val.replace("(", "").replace(")", "").split(", ");
        return {
          lat: Number.parseFloat(lat),
          lon: Number.parseFloat(lon),
        } as GeoPositionDto;
      }
      return val;
    }, geoPositionSchema),
    "Code postal": z.string(),
    Téléphone: phoneNumberSchema,
  });

export type AddAgenciesAndUsers = ReturnType<typeof makeAddAgenciesAndUsers>;
export const makeAddAgenciesAndUsers = useCaseBuilder("AddAgenciesAndUsers")
  .withInput<ImportedAgencyAndUserRow[]>(
    z.array(importedAgencyAndUserRowSchema) as ZodSchemaWithInputMatchingOutput<
      ImportedAgencyAndUserRow[]
    >,
  )
  .withOutput<{
    siretAlreadyInIFCount: number;
    createdAgenciesCount: number;
    createdUsersCount: number;
    usersAlreadyInIFCount: number;
  }>()
  .withDeps<{
    uuidGenerator: UuidGenerator;
    timeGateway: TimeGateway;
    addressGateway: AddressGateway;
  }>()
  .build(async ({ inputParams, uow, deps }) => {
    const usecaseErrors: Record<string, Error> = {};
    const chunkSize = 300;
    const chunks = splitEvery(chunkSize, inputParams);
    const siretsInIF = uniq(
      flatten(
        await executeInSequence(chunks, (importedAgencies) =>
          uow.agencyRepository.getExistingActiveSirets(
            importedAgencies.map((importedAgency) => importedAgency.SIRET),
          ),
        ),
      ),
    );

    const rowsNotInIF = inputParams.filter(
      (importedAgency) => !siretsInIF.includes(importedAgency.SIRET),
    );
    const { rowsWithDuplicates, uniqRows } =
      findDuplicatesInImportedRows(rowsNotInIF);

    const { createdUsersCount, usersAlreadyInIFCount } =
      await createOrUpdateUsers({
        emails: inputParams.map((importedAgency) =>
          importedAgency["E-mail authentification"].toLowerCase(),
        ),
        userRepository: uow.userRepository,
        timeGateway: deps.timeGateway,
        uuidGenerator: deps.uuidGenerator,
      });

    await linkUsersToExistingAgency({
      siretsInIF,
      importedAgencyAndUserRows: inputParams,
      agencyRepository: uow.agencyRepository,
      userRepository: uow.userRepository,
      usecaseErrors,
      now: deps.timeGateway.now(),
    });

    await createNewAgencies({
      importedAgencyAndUserRows: rowsWithDuplicates,
      agencyRepository: uow.agencyRepository,
      userRepository: uow.userRepository,
      deps,
      usecaseErrors,
      now: deps.timeGateway.now(),
    });

    await createNewAgenciesWithSuffix({
      allRows: inputParams,
      rowsToCreateAsAgencies: uniqRows,
      agencyRepository: uow.agencyRepository,
      userRepository: uow.userRepository,
      deps,
      usecaseErrors,
    });

    return {
      siretAlreadyInIFCount: siretsInIF.length,
      createdAgenciesCount: rowsWithDuplicates.length + uniqRows.length,
      createdUsersCount,
      usersAlreadyInIFCount,
      usecaseErrors,
    };
  });

const linkUsersToExistingAgency = async ({
  siretsInIF,
  importedAgencyAndUserRows,
  agencyRepository,
  userRepository,
  usecaseErrors,
  now,
}: {
  siretsInIF: SiretDto[];
  importedAgencyAndUserRows: ImportedAgencyAndUserRow[];
  agencyRepository: AgencyRepository;
  userRepository: UserRepository;
  usecaseErrors: Record<string, Error>;
  now: Date;
}): Promise<void> => {
  const rowsWithSiretAlreadyInIF = importedAgencyAndUserRows.filter((row) =>
    siretsInIF.includes(row.SIRET),
  );
  const rowsBySiret: Record<SiretDto, ImportedAgencyAndUserRow[]> =
    rowsWithSiretAlreadyInIF.reduce(
      (acc, row) => {
        if (!acc[row.SIRET]) {
          acc[row.SIRET] = [];
        }
        acc[row.SIRET].push(row);
        return acc;
      },
      {} as Record<SiretDto, ImportedAgencyAndUserRow[]>,
    );

  const chunkSize = 30;
  const chunks = splitEvery(chunkSize, keys(rowsBySiret));

  await executeInSequence(chunks, async (sirets) => {
    const { data: agenciesIF } = await agencyRepository.getAgencies({
      filters: {
        sirets,
      },
    });

    await executeInSequence(sirets, async (siret) => {
      const agencyIF = agenciesIF.find(
        (agencyIF) => agencyIF.agencySiret === siret,
      );
      if (!agencyIF) {
        usecaseErrors[siret] = new NotFoundError(
          `Agency with siret ${siret} not found in IF`,
        );
        return;
      }

      const agencyUsersRights: {
        userId: string;
        roles: AgencyRole[];
        isNotifiedByEmail: boolean;
      }[] = await executeInSequence(
        rowsBySiret[siret].map((row) => row["E-mail authentification"]),
        async (email) => {
          const user = await userRepository.findByEmail(email);

          if (!user)
            throw new Error(
              `Should not happen: User ${email} of siret ${siret} should already be created`,
            );

          const userWithRoles = agencyIF.usersRights[user.id] ?? undefined;

          return {
            userId: user.id,
            roles: uniq([
              ...(userWithRoles ? userWithRoles.roles : []),
              "agency-admin",
              "validator",
            ]),
            isNotifiedByEmail: userWithRoles?.isNotifiedByEmail ?? true,
          };
        },
      );

      await agencyRepository.update({
        id: agencyIF.id,
        status: agencyIF.status,
        updatedAt: now.toISOString(),
        usersRights: {
          ...agencyIF.usersRights,
          ...agencyUsersRights.reduce((acc, curr) => {
            const { roles, isNotifiedByEmail } = curr;
            acc[curr.userId] = { roles, isNotifiedByEmail };
            return acc;
          }, {} as AgencyUsersRights),
        },
      });
    });
  });
};

const formatImportedAgencyAndUserRow = (
  importedAgencyAndUserRow: ImportedAgencyAndUserRow[],
): ImportedAgencyAndUserRow[] => {
  const capitalizeFirstLetter = (str: string) =>
    str
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return importedAgencyAndUserRow.map(
    (row) =>
      ({
        ...row,
        "Type structure": row["Type structure"].toUpperCase(),
        "Nom structure": capitalizeFirstLetter(row["Nom structure"]),
        "E-mail authentification": row["E-mail authentification"].toLowerCase(),
        Téléphone: removeSpaces(row.Téléphone),
      }) satisfies ImportedAgencyAndUserRow,
  );
};

const createNewAgencies = async ({
  importedAgencyAndUserRows,
  agencyRepository,
  userRepository,
  deps,
  usecaseErrors,
  now,
}: {
  importedAgencyAndUserRows: ImportedAgencyAndUserRow[];
  agencyRepository: AgencyRepository;
  userRepository: UserRepository;
  now: Date;
  deps: {
    uuidGenerator: UuidGenerator;
    addressGateway: AddressGateway;
  };
  usecaseErrors: Record<string, Error>;
}) => {
  await executeInSequence(importedAgencyAndUserRows, async (row) => {
    const user = await userRepository.findByEmail(
      row["E-mail authentification"],
    );
    if (!user) {
      usecaseErrors[row.ID] = errors.user.notFoundByEmail({
        email: row["E-mail authentification"],
      });
      return;
    }

    const agencyDepartmentCode = await getDepartementCode({
      row,
      addressGateway: deps.addressGateway,
    });

    await agencyRepository.insert({
      id: deps.uuidGenerator.new(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: "active",
      agencySiret: row.SIRET,
      name: row["Nom structure"],
      contactEmail: row["Contact structure"],
      address: {
        streetNumberAndAddress: row["Adresse ligne 1"],
        postcode: row["Code postal"],
        city: row.Ville,
        departmentCode: agencyDepartmentCode,
      },
      position: {
        lat: row.Coordonées.lat,
        lon: row.Coordonées.lon,
      },
      kind: "structure-IAE",
      coveredDepartments: [agencyDepartmentCode],
      logoUrl: null,
      signature: "L'équipe",
      refersToAgencyId: null,
      refersToAgencyName: null,
      refersToAgencyContactEmail: null,
      phoneNumber: row.Téléphone,
      delegationAgencyInfo: null,
      usersRights: {
        [user.id]: {
          roles: ["agency-admin", "validator"],
          isNotifiedByEmail: true,
        },
      },
      codeSafir: null,
      statusJustification: null,
    });
  });
};

// duplicas si même siret + nom structure + e-mail authentification + lat + long + téléphone
function findDuplicatesInImportedRows(
  rows: ImportedAgencyAndUserRow[],
): Record<string, ImportedAgencyAndUserRow[]> {
  const rowsById: Record<string, ImportedAgencyAndUserRow> = Object.fromEntries(
    rows.map((row) => [row.ID, row]),
  );
  const formattedRows = formatImportedAgencyAndUserRow(rows);
  const groupedRows = formattedRows.reduce(
    (acc, row) => {
      const key = [
        row.SIRET,
        row["Nom structure"],
        row["E-mail authentification"],
        row.Coordonées.lat,
        row.Coordonées.lon,
        row.Téléphone,
      ].join("||");

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(rowsById[row.ID]);

      return acc;
    },
    {} as Record<string, ImportedAgencyAndUserRow[]>,
  );

  return values(groupedRows).reduce(
    (acc, curr) => {
      if (curr.length > 1) {
        acc.rowsWithDuplicates.push(curr[0]);
      } else {
        acc.uniqRows.push(curr[0]);
      }
      return acc;
    },
    {
      rowsWithDuplicates: [] as ImportedAgencyAndUserRow[],
      uniqRows: [] as ImportedAgencyAndUserRow[],
    },
  );
}

const createOrUpdateUsers = async ({
  emails,
  userRepository,
  timeGateway,
  uuidGenerator,
}: {
  emails: string[];
  userRepository: UserRepository;
  timeGateway: TimeGateway;
  uuidGenerator: UuidGenerator;
}) => {
  const uniqEmails = uniq(emails);

  const newUsersCount = (
    await executeInSequence(uniqEmails, async (email) => {
      const newUserUUid = uuidGenerator.new();
      const user = await getUserByEmailAndCreateIfMissing({
        userRepository,
        timeGateway: timeGateway,
        userIdIfNew: newUserUUid,
        userEmail: email,
      });

      return user.id === newUserUUid;
    })
  ).filter(Boolean).length;

  return {
    createdUsersCount: newUsersCount,
    usersAlreadyInIFCount: uniqEmails.length - newUsersCount,
  };
};

const createNewAgenciesWithSuffix = async ({
  allRows,
  rowsToCreateAsAgencies,
  agencyRepository,
  userRepository,
  deps,
  usecaseErrors,
}: {
  allRows: ImportedAgencyAndUserRow[];
  rowsToCreateAsAgencies: ImportedAgencyAndUserRow[];
  agencyRepository: AgencyRepository;
  userRepository: UserRepository;
  deps: {
    uuidGenerator: UuidGenerator;
    timeGateway: TimeGateway;
    addressGateway: AddressGateway;
  };
  usecaseErrors: Record<string, Error>;
}) => {
  const rowsGroupedBySiret = allRows.reduce(
    (acc, row) => {
      if (!acc[row.SIRET]) {
        acc[row.SIRET] = [];
      }
      acc[row.SIRET].push(row);
      return acc;
    },
    {} as Record<string, ImportedAgencyAndUserRow[]>,
  );

  const updatedRowsWithSuffix: ImportedAgencyAndUserRow[] =
    rowsToCreateAsAgencies.map((row) => {
      const needSuffix = rowsGroupedBySiret[row.SIRET].length > 1;
      const kind = row["Type structure"];
      return {
        ...row,
        "Nom structure": `${row["Nom structure"]}${needSuffix ? ` - ${kind}` : ""}`,
      };
    });

  await createNewAgencies({
    importedAgencyAndUserRows: updatedRowsWithSuffix,
    agencyRepository,
    userRepository,
    deps,
    usecaseErrors,
    now: deps.timeGateway.now(),
  });
};

const getDepartementCode = async ({
  row,
  addressGateway,
}: {
  row: ImportedAgencyAndUserRow;
  addressGateway: AddressGateway;
}): Promise<DepartmentCode> => {
  // DOM-COM
  if (
    row["Code postal"].startsWith("97") ||
    row["Code postal"].startsWith("98")
  ) {
    return row["Code postal"].slice(0, 3);
  }

  // CORSE
  if (row["Code postal"].startsWith("20")) {
    const searchQuery = `${row["Adresse ligne 1"]} ${row["Code postal"]} ${row.Ville}`;
    const results = await addressGateway.lookupStreetAddress(searchQuery, "FR");
    const agencyDepartmentCode = results.at(0)?.address.departmentCode;
    if (results.length === 0 || !agencyDepartmentCode) {
      throw errors.address.notFound({
        address: searchQuery,
      });
    }
    return agencyDepartmentCode;
  }

  // METROPOLE
  return row["Code postal"].slice(0, 2);
};
