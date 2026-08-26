import {
  type AgencyUserConventionListDto,
  ConventionDtoBuilder,
  type ConventionWithUnfinalizedAssessmentReadDto,
  type DataWithPagination,
  expectToEqual,
} from "shared";
import { connectedUserConventionsToManageSelectors } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.selectors";
import {
  connectedUserConventionsToManageInitialState,
  connectedUserConventionsToManageSlice,
  initialConventionsWithUnfinalizedAssessmentFilters,
} from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("ConnectedUserConventionsToManage", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("get the conventions for the connected user", () => {
    expectToEqual(
      connectedUserConventionsToManageSelectors.isLoading(store.getState()),
      false,
    );

    store.dispatch(
      connectedUserConventionsToManageSlice.actions.getConventionsForConnectedUserRequested(
        {
          params: {},
          jwt: "my-jwt",
          feedbackTopic: "connected-user-conventions",
        },
      ),
    );

    expectToEqual(
      connectedUserConventionsToManageSelectors.isLoading(store.getState()),
      true,
    );
    const convention: AgencyUserConventionListDto = {
      id: "convention-id",
      status: "READY_TO_SIGN",
      dateStart: "2024-01-15",
      dateEnd: "2024-01-20",
      businessName: "Business Name",
      agencyName: "Agency Name",
      assessment: null,
      beneficiary: {
        firstName: "John",
        lastName: "Doe",
      },
    };

    const result: DataWithPagination<AgencyUserConventionListDto> = {
      data: [convention],
      pagination: {
        totalRecords: 10,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: 10,
      },
    };
    dependencies.conventionGateway.getConventionsForUserResult$.next(result);
    expectToEqual(store.getState().connectedUserConventionsToManage, {
      ...connectedUserConventionsToManageInitialState,
      isLoading: false,
      conventions: result.data,
      pagination: result.pagination,
    });
  });

  it("failed to get the conventions for the connected user", () => {
    expectToEqual(
      connectedUserConventionsToManageSelectors.isLoading(store.getState()),
      false,
    );
    store.dispatch(
      connectedUserConventionsToManageSlice.actions.getConventionsForConnectedUserRequested(
        {
          params: {},
          jwt: "my-jwt",
          feedbackTopic: "connected-user-conventions",
        },
      ),
    );
    expectToEqual(
      connectedUserConventionsToManageSelectors.isLoading(store.getState()),
      true,
    );
    dependencies.conventionGateway.getConventionsForUserResult$.error(
      new Error("any-error-message"),
    );
    expectToEqual(
      connectedUserConventionsToManageSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "connected-user-conventions": {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération de vos conventions",
        message: "any-error-message",
      },
    });
  });

  describe("getConventionsWithUnfinalizedAssessmentRequested", () => {
    it("get the conventions with unfinalized assessment without assessmentCompletionStatus filter", () => {
      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        false,
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        initialConventionsWithUnfinalizedAssessmentFilters,
      );

      store.dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: 10,
            },
            jwt: "my-jwt",
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        true,
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 1,
          perPage: 10,
        },
      );

      const convention = new ConventionDtoBuilder().build();

      const conventionWithUnfinalizedAssessment: ConventionWithUnfinalizedAssessmentReadDto =
        {
          id: convention.id,
          dateEnd: convention.dateEnd,
          beneficiary: {
            firstname: convention.signatories.beneficiary.firstName,
            lastname: convention.signatories.beneficiary.lastName,
          },
          assessment: null,
          agencyId: convention.agencyId,
          agencyReferent: convention.agencyReferent ?? null,
          agencyName: "Agency Name",
        };

      const result: DataWithPagination<ConventionWithUnfinalizedAssessmentReadDto> =
        {
          data: [conventionWithUnfinalizedAssessment],
          pagination: {
            totalRecords: 5,
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
          },
        };
      dependencies.conventionGateway.getConventionsWithUnfinalizedAssessmentResult$.next(
        result,
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        result.data,
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentPagination(
          store.getState(),
        ),
        result.pagination,
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        false,
      );
    });

    it("stores assessmentCompletionStatus filter on request and keeps it after success", () => {
      store.dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: 10,
              assessmentCompletionStatus: "to-sign",
            },
            jwt: "my-jwt",
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 1,
          perPage: 10,
          assessmentCompletionStatus: "to-sign",
        },
      );

      const convention = new ConventionDtoBuilder().build();
      const result: DataWithPagination<ConventionWithUnfinalizedAssessmentReadDto> =
        {
          data: [
            {
              id: convention.id,
              dateEnd: convention.dateEnd,
              beneficiary: {
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              },
              assessment: null,
              agencyId: convention.agencyId,
              agencyReferent: convention.agencyReferent ?? null,
              agencyName: "Agency Name",
            },
          ],
          pagination: {
            totalRecords: 1,
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
          },
        };
      dependencies.conventionGateway.getConventionsWithUnfinalizedAssessmentResult$.next(
        result,
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 1,
          perPage: 10,
          assessmentCompletionStatus: "to-sign",
        },
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        result.data,
      );
    });

    it("stores search filter on request and keeps it after success", () => {
      store.dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: 10,
              search: "Dupont",
              assessmentCompletionStatus: "to-sign",
            },
            jwt: "my-jwt",
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 1,
          perPage: 10,
          search: "Dupont",
          assessmentCompletionStatus: "to-sign",
        },
      );

      const convention = new ConventionDtoBuilder().build();
      const result: DataWithPagination<ConventionWithUnfinalizedAssessmentReadDto> =
        {
          data: [
            {
              id: convention.id,
              dateEnd: convention.dateEnd,
              beneficiary: {
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              },
              assessment: null,
              agencyId: convention.agencyId,
              agencyReferent: convention.agencyReferent ?? null,
              agencyName: "Agency Name",
            },
          ],
          pagination: {
            totalRecords: 1,
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
          },
        };
      dependencies.conventionGateway.getConventionsWithUnfinalizedAssessmentResult$.next(
        result,
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 1,
          perPage: 10,
          search: "Dupont",
          assessmentCompletionStatus: "to-sign",
        },
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        result.data,
      );
    });

    it("failed to get the conventions with unfinalized assessment", () => {
      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        false,
      );
      store.dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: 10,
            },
            jwt: "my-jwt",
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        true,
      );
      dependencies.conventionGateway.getConventionsWithUnfinalizedAssessmentResult$.error(
        new Error("unfinalized-assessment-error"),
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        false,
      );
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "conventions-with-unfinalized-assessment": {
          on: "fetch",
          level: "error",
          title:
            "Problème lors de la récupération des bilans à compléter ou à signer",
          message: "unfinalized-assessment-error",
        },
      });
    });

    it("should clear state when clearConventionsWithUnfinalizedAssessment is dispatched", () => {
      const convention = new ConventionDtoBuilder().build();
      const result: DataWithPagination<ConventionWithUnfinalizedAssessmentReadDto> =
        {
          data: [
            {
              id: convention.id,
              dateEnd: convention.dateEnd,
              beneficiary: {
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              },
              assessment: null,
              agencyId: convention.agencyId,
              agencyReferent: convention.agencyReferent ?? null,
              agencyName: "Agency Name",
            },
          ],
          pagination: {
            totalRecords: 1,
            currentPage: 2,
            totalPages: 1,
            numberPerPage: 10,
          },
        };

      store.dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 2,
              perPage: 10,
              search: "Dupont",
              assessmentCompletionStatus: "to-complete",
            },
            jwt: "my-jwt",
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );
      dependencies.conventionGateway.getConventionsWithUnfinalizedAssessmentResult$.next(
        result,
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        {
          page: 2,
          perPage: 10,
          search: "Dupont",
          assessmentCompletionStatus: "to-complete",
        },
      );

      store.dispatch(
        connectedUserConventionsToManageSlice.actions.clearConventionsWithUnfinalizedAssessment(),
      );

      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentFilters(
          store.getState(),
        ),
        initialConventionsWithUnfinalizedAssessmentFilters,
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment(
          store.getState(),
        ),
        [],
      );
      expectToEqual(
        connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentPagination(
          store.getState(),
        ),
        undefined,
      );
    });
  });
});
