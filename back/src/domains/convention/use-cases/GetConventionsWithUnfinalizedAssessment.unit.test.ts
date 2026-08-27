import { subDays } from "date-fns";
import {
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { createAssessmentEntity } from "../entities/AssessmentEntity";
import {
  type GetConventionsWithUnfinalizedAssessment,
  makeGetConventionsWithUnfinalizedAssessment,
} from "./GetConventionsWithUnfinalizedAssessment";

describe("GetConventionsWithUnfinalizedAssessment", () => {
  const now = new Date();

  const agency = new AgencyDtoBuilder()
    .withId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    .withName("Test Agency")
    .withKind("france-travail")
    .build();
  const agency2 = new AgencyDtoBuilder()
    .withId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab")
    .withName("Test Agency 2")
    .withKind("france-travail")
    .build();

  const validatedConvention = new ConventionDtoBuilder()
    .withId("convention1")
    .withAgencyId(agency.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyReferent({ firstname: "Marie", lastname: "Curie" })
    .build();

  const assessment = new AssessmentDtoBuilder()
    .withConventionId(validatedConvention.id)
    .withCreatedAt(subDays(now, 10).toISOString())
    .build();

  const validatedConvention2 = new ConventionDtoBuilder()
    .withId("convention2")
    .withAgencyId(agency2.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .build();

  const assessment2 = new AssessmentDtoBuilder()
    .withConventionId(validatedConvention2.id)
    .withCreatedAt(subDays(now, 10).toISOString())
    .build();

  const validatedConvention3 = new ConventionDtoBuilder()
    .withId("convention3")
    .withAgencyId(agency.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateStart(subDays(now, 30).toISOString())
    .withDateEnd(subDays(now, 5).toISOString())
    .build();

  let uow: InMemoryUnitOfWork;
  let getConventionsWithUnfinalizedAssessment: GetConventionsWithUnfinalizedAssessment;
  let timeGateway: CustomTimeGateway;

  const currentUserWithValidAgencyRight = new ConnectedUserBuilder()
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        roles: ["validator"],
        isNotifiedByEmail: true,
      },
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
        roles: ["validator"],
        isNotifiedByEmail: true,
      },
    ])
    .build();

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(now);
    getConventionsWithUnfinalizedAssessment =
      makeGetConventionsWithUnfinalizedAssessment({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: { timeGateway },
      });

    uow.conventionRepository.setConventions([
      validatedConvention,
      validatedConvention2,
      validatedConvention3,
    ]);
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, validatedConvention),
      createAssessmentEntity(assessment2, validatedConvention2),
    ];
  });

  it("return paginated conventions with unfinalized assessment related to user agency rights", async () => {
    expectToEqual(
      await getConventionsWithUnfinalizedAssessment.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUserWithValidAgencyRight,
      ),
      {
        data: [
          {
            assessment: {
              createdAt: assessment.createdAt,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              status: assessment.status,
            },
            beneficiary: {
              firstname: validatedConvention.signatories.beneficiary.firstName,
              lastname: validatedConvention.signatories.beneficiary.lastName,
            },
            dateEnd: validatedConvention.dateEnd,
            id: validatedConvention.id,
            agencyId: validatedConvention.agencyId,
            agencyReferent: validatedConvention.agencyReferent ?? null,
            agencyName: agency.name,
          },
          {
            assessment: {
              createdAt: assessment2.createdAt,
              endedWithAJob: assessment2.endedWithAJob,
              signedAt: assessment2.signedAt,
              status: assessment2.status,
            },
            beneficiary: {
              firstname: validatedConvention2.signatories.beneficiary.firstName,
              lastname: validatedConvention2.signatories.beneficiary.lastName,
            },
            dateEnd: validatedConvention2.dateEnd,
            id: validatedConvention2.id,
            agencyId: validatedConvention2.agencyId,
            agencyReferent: validatedConvention2.agencyReferent ?? null,
            agencyName: agency2.name,
          },
          {
            assessment: null,
            beneficiary: {
              firstname: validatedConvention3.signatories.beneficiary.firstName,
              lastname: validatedConvention3.signatories.beneficiary.lastName,
            },
            dateEnd: validatedConvention3.dateEnd,
            id: validatedConvention3.id,
            agencyId: validatedConvention3.agencyId,
            agencyReferent: validatedConvention3.agencyReferent ?? null,
            agencyName: agency.name,
          },
        ],
        pagination: {
          currentPage: 1,
          numberPerPage: 10,
          totalPages: 1,
          totalRecords: 3,
        },
      },
    );
  });

  describe("filters", () => {
    it("filters conventions with assessment to complete", async () => {
      expectToEqual(
        await getConventionsWithUnfinalizedAssessment.execute(
          {
            pagination: { page: 1, perPage: 10 },
            filters: { assessmentCompletionStatus: "to-complete" },
          },
          currentUserWithValidAgencyRight,
        ),
        {
          data: [
            {
              assessment: null,
              beneficiary: {
                firstname:
                  validatedConvention3.signatories.beneficiary.firstName,
                lastname: validatedConvention3.signatories.beneficiary.lastName,
              },
              dateEnd: validatedConvention3.dateEnd,
              id: validatedConvention3.id,
              agencyId: validatedConvention3.agencyId,
              agencyReferent: validatedConvention3.agencyReferent ?? null,
              agencyName: agency.name,
            },
          ],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 1,
          },
        },
      );
    });

    it("filters conventions with assessment to sign", async () => {
      expectToEqual(
        await getConventionsWithUnfinalizedAssessment.execute(
          {
            pagination: { page: 1, perPage: 10 },
            filters: { assessmentCompletionStatus: "to-sign" },
          },
          currentUserWithValidAgencyRight,
        ),
        {
          data: [
            {
              assessment: {
                createdAt: assessment.createdAt,
                endedWithAJob: assessment.endedWithAJob,
                signedAt: assessment.signedAt,
                status: assessment.status,
              },
              beneficiary: {
                firstname:
                  validatedConvention.signatories.beneficiary.firstName,
                lastname: validatedConvention.signatories.beneficiary.lastName,
              },
              dateEnd: validatedConvention.dateEnd,
              id: validatedConvention.id,
              agencyId: validatedConvention.agencyId,
              agencyReferent: validatedConvention.agencyReferent ?? null,
              agencyName: agency.name,
            },
            {
              assessment: {
                createdAt: assessment2.createdAt,
                endedWithAJob: assessment2.endedWithAJob,
                signedAt: assessment2.signedAt,
                status: assessment2.status,
              },
              beneficiary: {
                firstname:
                  validatedConvention2.signatories.beneficiary.firstName,
                lastname: validatedConvention2.signatories.beneficiary.lastName,
              },
              dateEnd: validatedConvention2.dateEnd,
              id: validatedConvention2.id,
              agencyId: validatedConvention2.agencyId,
              agencyReferent: validatedConvention2.agencyReferent ?? null,
              agencyName: agency2.name,
            },
          ],
          pagination: {
            currentPage: 1,
            numberPerPage: 10,
            totalPages: 1,
            totalRecords: 2,
          },
        },
      );
    });

    describe("search", () => {
      it("filters conventions by search", async () => {
        expectToEqual(
          await getConventionsWithUnfinalizedAssessment.execute(
            {
              pagination: { page: 1, perPage: 10 },
              filters: { search: "Marie" },
            },
            currentUserWithValidAgencyRight,
          ),
          {
            data: [
              {
                assessment: {
                  createdAt: assessment.createdAt,
                  endedWithAJob: assessment.endedWithAJob,
                  signedAt: assessment.signedAt,
                  status: assessment.status,
                },
                beneficiary: {
                  firstname:
                    validatedConvention.signatories.beneficiary.firstName,
                  lastname:
                    validatedConvention.signatories.beneficiary.lastName,
                },
                dateEnd: validatedConvention.dateEnd,
                id: validatedConvention.id,
                agencyId: validatedConvention.agencyId,
                agencyReferent: validatedConvention.agencyReferent ?? null,
                agencyName: agency.name,
              },
            ],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          },
        );
      });

      it("combines search with assessmentCompletionStatus", async () => {
        expectToEqual(
          await getConventionsWithUnfinalizedAssessment.execute(
            {
              pagination: { page: 1, perPage: 10 },
              filters: {
                search: "Marie",
                assessmentCompletionStatus: "to-sign",
              },
            },
            currentUserWithValidAgencyRight,
          ),
          {
            data: [
              {
                assessment: {
                  createdAt: assessment.createdAt,
                  endedWithAJob: assessment.endedWithAJob,
                  signedAt: assessment.signedAt,
                  status: assessment.status,
                },
                beneficiary: {
                  firstname:
                    validatedConvention.signatories.beneficiary.firstName,
                  lastname:
                    validatedConvention.signatories.beneficiary.lastName,
                },
                dateEnd: validatedConvention.dateEnd,
                id: validatedConvention.id,
                agencyId: validatedConvention.agencyId,
                agencyReferent: validatedConvention.agencyReferent ?? null,
                agencyName: agency.name,
              },
            ],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 1,
            },
          },
        );
      });

      it("returns empty array when filters match nothing", async () => {
        expectToEqual(
          await getConventionsWithUnfinalizedAssessment.execute(
            {
              pagination: { page: 1, perPage: 10 },
              filters: { search: "unknown-search-term" },
            },
            currentUserWithValidAgencyRight,
          ),
          {
            data: [],
            pagination: {
              currentPage: 1,
              numberPerPage: 10,
              totalPages: 1,
              totalRecords: 0,
            },
          },
        );
      });
    });
  });

  it("throws when convention agency is not in user rights", async () => {
    const unknownAgencyId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    uow.conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser =
      async () => ({
        data: [
          {
            id: validatedConvention.id,
            dateEnd: validatedConvention.dateEnd,
            beneficiary: {
              firstname: validatedConvention.signatories.beneficiary.firstName,
              lastname: validatedConvention.signatories.beneficiary.lastName,
            },
            assessment: null,
            agencyId: unknownAgencyId,
            agencyReferent: null,
          },
        ],
        pagination: {
          currentPage: 1,
          numberPerPage: 10,
          totalPages: 1,
          totalRecords: 1,
        },
      });

    await expectPromiseToFailWithError(
      getConventionsWithUnfinalizedAssessment.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUserWithValidAgencyRight,
      ),
      errors.user.noRightsOnAgency({
        userId: currentUserWithValidAgencyRight.id,
        agencyId: unknownAgencyId,
      }),
    );
  });

  it("throws when user does not have the right agency role", async () => {
    const currentUserWithToReviewAgencyRight = new ConnectedUserBuilder()
      .withAgencyRights([
        {
          agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
          roles: ["to-review"],
          isNotifiedByEmail: true,
        },
      ])
      .build();

    await expectPromiseToFailWithError(
      getConventionsWithUnfinalizedAssessment.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUserWithToReviewAgencyRight,
      ),
      errors.agencies.noAgencyRights(currentUserWithToReviewAgencyRight.id),
    );
  });

  it("throws when user has no agency rights", async () => {
    const currentUserWithToReviewAgencyRight = new ConnectedUserBuilder()
      .withAgencyRights([])
      .build();

    await expectPromiseToFailWithError(
      getConventionsWithUnfinalizedAssessment.execute(
        { pagination: { page: 1, perPage: 10 } },
        currentUserWithToReviewAgencyRight,
      ),
      errors.agencies.noAgencyRights(currentUserWithToReviewAgencyRight.id),
    );
  });
});
