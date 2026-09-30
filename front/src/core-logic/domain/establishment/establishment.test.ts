import {
  type ConnectedUserJwt,
  type EstablishmentPublicOption,
  errors,
  expectObjectsToMatch,
  expectToEqual,
  type FormEstablishmentDto,
  FormEstablishmentDtoBuilder,
  type SiretDto,
} from "shared";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  defaultFormEstablishmentValue,
  type EstablishmentRequestedPayload,
  type EstablishmentState,
  establishmentSlice,
} from "./establishment.slice";

describe("Establishment", () => {
  const formEstablishment = FormEstablishmentDtoBuilder.valid().build();

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    const storeAndDeps = createTestStore();
    ({ store, dependencies } = storeAndDeps);
  });

  describe("establishment fetch", () => {
    it("fetches establishment on establishment edition (JWT query params)", () => {
      expectStoreToMatchInitialState();
      const testedQueryParams: EstablishmentRequestedPayload = {
        jwt: "some-correct-jwt",
        siret: "12345678901234",
      };
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: testedQueryParams,
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.formEstablishment$.next(
        formEstablishment,
      );

      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(
        establishmentSelectors.formEstablishment(store.getState()),
        formEstablishment,
      );
    });

    it("should fail when fetching establishment on establishment edition (JWT query params) on gateway error", () => {
      expectStoreToMatchInitialState();
      const testedQueryParams: EstablishmentRequestedPayload = {
        jwt: "some-wrong-jwt",
        siret: "12345678901234",
      };
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: testedQueryParams,
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.formEstablishment$.error(
        new Error("some-error"),
      );

      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "fetch",
          level: "error",
          message: "some-error",
          title: "Problème lors de la recuperation des données de l'entreprise",
        },
      });
      expectToEqual(
        establishmentSelectors.formEstablishment(store.getState()),
        defaultFormEstablishmentValue(),
      );
    });

    it("should clear establishment", () => {
      const initialEstablishmentState: EstablishmentState = {
        isLoading: true,
        formEstablishment,
        establishmentNameAndAdmins: null,
        establishmentPublicOptions: [],
      };
      ({ store, dependencies } = createTestStore({
        establishment: initialEstablishmentState,
      }));
      expectEstablishmentStateToMatch(initialEstablishmentState);
      store.dispatch(establishmentSlice.actions.clearEstablishmentRequested());

      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);

      expectToEqual(
        establishmentSelectors.formEstablishment(store.getState()),
        defaultFormEstablishmentValue(),
      );
    });
  });

  describe("establishment creation", () => {
    it("should create establishment", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.createEstablishmentRequested({
          formEstablishment: formEstablishment,
          feedbackTopic: "form-establishment",
          jwt: "some-jwt",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.addFormEstablishmentResult$.next(
        undefined,
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "create",
          level: "success",
          message: "L'entreprise a bien été ajoutée à notre annuaire.",
          title: "L'entreprise a bien été créée",
        },
      });
    });

    it("should fail when creating establishment on gateway error", () => {
      const errorMessageFromGateway = "Submit error message not used in slice";
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.createEstablishmentRequested({
          formEstablishment: formEstablishment,
          feedbackTopic: "form-establishment",
          jwt: "some-jwt",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.addFormEstablishmentResult$.error(
        new Error(errorMessageFromGateway),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "create",
          level: "error",
          message: errorMessageFromGateway,
          title: "Problème lors de la création de l'entreprise",
        },
      });
    });
  });

  describe("establishment edition", () => {
    it("should edit requested establishment", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: {
            jwt: "previously-saved-jwt",
            siret: "12345678901234",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      dependencies.establishmentGateway.formEstablishment$.next(
        formEstablishment,
      );
      expectEstablishmentStateToMatch({
        formEstablishment,
        isLoading: false,
      });
      const editedEstablishment: FormEstablishmentDto = {
        ...formEstablishment,
        isEngagedEnterprise: !formEstablishment.isEngagedEnterprise,
        businessAddresses: [
          {
            id: "11111111-2222-4444-1111-1111111111111111",
            rawAddress: "26 rue des castors, 75002 Paris",
          },
        ],
        businessNameCustomized: "My custom name",
      };
      store.dispatch(
        establishmentSlice.actions.updateEstablishmentRequested({
          establishmentUpdate: {
            formEstablishment: editedEstablishment,
            jwt: "previously-saved-jwt",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.editFormEstablishmentResult$.next(
        undefined,
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(
        establishmentSelectors.formEstablishment(store.getState()),
        editedEstablishment,
      );
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "update",
          level: "success",
          message: "L'entreprise a bien été mise à jour",
          title: "L'entreprise a bien été mise à jour",
        },
      });
    });

    it("should fail when editing establishment on gateway error", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: {
            jwt: "previously-saved-jwt",
            siret: "12345678901234",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      dependencies.establishmentGateway.formEstablishment$.next(
        formEstablishment,
      );
      expectEstablishmentStateToMatch({
        formEstablishment,
        isLoading: false,
      });
      const editedEstablishment: FormEstablishmentDto = {
        ...formEstablishment,
        isEngagedEnterprise: !formEstablishment.isEngagedEnterprise,
        businessAddresses: [
          {
            id: "11111111-2222-4444-1111-111111111111",
            rawAddress: "26 rue des castors, 75002 Paris",
          },
        ],
        businessNameCustomized: "My custom name",
      };
      store.dispatch(
        establishmentSlice.actions.updateEstablishmentRequested({
          establishmentUpdate: {
            formEstablishment: editedEstablishment,
            jwt: "previously-saved-jwt",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.editFormEstablishmentResult$.error(
        new Error("Submit error message not used in slice"),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "update",
          level: "error",
          message: "Submit error message not used in slice",
          title: "Problème lors de la mise à jour de l'entreprise",
        },
      });
    });
  });

  describe("establishment deletion", () => {
    const backOfficeJwt: ConnectedUserJwt = "backoffice-jwt";

    it("should delete requested establishment", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: {
            jwt: backOfficeJwt,
            siret: "12345678901234",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      dependencies.establishmentGateway.formEstablishment$.next(
        formEstablishment,
      );
      expectEstablishmentStateToMatch({
        formEstablishment,
        isLoading: false,
      });

      store.dispatch(
        establishmentSlice.actions.deleteEstablishmentRequested({
          establishmentDelete: {
            siret: formEstablishment.siret,
            jwt: backOfficeJwt,
          },
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.deleteEstablishmentResult$.next(
        undefined,
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "delete",
          level: "success",
          message: "L'entreprise a bien été supprimée",
          title: "L'entreprise a bien été supprimée",
        },
      });
    });

    it("should fail when editing establishment on gateway error", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentRequested({
          establishmentRequested: {
            jwt: backOfficeJwt,
            siret: "12345678901234",
          },
          feedbackTopic: "form-establishment",
        }),
      );
      dependencies.establishmentGateway.formEstablishment$.next(
        formEstablishment,
      );
      expectEstablishmentStateToMatch({
        formEstablishment,
        isLoading: false,
      });
      store.dispatch(
        establishmentSlice.actions.deleteEstablishmentRequested({
          establishmentDelete: {
            siret: formEstablishment.siret,
            jwt: backOfficeJwt,
          },
          feedbackTopic: "form-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.deleteEstablishmentResult$.error(
        new Error("Deletion error message not used in slice"),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "form-establishment": {
          on: "delete",
          level: "error",
          message: "Deletion error message not used in slice",
          title: "Problème lors de la suppression de l'entreprise",
        },
      });
    });
  });

  describe("establishment admins fetch", () => {
    const siret: SiretDto = "12345123451234";
    const jwt: ConnectedUserJwt = "jwt";

    it("fetches establishment admins successfully", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentNameAndAdminsRequested({
          siret,
          jwt,
          feedbackTopic: "form-establishment",
        }),
      );
      expectEstablishmentStateToMatch({
        isLoading: true,
        establishmentNameAndAdmins: null,
      });

      const expectedResponse = {
        name: "Truc Corp",
        adminEmails: ["admin1@corp.com", "admin2@corp.com"],
      };
      dependencies.establishmentGateway.establishmentAdmins$.next(
        expectedResponse,
      );

      expectEstablishmentStateToMatch({
        isLoading: false,
        establishmentNameAndAdmins: expectedResponse,
      });
    });

    it("fetches establishment admins - establishment not found", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentNameAndAdminsRequested({
          siret,
          jwt,
          feedbackTopic: "form-establishment",
        }),
      );
      expectEstablishmentStateToMatch({
        isLoading: true,
        establishmentNameAndAdmins: null,
      });

      dependencies.establishmentGateway.establishmentAdmins$.error(
        errors.establishment.notFound({ siret: "12345123451234" }),
      );

      expectEstablishmentStateToMatch({
        isLoading: false,
        establishmentNameAndAdmins: "establishmentNotFound",
      });
    });

    it("fetches establishment admins failed", () => {
      expectStoreToMatchInitialState();
      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentNameAndAdminsRequested({
          siret,
          jwt,
          feedbackTopic: "form-establishment",
        }),
      );
      expectEstablishmentStateToMatch({
        isLoading: true,
        establishmentNameAndAdmins: null,
      });

      dependencies.establishmentGateway.establishmentAdmins$.error(
        new Error("Failed"),
      );

      expectEstablishmentStateToMatch({
        isLoading: false,
        establishmentNameAndAdmins: null,
      });
    });
  });

  describe("establishment public options", () => {
    it("successfully fetched establishment public options from gateway", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentPublicOptionsRequested({
          feedbackTopic: "establishment-user-registration",
          filters: {},
          jwt: "any-connected-user-jwt",
        }),
      );
      expect(establishmentSelectors.isLoading(store.getState())).toBe(true);
      const establishmentPublicOption: EstablishmentPublicOption = {
        businessName: "L'omelette de la mère Poulard",
        siret: "10000000000000",
        isEstablishmentBanned: false,
      };

      dependencies.establishmentGateway.establishmentPublicOptions$.next([
        establishmentPublicOption,
      ]);

      expectToEqual(
        establishmentSelectors.establishmentPublicOptions(store.getState()),
        [establishmentPublicOption],
      );
      expect(establishmentSelectors.isLoading(store.getState())).toBe(false);
    });

    it("failed to fetched establishment public options from gateway", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.fetchEstablishmentPublicOptionsRequested({
          feedbackTopic: "establishment-user-registration",
          filters: {},
          jwt: "any-connected-user-jwt",
        }),
      );
      expect(establishmentSelectors.isLoading(store.getState())).toBe(true);

      const expectedError = new Error(
        "Error fetching establishment public options",
      );
      dependencies.establishmentGateway.establishmentPublicOptions$.error(
        expectedError,
      );

      expect(establishmentSelectors.isLoading(store.getState())).toBe(false);

      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "establishment-user-registration": {
          on: "fetch",
          level: "error",
          message: expectedError.message,
          title: "Problème lors de la récupération des entreprises",
        },
      });
    });
  });

  describe("user registration on establishment", () => {
    it("successfully registered user on establishment", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.userRegistrationOnEstablishmentRequested({
          siret: "12345123451234",
          userRight: {
            email: "test@test.com",
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          jwt: "any-connected-user-jwt",
          feedbackTopic: "establishment-user-registration",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.userRegistrationOnEstablishmentResult$.next(
        undefined,
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "establishment-user-registration": {
          on: "create",
          level: "success",
          message:
            "Elle sera étudiée prochainement par un administrateur de l'entreprise et vous serez informé de sa décision.",
          title: "Votre demande d'accès a bien été prise en compte",
        },
      });
    });

    it("failed to register user on establishment on gateway error", () => {
      expectStoreToMatchInitialState();

      store.dispatch(
        establishmentSlice.actions.userRegistrationOnEstablishmentRequested({
          siret: "12345123451234",
          userRight: {
            email: "test@test.com",
            role: "establishment-contact",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
          jwt: "any-connected-user-jwt",
          feedbackTopic: "establishment-user-registration",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.establishmentGateway.userRegistrationOnEstablishmentResult$.error(
        new Error("Failed to register user on establishment"),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "establishment-user-registration": {
          on: "create",
          level: "error",
          message: "Failed to register user on establishment",
          title:
            "Problème lors de l'enregistrement de l'utilisateur sur l'entreprise",
        },
      });
    });
  });

  describe("ban establishment", () => {
    it("should ban an establishment", () => {
      const adminJwt: ConnectedUserJwt = "admin-jwt";
      store.dispatch(
        establishmentSlice.actions.banEstablishmentRequested({
          siret: formEstablishment.siret,
          establishmentBannishmentJustification: "Raison du bannissement",
          jwt: adminJwt,
          feedbackTopic: "ban-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.adminGateway.banEstablishmentResponse$.next(undefined);
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "ban-establishment": {
          on: "create",
          level: "success",
          title: "L'entreprise a bien été bannie",
          message:
            "Le SIRET a été ajouté à la blacklist d’Immersion Facilitée.",
        },
      });
    });

    it("should fail when banning an establishment on gateway error", () => {
      const adminJwt: ConnectedUserJwt = "admin-jwt";
      store.dispatch(
        establishmentSlice.actions.banEstablishmentRequested({
          siret: formEstablishment.siret,
          establishmentBannishmentJustification: "Raison du bannissement",
          jwt: adminJwt,
          feedbackTopic: "ban-establishment",
        }),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), true);
      dependencies.adminGateway.banEstablishmentResponse$.error(
        new Error("Ban failed"),
      );
      expectToEqual(establishmentSelectors.isLoading(store.getState()), false);
      expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
        "ban-establishment": {
          on: "create",
          level: "error",
          title: "Impossible de bannir l'entreprise",
          message: "Ban failed",
        },
      });
    });
  });

  const expectStoreToMatchInitialState = () =>
    expectEstablishmentStateToMatch({
      isLoading: false,
      formEstablishment: defaultFormEstablishmentValue(),
      establishmentNameAndAdmins: null,
    });
  const expectEstablishmentStateToMatch = (
    expected: Partial<EstablishmentState>,
  ) => expectObjectsToMatch(store.getState().establishment, expected);
});
