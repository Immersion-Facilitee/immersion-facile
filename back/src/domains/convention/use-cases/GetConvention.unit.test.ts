import { addYears } from "date-fns";
import {
  AgencyDtoBuilder,
  type ApiConsumer,
  type ApiConsumerRights,
  AssessmentDtoBuilder,
  type BanEstablishmentPayload,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  type ConventionRole,
  defaultProConnectInfos,
  errors,
  establishmentsRoles,
  expectPromiseToFailWithError,
  expectToEqual,
  makeEmptyLastReminders,
  type Notification,
  type Role,
  type User,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeEmailHash } from "../../../utils/jwt";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../establishment/helpers/EstablishmentBuilders";
import { createAssessmentEntity } from "../entities/AssessmentEntity";
import { type GetConvention, makeGetConvention } from "./GetConvention";

describe("Get Convention", () => {
  const uuidGenerator = new UuidV4Generator();
  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.fr")
    .build();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.fr")
    .build();
  const johnDoe: User = {
    id: "johndoe",
    email: "my-user@email.com",
    firstName: "John",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };
  const pendingUser: User = {
    id: "pendinguser",
    email: "pending@mail.com",
    firstName: "Pending",
    lastName: "User",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };
  const establishmentRep: User = {
    id: "estabrep",
    email: "estabrep@mail.com",
    firstName: "John",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };
  const beneficiary: User = {
    id: "beneficiary",
    email: "beneficiary@email.fr",
    firstName: "Jean",
    lastName: "Benef",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };
  const userWithNoRight: User = {
    id: "user-with-no-right",
    email: "user-with-no-right@mail.com",
    firstName: "User",
    lastName: "With No Right",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };
  const tutor: User = {
    id: "my-tutor-user-id",
    email: "tutor@email.com",
    firstName: "John",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };

  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId(uuidGenerator.new())
    .withIsAdmin(true)
    .buildUser();

  const agency = new AgencyDtoBuilder().build();
  const convention = new ConventionDtoBuilder()
    .withId(uuidGenerator.new())
    .withAgencyId(agency.id)
    .withEstablishmentRepresentative({
      email: "estab-rep@email.com",
      firstName: "John",
      lastName: "LeRepEtablissement",
      phone: "+590590275843",
      role: "establishment-representative",
      signedAt: new Date().toISOString(),
    })
    .withBeneficiaryRepresentative({
      email: "benef-rep@email.com",
      firstName: "Joel",
      lastName: "LeRepBeneficiaire",
      phone: "+262269612345",
      role: "beneficiary-representative",
      signedAt: new Date().toISOString(),
    })
    .withBeneficiaryCurrentEmployer({
      email: "benef-employer@email.com",
      firstName: "Julie",
      lastName: "Lemployeur",
      phone: "+33555689727",
      businessAddress: "",
      businessName: "Current employer",
      businessSiret: "12345678912345",
      job: "",
      role: "beneficiary-current-employer",
      signedAt: new Date().toISOString(),
    })
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withEstablishmentRepresentativeEmail(establishmentRep.email)
    .withAgencyReferent({ firstname: "Fredy", lastname: "L'ACCOMPAGNATEUR" })
    .build();

  const createApiConsumer = (
    conventionRight: ApiConsumerRights["convention"],
  ): ApiConsumer => ({
    id: "my-api-consumer-id",
    description: "Some description",
    name: "pole-emploi",
    createdAt: new Date().toISOString(),
    expirationDate: addYears(new Date(), 2).toISOString(),
    contact: {
      firstName: "John",
      lastName: "Doe",
      job: "job",
      emails: ["john.doe@mail.com"],
      phone: "0601010101",
    },
    rights: {
      searchEstablishment: {
        kinds: [],
        scope: "no-scope",
        subscriptions: [],
      },
      convention: conventionRight,
      statistics: { kinds: [], scope: "no-scope", subscriptions: [] },
    },
    revokedAt: null,
    currentKeyIssuedAt: new Date().toISOString(),
  });

  const conventionWithEstablishmentTutor = new ConventionDtoBuilder()
    .withId(uuidGenerator.new())
    .withAgencyId(agency.id)
    .withEstablishmentTutor({
      email: tutor.email,
      firstName: "John",
      lastName: "Doe",
      role: "establishment-tutor",
      phone: "+33602010203",
      job: "Job",
    })
    .build();

  const establishmentWithSiret = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret(convention.siret)
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "",
        phone: "",
        userId: tutor.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
      {
        role: "establishment-admin",
        status: "PENDING",
        job: "",
        phone: "",
        userId: pendingUser.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
    ])
    .build();

  const ftAdvisorEmail = "ft-advisor@mail.fr";
  const ftConnectedConvention = new ConventionDtoBuilder(convention)
    .withId(uuidGenerator.new())
    .withFederatedIdentity({
      provider: "ftConnect",
      token: "some-id",
      payload: {
        advisor: {
          email: ftAdvisorEmail,
          firstName: "john",
          lastName: "doe",
          type: "PLACEMENT",
        },
      },
    })
    .build();

  const assessment = new AssessmentDtoBuilder()
    .withConventionId(convention.id)
    .build();

  let getConvention: GetConvention;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getConvention = makeGetConvention({
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    uow.conventionRepository.setConventions([
      convention,
      conventionWithEstablishmentTutor,
      ftConnectedConvention,
    ]);
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    uow.userRepository.users = [
      counsellor,
      validator,
      johnDoe,
      establishmentRep,
      beneficiary,
      userWithNoRight,
      tutor,
      backofficeAdminUser,
    ];
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, convention),
    ];
  });

  describe("Wrong paths", () => {
    describe("Forbidden error", () => {
      describe("with ConnectedUser", () => {
        it("when the connected user has no rights on the convention", async () => {
          await expectPromiseToFailWithError(
            getConvention.execute(
              { conventionId: convention.id },
              { userId: userWithNoRight.id },
            ),
            errors.convention.forbiddenMissingRightsUserId({
              conventionId: convention.id,
              userId: userWithNoRight.id,
            }),
          );
        });

        it("When the user don't have correct role on connected users neither has right on existing establishment with same siret in convention", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            establishmentWithSiret,
          ];
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [johnDoe.id]: { isNotifiedByEmail: false, roles: ["to-review"] },
            }),
          ];

          await expectPromiseToFailWithError(
            getConvention.execute(
              { conventionId: convention.id },
              { userId: johnDoe.id },
            ),
            errors.convention.forbiddenMissingRightsUserId({
              conventionId: convention.id,
              userId: johnDoe.id,
            }),
          );
        });
        it("When the user don't have correct status on connected users neither has right on existing establishment with same siret in convention", async () => {
          uow.establishmentAggregateRepository.establishmentAggregates = [
            establishmentWithSiret,
          ];
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [pendingUser.id]: {
                isNotifiedByEmail: false,
                roles: ["to-review"],
              },
            }),
          ];

          await expectPromiseToFailWithError(
            getConvention.execute(
              { conventionId: convention.id },
              { userId: johnDoe.id },
            ),
            errors.convention.forbiddenMissingRightsUserId({
              conventionId: convention.id,
              userId: johnDoe.id,
            }),
          );
        });
      });

      describe("with ConventionJwtPayload", () => {
        it("When convention id in jwt token does not match provided one", async () => {
          const jwtPayload: ConventionDomainJwtPayload = {
            role: "establishment-representative",
            applicationId: "not-matching-convention-id",
            emailHash: "bad-hash",
          };
          await expectPromiseToFailWithError(
            getConvention.execute({ conventionId: convention.id }, jwtPayload),
            errors.convention.forbiddenConventionIdMismatch({
              jwtConventionId: jwtPayload.applicationId,
              jwtRole: jwtPayload.role,
              requestedConventionId: convention.id,
            }),
          );
        });

        it.each([
          "validator",
          "beneficiary",
          "counsellor",
          "validator",
          "establishment-representative",
          "establishment-tutor",
          "beneficiary-current-employer",
          "beneficiary-representative",
        ] satisfies Role[])("When there is not email hash match from '%role' emails in convention or in agency", async (role) => {
          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency, {
              [validator.id]: {
                isNotifiedByEmail: false,
                roles: ["validator"],
              },
              [counsellor.id]: {
                isNotifiedByEmail: false,
                roles: ["counsellor"],
              },
            }),
          ];

          const emailHash = "thisHashDontMatch";

          await expectPromiseToFailWithError(
            getConvention.execute(
              { conventionId: convention.id },
              {
                role,
                emailHash,
                applicationId: convention.id,
              },
            ),
            errors.convention.forbiddenMissingRightsEmailHash({
              emailHash,
              role,
              conventionId: convention.id,
            }),
          );
        });

        it("when the user has ProConnect but not for the agency of this convention", async () => {
          const anotherAgency = new AgencyDtoBuilder(agency)
            .withId("another")
            .build();
          const role: ConventionRole = "validator";

          uow.agencyRepository.agencies = [
            toAgencyWithRights(agency),
            toAgencyWithRights(anotherAgency, {
              [johnDoe.id]: { isNotifiedByEmail: false, roles: [role] },
            }),
          ];

          const emailHash = makeEmailHash(johnDoe.email);
          await expectPromiseToFailWithError(
            getConvention.execute(
              { conventionId: convention.id },
              {
                role,
                emailHash: emailHash,
                applicationId: convention.id,
              },
            ),
            errors.convention.forbiddenMissingRightsEmailHash({
              emailHash,
              role,
              conventionId: convention.id,
            }),
          );
        });
      });

      describe("with ApiConsumer", () => {
        it("convention is linked to an agency with an Id which is not", async () => {
          const apiConsumer = createApiConsumer({
            kinds: ["READ"],
            scope: { agencyIds: ["out-of-scope-agency-id"] },
            subscriptions: [],
          });
          await expectPromiseToFailWithError(
            getConvention.execute({ conventionId: convention.id }, apiConsumer),
            errors.convention.forbiddenMissingRightsApiConsumer(
              convention.id,
              apiConsumer.id,
            ),
          );
        });

        it("convention is linked to an agency with a kind not in scope", async () => {
          const apiConsumer = createApiConsumer({
            kinds: ["READ"],
            scope: { agencyKinds: ["mission-locale"] },
            subscriptions: [],
          });
          await expectPromiseToFailWithError(
            getConvention.execute({ conventionId: convention.id }, apiConsumer),
            errors.convention.forbiddenMissingRightsApiConsumer(
              convention.id,
              apiConsumer.id,
            ),
          );
        });
      });
    });

    describe("Not found error", () => {
      it("When the Convention does not exist", async () => {
        uow.conventionRepository.setConventions([]);

        await expectPromiseToFailWithError(
          getConvention.execute(
            { conventionId: convention.id },
            {
              role: "establishment-representative",
              applicationId: convention.id,
              emailHash: "",
            },
          ),
          errors.convention.notFound({ conventionId: convention.id }),
        );
      });

      it("When if user is missing", async () => {
        uow.userRepository.users = [];

        await expectPromiseToFailWithError(
          getConvention.execute(
            { conventionId: convention.id },
            { userId: johnDoe.id },
          ),
          errors.user.notFound({ userId: johnDoe.id }),
        );
      });

      it("When the agency does not exist", async () => {
        uow.agencyRepository.agencies = [];

        await expectPromiseToFailWithError(
          getConvention.execute(
            { conventionId: convention.id },
            { userId: establishmentRep.id },
          ),
          errors.agencies.notFound({
            missingAgencyIds: [agency.id],
            presentAgencyIds: [],
          }),
        );
      });
    });
  });

  describe("Right paths", () => {
    describe("ConventionReadDto enrichment", () => {
      const expectedAssessment = {
        status: assessment.status,
        endedWithAJob: assessment.endedWithAJob,
        signedAt: assessment.signedAt,
        createdAt: assessment.createdAt,
      };

      it("includes agencyRefersTo when agency refers to another agency", async () => {
        const referringAgency = new AgencyDtoBuilder()
          .withId("33333333-3333-4333-8333-333333333333")
          .withName("Agence référente")
          .withAgencySiret("55552222000055")
          .withAgencyContactEmail(validator.email)
          .build();

        const agencyWithRefersTo = new AgencyDtoBuilder(agency)
          .withRefersToAgencyInfo({
            refersToAgencyId: referringAgency.id,
            refersToAgencyName: referringAgency.name,
            refersToAgencyContactEmail: referringAgency.contactEmail,
          })
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agencyWithRefersTo),
          toAgencyWithRights(referringAgency),
        ];

        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            { userId: establishmentRep.id },
          ),
          {
            ...convention,
            agencyName: agencyWithRefersTo.name,
            agencyDepartment: agencyWithRefersTo.address.departmentCode,
            agencyKind: agencyWithRefersTo.kind,
            agencyContactEmail: agencyWithRefersTo.contactEmail,
            agencySiret: agencyWithRefersTo.agencySiret,
            agencyValidationSteps: "validator-only",
            agencyRefersTo: {
              id: referringAgency.id,
              name: referringAgency.name,
              contactEmail: referringAgency.contactEmail,
              kind: referringAgency.kind,
              siret: referringAgency.agencySiret,
            },
            assessment: expectedAssessment,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });

      it("includes banned establishment information when siret is banned", async () => {
        const banEstablishmentPayload: BanEstablishmentPayload = {
          siret: convention.siret,
          establishmentBannishmentJustification: "Entreprise bannie pour tests",
        };
        uow.bannedEstablishmentRepository.bannedEstablishments = [
          banEstablishmentPayload,
        ];

        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            { userId: establishmentRep.id },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyContactEmail: agency.contactEmail,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: expectedAssessment,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: true,
            establishmentBannishmentJustification:
              banEstablishmentPayload.establishmentBannishmentJustification,
          },
        );
      });

      it("includes lastReminders when reminder notifications exist", async () => {
        const signatureEmailAt = "2025-01-02T10:00:00.000Z";
        const assessmentCompletionEmailAt = "2025-01-04T09:00:00.000Z";
        const assessmentSignatureSmsAt = "2025-01-05T10:00:00.000Z";
        const followedIds = {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        };

        const signatureEmailReminder: Notification = {
          id: "signature-email",
          createdAt: signatureEmailAt,
          kind: "email",
          followedIds,
          templatedContent: {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
            recipients: [convention.signatories.beneficiary.email],
            params: {
              agencyLogoUrl: undefined,
              beneficiaryName: "Beneficiary",
              businessName: convention.businessName,
              conventionId: convention.id,
              establishmentRepresentativeName: "Establishment Rep",
              establishmentTutorName: "Tutor",
              internshipKind: convention.internshipKind,
              conventionSignShortlink: "https://short.link",
              signatoryName: "Signatory",
            },
          },
        };

        const assessmentCompletionEmailReminder: Notification = {
          id: "assessment-completion-email",
          createdAt: assessmentCompletionEmailAt,
          kind: "email",
          followedIds,
          templatedContent: {
            kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
            recipients: [convention.establishmentTutor.email],
            params: {
              agencyLogoUrl: undefined,
              assessmentCreationLink: "https://short.link",
              beneficiaryFirstName:
                convention.signatories.beneficiary.firstName,
              beneficiaryLastName: convention.signatories.beneficiary.lastName,
              conventionId: convention.id,
              establishmentTutorName: "Tutor",
              internshipKind: convention.internshipKind,
            },
          },
        };

        const assessmentSignatureSmsReminder: Notification = {
          id: "assessment-signature-sms",
          createdAt: assessmentSignatureSmsAt,
          kind: "sms",
          followedIds,
          templatedContent: {
            kind: "ReminderForAssessmentSignature",
            recipientPhone: convention.signatories.beneficiary.phone,
            params: { shortLink: "https://short.link" },
          },
        };

        uow.notificationRepository.notifications = [
          signatureEmailReminder,
          assessmentCompletionEmailReminder,
          assessmentSignatureSmsReminder,
        ];

        const emptyLastReminders = makeEmptyLastReminders();

        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            { userId: establishmentRep.id },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyContactEmail: agency.contactEmail,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: expectedAssessment,
            lastReminders: {
              ...emptyLastReminders,
              conventionSignatures: {
                ...emptyLastReminders.conventionSignatures,
                beneficiary: {
                  email: signatureEmailAt,
                  sms: null,
                },
              },
              assessmentCompletion: {
                email: assessmentCompletionEmailAt,
                sms: null,
              },
              assessmentSignature: {
                email: null,
                sms: assessmentSignatureSmsAt,
              },
            },
            isEstablishmentBanned: false,
          },
        );
      });
    });

    describe("with connected user", () => {
      it("that beneficiary email is also the connected user email", async () => {
        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            {
              userId: beneficiary.id,
            },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyContactEmail: agency.contactEmail,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });

      it("that have agency rights", async () => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [johnDoe.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          }),
        ];

        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            {
              userId: johnDoe.id,
            },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyKind: agency.kind,
            agencyContactEmail: agency.contactEmail,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });

      describe("establishment rights", () => {
        it("that establishment rep email is also the connected user email", async () => {
          expectToEqual(
            await getConvention.execute(
              { conventionId: convention.id },
              {
                userId: establishmentRep.id,
              },
            ),
            {
              ...convention,
              agencyName: agency.name,
              agencyDepartment: agency.address.departmentCode,
              agencyContactEmail: agency.contactEmail,
              agencyKind: agency.kind,
              agencySiret: agency.agencySiret,
              agencyValidationSteps: "validator-only",
              assessment: {
                status: assessment.status,
                endedWithAJob: assessment.endedWithAJob,
                signedAt: assessment.signedAt,
                createdAt: assessment.createdAt,
              },
              lastReminders: makeEmptyLastReminders(),
              isEstablishmentBanned: false,
            },
          );
        });

        it("that establishment tutor email is also the connected user email", async () => {
          expectToEqual(
            await getConvention.execute(
              { conventionId: conventionWithEstablishmentTutor.id },
              {
                userId: tutor.id,
              },
            ),
            {
              ...conventionWithEstablishmentTutor,
              agencyName: agency.name,
              agencyDepartment: agency.address.departmentCode,
              agencyContactEmail: agency.contactEmail,
              agencyKind: agency.kind,
              agencySiret: agency.agencySiret,
              agencyValidationSteps: "validator-only",
              assessment: null,
              lastReminders: makeEmptyLastReminders(),
              isEstablishmentBanned: false,
            },
          );
        });

        it.each(
          establishmentsRoles,
        )("that the connected user is also %s of the existing establishment with same siret in convention", async (role) => {
          const establishmentWithRights = new EstablishmentAggregateBuilder(
            establishmentWithSiret,
          )
            .withUserRights([
              {
                userId: johnDoe.id,
                role,
                status: "ACCEPTED",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build();

          uow.establishmentAggregateRepository.establishmentAggregates = [
            establishmentWithRights,
          ];

          expectToEqual(
            await getConvention.execute(
              { conventionId: convention.id },
              {
                userId: johnDoe.id,
              },
            ),
            {
              ...convention,
              agencyName: agency.name,
              agencyDepartment: agency.address.departmentCode,
              agencyContactEmail: agency.contactEmail,
              agencyKind: agency.kind,
              agencySiret: agency.agencySiret,
              agencyValidationSteps: "validator-only",
              assessment: {
                status: assessment.status,
                endedWithAJob: assessment.endedWithAJob,
                signedAt: assessment.signedAt,
                createdAt: assessment.createdAt,
              },
              lastReminders: makeEmptyLastReminders(),
              isEstablishmentBanned: false,
            },
          );
        });
      });

      it("the user is backofficeAdmin", async () => {
        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            {
              userId: backofficeAdminUser.id,
            },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyContactEmail: agency.contactEmail,
            agencyKind: agency.kind,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });
    });

    describe("with ConventionJwtPayload", () => {
      beforeEach(() => {
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [counsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor"],
            },
            [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
          }),
        ];
      });
      it.each([
        {
          role: "establishment-representative",
          email: convention.signatories.establishmentRepresentative.email,
        },
        {
          role: "establishment-tutor",
          email: convention.establishmentTutor.email,
        },
        {
          role: "beneficiary",
          email: convention.signatories.beneficiary.email,
        },
      ] satisfies {
        role: ConventionRole;
        email: string;
      }[])("email hash match email hash for role '$role' in convention", async ({
        role,
        email,
      }: {
        role: ConventionRole;
        email: string;
      }) => {
        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            {
              role,
              emailHash: makeEmailHash(email),
              applicationId: convention.id,
            },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyContactEmail: agency.contactEmail,
            agencyKind: agency.kind,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });

      it.each([
        {
          role: "counsellor",
          email: counsellor.email,
        },
        {
          role: "validator",
          email: validator.email,
        },
      ] satisfies {
        role: ConventionRole;
        email: string;
      }[])("email hash match user email hash and has '$role' agency right", async ({
        role,
        email,
      }: {
        role: ConventionRole;
        email: string;
      }) => {
        uow.userRepository.users = [counsellor, validator];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [validator.id]: {
              isNotifiedByEmail: false,
              roles: ["validator"],
            },
            [counsellor.id]: {
              isNotifiedByEmail: false,
              roles: ["counsellor"],
            },
          }),
        ];

        expectToEqual(
          await getConvention.execute(
            { conventionId: convention.id },
            {
              role,
              emailHash: makeEmailHash(email),
              applicationId: convention.id,
            },
          ),
          {
            ...convention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyContactEmail: agency.contactEmail,
            agencyKind: agency.kind,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });

      it("user is a FtAdvisor", async () => {
        expectToEqual(
          await getConvention.execute(
            { conventionId: ftConnectedConvention.id },
            {
              role: "validator",
              emailHash: makeEmailHash(ftAdvisorEmail),
              applicationId: ftConnectedConvention.id,
            },
          ),
          {
            ...ftConnectedConvention,
            agencyName: agency.name,
            agencyDepartment: agency.address.departmentCode,
            agencyContactEmail: agency.contactEmail,
            agencyKind: agency.kind,
            agencySiret: agency.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        );
      });
    });

    describe("with ApiConsumer", () => {
      it("when agencyIds scope matches", async () => {
        const retrievedConvention = await getConvention.execute(
          { conventionId: convention.id },
          createApiConsumer({
            kinds: ["READ"],
            scope: { agencyIds: [agency.id] },
            subscriptions: [],
          }),
        );

        expectToEqual(retrievedConvention, {
          ...convention,
          agencyName: agency.name,
          agencyDepartment: agency.address.departmentCode,
          agencyContactEmail: agency.contactEmail,
          agencyKind: agency.kind,
          agencySiret: agency.agencySiret,
          agencyValidationSteps: "validator-only",
          assessment: {
            status: assessment.status,
            endedWithAJob: assessment.endedWithAJob,
            signedAt: assessment.signedAt,
            createdAt: assessment.createdAt,
          },
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        });
      });

      it("when agencyKinds scope matches", async () => {
        const retrievedConvention = await getConvention.execute(
          { conventionId: convention.id },
          createApiConsumer({
            kinds: ["READ"],
            scope: { agencyKinds: [agency.kind] },
            subscriptions: [],
          }),
        );

        expectToEqual(retrievedConvention, {
          ...convention,
          agencyName: agency.name,
          agencyDepartment: agency.address.departmentCode,
          agencyContactEmail: agency.contactEmail,
          agencyKind: agency.kind,
          agencySiret: agency.agencySiret,
          agencyValidationSteps: "validator-only",
          assessment: {
            status: assessment.status,
            endedWithAJob: assessment.endedWithAJob,
            signedAt: assessment.signedAt,
            createdAt: assessment.createdAt,
          },
          lastReminders: makeEmptyLastReminders(),
          isEstablishmentBanned: false,
        });
      });
    });
  });
});
