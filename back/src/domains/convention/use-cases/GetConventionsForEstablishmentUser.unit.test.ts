import { addDays, subDays, subMonths } from "date-fns";
import {
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  defaultMonthsThresholdForConventionsListing,
  expectToEqual,
  makeBooleanFeatureFlag,
  reasonableSchedule,
  type UserEstablishmentRightDetails,
} from "shared";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { makeGetConventionsForEstablishmentUser } from "./GetConventionsForEstablishmentUser";

describe("GetConventionsForEstablishmentUser", () => {
  const now = new Date("2026-09-01T10:10:00.000Z");
  const pagination = { page: 1, perPage: 10 };
  const userEmail = "establishment-user@mail.com";

  const acceptedAdminRight: UserEstablishmentRightDetails = {
    siret: "11112222333344",
    businessName: "Accepted Corp",
    role: "establishment-admin",
    status: "ACCEPTED",
    shouldReceiveDiscussionNotifications: true,
    admins: [],
    isEstablishmentBanned: false,
  };

  const acceptedContactRight: UserEstablishmentRightDetails = {
    siret: "11112222333344",
    businessName: "Accepted Corp",
    role: "establishment-contact",
    status: "ACCEPTED",
    shouldReceiveDiscussionNotifications: true,
    admins: [],
    isEstablishmentBanned: false,
  };

  const pendingContactRight: UserEstablishmentRightDetails = {
    siret: "55556666777788",
    businessName: "Omega Corp",
    role: "establishment-contact",
    status: "PENDING",
    shouldReceiveDiscussionNotifications: true,
    isEstablishmentBanned: false,
  };

  const userWithAcceptedAdminRight = new ConnectedUserBuilder()
    .withEmail(userEmail)
    .withEstablishments([acceptedAdminRight])
    .build();

  const userWithAcceptedContactRight = new ConnectedUserBuilder()
    .withEmail(userEmail)
    .withEstablishments([acceptedContactRight])
    .build();

  const userWithPendingContactRight = new ConnectedUserBuilder()
    .withEmail(userEmail)
    .withEstablishments([pendingContactRight])
    .build();

  const userWithoutEstablishmentRight = new ConnectedUserBuilder()
    .withEmail(userEmail)
    .withEstablishments([])
    .build();

  const monthsAgo_25 = subMonths(
    now,
    defaultMonthsThresholdForConventionsListing,
  );

  let getConventionsForEstablishmentUser: ReturnType<
    typeof makeGetConventionsForEstablishmentUser
  >;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getConventionsForEstablishmentUser = makeGetConventionsForEstablishmentUser(
      {
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: { timeGateway: new CustomTimeGateway(now) },
      },
    );
  });

  it("returns a convention of an establishment where the user is an ACCEPTED admin", async () => {
    const conventionWithSiretUserHasAcceptedRightOn = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret(acceptedAdminRight.siret)
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail("other-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();
    const outOfScopeConvention = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withSiret("99998888777766")
      .withEstablishmentRepresentativeEmail("someone-else@mail.com")
      .withEstablishmentTutorEmail("someone-else-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([
      conventionWithSiretUserHasAcceptedRightOn,
      outOfScopeConvention,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithAcceptedAdminRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("returns a convention of an establishment where the user is an ACCEPTED contact", async () => {
    const conventionWithSiretUserHasAcceptedRightOn = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret(acceptedContactRight.siret)
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail("other-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([
      conventionWithSiretUserHasAcceptedRightOn,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithAcceptedContactRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("does not return a convention of an establishment where the user has a PENDING right and when they are not representative or tutor on the convention", async () => {
    const conventionWithSiretUserHasPendingRightOn = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret(pendingContactRight.siret)
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail("other-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([
      conventionWithSiretUserHasPendingRightOn,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithPendingContactRight,
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

  it("returns a convention where the user is establishment representative by email without rights on establishment", async () => {
    const conventionUserIsEstablishmentRepresentativeOn =
      new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111111")
        .withSiret("99998888777766")
        .withEstablishmentRepresentativeEmail(userEmail)
        .withEstablishmentTutorEmail("other-tutor@mail.com")
        .withDateStart("2026-01-10")
        .withDateEnd("2026-01-15")
        .withSchedule(reasonableSchedule)
        .build();

    uow.conventionRepository.setConventions([
      conventionUserIsEstablishmentRepresentativeOn,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithoutEstablishmentRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("returns a convention where the user is establishment tutor by email without rights on establishment", async () => {
    const conventionUserIsEstablishmentTutorOn = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret("99998888777766")
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail(userEmail)
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([
      conventionUserIsEstablishmentTutorOn,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithoutEstablishmentRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("returns both the convention of an accepted establishment and the convention where the user is tutor by email", async () => {
    const conventionWithSiretUserHasAcceptedRightOn = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret(acceptedAdminRight.siret)
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail("other-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();
    const conventionUserIsEstablishmentTutorOn = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withSiret("99998888777766")
      .withEstablishmentRepresentativeEmail("other-representative@mail.com")
      .withEstablishmentTutorEmail(userEmail)
      .withDateStart("2026-02-10")
      .withDateEnd("2026-02-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([
      conventionWithSiretUserHasAcceptedRightOn,
      conventionUserIsEstablishmentTutorOn,
    ]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithAcceptedAdminRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          status: "READY_TO_SIGN",
          dateStart: "2026-02-10",
          dateEnd: "2026-02-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
          },
        },
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("returns a convention only once when it matches both siret and email", async () => {
    const overlappingConvention = new ConventionDtoBuilder()
      .withId("11111111-1111-4111-8111-111111111111")
      .withSiret(acceptedAdminRight.siret)
      .withEstablishmentRepresentativeEmail(userEmail)
      .withEstablishmentTutorEmail(userEmail)
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([overlappingConvention]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithAcceptedAdminRight,
    );

    expectToEqual(result, {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "READY_TO_SIGN",
          dateStart: "2026-01-10",
          dateEnd: "2026-01-15",
          businessName: "Beta.gouv.fr",
          immersionAppellation: {
            romeCode: "A1101",
            romeLabel: "Conduite d'engins agricoles et forestiers",
            appellationCode: "17751",
            appellationLabel: "Pilote de machines d'abattage",
          },
          assessment: null,
          beneficiary: {
            firstName: "Esteban",
            lastName: "Ocon",
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

  it("excludes a convention outside siret and email access", async () => {
    const outOfScopeConvention = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withSiret("99998888777766")
      .withEstablishmentRepresentativeEmail("someone-else@mail.com")
      .withEstablishmentTutorEmail("someone-else-tutor@mail.com")
      .withDateStart("2026-01-10")
      .withDateEnd("2026-01-15")
      .withSchedule(reasonableSchedule)
      .build();

    uow.conventionRepository.setConventions([outOfScopeConvention]);

    const result = await getConventionsForEstablishmentUser.execute(
      pagination,
      userWithAcceptedAdminRight,
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

  describe("when enableRequestArchivedConvention is active", () => {
    it(`returns archived conventions (date end older than ${defaultMonthsThresholdForConventionsListing} months)`, async () => {
      uow.featureFlagRepository.featureFlags = {
        enableRequestArchivedConvention: makeBooleanFeatureFlag(true),
      };

      const archivedConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111111")
        .withSiret(acceptedAdminRight.siret)
        .withEstablishmentRepresentativeEmail("other-representative@mail.com")
        .withEstablishmentTutorEmail("other-tutor@mail.com")
        .withDateStart(subDays(monthsAgo_25, 4).toISOString())
        .withDateEnd(subDays(monthsAgo_25, 1).toISOString())
        .withSchedule(reasonableSchedule)
        .build();
      const notArchivedConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111112")
        .withSiret(acceptedAdminRight.siret)
        .withEstablishmentRepresentativeEmail("other-representative@mail.com")
        .withEstablishmentTutorEmail("other-tutor@mail.com")
        .withDateStart(addDays(monthsAgo_25, 1).toISOString())
        .withDateEnd(addDays(monthsAgo_25, 4).toISOString())
        .withSchedule(reasonableSchedule)
        .build();

      uow.conventionRepository.setConventions([
        archivedConvention,
        notArchivedConvention,
      ]);

      const result = await getConventionsForEstablishmentUser.execute(
        pagination,
        userWithAcceptedAdminRight,
      );

      expectToEqual(result, {
        data: [
          {
            id: "11111111-1111-4111-8111-111111111112",
            status: "READY_TO_SIGN",
            dateStart: "2024-08-02T10:10:00.000Z",
            dateEnd: "2024-08-05T10:10:00.000Z",
            businessName: "Beta.gouv.fr",
            immersionAppellation: {
              romeCode: "A1101",
              romeLabel: "Conduite d'engins agricoles et forestiers",
              appellationCode: "17751",
              appellationLabel: "Pilote de machines d'abattage",
            },
            assessment: null,
            beneficiary: {
              firstName: "Esteban",
              lastName: "Ocon",
            },
          },
          {
            id: "11111111-1111-4111-8111-111111111111",
            status: "READY_TO_SIGN",
            dateStart: "2024-07-28T10:10:00.000Z",
            dateEnd: "2024-07-31T10:10:00.000Z",
            businessName: "Beta.gouv.fr",
            immersionAppellation: {
              romeCode: "A1101",
              romeLabel: "Conduite d'engins agricoles et forestiers",
              appellationCode: "17751",
              appellationLabel: "Pilote de machines d'abattage",
            },
            assessment: null,
            beneficiary: {
              firstName: "Esteban",
              lastName: "Ocon",
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
  });

  describe("when enableRequestArchivedConvention is inactive", () => {
    it(`does not return archived conventions (date end older than ${defaultMonthsThresholdForConventionsListing} months)`, async () => {
      const archivedConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111111")
        .withSiret(acceptedAdminRight.siret)
        .withEstablishmentRepresentativeEmail("other-representative@mail.com")
        .withEstablishmentTutorEmail("other-tutor@mail.com")
        .withDateStart(subDays(monthsAgo_25, 4).toISOString())
        .withDateEnd(subDays(monthsAgo_25, 1).toISOString())
        .withSchedule(reasonableSchedule)
        .build();
      const notArchivedConvention = new ConventionDtoBuilder()
        .withId("11111111-1111-4111-8111-111111111112")
        .withSiret(acceptedAdminRight.siret)
        .withEstablishmentRepresentativeEmail("other-representative@mail.com")
        .withEstablishmentTutorEmail("other-tutor@mail.com")
        .withDateStart(addDays(monthsAgo_25, 1).toISOString())
        .withDateEnd(addDays(monthsAgo_25, 4).toISOString())
        .withSchedule(reasonableSchedule)
        .build();

      uow.conventionRepository.setConventions([
        archivedConvention,
        notArchivedConvention,
      ]);

      const result = await getConventionsForEstablishmentUser.execute(
        pagination,
        userWithAcceptedAdminRight,
      );

      expectToEqual(result, {
        data: [
          {
            id: "11111111-1111-4111-8111-111111111112",
            status: "READY_TO_SIGN",
            dateStart: "2024-08-02T10:10:00.000Z",
            dateEnd: "2024-08-05T10:10:00.000Z",
            businessName: "Beta.gouv.fr",
            immersionAppellation: {
              romeCode: "A1101",
              romeLabel: "Conduite d'engins agricoles et forestiers",
              appellationCode: "17751",
              appellationLabel: "Pilote de machines d'abattage",
            },
            assessment: null,
            beneficiary: {
              firstName: "Esteban",
              lastName: "Ocon",
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
  });
});
