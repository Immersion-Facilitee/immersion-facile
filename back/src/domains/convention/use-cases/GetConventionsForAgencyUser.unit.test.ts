import { subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyRole,
  type AgencyUserConventionListDto,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type DataWithPagination,
  expectArraysToEqualIgnoringOrder,
  expectToEqual,
  type GetConventionsForAgencyUserParams,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { makeGetConventionsForAgencyUser } from "./GetConventionsForAgencyUser";

describe("GetConventionsForAgencyUser", () => {
  const agencyUserId = "agency-user-id-12345";
  const currentUser = new ConnectedUserBuilder()
    .withId(agencyUserId)
    .withEmail("counsellor1@email.com")
    .withFirstName("John")
    .withLastName("Doe")
    .build();

  const agency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
      .withName("Test Agency")
      .withKind("france-travail")
      .build(),
    {
      [agencyUserId]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const conventions = Array.from({ length: 30 }, (_, i) =>
    new ConventionDtoBuilder()
      .withId(`convention-id-${i + 1}`)
      .withAgencyId(agency.id)
      .withStatus(i % 2 === 0 ? "ACCEPTED_BY_VALIDATOR" : "READY_TO_SIGN")
      .build(),
  );

  let getConventionsForAgencyUser: ReturnType<
    typeof makeGetConventionsForAgencyUser
  >;
  let timeGateway: TimeGateway;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    const uowPerformer = new InMemoryUowPerformer(uow);
    getConventionsForAgencyUser = makeGetConventionsForAgencyUser({
      uowPerformer,
      deps: {
        timeGateway,
      },
    });

    uow.agencyRepository.agencies = [agency];
    uow.userRepository.users = [currentUser];
    uow.conventionRepository.setConventions(conventions);
  });

  describe("Filtering", () => {
    it("should filter out conventions that are older than 25 months by default", async () => {
      const conventionOutOfRange = new ConventionDtoBuilder()
        .withId("convention-id-1")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 26).toISOString())
        .build();
      const conventionInRange = new ConventionDtoBuilder()
        .withId("convention-id-2")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 24).toISOString())
        .build();

      uow.conventionRepository.setConventions([
        conventionOutOfRange,
        conventionInRange,
      ]);

      const params: GetConventionsForAgencyUserParams = {
        filters: {},
        pagination: {
          page: 1,
          perPage: 10,
        },
      };

      const result = await getConventionsForAgencyUser.execute(
        params,
        currentUser,
      );

      expectOnlyConventionInResult(result, conventionInRange);
      expectToEqual(result.pagination, {
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
        totalRecords: 1,
      });
    });

    it("should keep and override dateEnd from if provided and less or equal to defaultMonthsThreshold", async () => {
      const conventionOutOfRange = new ConventionDtoBuilder()
        .withId("convention-id-1")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 14).toISOString())
        .build();
      const conventionInRange = new ConventionDtoBuilder()
        .withId("convention-id-2")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 12).toISOString())
        .build();

      uow.conventionRepository.setConventions([
        conventionOutOfRange,
        conventionInRange,
      ]);

      const params: GetConventionsForAgencyUserParams = {
        filters: {
          dateEnd: {
            from: subMonths(timeGateway.now(), 13).toISOString(),
          },
        },
        pagination: {
          page: 1,
          perPage: 10,
        },
      };

      const result = await getConventionsForAgencyUser.execute(
        params,
        currentUser,
      );

      expectOnlyConventionInResult(result, conventionInRange);
      expectToEqual(result.pagination, {
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
        totalRecords: 1,
      });
    });

    it("shouldn't take into account dateEnd to if provided and greater than defaultMonthsThreshold", async () => {
      const conventionOutOfRange = new ConventionDtoBuilder()
        .withId("convention-id-1")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 26).toISOString())
        .build();
      const conventionInRange = new ConventionDtoBuilder()
        .withId("convention-id-2")
        .withAgencyId(agency.id)
        .withStatus("ACCEPTED_BY_VALIDATOR")
        .withDateEnd(subMonths(timeGateway.now(), 24).toISOString())
        .build();

      uow.conventionRepository.setConventions([
        conventionOutOfRange,
        conventionInRange,
      ]);

      const params: GetConventionsForAgencyUserParams = {
        filters: {
          dateEnd: {
            to: subMonths(timeGateway.now(), 30).toISOString(),
          },
        },
        pagination: {
          page: 1,
          perPage: 10,
        },
      };

      const result = await getConventionsForAgencyUser.execute(
        params,
        currentUser,
      );

      expectOnlyConventionInResult(result, conventionInRange);
      expectToEqual(result.pagination, {
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
        totalRecords: 1,
      });
    });
    const expectOnlyConventionInResult = (
      result: DataWithPagination<AgencyUserConventionListDto>,
      convention: ConventionDto,
    ) => {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(convention.id);
      expect(result.data[0]?.dateEnd).toBe(convention.dateEnd);
    };
  });

  describe("Agency rights", () => {
    const allowedRoles: AgencyRole[] = [
      "counsellor",
      "validator",
      "agency-admin",
      "agency-viewer",
    ];

    it.each(
      allowedRoles,
    )("should return conventions when user has the %s role", async (role) => {
      uow.agencyRepository.agencies = [
        {
          ...agency,
          usersRights: {
            [agencyUserId]: { isNotifiedByEmail: true, roles: [role] },
          },
        },
      ];

      const result = await getConventionsForAgencyUser.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expect(result.data).toHaveLength(10);
      expect(result.pagination.totalRecords).toBe(conventions.length);
    });

    it("should return no convention when user only has a non-authorized role", async () => {
      uow.agencyRepository.agencies = [
        {
          ...agency,
          usersRights: {
            [agencyUserId]: {
              isNotifiedByEmail: true,
              roles: ["to-review"],
            },
          },
        },
      ];

      const result = await getConventionsForAgencyUser.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
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

    it("should only return requested conventions from agencies where user has valid rights", async () => {
      const agencyUserHasValidRightOn = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
          .withName("Agency user has valid right on")
          .build(),
        {
          [agencyUserId]: {
            isNotifiedByEmail: true,
            roles: ["counsellor"],
          },
        },
      );
      const agencyUserHasNoValidRightOn = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("cccccccc-cccc-cccc-cccc-cccccccccccc")
          .withName("Agency user has no valid right on")
          .build(),
        {},
      );
      const conventionFromAgencyUserHasValidRightOn = new ConventionDtoBuilder()
        .withId("convention-from-agency-user-has-valid-right-on")
        .withAgencyId(agencyUserHasValidRightOn.id)
        .build();
      const conventionFromAgencyUserHasNoValidRightOn =
        new ConventionDtoBuilder()
          .withId("convention-from-agency-user-has-no-valid-right-on")
          .withAgencyId(agencyUserHasNoValidRightOn.id)
          .build();

      uow.agencyRepository.agencies = [
        agency,
        agencyUserHasValidRightOn,
        agencyUserHasNoValidRightOn,
      ];
      uow.conventionRepository.setConventions([
        conventions[0],
        conventionFromAgencyUserHasValidRightOn,
        conventionFromAgencyUserHasNoValidRightOn,
      ]);

      const result = await getConventionsForAgencyUser.execute(
        {
          filters: {
            agencyIds: [
              agencyUserHasValidRightOn.id,
              agencyUserHasNoValidRightOn.id,
            ],
          },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(
        result.data.map(({ id }) => id),
        [conventionFromAgencyUserHasValidRightOn.id],
      );
    });

    it("should only return conventions from agencies matching agencyDepartmentCodes", async () => {
      const agencyInParis = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
          .withName("Agency in Paris")
          .withAddress({
            city: "Paris",
            departmentCode: "75",
            postcode: "75001",
            streetNumberAndAddress: "1 rue de Paris",
          })
          .build(),
        {
          [agencyUserId]: {
            isNotifiedByEmail: true,
            roles: ["counsellor"],
          },
        },
      );
      const agencyInLyon = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("cccccccc-cccc-cccc-cccc-cccccccccccc")
          .withName("Agency in Lyon")
          .withAddress({
            city: "Lyon",
            departmentCode: "69",
            postcode: "69001",
            streetNumberAndAddress: "1 rue de Lyon",
          })
          .build(),
        {
          [agencyUserId]: {
            isNotifiedByEmail: true,
            roles: ["counsellor"],
          },
        },
      );
      const conventionInParis = new ConventionDtoBuilder()
        .withId("convention-in-paris")
        .withAgencyId(agencyInParis.id)
        .build();
      const conventionInLyon = new ConventionDtoBuilder()
        .withId("convention-in-lyon")
        .withAgencyId(agencyInLyon.id)
        .build();

      uow.agencyRepository.agencies = [agency, agencyInParis, agencyInLyon];
      uow.conventionRepository.setConventions([
        conventionInParis,
        conventionInLyon,
      ]);

      const result = await getConventionsForAgencyUser.execute(
        {
          filters: {
            agencyDepartmentCodes: ["75"],
          },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(
        result.data.map(({ id }) => id),
        [conventionInParis.id],
      );
    });

    it("should return all conventions from agencies where user has valid rights when no agency filter is requested", async () => {
      const agencyUserHasValidRightOn = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
          .withName("Agency user has valid right on")
          .build(),
        {
          [agencyUserId]: { isNotifiedByEmail: true, roles: ["agency-viewer"] },
        },
      );
      const conventionFromAgencyUserHasValidRightOn = new ConventionDtoBuilder()
        .withId("convention-from-agency-user-has-valid-right-on")
        .withAgencyId(agencyUserHasValidRightOn.id)
        .build();

      uow.agencyRepository.agencies = [agency, agencyUserHasValidRightOn];
      uow.conventionRepository.setConventions([
        conventions[0],
        conventionFromAgencyUserHasValidRightOn,
      ]);

      const result = await getConventionsForAgencyUser.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expectArraysToEqualIgnoringOrder(
        result.data.map(({ id }) => id),
        [conventions[0].id, conventionFromAgencyUserHasValidRightOn.id],
      );
    });
  });

  describe("Agency with refersTo", () => {
    const agencyWithRefersTo = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("dddddddd-dddd-dddd-dddd-dddddddddddd")
        .withName("Structure d'accompagnement")
        .withRefersToAgencyInfo({
          refersToAgencyId: agency.id,
          refersToAgencyName: agency.name,
          refersToAgencyContactEmail: agency.contactEmail,
        })
        .build(),
      {
        [agencyUserId]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const conventionInReviewOnAgency = new ConventionDtoBuilder()
      .withId("convention-in-review-on-agency")
      .withAgencyId(agency.id)
      .withStatus("IN_REVIEW")
      .build();
    const conventionInReviewOnAgencyWithRefersTo = new ConventionDtoBuilder()
      .withId("convention-in-review-on-agency-with-refers-to")
      .withAgencyId(agencyWithRefersTo.id)
      .withStatus("IN_REVIEW")
      .build();
    const conventionReadyToSignOnAgencyWithRefersTo = new ConventionDtoBuilder()
      .withId("convention-ready-to-sign-on-agency-with-refers-to")
      .withAgencyId(agencyWithRefersTo.id)
      .withStatus("READY_TO_SIGN")
      .build();
    const conventionPartiallySignedOnAgencyWithRefersTo =
      new ConventionDtoBuilder()
        .withId("convention-partially-signed-on-agency-with-refers-to")
        .withAgencyId(agencyWithRefersTo.id)
        .withStatus("PARTIALLY_SIGNED")
        .build();
    const conventionAcceptedByCounsellorOnAgencyWithRefersTo =
      new ConventionDtoBuilder()
        .withId("convention-accepted-by-counsellor-on-agency-with-refers-to")
        .withAgencyId(agencyWithRefersTo.id)
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .build();
    const conventionRejectedOnAgencyWithRefersTo = new ConventionDtoBuilder()
      .withId("convention-rejected-on-agency-with-refers-to")
      .withAgencyId(agencyWithRefersTo.id)
      .withStatus("REJECTED")
      .build();
    const conventionDeprecatedOnAgencyWithRefersTo = new ConventionDtoBuilder()
      .withId("convention-deprecated-on-agency-with-refers-to")
      .withAgencyId(agencyWithRefersTo.id)
      .withStatus("DEPRECATED")
      .build();

    beforeEach(() => {
      uow.agencyRepository.agencies = [agency, agencyWithRefersTo];
      uow.conventionRepository.setConventions([
        conventionInReviewOnAgency,
        conventionInReviewOnAgencyWithRefersTo,
        conventionReadyToSignOnAgencyWithRefersTo,
        conventionPartiallySignedOnAgencyWithRefersTo,
        conventionAcceptedByCounsellorOnAgencyWithRefersTo,
        conventionRejectedOnAgencyWithRefersTo,
        conventionDeprecatedOnAgencyWithRefersTo,
      ]);
    });

    it("should not return READY_TO_SIGN, PARTIALLY_SIGNED or IN_REVIEW of an agency with refersTo when user is validator, and still return IN_REVIEW of the agency without refersTo", async () => {
      const result = await getConventionsForAgencyUser.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expectArraysToEqualIgnoringOrder(
        result.data.map(({ id }) => id),
        [
          conventionInReviewOnAgency.id,
          conventionAcceptedByCounsellorOnAgencyWithRefersTo.id,
          conventionRejectedOnAgencyWithRefersTo.id,
          conventionDeprecatedOnAgencyWithRefersTo.id,
        ],
      );
    });

    it.each([
      {
        roles: ["counsellor"] satisfies AgencyRole[],
        case: "counsellor",
      },
      {
        roles: ["counsellor", "validator"] satisfies AgencyRole[],
        case: "counsellor and validator",
      },
      {
        roles: ["agency-admin"] satisfies AgencyRole[],
        case: "agency-admin",
      },
      {
        roles: ["agency-viewer"] satisfies AgencyRole[],
        case: "agency-viewer",
      },
    ])("should return READY_TO_SIGN, PARTIALLY_SIGNED and IN_REVIEW of an agency with refersTo when user is $case", async ({
      roles,
    }) => {
      uow.agencyRepository.agencies = [
        agency,
        {
          ...agencyWithRefersTo,
          usersRights: {
            [agencyUserId]: { isNotifiedByEmail: true, roles },
          },
        },
      ];

      const result = await getConventionsForAgencyUser.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUser,
      );

      expectArraysToEqualIgnoringOrder(
        result.data.map(({ id }) => id),
        [
          conventionInReviewOnAgency.id,
          conventionInReviewOnAgencyWithRefersTo.id,
          conventionReadyToSignOnAgencyWithRefersTo.id,
          conventionPartiallySignedOnAgencyWithRefersTo.id,
          conventionAcceptedByCounsellorOnAgencyWithRefersTo.id,
          conventionRejectedOnAgencyWithRefersTo.id,
          conventionDeprecatedOnAgencyWithRefersTo.id,
        ],
      );
    });

    it("should not return IN_REVIEW of an agency with refersTo when filtering by status IN_REVIEW", async () => {
      const result = await getConventionsForAgencyUser.execute(
        {
          filters: { statuses: ["IN_REVIEW"] },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectToEqual(
        result.data.map(({ id }) => id),
        [conventionInReviewOnAgency.id],
      );
    });

    it("should not return IN_REVIEW of an agency with refersTo when filtering by that agency id", async () => {
      const result = await getConventionsForAgencyUser.execute(
        {
          filters: { agencyIds: [agencyWithRefersTo.id] },
          pagination: { page: 1, perPage: 10 },
        },
        currentUser,
      );

      expectArraysToEqualIgnoringOrder(
        result.data.map(({ id }) => id),
        [
          conventionAcceptedByCounsellorOnAgencyWithRefersTo.id,
          conventionRejectedOnAgencyWithRefersTo.id,
          conventionDeprecatedOnAgencyWithRefersTo.id,
        ],
      );
    });
  });
});
