import {
  type Beneficiary,
  type ConventionAgencyPublicFields,
  type ConventionAssessmentFields,
  ConventionDtoBuilder,
  type ConventionLastRemindersFields,
  type ConventionReadDto,
  type DashboardUrlAndName,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  expectObjectsToMatch,
  expectToEqual,
  makeEmptyLastReminders,
  type SignatoryRole,
  type WithBannedEstablishmentInformations,
} from "shared";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  type ConventionState,
  conventionSlice,
  initialConventionState,
} from "./convention.slice";

describe("Convention slice", () => {
  const conventionReadDtoRemainingProps: ConventionAgencyPublicFields &
    ConventionAssessmentFields &
    ConventionLastRemindersFields &
    WithBannedEstablishmentInformations = {
    agencyDepartment: "75",
    agencyContactEmail: "contact@mail.com",
    agencyName: "some-agency-name",
    agencyKind: "france-travail",
    agencySiret: "11112222000033",
    agencyValidationSteps: "validator-only",
    assessment: null,
    lastReminders: makeEmptyLastReminders(),
    isEstablishmentBanned: false,
  };
  const convention = new ConventionDtoBuilder()
    .withStatus("READY_TO_SIGN")
    .build();

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("sets JWT in store", () => {
    const jwt = "some-jwt";
    store.dispatch(conventionSlice.actions.jwtProvided(jwt));
    expectConventionState({ jwt });
  });

  describe("Save convention", () => {
    it("saves a new convention", () => {
      store.dispatch(
        conventionSlice.actions.saveConventionRequested({
          convention: {
            ...convention,
            ...conventionReadDtoRemainingProps,
          } satisfies ConventionReadDto,
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({
        isLoading: true,
      });
      feedGatewayWithAddConventionSuccess();
      expectConventionState({
        isLoading: false,
      });

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-form"],
        {
          level: "success",
          message: "La convention a bien été créée",
          on: "create",
          title: "La convention a bien été créée",
        },
      );
      expect(store.getState().convention.convention?.status).toBe(
        "READY_TO_SIGN",
      );
      expectAddConventionToHaveBeenCalled(1);
      expectUpdateConventionToHaveBeenCalled(0);
    });

    it("saves an already existing convention base (base on presence of JWT)", () => {
      ({ store, dependencies } = createTestStore({
        convention: {
          formUi: {
            preselectedAgencyId: null,
            isMinor: false,
            isTutorEstablishmentRepresentative: true,
            hasCurrentEmployer: false,
            currentStep: 1,
            agencyDepartment: null,
            showSummary: false,
          },
          jwt: "some-correct-jwt",
          convention: null,
          conventionStatusDashboardUrl: null,
          isLoading: false,
          currentSignatoryRole: null,
          similarConventionIds: [],
        },
      }));

      store.dispatch(
        conventionSlice.actions.saveConventionRequested({
          convention: {
            ...convention,
            ...conventionReadDtoRemainingProps,
          },
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({
        isLoading: true,
      });
      feedGatewayWithUpdateConventionSuccess();
      expectConventionState({
        isLoading: false,
      });
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-form"],
        {
          level: "success",
          title: "La convention a bien été mise à jour",
          on: "update",
          message:
            "Les signataires ont reçu un email leur demandant de signer la version modifiée.",
        },
      );
      expectUpdateConventionToHaveBeenCalled(1);
      expectAddConventionToHaveBeenCalled(0);
    });

    it("shows message when something goes wrong when saving", () => {
      const convention = new ConventionDtoBuilder().build();
      store.dispatch(
        conventionSlice.actions.saveConventionRequested({
          convention: {
            ...convention,
            ...conventionReadDtoRemainingProps,
          },
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({
        isLoading: true,
      });
      const errorMessage = "Une erreur lors de la sauvegarde ! ";
      feedGatewayWithAddConventionError(new Error(errorMessage));
      expectConventionState({
        isLoading: false,
      });
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-form"],
        {
          level: "error",
          message: errorMessage,
          on: "create",
          title: "Problème lors de la création de la convention",
        },
      );
    });
  });

  describe("Get similar conventions", () => {
    it("get no similar convention", () => {
      const convention = new ConventionDtoBuilder()
        .withStatus("READY_TO_SIGN")
        .build();
      store.dispatch(
        conventionSlice.actions.getSimilarConventionsRequested({
          siret: convention.siret,
          beneficiaryBirthdate: "2023-10-01",
          dateStart: convention.dateStart,
          beneficiaryLastName: "Test",
          codeAppellation: "111222",
          feedbackTopic: "convention-form",
        }),
      );

      dependencies.conventionGateway.getSimilarConventionsResult$.next([]);

      expectToEqual(
        conventionSelectors.similarConventionIds(store.getState()),
        [],
      );
    });

    it("get similar conventions when showSummarychangeRequested is true", () => {
      const convention = new ConventionDtoBuilder()
        .withStatus("READY_TO_SIGN")
        .build();

      store.dispatch(
        conventionSlice.actions.showSummaryChangeRequested({
          showSummary: true,
          convention: {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "france-travail",
            agencySiret: "11112222000033",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        }),
      );
      dependencies.conventionGateway.getSimilarConventionsResult$.next([
        "fake-convention-id",
      ]);

      expectToEqual(
        conventionSelectors.similarConventionIds(store.getState()),
        ["fake-convention-id"],
      );
    });
  });

  describe("Get convention", () => {
    it("stores null as Convention without a convention matching in backend", () => {
      expectConventionState({
        isLoading: false,
        convention: null,
      });
      store.dispatch(
        conventionSlice.actions.fetchConventionRequested({
          jwt: "my-jwt",
          conventionId: "some-convention-id",
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({ isLoading: true });
      feedGatewayWithConvention(undefined);
      expectConventionState({
        convention: null,
        isLoading: false,
      });
    });

    it("fetch a convention with rqth beneficiary", () => {
      const beneficiary: Beneficiary<"immersion"> = {
        email: "benef@mail.com",
        role: "beneficiary",
        phone: "0614000000",
        firstName: "John",
        lastName: "Doe",
        birthdate: "1990-02-21T00:00:00.000Z",
        isRqth: true,
      };
      const convention = new ConventionDtoBuilder()
        .withBeneficiary(beneficiary)
        .build();
      const conventionRead: ConventionReadDto = {
        ...convention,
        agencyName: "agency",
        agencyDepartment: "75",
        agencyContactEmail: "contact@mail.com",
        agencyKind: "france-travail",
        agencySiret: "11112222000033",
        agencyValidationSteps: "validator-only",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };
      // tester l'état initiale
      expectConventionState({
        isLoading: false,
        convention: null,
      });

      //dispatch fetch convention
      store.dispatch(
        conventionSlice.actions.fetchConventionRequested({
          jwt: "my-jwt",
          conventionId: "some-convention-id",
          feedbackTopic: "convention-form",
        }),
      );

      //test state
      expectConventionState({
        isLoading: true,
        convention: null,
      });

      //feed gateway
      feedGatewayWithConvention(conventionRead);

      //test state
      expectConventionState({
        isLoading: false,
        convention: {
          ...conventionRead,
          signatories: {
            ...conventionRead.signatories,
            beneficiary: {
              ...beneficiary,
              isRqth: true,
            },
          },
        } as ConventionReadDto,
      });
    });

    it("stores the Convention if one matches in backend with magicLinkJwt", () => {
      const convention = new ConventionDtoBuilder().build();
      const conventionRead: ConventionReadDto = {
        ...convention,
        agencyName: "agency",
        agencyDepartment: "75",
        agencyContactEmail: "contact@mail.com",
        agencyKind: "france-travail",
        agencySiret: "11112222000033",
        agencyValidationSteps: "validator-only",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };
      expectConventionState({
        isLoading: false,
        convention: null,
      });
      store.dispatch(
        conventionSlice.actions.fetchConventionRequested({
          jwt: "my-jwt",
          conventionId: "some-convention-id",
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({ isLoading: true });
      feedGatewayWithConvention(conventionRead);
      expectConventionState({
        convention: conventionRead,
        isLoading: false,
      });
    });

    it("stores error if failure during fetch", () => {
      expectConventionState({
        isLoading: false,
        convention: null,
      });
      store.dispatch(
        conventionSlice.actions.fetchConventionRequested({
          jwt: "my-jwt",
          conventionId: "some-convention-id",
          feedbackTopic: "convention-form",
        }),
      );
      expectConventionState({ isLoading: true });
      feedGatewayWithErrorOnConventionFetch(new Error("I failed !"));
      expectConventionState({
        convention: null,
        isLoading: false,
      });
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-form"],
        {
          level: "error",
          message: "I failed !",
          on: "fetch",
          title: "Problème lors de la récupération de la convention",
        },
      );
    });

    describe("Convention formUi update based on convention data", () => {
      describe("isTutorEstablishmentRepresentative", () => {
        it("reflects formUi when get convention with tutor different from establishment representative", () => {
          const convention = new ConventionDtoBuilder()
            .withEstablishmentRepresentativeEmail("a-different@email.com")
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "cci",
            agencySiret: "11112222000044",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: false,
              isTutorEstablishmentRepresentative: false,
              hasCurrentEmployer: false,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });

        it("reflects formUi when get convention with tutor same as establishment representative", () => {
          const tutor: EstablishmentTutor = {
            email: "tutor@email.com",
            firstName: "tutorName",
            lastName: "tutorLastName",
            job: "Tutor",
            phone: "0611223344",
            role: "establishment-tutor",
          };
          const establishmentRepresentative: EstablishmentRepresentative = {
            ...tutor,
            role: "establishment-representative",
          };

          const convention = new ConventionDtoBuilder()
            .withEstablishmentTutor(tutor)
            .withEstablishmentRepresentative(establishmentRepresentative)
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "cci",
            agencySiret: "11112222000055",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: false,
              isTutorEstablishmentRepresentative: true,
              hasCurrentEmployer: false,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });
      });

      describe("isMinor", () => {
        it("reflects formUi when get convention with minor", () => {
          const convention = new ConventionDtoBuilder()
            .withBeneficiaryRepresentative({
              email: "benef-rep@rep.com",
              phone: "0102",
              firstName: "yo",
              lastName: "lo",
              role: "beneficiary-representative",
            })
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "cci",
            agencySiret: "11112222000055",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: true,
              isTutorEstablishmentRepresentative: false,
              hasCurrentEmployer: false,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });

        it("reflects formUi when get convention with not minor", () => {
          const convention = new ConventionDtoBuilder()
            .withBeneficiaryRepresentative(undefined)
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "cci",
            agencySiret: "11112222000055",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: false,
              isTutorEstablishmentRepresentative: false,
              hasCurrentEmployer: false,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });
      });

      describe("hasCurrentEmployer", () => {
        it("reflects formUi when we fetch a convention without current employer", () => {
          const convention = new ConventionDtoBuilder()
            .withBeneficiaryCurrentEmployer(undefined)
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "mission-locale",
            agencySiret: "11112222000055",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: false,
              isTutorEstablishmentRepresentative: false,
              hasCurrentEmployer: false,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });

        it("reflects formUi when we fetch a convention with current employer", () => {
          const convention = new ConventionDtoBuilder()
            .withBeneficiaryCurrentEmployer({
              businessName: "France Merguez",
              businessSiret: "12345678901234",
              email: "currentEmployer@gmail.com",
              firstName: "Current",
              lastName: "LastName",
              job: "job",
              phone: "112233445",
              role: "beneficiary-current-employer",
              businessAddress: "20 rue des merguez ",
            })
            .build();
          const conventionRead: ConventionReadDto = {
            ...convention,
            agencyName: "agency",
            agencyDepartment: "75",
            agencyContactEmail: "contact@mail.com",
            agencyKind: "mission-locale",
            agencySiret: "11112222000055",
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          };
          expectConventionState({
            isLoading: false,
            convention: null,
          });
          store.dispatch(
            conventionSlice.actions.fetchConventionRequested({
              jwt: "my-jwt",
              conventionId: "some-convention-id",
              feedbackTopic: "convention-form",
            }),
          );
          expectConventionState({ isLoading: true });
          feedGatewayWithConvention(conventionRead);
          expectConventionState({
            convention: conventionRead,
            isLoading: false,
            formUi: {
              preselectedAgencyId: null,
              isMinor: false,
              isTutorEstablishmentRepresentative: false,
              hasCurrentEmployer: true,
              currentStep: 1,
              agencyDepartment: null,
              showSummary: false,
            },
          });
        });
      });
    });
  });

  describe("Signatory data from convention selector", () => {
    it("returns null values when there is no convention", () => {
      const signatoryData = conventionSelectors.signatoryData(store.getState());
      expectToEqual(signatoryData, {
        signatory: null,
        signedAtFieldName: null,
      });
    });

    it("returns null values when no there is no current signatory", () => {
      const convention: ConventionReadDto = {
        ...new ConventionDtoBuilder().build(),
        agencyName: "My agency",
        agencyDepartment: "75",
        agencyContactEmail: "contact@mail.com",
        agencyKind: "cap-emploi",
        agencySiret: "11112222000055",
        agencyValidationSteps: "validator-only",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };
      ({ store, dependencies } = createTestStore({
        convention: {
          formUi: {
            preselectedAgencyId: null,
            isMinor: false,
            isTutorEstablishmentRepresentative: true,
            hasCurrentEmployer: false,
            currentStep: 1,
            agencyDepartment: null,
            showSummary: false,
          },
          jwt: null,
          isLoading: false,
          convention,
          conventionStatusDashboardUrl: null,
          currentSignatoryRole: null,
          similarConventionIds: [],
        },
      }));
      const signatoryData = conventionSelectors.signatoryData(store.getState());
      expectToEqual(signatoryData, {
        signatory: null,
        signedAtFieldName: null,
      });
    });

    it("selects signatory data in convention when there is convention and currentSignatoryRole", () => {
      const beneficiary: Beneficiary<"immersion"> = {
        email: "benef@mail.com",
        role: "beneficiary",
        phone: "0614000000",
        firstName: "John",
        lastName: "Doe",
        birthdate: "1990-02-21T00:00:00.000Z",
        isRqth: false,
      };
      const convention: ConventionReadDto = {
        ...new ConventionDtoBuilder().withBeneficiary(beneficiary).build(),
        agencyName: "My agency",
        agencyDepartment: "75",
        agencyContactEmail: "contact@mail.com",
        agencyKind: "conseil-departemental",
        agencySiret: "11112222000066",
        agencyValidationSteps: "validator-only",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };

      ({ store, dependencies } = createTestStore({
        convention: {
          formUi: {
            preselectedAgencyId: null,
            isMinor: false,
            isTutorEstablishmentRepresentative: true,
            hasCurrentEmployer: false,
            currentStep: 1,
            agencyDepartment: null,
            showSummary: false,
          },
          jwt: null,
          isLoading: false,
          convention,
          conventionStatusDashboardUrl: null,
          currentSignatoryRole: "beneficiary",
          similarConventionIds: [],
        },
      }));

      const signatoryData = conventionSelectors.signatoryData(store.getState());

      expectToEqual(signatoryData, {
        signatory: beneficiary,
        signedAtFieldName: "signatories.beneficiary.signedAt",
      });
    });
  });

  it("gets the dashboard Url for convention status check", () => {
    const jwt = "some-correct-jwt";
    store.dispatch(
      conventionSlice.actions.conventionStatusDashboardRequested({
        conventionId: convention.id,
        jwt,
        feedbackTopic: "convention-status-dashboard",
      }),
    );
    expectConventionState({ isLoading: true });
    const urlAndName: DashboardUrlAndName = {
      name: "conventionStatus",
      url: "https://my-dashboard.com/123",
    };
    feedGatewayWithConventionStatusDashboardUrl(urlAndName);
    expectConventionState({ conventionStatusDashboardUrl: urlAndName.url });
  });

  it("stores the error when something goes wrong when fetching the dashboard Url for convention status check", () => {
    const jwt = "some-correct-jwt";
    store.dispatch(
      conventionSlice.actions.conventionStatusDashboardRequested({
        conventionId: convention.id,
        jwt,
        feedbackTopic: "convention-status-dashboard",
      }),
    );
    expectConventionState({ isLoading: true });
    feedGatewayWithConventionStatusDashboardUrlError(new Error("Oops !"));
    expectConventionState({
      isLoading: false,
    });
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())[
        "convention-status-dashboard"
      ],
      {
        level: "error",
        message: "Oops !",
        on: "fetch",
        title:
          "Problème lors de la récupération du tableau de bord de la convention",
      },
    );
  });

  it("stores the current signatory role", () => {
    expectConventionState({ currentSignatoryRole: null });
    const newRole: SignatoryRole = "beneficiary";
    store.dispatch(
      conventionSlice.actions.currentSignatoryRoleChanged(newRole),
    );
    expectConventionState({ currentSignatoryRole: newRole });
  });

  it("changes the form current step when asked", () => {
    ({ store } = createTestStore({
      convention: {
        formUi: {
          preselectedAgencyId: null,
          isMinor: false,
          isTutorEstablishmentRepresentative: true,
          hasCurrentEmployer: false,
          currentStep: 1,
          agencyDepartment: null,
          showSummary: false,
        },
        jwt: null,
        convention: null,
        conventionStatusDashboardUrl: null,
        isLoading: false,
        currentSignatoryRole: null,
        similarConventionIds: [],
      },
    }));
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, currentStep: 1 },
    });
    store.dispatch(conventionSlice.actions.setCurrentStep(2));
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, currentStep: 2 },
    });
  });

  it("changes the form agencyDepartment when asked", () => {
    ({ store } = createTestStore({
      convention: {
        formUi: {
          preselectedAgencyId: null,
          isMinor: false,
          isTutorEstablishmentRepresentative: true,
          hasCurrentEmployer: false,
          currentStep: 1,
          agencyDepartment: null,
          showSummary: false,
        },
        jwt: null,
        convention: null,
        conventionStatusDashboardUrl: null,
        isLoading: false,
        currentSignatoryRole: null,
        similarConventionIds: [],
      },
    }));
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, agencyDepartment: null },
    });
    store.dispatch(
      conventionSlice.actions.agencyDepartementChangeRequested("86"),
    );
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, agencyDepartment: "86" },
    });
  });

  it("changes the form showSummary when asked (and populate convention if provided)", () => {
    const fakeConvention =
      new ConventionDtoBuilder().build() as ConventionReadDto;
    ({ store } = createTestStore({
      convention: {
        formUi: {
          preselectedAgencyId: null,
          isMinor: false,
          isTutorEstablishmentRepresentative: true,
          hasCurrentEmployer: false,
          currentStep: 1,
          agencyDepartment: null,
          showSummary: false,
        },
        jwt: null,
        convention: null,
        conventionStatusDashboardUrl: null,
        isLoading: false,
        currentSignatoryRole: null,
        similarConventionIds: [],
      },
    }));
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, showSummary: false },
    });
    store.dispatch(
      conventionSlice.actions.showSummaryChangeRequested({
        showSummary: true,
        convention: fakeConvention,
      }),
    );
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, showSummary: true },
      convention: fakeConvention,
    });
    store.dispatch(
      conventionSlice.actions.showSummaryChangeRequested({
        showSummary: false,
      }),
    );
    expectConventionState({
      formUi: { ...store.getState().convention.formUi, showSummary: false },
    });
  });

  it("Toggle is minor", () => {
    expectIsMinorToBe(false);

    store.dispatch(conventionSlice.actions.isMinorChanged(true));
    expectIsMinorToBe(true);

    store.dispatch(conventionSlice.actions.isMinorChanged(false));
    expectIsMinorToBe(false);
  });

  it("Toggle is tutor establishment representative", () => {
    expectIsTutorEstablishmentRepresentativeToBe(true);
    store.dispatch(
      conventionSlice.actions.isTutorEstablishmentRepresentativeChanged(false),
    );
    expectIsTutorEstablishmentRepresentativeToBe(false);
    store.dispatch(
      conventionSlice.actions.isTutorEstablishmentRepresentativeChanged(true),
    );
    expectIsTutorEstablishmentRepresentativeToBe(true);
  });

  it("Clear fetched convention", () => {
    const convention: ConventionReadDto = {
      ...new ConventionDtoBuilder().build(),
      agencyName: "agency",
      agencyDepartment: "75",
      agencyContactEmail: "contact@mail.com",
      agencyKind: "cci",
      agencySiret: "11112222000077",
      agencyValidationSteps: "validator-only",
      assessment: null,
      lastReminders: makeEmptyLastReminders(),
      isEstablishmentBanned: false,
    };
    ({ store } = createTestStore({
      convention: {
        formUi: {
          preselectedAgencyId: null,
          isMinor: true,
          isTutorEstablishmentRepresentative: true,
          hasCurrentEmployer: true,
          currentStep: 3,
          agencyDepartment: "87",
          showSummary: false,
        },
        jwt: null,
        convention,
        conventionStatusDashboardUrl: null,
        isLoading: false,
        currentSignatoryRole: null,
        similarConventionIds: [],
      },
    }));
    expectConventionState({ convention });
    store.dispatch(conventionSlice.actions.clearFetchedConvention());
    expectConventionState({
      convention: initialConventionState.convention,
      formUi: initialConventionState.formUi,
    });
  });

  const expectConventionState = (conventionState: Partial<ConventionState>) => {
    expectObjectsToMatch(store.getState().convention, conventionState);
  };

  const feedGatewayWithAddConventionSuccess = () => {
    dependencies.conventionGateway.addConventionResult$.next(undefined);
  };

  const feedGatewayWithAddConventionError = (error: Error) => {
    dependencies.conventionGateway.addConventionResult$.error(error);
  };

  const feedGatewayWithUpdateConventionSuccess = () => {
    dependencies.conventionGateway.updateConventionResult$.next(undefined);
  };

  const feedGatewayWithConventionStatusDashboardUrl = (
    params: DashboardUrlAndName,
  ) => {
    dependencies.conventionGateway.conventionDashboardUrl$.next(params);
  };

  const feedGatewayWithConventionStatusDashboardUrlError = (error: Error) => {
    dependencies.conventionGateway.conventionDashboardUrl$.error(error);
  };

  const expectAddConventionToHaveBeenCalled = (numberOfCalls: number) => {
    expect(dependencies.conventionGateway.addConventionCallCount).toBe(
      numberOfCalls,
    );
  };

  const expectUpdateConventionToHaveBeenCalled = (numberOfCalls: number) => {
    expect(dependencies.conventionGateway.updateConventionCallCount).toBe(
      numberOfCalls,
    );
  };

  const feedGatewayWithErrorOnConventionFetch = (error: Error) => {
    dependencies.conventionGateway.convention$.error(error);
  };

  const feedGatewayWithConvention = (
    convention: ConventionReadDto | undefined,
  ) => {
    dependencies.conventionGateway.convention$.next(convention);
  };

  const expectIsMinorToBe = (expected: boolean) => {
    expectToEqual(conventionSelectors.isMinor(store.getState()), expected);
  };

  const expectIsTutorEstablishmentRepresentativeToBe = (expected: boolean) => {
    expectToEqual(
      conventionSelectors.isTutorEstablishmentRepresentative(store.getState()),
      expected,
    );
  };
});
