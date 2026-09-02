import {
  AgencyDtoBuilder,
  type AgencyRole,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  conventionStatusesAllowedForModification,
  type EditConventionWithFinalStatusBeneficiaryUpdate,
  type EditConventionWithFinalStatusRequestDto,
  errors,
  expectArraysToMatch,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";

import {
  type EditConventionWithFinalStatus,
  makeEditConventionWithFinalStatus,
} from "./EditConventionWithFinalStatus";

describe("EditConventionWithFinalStatus", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const agency = new AgencyDtoBuilder().build();
  const newBirthdate = "1995-03-15";
  const oldBeneficiaryBirthdate = "2002-10-05";
  const newFirstName = "Jean";
  const newLastName = "Martin";
  const newTutorEmail = "new-tutor@mail.com";

  const convention = new ConventionDtoBuilder()
    .withId(conventionId)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(agency.id)
    .withBeneficiaryBirthdate(oldBeneficiaryBirthdate)
    .withEstablishmentTutorEmail("tutor@mail.com")
    .build();

  const establishmentTutorRequest = {
    firstname: "Marie",
    lastname: "Curie",
    job: "Tuteur",
    email: newTutorEmail,
    phone: "+33601020304",
  };

  const baseRequest: EditConventionWithFinalStatusRequestDto = {
    conventionId,
    establishmentTutor: establishmentTutorRequest,
    beneficiary: {
      updatedBeneficiaryBirthDate: newBirthdate,
      firstname: newFirstName,
      lastname: newLastName,
    },
  };

  const tutorOnlyRequest: EditConventionWithFinalStatusRequestDto = {
    conventionId,
    establishmentTutor: establishmentTutorRequest,
  };

  const backOfficeAdmin = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005262")
    .withIsAdmin(true)
    .build();

  const counsellorUser = new ConnectedUserBuilder()
    .withId("bcc5c20e-6dd2-45cf-affe-927358005264")
    .withEmail("counsellor@mail.com")
    .build();

  const adminJwtPayload = { userId: backOfficeAdmin.id };
  const counsellorJwtPayload = { userId: counsellorUser.id };

  let uow: InMemoryUnitOfWork;
  let usecase: EditConventionWithFinalStatus;

  beforeEach(() => {
    uow = createInMemoryUow();
    usecase = makeEditConventionWithFinalStatus({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway: new CustomTimeGateway(),
          uuidGenerator: new TestUuidGenerator(),
        }),
      },
    });

    uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];
  });

  describe("Wrong paths", () => {
    it("throws when convention is not found", async () => {
      const nonExistentConventionId = "00000000-0000-4000-8000-000000000001";
      uow.userRepository.users = [backOfficeAdmin];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            ...baseRequest,
            conventionId: nonExistentConventionId,
          },
          adminJwtPayload,
        ),
        errors.convention.notFound({
          conventionId: nonExistentConventionId,
        }),
      );
    });

    it.each(conventionStatusesAllowedForModification)(
      "throws when convention status is not allowed (%s)",
      async (status) => {
        const conventionWithStatus = new ConventionDtoBuilder(convention)
          .withStatus(status)
          .build();
        uow.conventionRepository.setConventions([conventionWithStatus]);
        uow.userRepository.users = [backOfficeAdmin];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              ...baseRequest,
              conventionId: conventionWithStatus.id,
            },
            adminJwtPayload,
          ),
          errors.convention.editConventionWithFinalStatusNotAllowedForStatus({
            status,
            conventionId: conventionWithStatus.id,
          }),
        );
      },
    );

    it("throws when user is not authorized", async () => {
      const unauthorizedUser = new ConnectedUserBuilder()
        .withId("bcc5c20e-6dd2-45cf-affe-927358005265")
        .build();
      uow.conventionRepository.setConventions([convention]);
      uow.userRepository.users = [unauthorizedUser];
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

      await expectPromiseToFailWithError(
        usecase.execute(tutorOnlyRequest, { userId: unauthorizedUser.id }),
        errors.convention.editConventionWithFinalStatusNotAuthorizedForRole(),
      );
    });

    it("throws when user with missing rights sends beneficiary update", async () => {
      uow.conventionRepository.setConventions([convention]);
      uow.userRepository.users = [counsellorUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [counsellorUser.id]: {
            roles: ["to-review"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await expectPromiseToFailWithError(
        usecase.execute(baseRequest, counsellorJwtPayload),
        errors.user.forbidden({ userId: counsellorUser.id }),
      );
    });

    it("throws when minor above 16 years old but without representative", async () => {
      const conventionWithoutRepresentative = new ConventionDtoBuilder(
        convention,
      )
        .withBeneficiaryRepresentative(undefined)
        .build();
      const minorAbove16YearsOldBirthdate = "2007-10-01";
      uow.conventionRepository.setConventions([
        conventionWithoutRepresentative,
      ]);
      uow.userRepository.users = [backOfficeAdmin];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            ...baseRequest,
            beneficiary: {
              updatedBeneficiaryBirthDate: minorAbove16YearsOldBirthdate,
              firstname: newFirstName,
              lastname: newLastName,
            },
          },
          adminJwtPayload,
        ),
        errors.convention.invalidConventionAfterFinalStatusEdit({
          message:
            "Les bénéficiaires mineurs doivent renseigner un représentant légal. Le bénéficiaire aurait 17 ans au démarrage de la convention.",
          conventionId,
        }),
      );
    });

    it("throws when beneficiary would be under minimum age for immersion", async () => {
      const conventionWithRepresentative = new ConventionDtoBuilder(convention)
        .withBeneficiaryRepresentative({
          role: "beneficiary-representative",
          email: "rep.parent@email.fr",
          phone: "+33601010102",
          firstName: "Rep",
          lastName: "Legal",
          signedAt: new Date("2024-01-01").toISOString(),
        })
        .build();
      uow.conventionRepository.setConventions([conventionWithRepresentative]);
      uow.userRepository.users = [backOfficeAdmin];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            ...tutorOnlyRequest,
            beneficiary: {
              updatedBeneficiaryBirthDate: "2009-06-01",
              firstname: newFirstName,
              lastname: newLastName,
            },
          },
          adminJwtPayload,
        ),
        errors.convention.invalidConventionAfterFinalStatusEdit({
          message: "L'âge du bénéficiaire doit être au minimum de 16ans",
          conventionId,
        }),
      );
    });

    it.each([
      {
        role: "counsellor",
        beneficiary: {
          firstname: "updated firstname",
          lastname: "updated lastname",
        },
      },
      {
        role: "validator",
        beneficiary: { lastname: "updated lastname" },
      },
      {
        role: "agency-admin",
        beneficiary: { firstname: "updated firstname" },
      },
    ] satisfies {
      role: AgencyRole;
      beneficiary: EditConventionWithFinalStatusBeneficiaryUpdate;
    }[])(
      "throws when $role is not allowed to edit beneficiary info except birthdate",
      async ({ role, beneficiary }) => {
        const user = new ConnectedUserBuilder()
          .withId("bcc5c20e-6dd2-45cf-affe-927358005277")
          .withEmail("user@mail.com")
          .withIsAdmin(false)
          .build();

        uow.conventionRepository.setConventions([convention]);
        uow.userRepository.users = [user];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [user.id]: {
              roles: [role],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await expectPromiseToFailWithError(
          usecase.execute(
            {
              conventionId,
              beneficiary,
            },
            { userId: user.id },
          ),
          errors.user.forbidden({ userId: user.id }),
        );
      },
    );

    it("throws when establishment-representative is not allowed to edit beneficiary", async () => {
      const user = new ConnectedUserBuilder()
        .withId("bcc5c20e-6dd2-45cf-affe-927358005277")
        .withEmail(convention.signatories.establishmentRepresentative.email)
        .withIsAdmin(false)
        .build();

      uow.conventionRepository.setConventions([convention]);
      uow.userRepository.users = [user];
      uow.agencyRepository.agencies = [toAgencyWithRights(agency, {})];

      await expectPromiseToFailWithError(
        usecase.execute(
          {
            conventionId,
            beneficiary: {
              firstname: "updated firstname",
              lastname: "updated lastname",
            },
          },
          { userId: user.id },
        ),
        errors.user.forbidden({ userId: user.id }),
      );
    });
  });

  describe("Right path", () => {
    beforeEach(() => {
      uow.conventionRepository.setConventions([convention]);
    });

    it.each(["counsellor", "validator", "agency-admin"] satisfies AgencyRole[])(
      "%s can edit beneficiary birthdate",
      async (role) => {
        const user = new ConnectedUserBuilder()
          .withId("bcc5c20e-6dd2-45cf-affe-927358005277")
          .withEmail("user@mail.com")
          .withIsAdmin(false)
          .build();

        uow.userRepository.users = [user];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [user.id]: {
              roles: [role],
              isNotifiedByEmail: false,
            },
          }),
        ];

        await usecase.execute(
          {
            conventionId,
            beneficiary: { updatedBeneficiaryBirthDate: newBirthdate },
          },
          { userId: user.id },
        );

        const expectedConvention = new ConventionDtoBuilder(convention)
          .withBeneficiaryBirthdate(newBirthdate)
          .build();
        expectToEqual(uow.conventionRepository.conventions, [
          expectedConvention,
        ]);
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "ConventionWithFinalStatusEdited",
            payload: {
              convention: expectedConvention,
              triggeredBy: {
                kind: "connected-user",
                userId: user.id,
              },
            },
          },
        ]);
      },
    );

    it("does nothing when no field is provided to update", async () => {
      uow.userRepository.users = [backOfficeAdmin];

      await usecase.execute({ conventionId }, adminJwtPayload);

      expectToEqual(uow.conventionRepository.conventions, [convention]);
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("does nothing when establishment tutor and beneficiary objects are empty", async () => {
      uow.userRepository.users = [backOfficeAdmin];

      await usecase.execute(
        { conventionId, establishmentTutor: {}, beneficiary: {} },
        adminJwtPayload,
      );

      expectToEqual(uow.conventionRepository.conventions, [convention]);
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("updates beneficiary and establishment tutor and saves ConventionWithFinalStatusEdited event", async () => {
      uow.userRepository.users = [backOfficeAdmin];

      await usecase.execute(baseRequest, adminJwtPayload);

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withBeneficiaryBirthdate(newBirthdate)
        .withBeneficiaryFirstName(newFirstName)
        .withBeneficiaryLastName(newLastName)
        .withEstablishmentTutorEmail(newTutorEmail)
        .withEstablishmentTutorFirstName(establishmentTutorRequest.firstname)
        .withEstablishmentTutorLastName(establishmentTutorRequest.lastname)
        .withEstablishmentTutorJob(establishmentTutorRequest.job)
        .withEstablishmentTutorPhone(establishmentTutorRequest.phone)
        .build();
      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ConventionWithFinalStatusEdited",
          payload: {
            convention: expectedConvention,
            triggeredBy: {
              kind: "connected-user",
              userId: backOfficeAdmin.id,
            },
          },
        },
      ]);
    });

    it("updates only establishment tutor email with partial request", async () => {
      uow.userRepository.users = [counsellorUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [counsellorUser.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await usecase.execute(
        {
          conventionId,
          establishmentTutor: {
            email: newTutorEmail,
          },
        },
        counsellorJwtPayload,
      );

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutorEmail(newTutorEmail)
        .build();
      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
    });

    it("updates only beneficiary birthdate with partial request", async () => {
      uow.userRepository.users = [backOfficeAdmin];

      await usecase.execute(
        {
          conventionId,
          beneficiary: {
            updatedBeneficiaryBirthDate: newBirthdate,
          },
        },
        adminJwtPayload,
      );

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withBeneficiaryBirthdate(newBirthdate)
        .build();
      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
    });

    it("updates only establishment tutor when counsellor edits without beneficiary", async () => {
      uow.userRepository.users = [counsellorUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [counsellorUser.id]: {
            roles: ["counsellor"],
            isNotifiedByEmail: true,
          },
        }),
      ];

      await usecase.execute(tutorOnlyRequest, counsellorJwtPayload);

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutorEmail(newTutorEmail)
        .withEstablishmentTutorFirstName(establishmentTutorRequest.firstname)
        .withEstablishmentTutorLastName(establishmentTutorRequest.lastname)
        .withEstablishmentTutorJob(establishmentTutorRequest.job)
        .withEstablishmentTutorPhone(establishmentTutorRequest.phone)
        .build();
      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ConventionWithFinalStatusEdited",
          payload: {
            convention: expectedConvention,
            triggeredBy: {
              kind: "connected-user",
              userId: counsellorUser.id,
            },
          },
        },
      ]);
    });

    it("does not update establishment representative signatory when only tutor is edited", async () => {
      uow.userRepository.users = [backOfficeAdmin];

      await usecase.execute(tutorOnlyRequest, adminJwtPayload);

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutorEmail(newTutorEmail)
        .withEstablishmentTutorFirstName(establishmentTutorRequest.firstname)
        .withEstablishmentTutorLastName(establishmentTutorRequest.lastname)
        .withEstablishmentTutorJob(establishmentTutorRequest.job)
        .withEstablishmentTutorPhone(establishmentTutorRequest.phone)
        .build();

      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ConventionWithFinalStatusEdited",
          payload: {
            convention: expectedConvention,
            triggeredBy: {
              kind: "connected-user",
              userId: backOfficeAdmin.id,
            },
          },
        },
      ]);
    });

    it("allows establishment representative via magic link jwt", async () => {
      const repEmail = convention.signatories.establishmentRepresentative.email;
      const repUser = new UserBuilder().withEmail(repEmail).build();
      const repJwtPayload = createConventionMagicLinkPayload({
        id: conventionId,
        role: "establishment-representative",
        email: repEmail,
        now: new Date(),
      });

      uow.userRepository.users = [repUser];

      await usecase.execute(tutorOnlyRequest, repJwtPayload);

      const expectedConvention = new ConventionDtoBuilder(convention)
        .withEstablishmentTutorEmail(newTutorEmail)
        .withEstablishmentTutorFirstName(establishmentTutorRequest.firstname)
        .withEstablishmentTutorLastName(establishmentTutorRequest.lastname)
        .withEstablishmentTutorJob(establishmentTutorRequest.job)
        .withEstablishmentTutorPhone(establishmentTutorRequest.phone)
        .build();

      expectToEqual(uow.conventionRepository.conventions, [expectedConvention]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ConventionWithFinalStatusEdited",
          payload: {
            convention: expectedConvention,
            triggeredBy: {
              kind: "convention-magic-link",
              role: "establishment-representative",
            },
          },
        },
      ]);
    });
  });
});
