import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyRole,
  ConnectedUserBuilder,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionRole,
  type ConventionStatus,
  conventionStatuses,
  type EstablishmentTutor,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type Role,
  type SignatoryRole,
  statusTransitionConfigs,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeHashByRolesForTest } from "../../../utils/emailHash";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeUpdateConvention,
  type UpdateConvention,
} from "./UpdateConvention";

describe("Update Convention", () => {
  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin-user-id")
    .withIsAdmin(true)
    .buildUser();
  const validatorUser = new ConnectedUserBuilder()
    .withId("validator-user-id")
    .withEmail("validator@email.com")
    .buildUser();
  const counsellorUser = new ConnectedUserBuilder()
    .withId("counsellor-user-id")
    .withEmail("counsellor@email.com")
    .buildUser();
  const agency = new AgencyDtoBuilder().build();
  const agencyWithRefersTo = new AgencyDtoBuilder(agency)
    .withRefersToAgencyInfo({
      refersToAgencyId: "another-agency-id" as AgencyId,
      refersToAgencyName: "Another Agency",
      refersToAgencyContactEmail: "another-agency-contact@mail.com",
    })
    .build();
  const agencyWithoutRefersTo = new AgencyDtoBuilder(agency)
    .withRefersToAgencyInfo(null)
    .build();
  const convention = new ConventionDtoBuilder()
    .withStatus("READY_TO_SIGN")
    .withBeneficiaryCurrentEmployer({
      role: "beneficiary-current-employer",
      firstName: "Jean",
      lastName: "L'employeur actuel du beneficiaire",
      email: "jean.l.employeur@mail.com",
      phone: "+33112233445",
      job: "Boss",
      businessSiret: "01234567891234",
      businessName: "business",
      businessAddress: "Rue des Bouchers 67065 Strasbourg",
    })
    .withBeneficiaryRepresentative({
      role: "beneficiary-representative",
      firstName: "Joe",
      lastName: "Le représentant du beneficiaire",
      email: "joe.le.representant@mail.com",
      phone: "+33112233445",
    })
    .withAgencyId(agency.id)
    .notSigned()
    .build();

  const signedAt = "2024-10-04T00:00:00.000Z";
  const makeFullySignedConventionBuilder = (convention: ConventionDto) =>
    new ConventionDtoBuilder(convention)
      .signedByBeneficiary(signedAt)
      .signedByBeneficiaryRepresentative(signedAt)
      .signedByEstablishmentRepresentative(signedAt)
      .withBeneficiaryCurrentEmployer(
        convention.signatories.beneficiaryCurrentEmployer
          ? {
              ...convention.signatories.beneficiaryCurrentEmployer,
              signedAt,
            }
          : undefined,
      );

  const acceptedByCounsellorConvention = makeFullySignedConventionBuilder(
    convention,
  )
    .withStatus("ACCEPTED_BY_COUNSELLOR")
    .build();

  const connectedUser = new ConnectedUserBuilder()
    .withId("connected-user-id")
    .build();
  const notConnectedUser = new UserBuilder()
    .withEmail("notconnecteduser@mail.com")
    .build();
  let updateConvention: UpdateConvention;
  let createNewEvent: CreateNewEvent;
  let uowPerformer: InMemoryUowPerformer;
  let uow: InMemoryUnitOfWork;
  let timeGateway: TimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    uow.userRepository.users = [backofficeAdminUser];

    createNewEvent = makeCreateNewEvent({
      timeGateway: new CustomTimeGateway(),
      uuidGenerator: new TestUuidGenerator(),
    });

    uowPerformer = new InMemoryUowPerformer(uow);

    updateConvention = makeUpdateConvention({
      uowPerformer,
      deps: {
        createNewEvent,
        timeGateway,
      },
    });

    uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
  });

  describe("Wrong path", () => {
    describe("when user is not allowed", () => {
      describe("with connected user", () => {
        it("throws not found if connected user does not exist", async () => {
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.conventionRepository.setConventions([convention]);

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention,
              },
              { userId: connectedUser.id },
            ),
            errors.user.notFound({ userId: connectedUser.id }),
          );
        });

        it("throws unauthorized if user has no rights on agency", async () => {
          uow.conventionRepository.setConventions([convention]);
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.userRepository.users = [connectedUser];

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention,
              },
              { userId: connectedUser.id },
            ),
            errors.convention.updateForbidden({ id: convention.id }),
          );
        });

        it("throws forbidden if connected user email is not linked to the convention", async () => {
          const userWithNoRightOnConvention = new ConnectedUserBuilder()
            .withId("unrelated-user-id")
            .withEmail("unrelated@mail.com")
            .buildUser();

          uow.conventionRepository.setConventions([convention]);
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.userRepository.users = [userWithNoRightOnConvention];

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention,
              },
              { userId: userWithNoRightOnConvention.id },
            ),
            errors.convention.updateForbidden({ id: convention.id }),
          );
        });

        it.each([
          "agency-viewer",
          "agency-admin",
          "to-review",
        ] as AgencyRole[])("throws unauthorized if user has not enough rights on agency and is not backoffice admin neither establishment-representative on convention", async (role) => {
          uow.conventionRepository.setConventions([convention]);
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [connectedUser.id]: {
                roles: [role],
                isNotifiedByEmail: false,
              },
            }),
          ];
          uow.userRepository.users = [connectedUser];

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention,
              },
              { userId: connectedUser.id },
            ),
            errors.convention.updateForbidden({ id: convention.id }),
          );
        });

        it("throws unauthorized if validator tries to edit ACCEPTED_BY_COUNSELLOR convention with agency that has refersToAgencyId", async () => {
          const conventionToUpdate = new ConventionDtoBuilder(
            acceptedByCounsellorConvention,
          )
            .withStatus("READY_TO_SIGN")
            .build();

          uow.conventionRepository.setConventions([
            acceptedByCounsellorConvention,
          ]);
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agencyWithRefersTo, {
              [connectedUser.id]: {
                roles: ["validator"],
                isNotifiedByEmail: false,
              },
            }),
          ];
          uow.userRepository.users = [connectedUser];

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention: conventionToUpdate,
              },
              { userId: connectedUser.id },
            ),
            errors.convention.validatorOfAgencyRefersToNotAllowed(),
          );
        });
      });

      describe("with convention jwt payload", () => {
        it("throws if convention id does not match the one in jwt payload", async () => {
          uow.conventionRepository.setConventions([convention]);

          const requestedConventionId = "1dd5c20e-6dd2-45af-affe-927358005250";
          const emailHash = "yolo";
          const role = "beneficiary";

          const jwtPayload: ConventionDomainJwtPayload = {
            applicationId: requestedConventionId,
            role,
            emailHash,
          };

          await expectPromiseToFailWithError(
            updateConvention.execute({ convention }, jwtPayload),
            errors.convention.forbiddenConventionIdMismatch({
              jwtConventionId: jwtPayload.applicationId,
              jwtRole: jwtPayload.role,
              requestedConventionId: convention.id,
            }),
          );
        });

        it.each([
          "to-review",
          "agency-viewer",
          "agency-admin",
          "establishment-tutor",
        ] satisfies Role[])("throws forbiden if user role is not allowed", async (role) => {
          uow.conventionRepository.setConventions([convention]);

          const jwtPayload = createConventionMagicLinkPayload({
            id: convention.id,
            role: role as ConventionRole,
            email: notConnectedUser.email,
            now: new Date(),
          });

          await expectPromiseToFailWithError(
            updateConvention.execute(
              {
                convention,
              },
              jwtPayload,
            ),
            errors.convention.updateForbidden({
              id: convention.id,
            }),
          );
        });
      });
    });

    it("throws NotFoundError when convention does not exist", async () => {
      const id = "add5c20e-6dd2-45af-affe-927358005251";
      const validConvention = new ConventionDtoBuilder()
        .withStatus("READY_TO_SIGN")
        .withId(id)
        .withStatusJustification("justif")
        .build();

      await expectPromiseToFailWithError(
        updateConvention.execute(
          { convention: validConvention },
          { userId: backofficeAdminUser.id },
        ),
        errors.convention.notFound({ conventionId: id }),
      );
    });

    it.each([
      "REJECTED",
      "CANCELLED",
      "DEPRECATED",
      "ACCEPTED_BY_VALIDATOR",
    ] as ConventionStatus[])("rejects when convention initial status is %s", async (initialStatus: ConventionStatus) => {
      const storedConvention = new ConventionDtoBuilder()
        .withStatus(initialStatus)
        .build();

      uow.conventionRepository.setConventions([storedConvention]);

      const updatedConvention = new ConventionDtoBuilder()
        .withId(storedConvention.id)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .build();

      await expectPromiseToFailWithError(
        updateConvention.execute(
          {
            convention: updatedConvention,
          },
          {
            applicationId: storedConvention.id,
            role: "beneficiary",
            emailHash: makeHashByRolesForTest(
              convention,
              counsellorUser,
              validatorUser,
            ).beneficiary,
          },
        ),
        errors.convention.updateBadStatusInRepo({
          id: storedConvention.id,
          status: storedConvention.status,
        }),
      );
    });

    it.each(
      conventionStatuses.filter((status) => status !== "READY_TO_SIGN"),
    )("rejects applications if the updated convention status is not READY_TO_SIGN", async (status: ConventionStatus) => {
      const convention = new ConventionDtoBuilder().withStatus(status).build();

      uow.conventionRepository.setConventions([convention]);

      await expectPromiseToFailWithError(
        updateConvention.execute(
          { convention },
          { userId: backofficeAdminUser.id },
        ),
        errors.convention.updateBadStatusInParams({ id: convention.id }),
      );
    });
    it("throws if convention already updated when user try to update it", async () => {
      const updatedAt = "2025-01-01";
      const firstUpdatedConvention = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("first-justification")
        .withUpdatedAt(addDays(new Date(updatedAt), 1).toISOString())
        .build();
      uow.conventionRepository.setConventions([firstUpdatedConvention]);

      const conventionToUpdate = new ConventionDtoBuilder(
        firstUpdatedConvention,
      )
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("new-justification")
        .withUpdatedAt(updatedAt)
        .build();

      await expectPromiseToFailWithError(
        updateConvention.execute(
          { convention: conventionToUpdate },
          { userId: backofficeAdminUser.id },
        ),
        errors.convention.conventionGotUpdatedWhileUpdating(),
      );
    });
  });

  describe("Right path", () => {
    it.each([
      {
        applicationId: convention.id,
        role: "beneficiary",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        ).beneficiary,
        makeExpectedUpdatedConvention: (
          updatedConvention: ConventionDto,
          signedAt: string,
        ) =>
          new ConventionDtoBuilder(updatedConvention)
            .withStatus("PARTIALLY_SIGNED")
            .signedByBeneficiary(signedAt)
            .build(),
      },
      {
        applicationId: convention.id,
        role: "beneficiary-current-employer",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        )["beneficiary-current-employer"],
        makeExpectedUpdatedConvention: (
          updatedConvention: ConventionDto,
          signedAt: string,
        ) => {
          const beneficiaryCurrentEmployer =
            updatedConvention.signatories.beneficiaryCurrentEmployer;
          if (!beneficiaryCurrentEmployer)
            throw new Error(
              "Expected convention to have a beneficiary current employer.",
            );
          return new ConventionDtoBuilder(updatedConvention)
            .withStatus("PARTIALLY_SIGNED")
            .withBeneficiaryCurrentEmployer({
              ...beneficiaryCurrentEmployer,
              signedAt,
            })
            .build();
        },
      },
      {
        applicationId: convention.id,
        role: "beneficiary-representative",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        )["beneficiary-representative"],
        makeExpectedUpdatedConvention: (
          updatedConvention: ConventionDto,
          signedAt: string,
        ) =>
          new ConventionDtoBuilder(updatedConvention)
            .withStatus("PARTIALLY_SIGNED")
            .signedByBeneficiaryRepresentative(signedAt)
            .build(),
      },
      {
        applicationId: convention.id,
        role: "establishment-representative",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        )["establishment-representative"],
        makeExpectedUpdatedConvention: (
          updatedConvention: ConventionDto,
          signedAt: string,
        ) =>
          new ConventionDtoBuilder(updatedConvention)
            .withStatus("PARTIALLY_SIGNED")
            .signedByEstablishmentRepresentative(signedAt)
            .build(),
      },
    ] satisfies (ConventionDomainJwtPayload & {
      role: SignatoryRole;
      makeExpectedUpdatedConvention: (
        updatedConvention: ConventionDto,
        signedAt: string,
      ) => ConventionDto;
    })[])("updates the Convention in the repository when updated by signatories user", async (payload) => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
      uow.conventionRepository.setConventions([convention]);

      const updatedConvention = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .withBeneficiaryEmail("new@email.fr")
        .withStatusJustification("justif")
        .build();

      await updateConvention.execute(
        { convention: updatedConvention },
        payload,
      );

      const signedAt = timeGateway.now().toISOString();
      const expectedUpdatedConvention = payload.makeExpectedUpdatedConvention(
        updatedConvention,
        signedAt,
      );

      expectToEqual(uow.conventionRepository.conventions, [
        expectedUpdatedConvention,
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        createNewEvent({
          topic: "ConventionModifiedAndSigned",
          payload: {
            convention: expectedUpdatedConvention,
            triggeredBy: {
              kind: "convention-magic-link",
              role: payload.role,
            },
          },
        }),
      ]);
    });

    describe("when connected user is a signatory", () => {
      describe("beneficiary", () => {
        const beneficiaryUser = new ConnectedUserBuilder()
          .withId("beneficiary-user-id")
          .withEmail(convention.signatories.beneficiary.email)
          .buildUser();
        const storedConvention = new ConventionDtoBuilder(convention)
          .withStatus("PARTIALLY_SIGNED")
          .signedByEstablishmentRepresentative(signedAt)
          .build();

        it("updates, clears signatures and re-signs without changing email", async () => {
          uow.userRepository.users = [beneficiaryUser];
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.conventionRepository.setConventions([storedConvention]);

          const updatedConvention = new ConventionDtoBuilder(storedConvention)
            .withStatus("READY_TO_SIGN")
            .withStatusJustification("justif")
            .notSigned()
            .build();

          await updateConvention.execute(
            { convention: updatedConvention },
            { userId: beneficiaryUser.id },
          );

          const expectedSignedAt = timeGateway.now().toISOString();
          const expectedUpdatedConvention = new ConventionDtoBuilder(
            updatedConvention,
          )
            .withStatus("PARTIALLY_SIGNED")
            .signedByBeneficiary(expectedSignedAt)
            .build();

          expectToEqual(uow.conventionRepository.conventions, [
            expectedUpdatedConvention,
          ]);
          expectArraysToMatch(uow.outboxRepository.events, [
            createNewEvent({
              topic: "ConventionModifiedAndSigned",
              payload: {
                convention: expectedUpdatedConvention,
                triggeredBy: {
                  kind: "connected-user",
                  userId: beneficiaryUser.id,
                },
              },
            }),
          ]);
        });

        it("updates, clears signatures and re-signs when email changes", async () => {
          uow.userRepository.users = [beneficiaryUser];
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.conventionRepository.setConventions([storedConvention]);

          const updatedConvention = new ConventionDtoBuilder(storedConvention)
            .withStatus("READY_TO_SIGN")
            .withBeneficiaryEmail("new@email.fr")
            .withStatusJustification("justif")
            .notSigned()
            .build();

          await updateConvention.execute(
            { convention: updatedConvention },
            { userId: beneficiaryUser.id },
          );

          const expectedSignedAt = timeGateway.now().toISOString();
          const expectedUpdatedConvention = new ConventionDtoBuilder(
            updatedConvention,
          )
            .withStatus("PARTIALLY_SIGNED")
            .signedByBeneficiary(expectedSignedAt)
            .build();

          expectToEqual(uow.conventionRepository.conventions, [
            expectedUpdatedConvention,
          ]);
          expectArraysToMatch(uow.outboxRepository.events, [
            createNewEvent({
              topic: "ConventionModifiedAndSigned",
              payload: {
                convention: expectedUpdatedConvention,
                triggeredBy: {
                  kind: "connected-user",
                  userId: beneficiaryUser.id,
                },
              },
            }),
          ]);
        });
      });

      describe("establishment representative", () => {
        const establishmentRepresentativeUser = new ConnectedUserBuilder()
          .withId("establishment-representative-user-id")
          .withEmail(convention.signatories.establishmentRepresentative.email)
          .buildUser();
        const storedConvention = new ConventionDtoBuilder(convention)
          .withStatus("PARTIALLY_SIGNED")
          .signedByBeneficiary(signedAt)
          .build();

        it("updates, clears signatures and re-signs without changing email", async () => {
          uow.userRepository.users = [establishmentRepresentativeUser];
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.conventionRepository.setConventions([storedConvention]);

          const updatedConvention = new ConventionDtoBuilder(storedConvention)
            .withStatus("READY_TO_SIGN")
            .withStatusJustification("justif")
            .notSigned()
            .build();

          await updateConvention.execute(
            { convention: updatedConvention },
            { userId: establishmentRepresentativeUser.id },
          );

          const expectedSignedAt = timeGateway.now().toISOString();
          const expectedUpdatedConvention = new ConventionDtoBuilder(
            updatedConvention,
          )
            .withStatus("PARTIALLY_SIGNED")
            .signedByEstablishmentRepresentative(expectedSignedAt)
            .build();

          expectToEqual(uow.conventionRepository.conventions, [
            expectedUpdatedConvention,
          ]);
          expectArraysToMatch(uow.outboxRepository.events, [
            createNewEvent({
              topic: "ConventionModifiedAndSigned",
              payload: {
                convention: expectedUpdatedConvention,
                triggeredBy: {
                  kind: "connected-user",
                  userId: establishmentRepresentativeUser.id,
                },
              },
            }),
          ]);
        });

        it("updates, clears signatures and re-signs when email changes", async () => {
          uow.userRepository.users = [establishmentRepresentativeUser];
          uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
          uow.conventionRepository.setConventions([storedConvention]);

          const updatedConvention = new ConventionDtoBuilder(storedConvention)
            .withStatus("READY_TO_SIGN")
            .withEstablishmentRepresentativeEmail("new-rep@email.fr")
            .withStatusJustification("justif")
            .notSigned()
            .build();

          await updateConvention.execute(
            { convention: updatedConvention },
            { userId: establishmentRepresentativeUser.id },
          );

          const expectedSignedAt = timeGateway.now().toISOString();
          const expectedUpdatedConvention = new ConventionDtoBuilder(
            updatedConvention,
          )
            .withStatus("PARTIALLY_SIGNED")
            .signedByEstablishmentRepresentative(expectedSignedAt)
            .build();

          expectToEqual(uow.conventionRepository.conventions, [
            expectedUpdatedConvention,
          ]);
          expectArraysToMatch(uow.outboxRepository.events, [
            createNewEvent({
              topic: "ConventionModifiedAndSigned",
              payload: {
                convention: expectedUpdatedConvention,
                triggeredBy: {
                  kind: "connected-user",
                  userId: establishmentRepresentativeUser.id,
                },
              },
            }),
          ]);
        });
      });
    });

    it.each([
      {
        applicationId: convention.id,
        role: "validator",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        ).validator,
      },
      {
        applicationId: convention.id,
        role: "counsellor",
        emailHash: makeHashByRolesForTest(
          convention,
          counsellorUser,
          validatorUser,
        ).counsellor,
      },
      { userId: backofficeAdminUser.id },
      { userId: validatorUser.id },
      { userId: counsellorUser.id },
    ] as (
      | ConventionDomainJwtPayload
      | ConnectedUserDomainJwtPayload
    )[])("updates the Convention in the repository updated by non signatories user", async (payload) => {
      uow.userRepository.users = [
        validatorUser,
        counsellorUser,
        backofficeAdminUser,
      ];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validatorUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: true,
          },
          [counsellorUser.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
        }),
      ];
      uow.conventionRepository.setConventions([convention]);

      const updatedConvention = new ConventionDtoBuilder(convention)
        .withStatus("READY_TO_SIGN")
        .withBeneficiaryEmail("new@email.fr")
        .withStatusJustification("justif")
        .build();

      await updateConvention.execute(
        { convention: updatedConvention },
        payload,
      );
      expectToEqual(uow.conventionRepository.conventions, [updatedConvention]);
      expectToEqual(uow.outboxRepository.events, [
        createNewEvent({
          topic: "ConventionSubmittedAfterModification",
          payload: {
            convention: updatedConvention,
            triggeredBy: {
              ...("userId" in payload
                ? {
                    kind: "connected-user",
                    userId: payload.userId,
                  }
                : {
                    kind: "convention-magic-link",
                    role: payload.role,
                  }),
            },
          },
        }),
      ]);
    });

    it("With tutor different of establishment representative", async () => {
      const tutor: EstablishmentTutor = {
        role: "establishment-tutor",
        firstName: "Bob",
        lastName: "Harrys",
        email: "bob.harry@mail.com",
        phone: "+33112233445",
        job: "tutor",
      };
      const storedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutor(tutor)
        .withEstablishmentRepresentative({
          ...tutor,
          role: "establishment-representative",
        })
        .build();

      uow.conventionRepository.setConventions([storedConvention]);

      const updatedConvention = new ConventionDtoBuilder(storedConvention)
        .withStatus("READY_TO_SIGN")
        .withEstablishmentRepresentative({
          role: "establishment-representative",
          firstName: "Martin",
          lastName: "Hills",
          email: "martin.hills@mail.com",
          phone: "+33112233445",
        })
        .build();

      await updateConvention.execute(
        {
          convention: updatedConvention,
        },
        { userId: backofficeAdminUser.id },
      );
      expectToEqual(uow.conventionRepository.conventions, [updatedConvention]);
    });

    it("clears dateApproval when updating convention", async () => {
      const storedConvention = new ConventionDtoBuilder(convention)
        .withDateApproval("2024-01-15T10:00:00.000Z")
        .build();

      uow.conventionRepository.setConventions([storedConvention]);

      const updatedConvention = new ConventionDtoBuilder(storedConvention)
        .withStatus("READY_TO_SIGN")
        .withBeneficiaryEmail("new@email.fr")
        .withStatusJustification("justif")
        .build();

      await updateConvention.execute(
        {
          convention: updatedConvention,
        },
        { userId: backofficeAdminUser.id },
      );

      expectToEqual(uow.conventionRepository.conventions, [
        {
          ...updatedConvention,
          dateApproval: undefined,
        },
      ]);
    });

    it.each(
      statusTransitionConfigs.READY_TO_SIGN.validInitialStatuses,
    )("allows when convention initial status is %s", async (initialStatus: ConventionStatus) => {
      const statusesNeedingAllSignatures: ConventionStatus[] = [
        "IN_REVIEW",
        "ACCEPTED_BY_COUNSELLOR",
      ];
      const storedConvention = (
        statusesNeedingAllSignatures.includes(initialStatus)
          ? makeFullySignedConventionBuilder(convention)
          : new ConventionDtoBuilder(convention)
      )
        .withStatus(initialStatus)
        .build();

      uow.conventionRepository.setConventions([storedConvention]);

      const updatedConvention = new ConventionDtoBuilder(storedConvention)
        .withStatus("READY_TO_SIGN")
        .withStatusJustification("justif")
        .notSigned()
        .build();

      await updateConvention.execute(
        { convention: updatedConvention },
        { userId: backofficeAdminUser.id },
      );

      expectToEqual(uow.conventionRepository.conventions, [updatedConvention]);
    });

    describe("when convention status is ACCEPTED_BY_COUNSELLOR", () => {
      const conventionToUpdate = new ConventionDtoBuilder(
        acceptedByCounsellorConvention,
      )
        .withStatus("READY_TO_SIGN")
        .withBeneficiaryEmail("new@email.fr")
        .withStatusJustification("justif")
        .notSigned()
        .build();

      beforeEach(() => {
        uow.conventionRepository.setConventions([
          acceptedByCounsellorConvention,
        ]);
        uow.userRepository.users = [connectedUser];
      });
      it("allows counsellor to edit convention with agency that has refersToAgencyId", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithRefersTo, {
            [connectedUser.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await updateConvention.execute(
          {
            convention: conventionToUpdate,
          },
          { userId: connectedUser.id },
        );

        expectToEqual(uow.conventionRepository.conventions, [
          conventionToUpdate,
        ]);
      });

      it("allows validator to edit convention with agency that has no refersToAgencyId", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithoutRefersTo, {
            [connectedUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await updateConvention.execute(
          {
            convention: conventionToUpdate,
          },
          { userId: connectedUser.id },
        );

        expectToEqual(uow.conventionRepository.conventions, [
          conventionToUpdate,
        ]);
      });

      it("allows counsellor to edit convention with agency that has no refersToAgencyId", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithoutRefersTo, {
            [connectedUser.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await updateConvention.execute(
          {
            convention: conventionToUpdate,
          },
          { userId: connectedUser.id },
        );

        expectToEqual(uow.conventionRepository.conventions, [
          conventionToUpdate,
        ]);
      });
    });
  });
});
