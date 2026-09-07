import {
  type AgencyUserConventionListDto,
  type BeneficiaryConventionListDto,
  type DataWithPagination,
  defaultPerPageInWebPagination,
  expectToEqual,
  type FlatGetConventionsForAgencyUserParams,
} from "shared";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  type ConventionListState,
  conventionListSlice,
  initialConventionWithPagination,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import type { FeedbackTopic } from "../../feedback/feedback.content";
import { feedbackSlice } from "../../feedback/feedback.slice";

describe("ConnectedUserConventionList", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  const conventionListFetchErrorMessage = "Convention list fetch error";
  const conventionListFetchError = new Error(conventionListFetchErrorMessage);
  const defaultConventionListState: ConventionListState = {
    isLoading: false,
    conventionsWithPagination: initialConventionWithPagination,
    beneficiaryConventionList: null,
  };
  const jwt = "my-jwt";

  const convention1: AgencyUserConventionListDto = {
    id: "convention-1",
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

  const convention2: AgencyUserConventionListDto = {
    ...convention1,
    id: "convention-2",
    dateStart: "2024-02-20",
  };

  const conventionsWithPagination: DataWithPagination<AgencyUserConventionListDto> =
    {
      data: [convention1, convention2],
      pagination: {
        totalRecords: 2,
        currentPage: 1,
        totalPages: 1,
        numberPerPage: defaultPerPageInWebPagination,
      },
    };

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("conventionsWithPagination", () => {
    it("on convention list fetched successfully", () => {
      expectConventionListSelectors(defaultConventionListState);

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
      });

      feedGatewayWithConventionListOrError(conventionsWithPagination);

      expectConventionListSelectors({
        ...defaultConventionListState,
        conventionsWithPagination: {
          ...conventionsWithPagination,
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
        },
      });
    });

    it("on convention list fetched failed", () => {
      expectConventionListSelectors(defaultConventionListState);

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
      });

      feedGatewayWithConventionListOrError(conventionListFetchError);

      expectConventionListSelectors({
        ...defaultConventionListState,
      });
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "connected-user-convention-list": {
          on: "fetch",
          level: "error",
          title: "Problème lors de la récupération des conventions",
          message: conventionListFetchErrorMessage,
        },
      });
    });

    it("updates filters when fetching convention list", () => {
      expectConventionListSelectors(defaultConventionListState);

      const customFilters: FlatGetConventionsForAgencyUserParams = {
        sortBy: "dateStart",
        sortDirection: "asc",
        page: 2,
        perPage: 20,
      };

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: customFilters,
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
        conventionsWithPagination: {
          ...defaultConventionListState.conventionsWithPagination,
          filters: customFilters,
        },
      });
    });

    it("previous convention list in state preserved on new fetch requested", () => {
      expectConventionListSelectors(defaultConventionListState);

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      feedGatewayWithConventionListOrError(conventionsWithPagination);

      expectConventionListSelectors({
        ...defaultConventionListState,
        conventionsWithPagination: {
          ...conventionsWithPagination,
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
        },
      });

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: {
            sortBy: "dateStart",
            sortDirection: "asc",
            page: 2,
            perPage: 10,
          },
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
        conventionsWithPagination: {
          ...conventionsWithPagination,
          filters: {
            sortBy: "dateStart",
            sortDirection: "asc",
            page: 2,
            perPage: 10,
          },
        },
      });
    });

    it("clears convention list filters", () => {
      expectConventionListSelectors(defaultConventionListState);

      const customFilters: FlatGetConventionsForAgencyUserParams = {
        sortBy: "dateStart",
        sortDirection: "asc",
        page: 2,
        perPage: 20,
        statuses: ["PARTIALLY_SIGNED"],
        dateStartFrom: "2024-01-01",
      };

      store.dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          jwt,
          filters: customFilters,
          feedbackTopic: "connected-user-convention-list",
        }),
      );

      feedGatewayWithConventionListOrError(conventionsWithPagination);

      expectConventionListSelectors({
        ...defaultConventionListState,
        conventionsWithPagination: {
          ...conventionsWithPagination,
          filters: customFilters,
        },
      });

      store.dispatch(conventionListSlice.actions.clearConventionListFilters());

      expectConventionListSelectors(defaultConventionListState);
    });

    const feedGatewayWithConventionListOrError = (
      conventionListOrError?:
        | DataWithPagination<AgencyUserConventionListDto>
        | Error,
    ) => {
      if (conventionListOrError instanceof Error) {
        dependencies.conventionGateway.getConventionsForUserResult$.error(
          conventionListOrError,
        );
      } else if (conventionListOrError) {
        dependencies.conventionGateway.getConventionsForUserResult$.next(
          conventionListOrError,
        );
      }
    };
  });

  describe("beneficiaryConventionList", () => {
    const feedbackTopic: FeedbackTopic =
      "connected-user-beneficiary-convention-list";

    it("fetch list succedeed then cleared", () => {
      expectConventionListSelectors(defaultConventionListState);

      store.dispatch(
        conventionListSlice.actions.fetchBeneficiaryConventionListRequested({
          jwt,
          feedbackTopic: "connected-user-beneficiary-convention-list",
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
      });

      const nextResult: BeneficiaryConventionListDto = [
        {
          conventionId: "id",
          businessName: "Business name",
          dateStart: "2023-02-06",
          dateEnd: "2023-02-02",
          status: "ACCEPTED_BY_VALIDATOR",
          assessment: null,
        },
      ];

      feedGatewayWithBeneficiaryConventionListOrError(nextResult);

      expectConventionListSelectors({
        ...defaultConventionListState,
        beneficiaryConventionList: nextResult,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          level: "success",
          title: "Conventions récupérées avec succès",
          on: "fetch",
          message: "",
        },
      );

      store.dispatch(
        conventionListSlice.actions.clearBeneficiaryConventionListRequested(),
      );
      store.dispatch(feedbackSlice.actions.clearFeedbacksTriggered());

      expectConventionListSelectors(defaultConventionListState);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        undefined,
      );
    });

    it("fetch list failed with feedback then cleared", () => {
      expectConventionListSelectors(defaultConventionListState);

      store.dispatch(
        conventionListSlice.actions.fetchBeneficiaryConventionListRequested({
          jwt,
          feedbackTopic: feedbackTopic,
        }),
      );

      expectConventionListSelectors({
        ...defaultConventionListState,
        isLoading: true,
      });

      const error = new Error("CPT");

      feedGatewayWithBeneficiaryConventionListOrError(error);

      expectConventionListSelectors({
        ...defaultConventionListState,
        beneficiaryConventionList: [],
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        {
          level: "error",
          title: "Problème lors de la récupération de vos conventions",
          on: "fetch",
          message: error.message,
        },
      );

      store.dispatch(
        conventionListSlice.actions.clearBeneficiaryConventionListRequested(),
      );
      store.dispatch(feedbackSlice.actions.clearFeedbacksTriggered());

      expectConventionListSelectors(defaultConventionListState);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())[feedbackTopic],
        undefined,
      );
    });

    const feedGatewayWithBeneficiaryConventionListOrError = (
      beneficiaryConventionListOrError: BeneficiaryConventionListDto | Error,
    ) =>
      beneficiaryConventionListOrError instanceof Error
        ? dependencies.conventionGateway.getBeneficiaryConventionListResult$.error(
            beneficiaryConventionListOrError,
          )
        : dependencies.conventionGateway.getBeneficiaryConventionListResult$.next(
            beneficiaryConventionListOrError,
          );
  });

  const expectConventionListSelectors = ({
    isLoading,
    conventionsWithPagination,
    beneficiaryConventionList,
  }: ConventionListState) => {
    expectToEqual(
      conventionListSelectors.isLoading(store.getState()),
      isLoading,
    );
    expectToEqual(
      conventionListSelectors.conventionsWithPagination(store.getState()),
      conventionsWithPagination,
    );
    expectToEqual(
      conventionListSelectors.beneficiaryConventionList(store.getState()),
      beneficiaryConventionList,
    );
  };
});
