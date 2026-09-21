import {
  DiscussionBuilder,
  type DiscussionEstablishmentContactInfo,
  type DiscussionInList,
  type DiscussionReadDto,
  discussionToExchangesData,
  type Exchange,
  expectToEqual,
} from "shared";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  type DiscussionState,
  discussionSlice,
  type FlatGetPaginatedDiscussionsParamsWithStatusesAsArray,
  initialDiscussionsWithPagination,
  type SendExchangeRequestedPayload,
} from "./discussion.slice";

describe("Discussion slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const discussionFetchErrorMessage = "Discussion fetch error from API.";
  const discussionFetchError = new Error(discussionFetchErrorMessage);
  const defaultStartingDiscussionState: DiscussionState = {
    isLoading: false,
    discussion: null,
    discussionsWithPagination: initialDiscussionsWithPagination,
    discussionEstablishmentContactInfo: null,
  };
  const jwt = "my-jwt";
  const discussion: DiscussionReadDto = new DiscussionBuilder().buildRead();

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("on discussion fetched missing", () => {
    expectDiscussionSelector(defaultStartingDiscussionState);

    store.dispatch(
      discussionSlice.actions.fetchDiscussionRequested({
        jwt,
        discussionId: "missing-discussion-id",
        feedbackTopic: "dashboard-discussion",
      }),
    );

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      isLoading: true,
    });

    feedGatewayWithDiscussionOrError(undefined);

    expectDiscussionSelector({
      isLoading: false,
      discussion: null,
      discussionsWithPagination: initialDiscussionsWithPagination,
      discussionEstablishmentContactInfo: null,
    });
  });

  it("on discussion fetched successfully", () => {
    expectDiscussionSelector(defaultStartingDiscussionState);

    store.dispatch(
      discussionSlice.actions.fetchDiscussionRequested({
        jwt,
        discussionId: discussion.id,
        feedbackTopic: "dashboard-discussion",
      }),
    );

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      isLoading: true,
    });

    feedGatewayWithDiscussionOrError(discussion);

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      discussion,
    });
  });

  it("on discussion fetched failed", () => {
    expectDiscussionSelector(defaultStartingDiscussionState);

    store.dispatch(
      discussionSlice.actions.fetchDiscussionRequested({
        jwt,
        discussionId: discussion.id,
        feedbackTopic: "dashboard-discussion",
      }),
    );

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      isLoading: true,
    });

    feedGatewayWithDiscussionOrError(discussionFetchError);

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
    });
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "dashboard-discussion": {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération des discussions",
        message: discussionFetchErrorMessage,
      },
    });
  });

  it("previous discussion in state removed on discussion fetch requested", () => {
    expectDiscussionSelector(defaultStartingDiscussionState);

    store.dispatch(
      discussionSlice.actions.fetchDiscussionRequested({
        jwt,
        discussionId: discussion.id,
        feedbackTopic: "dashboard-discussion",
      }),
    );

    feedGatewayWithDiscussionOrError(discussion);

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      discussion,
    });

    store.dispatch(
      discussionSlice.actions.fetchDiscussionRequested({
        jwt,
        discussionId: discussion.id,
        feedbackTopic: "dashboard-discussion",
      }),
    );

    expectDiscussionSelector({
      ...defaultStartingDiscussionState,
      isLoading: true,
      discussion: null,
    });
  });

  describe("dashboard discussion reject", () => {
    it("dashboard discussion reject succeeded", () => {
      expectDiscussionSelector(defaultStartingDiscussionState);

      store.dispatch(
        discussionSlice.actions.updateDiscussionStatusRequested({
          jwt,
          discussionId: discussion.id,
          feedbackTopic: "dashboard-discussion-status-updated",
          status: "REJECTED",
          rejectionKind: "NO_TIME",
        }),
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        isLoading: true,
      });

      dependencies.establishmentGateway.updateDiscussionStatusResponse$.next();

      expectToEqual(discussionSelectors.isLoading(store.getState()), false);

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-discussion-status-updated": {
          on: "update",
          level: "success",
          title: "La candidature a bien été mise à jour",
          message: "La candidature a bien été mise à jour",
        },
      });
    });

    it("discussion reject failed", () => {
      expectDiscussionSelector(defaultStartingDiscussionState);

      store.dispatch(
        discussionSlice.actions.updateDiscussionStatusRequested({
          jwt,
          discussionId: discussion.id,
          feedbackTopic: "dashboard-discussion-status-updated",
          status: "REJECTED",
          rejectionKind: "NO_TIME",
        }),
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        isLoading: true,
      });

      dependencies.establishmentGateway.updateDiscussionStatusResponse$.error(
        discussionFetchError,
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
      });
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-discussion-status-updated": {
          on: "update",
          level: "error",
          title: "Problème lors de la mise à jour de la candidature",
          message: discussionFetchErrorMessage,
        },
      });
    });
  });

  describe("fetch discussion establishment contact info", () => {
    const discussionEstablishmentContactInfo: DiscussionEstablishmentContactInfo =
      {
        siret: "12345678901234",
        mainContact: {
          firstName: "Pat",
          lastName: "La Girafe",
          phone: "0611223344",
        },
        isEstablishmentReachableByPhoneAfter15Days: false,
      };

    it("fetches discussion establishment contact info successfully", () => {
      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        null,
      );

      store.dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            jwt,
            discussionId: discussion.id,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );

      expectToEqual(discussionSelectors.isLoading(store.getState()), true);
      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        null,
      );

      dependencies.establishmentGateway.discussionEstablishmentContactInfo$.next(
        discussionEstablishmentContactInfo,
      );

      expectToEqual(discussionSelectors.isLoading(store.getState()), false);
      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        discussionEstablishmentContactInfo,
      );
    });

    it("fails to fetch discussion establishment contact info", () => {
      store.dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            jwt,
            discussionId: discussion.id,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );

      expectToEqual(discussionSelectors.isLoading(store.getState()), true);

      dependencies.establishmentGateway.discussionEstablishmentContactInfo$.error(
        discussionFetchError,
      );

      expectToEqual(discussionSelectors.isLoading(store.getState()), false);
      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        null,
      );
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-discussion-contact-info": {
          on: "fetch",
          level: "error",
          title:
            "Problème lors de la récupération des coordonnées de l'entreprise",
          message: discussionFetchErrorMessage,
        },
      });
    });

    it("resets discussion establishment contact info when a new fetch is requested", () => {
      store.dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            jwt,
            discussionId: discussion.id,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );

      dependencies.establishmentGateway.discussionEstablishmentContactInfo$.next(
        discussionEstablishmentContactInfo,
      );

      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        discussionEstablishmentContactInfo,
      );

      store.dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            jwt,
            discussionId: discussion.id,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );

      expectToEqual(
        discussionSelectors.discussionEstablishmentContactInfo(
          store.getState(),
        ),
        null,
      );
    });
  });

  describe("send a new exchange on discussion", () => {
    it("send message requested and discussion is not in state", () => {
      expectDiscussionSelector(defaultStartingDiscussionState);
      const exchangePayload: SendExchangeRequestedPayload = {
        jwt,
        discussionId: discussion.id,
        message: "My message",
        recipientRole: "potentialBeneficiary",
      };

      const expectedExchange: Exchange = {
        message: exchangePayload.message,
        subject: "Réponse de My businessName à votre demande",
        sentAt: new Date().toISOString(),
        sender: "establishment",
        email: "establishment@mail.com",
        firstname: "Patrick",
        lastname: "Duchenne",
        attachments: [],
      };

      store.dispatch(
        discussionSlice.actions.sendExchangeRequested({
          exchangeData: exchangePayload,
          feedbackTopic: "establishment-dashboard-discussion-send-message",
        }),
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        isLoading: true,
      });

      dependencies.establishmentGateway.sendMessageResponse$.next(
        expectedExchange,
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        isLoading: false,
      });

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "establishment-dashboard-discussion-send-message": {
          on: "create",
          level: "success",
          title: "Message envoyé",
          message: "Le message a bien été envoyé",
        },
      });
    });

    it("send message requested and populate discussion with new exchange", () => {
      expectDiscussionSelector(defaultStartingDiscussionState);
      const exchangePayload: SendExchangeRequestedPayload = {
        jwt,
        discussionId: discussion.id,
        message: "My message",
        recipientRole: "potentialBeneficiary",
      };

      store.dispatch(
        discussionSlice.actions.fetchDiscussionRequested({
          jwt,
          discussionId: discussion.id,
          feedbackTopic: "dashboard-discussion",
        }),
      );

      feedGatewayWithDiscussionOrError(discussion);

      store.dispatch(
        discussionSlice.actions.sendExchangeRequested({
          exchangeData: exchangePayload,
          feedbackTopic: "establishment-dashboard-discussion-send-message",
        }),
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        discussion,
        isLoading: true,
      });

      const expectedExchange: Exchange = {
        message: exchangePayload.message,
        subject: "Réponse de My businessName à votre demande",
        sentAt: new Date().toISOString(),
        sender: "establishment",
        email: "establishment@mail.com",
        firstname: "Jude",
        lastname: "Law",
        attachments: [],
      };

      dependencies.establishmentGateway.sendMessageResponse$.next(
        expectedExchange,
      );

      expectDiscussionSelector({
        ...defaultStartingDiscussionState,
        discussion: {
          ...discussion,
          exchanges: [...discussion.exchanges, expectedExchange],
        },
        isLoading: false,
      });

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "dashboard-discussion": {
          on: "fetch",
          level: "success",
          title: "Les discussions ont bien été récupérées",
          message: "Les discussions ont bien été récupérées",
        },
        "establishment-dashboard-discussion-send-message": {
          on: "create",
          level: "success",
          title: "Message envoyé",
          message: "Le message a bien été envoyé",
        },
      });
    });
    describe("fetch discussion list", () => {
      it("fetches discussion list successfully and keeps filters", () => {
        const filtersToKeep: FlatGetPaginatedDiscussionsParamsWithStatusesAsArray =
          {
            userRole: "establishment",
            orderBy: "createdAt",
            orderDirection: "asc",
            page: 1,
            perPage: 20,
            search: "test",
          };
        expectDiscussionSelector(defaultStartingDiscussionState);
        store.dispatch(
          discussionSlice.actions.fetchDiscussionListRequested({
            jwt,
            filters: filtersToKeep,
            feedbackTopic: "establishment-dashboard-discussion-list",
          }),
        );

        expectDiscussionSelector({
          ...defaultStartingDiscussionState,
          isLoading: true,
        });

        dependencies.establishmentGateway.discussions$.next({
          data: [discussionToDiscussionInList(discussion)],
          pagination: {
            totalRecords: 1,
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
          },
        });

        expectDiscussionSelector({
          ...defaultStartingDiscussionState,
          discussionsWithPagination: {
            data: [
              {
                ...discussionToDiscussionInList(discussion),
              },
            ],
            pagination: {
              totalRecords: 1,
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
            },
            filters: filtersToKeep,
          },
        });
      });
      it("fails to fetch discussion list with feedback", () => {
        expectDiscussionSelector(defaultStartingDiscussionState);
        store.dispatch(
          discussionSlice.actions.fetchDiscussionListRequested({
            jwt,
            filters: {
              userRole: "establishment",
              orderBy: "createdAt",
              orderDirection: "desc",
              page: 1,
              perPage: 10,
            },
            feedbackTopic: "establishment-dashboard-discussion-list",
          }),
        );

        expectDiscussionSelector({
          ...defaultStartingDiscussionState,
          isLoading: true,
        });

        dependencies.establishmentGateway.discussions$.error(
          discussionFetchError,
        );

        expectDiscussionSelector({
          ...defaultStartingDiscussionState,
        });
        expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
          "establishment-dashboard-discussion-list": {
            on: "fetch",
            level: "error",
            title: "Problème lors de la récupération des discussions",
            message: discussionFetchErrorMessage,
          },
        });
      });
    });

    const feedGatewayWithDiscussionOrError = (
      discussionOrError?: DiscussionReadDto | Error,
    ) => {
      discussionOrError instanceof Error
        ? dependencies.establishmentGateway.discussion$.error(discussionOrError)
        : dependencies.establishmentGateway.discussion$.next(discussionOrError);
    };

    const expectDiscussionSelector = ({
      isLoading,
      discussion,
    }: DiscussionState) => {
      expectToEqual(discussionSelectors.isLoading(store.getState()), isLoading);
      expectToEqual(
        discussionSelectors.discussion(store.getState()),
        discussion,
      );
    };
  });

  const feedGatewayWithDiscussionOrError = (
    discussionOrError?: DiscussionReadDto | Error,
  ) => {
    discussionOrError instanceof Error
      ? dependencies.establishmentGateway.discussion$.error(discussionOrError)
      : dependencies.establishmentGateway.discussion$.next(discussionOrError);
  };

  const expectDiscussionSelector = ({
    isLoading,
    discussion,
  }: DiscussionState) => {
    expectToEqual(discussionSelectors.isLoading(store.getState()), isLoading);
    expectToEqual(discussionSelectors.discussion(store.getState()), discussion);
  };
  const discussionToDiscussionInList = (
    discussion: DiscussionReadDto,
  ): DiscussionInList => ({
    ...discussion,
    potentialBeneficiary: {
      firstName: discussion.potentialBeneficiary.firstName,
      lastName: discussion.potentialBeneficiary.lastName,
      phone: null,
    },
    city: discussion.address.city,
    immersionObjective: null,
    exchangesData: discussionToExchangesData(discussion),
    isEstablishmentReachableByPhoneAfter15Days: false,
  });
});
