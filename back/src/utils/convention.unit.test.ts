import {
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  type BanEstablishmentPayload,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  makeEmptyLastReminders,
  type Notification,
} from "shared";
import { createAssessmentEntity } from "../domains/convention/entities/AssessmentEntity";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../domains/core/unit-of-work/adapters/createInMemoryUow";
import { toAgencyWithRights } from "./agency";
import { conventionDtosToConventionReadDtos } from "./convention";

describe("conventionDtosToConventionReadDtos", () => {
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.fr")
    .build();

  const agency = new AgencyDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withName("Agency A")
    .withKind("autre")
    .withAgencySiret("11112222000033")
    .build();

  const convention = new ConventionDtoBuilder()
    .withId("22222222-2222-4222-8222-222222222222")
    .withAgencyId(agency.id)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withBeneficiaryRepresentative({
      email: "benef-rep@email.com",
      firstName: "Joel",
      lastName: "LeRep",
      phone: "+33600000001",
      role: "beneficiary-representative",
      signedAt: new Date().toISOString(),
    })
    .withBeneficiaryCurrentEmployer({
      email: "benef-employer@email.com",
      firstName: "Julie",
      lastName: "Lemployeur",
      phone: "+33600000002",
      businessAddress: "",
      businessName: "Current employer",
      businessSiret: "12345678912345",
      job: "",
      role: "beneficiary-current-employer",
      signedAt: new Date().toISOString(),
    })
    .build();

  const beneficiaryRepresentative =
    convention.signatories.beneficiaryRepresentative;
  const beneficiaryCurrentEmployer =
    convention.signatories.beneficiaryCurrentEmployer;

  if (!beneficiaryRepresentative || !beneficiaryCurrentEmployer)
    throw new Error("Expected optional signatories to be set in fixture");

  const expectedAgencyFields = {
    agencyName: agency.name,
    agencyDepartment: agency.address.departmentCode,
    agencyKind: agency.kind,
    agencyContactEmail: agency.contactEmail,
    agencySiret: agency.agencySiret,
    agencyValidationSteps: "validator-only" as const,
  };

  const followedIds = {
    conventionId: convention.id,
    agencyId: convention.agencyId,
    establishmentSiret: convention.siret,
  };

  const makeSignatureEmailReminder = ({
    id,
    createdAt,
    recipientEmail,
  }: {
    id: string;
    createdAt: string;
    recipientEmail: string;
  }): Notification => ({
    id,
    createdAt,
    kind: "email",
    followedIds,
    templatedContent: {
      kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
      recipients: [recipientEmail],
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
  });

  const makeSmsReminder = ({
    id,
    createdAt,
    kind,
    recipientPhone,
  }: {
    id: string;
    createdAt: string;
    kind:
      | "ReminderForSignatories"
      | "ReminderForAssessment"
      | "ReminderForAssessmentSignature";
    recipientPhone: string;
  }): Notification => ({
    id,
    createdAt,
    kind: "sms",
    followedIds,
    templatedContent: {
      kind,
      recipientPhone,
      params: { shortLink: "https://short.link" },
    },
  });

  const makeAssessmentCompletionEmailReminder = ({
    id,
    createdAt,
  }: {
    id: string;
    createdAt: string;
  }): Notification => ({
    id,
    createdAt,
    kind: "email",
    followedIds,
    templatedContent: {
      kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
      recipients: [convention.establishmentTutor.email],
      params: {
        agencyLogoUrl: undefined,
        assessmentCreationLink: "https://short.link",
        beneficiaryFirstName: convention.signatories.beneficiary.firstName,
        beneficiaryLastName: convention.signatories.beneficiary.lastName,
        conventionId: convention.id,
        establishmentTutorName: "Tutor",
        internshipKind: convention.internshipKind,
      },
    },
  });

  const makeAssessmentSignatureEmailReminder = ({
    id,
    createdAt,
  }: {
    id: string;
    createdAt: string;
  }): Notification => ({
    id,
    createdAt,
    kind: "email",
    followedIds,
    templatedContent: {
      kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
      recipients: [convention.signatories.beneficiary.email],
      params: {
        beneficiaryFirstName: convention.signatories.beneficiary.firstName,
        beneficiaryLastName: convention.signatories.beneficiary.lastName,
        businessName: convention.businessName,
        internshipKind: convention.internshipKind,
        assessmentSignatureLink: "https://short.link",
        conventionId: convention.id,
      },
    },
  });

  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];
    uow.userRepository.users = [validator];
  });

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
      toAgencyWithRights(agencyWithRefersTo, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
      toAgencyWithRights(referringAgency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];

    expectToEqual(await conventionDtosToConventionReadDtos([convention], uow), [
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
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      },
    ]);
  });

  describe("lastReminders", () => {
    it("returns signature email reminder for a signatory", async () => {
      const sentAt = "2025-01-02T10:00:00.000Z";

      uow.notificationRepository.notifications = [
        makeSignatureEmailReminder({
          id: "signature-email",
          createdAt: sentAt,
          recipientEmail: convention.signatories.beneficiary.email,
        }),
      ];

      const emptyLastReminders = makeEmptyLastReminders();

      expectToEqual(
        await conventionDtosToConventionReadDtos([convention], uow),
        [
          {
            ...convention,
            ...expectedAgencyFields,
            assessment: null,
            lastReminders: {
              ...emptyLastReminders,
              conventionSignatures: {
                ...emptyLastReminders.conventionSignatures,
                beneficiary: {
                  email: sentAt,
                  sms: null,
                },
              },
            },
            isEstablishmentBanned: false,
          },
        ],
      );
    });

    it("returns signature reminders for each signatory role", async () => {
      const establishmentRepDate = "2025-01-02T12:00:00.000Z";
      const beneficiaryRepDate = "2025-01-02T13:00:00.000Z";
      const currentEmployerDate = "2025-01-02T14:00:00.000Z";

      uow.notificationRepository.notifications = [
        makeSignatureEmailReminder({
          id: "estab-rep-email",
          createdAt: establishmentRepDate,
          recipientEmail:
            convention.signatories.establishmentRepresentative.email,
        }),
        makeSignatureEmailReminder({
          id: "benef-rep-email",
          createdAt: beneficiaryRepDate,
          recipientEmail: beneficiaryRepresentative.email,
        }),
        makeSmsReminder({
          id: "current-employer-sms",
          createdAt: currentEmployerDate,
          kind: "ReminderForSignatories",
          recipientPhone: beneficiaryCurrentEmployer.phone,
        }),
      ];

      expectToEqual(
        await conventionDtosToConventionReadDtos([convention], uow),
        [
          {
            ...convention,
            ...expectedAgencyFields,
            assessment: null,
            lastReminders: {
              ...makeEmptyLastReminders(),
              conventionSignatures: {
                beneficiary: { email: null, sms: null },
                "establishment-representative": {
                  email: establishmentRepDate,
                  sms: null,
                },
                "beneficiary-representative": {
                  email: beneficiaryRepDate,
                  sms: null,
                },
                "beneficiary-current-employer": {
                  email: null,
                  sms: currentEmployerDate,
                },
              },
            },
            isEstablishmentBanned: false,
          },
        ],
      );
    });

    it("returns assessment completion and signature reminders", async () => {
      const assessmentCompletionEmailAt = "2025-01-04T09:00:00.000Z";
      const assessmentCompletionSmsAt = "2025-01-04T10:00:00.000Z";
      const assessmentSignatureEmailAt = "2025-01-05T09:00:00.000Z";
      const assessmentSignatureSmsAt = "2025-01-05T10:00:00.000Z";

      uow.notificationRepository.notifications = [
        makeAssessmentCompletionEmailReminder({
          id: "assessment-completion-email",
          createdAt: assessmentCompletionEmailAt,
        }),
        makeSmsReminder({
          id: "assessment-completion-sms",
          createdAt: assessmentCompletionSmsAt,
          kind: "ReminderForAssessment",
          recipientPhone: convention.establishmentTutor.phone,
        }),
        makeAssessmentSignatureEmailReminder({
          id: "assessment-signature-email",
          createdAt: assessmentSignatureEmailAt,
        }),
        makeSmsReminder({
          id: "assessment-signature-sms",
          createdAt: assessmentSignatureSmsAt,
          kind: "ReminderForAssessmentSignature",
          recipientPhone: convention.signatories.beneficiary.phone,
        }),
      ];

      expectToEqual(
        await conventionDtosToConventionReadDtos([convention], uow),
        [
          {
            ...convention,
            ...expectedAgencyFields,
            assessment: null,
            lastReminders: {
              ...makeEmptyLastReminders(),
              assessmentCompletion: {
                email: assessmentCompletionEmailAt,
                sms: assessmentCompletionSmsAt,
              },
              assessmentSignature: {
                email: assessmentSignatureEmailAt,
                sms: assessmentSignatureSmsAt,
              },
            },
            isEstablishmentBanned: false,
          },
        ],
      );
    });
  });

  it("throws when agency is not found", async () => {
    uow.agencyRepository.agencies = [];

    await expectPromiseToFailWithError(
      conventionDtosToConventionReadDtos([convention], uow),
      errors.agencies.notFound({
        missingAgencyIds: [agency.id],
        presentAgencyIds: [],
      }),
    );
  });

  describe("with multiple conventions", () => {
    const validator = new ConnectedUserBuilder()
      .withId("validator-batch")
      .withEmail("validator-batch@mail.fr")
      .build();
    const counsellor = new ConnectedUserBuilder()
      .withId("counsellor-batch")
      .withEmail("counsellor-batch@mail.fr")
      .build();

    const agencyValidatorOnly = new AgencyDtoBuilder()
      .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .withName("Agency validator only")
      .withKind("autre")
      .withAgencySiret("11112222000011")
      .withAddress({
        streetNumberAndAddress: "1 rue de Paris",
        city: "Paris",
        departmentCode: "75",
        postcode: "75001",
      })
      .withCoveredDepartments(["75", "92"])
      .build();

    const agencyWithCounsellor = new AgencyDtoBuilder()
      .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .withName("Agency with counsellor")
      .withKind("mission-locale")
      .withAgencySiret("11112222000022")
      .withAddress({
        streetNumberAndAddress: "1 rue de Lyon",
        city: "Lyon",
        departmentCode: "69",
        postcode: "69001",
      })
      .withCoveredDepartments(["69", "01"])
      .build();

    const conventionOnValidatorAgency = new ConventionDtoBuilder()
      .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
      .withAgencyId(agencyValidatorOnly.id)
      .withSiret("12345678901234")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .build();

    const conventionOnCounsellorAgency = new ConventionDtoBuilder()
      .withId("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
      .withAgencyId(agencyWithCounsellor.id)
      .withSiret("98765432109876")
      .withStatus("ACCEPTED_BY_COUNSELLOR")
      .build();

    let uow: InMemoryUnitOfWork;

    beforeEach(() => {
      uow = createInMemoryUow();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agencyValidatorOnly, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
        toAgencyWithRights(agencyWithCounsellor, {
          [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];
      uow.userRepository.users = [validator, counsellor];
    });

    it("returns empty array when given no conventions", async () => {
      expectToEqual(await conventionDtosToConventionReadDtos([], uow), []);
    });

    it("enriches each convention with agency fields specific to its agency", async () => {
      expectToEqual(
        await conventionDtosToConventionReadDtos(
          [conventionOnValidatorAgency, conventionOnCounsellorAgency],
          uow,
        ),
        [
          {
            ...conventionOnValidatorAgency,
            agencyName: agencyValidatorOnly.name,
            agencyDepartment: "75",
            agencyKind: agencyValidatorOnly.kind,
            agencyContactEmail: agencyValidatorOnly.contactEmail,
            agencySiret: agencyValidatorOnly.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
          {
            ...conventionOnCounsellorAgency,
            agencyName: agencyWithCounsellor.name,
            agencyDepartment: "69",
            agencyKind: agencyWithCounsellor.kind,
            agencyContactEmail: agencyWithCounsellor.contactEmail,
            agencySiret: agencyWithCounsellor.agencySiret,
            agencyValidationSteps: "counsellor-and-validator",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ],
      );
    });

    it("includes assessment when present and null when absent", async () => {
      const assessment = new AssessmentDtoBuilder()
        .withConventionId(conventionOnValidatorAgency.id)
        .build();

      uow.assessmentRepository.assessments = [
        createAssessmentEntity(assessment, conventionOnValidatorAgency),
      ];

      expectToEqual(
        await conventionDtosToConventionReadDtos(
          [conventionOnValidatorAgency, conventionOnCounsellorAgency],
          uow,
        ),
        [
          {
            ...conventionOnValidatorAgency,
            agencyName: agencyValidatorOnly.name,
            agencyDepartment: "75",
            agencyKind: agencyValidatorOnly.kind,
            agencyContactEmail: agencyValidatorOnly.contactEmail,
            agencySiret: agencyValidatorOnly.agencySiret,
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
          {
            ...conventionOnCounsellorAgency,
            agencyName: agencyWithCounsellor.name,
            agencyDepartment: "69",
            agencyKind: agencyWithCounsellor.kind,
            agencyContactEmail: agencyWithCounsellor.contactEmail,
            agencySiret: agencyWithCounsellor.agencySiret,
            agencyValidationSteps: "counsellor-and-validator",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ],
      );
    });

    it("includes banned establishment info only for banned sirets", async () => {
      const banEstablishmentPayload: BanEstablishmentPayload = {
        siret: conventionOnValidatorAgency.siret,
        establishmentBannishmentJustification: "Banned for batch tests",
      };
      uow.bannedEstablishmentRepository.bannedEstablishments = [
        banEstablishmentPayload,
      ];

      expectToEqual(
        await conventionDtosToConventionReadDtos(
          [conventionOnValidatorAgency, conventionOnCounsellorAgency],
          uow,
        ),
        [
          {
            ...conventionOnValidatorAgency,
            agencyName: agencyValidatorOnly.name,
            agencyDepartment: "75",
            agencyKind: agencyValidatorOnly.kind,
            agencyContactEmail: agencyValidatorOnly.contactEmail,
            agencySiret: agencyValidatorOnly.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: true,
            establishmentBannishmentJustification:
              banEstablishmentPayload.establishmentBannishmentJustification,
          },
          {
            ...conventionOnCounsellorAgency,
            agencyName: agencyWithCounsellor.name,
            agencyDepartment: "69",
            agencyKind: agencyWithCounsellor.kind,
            agencyContactEmail: agencyWithCounsellor.contactEmail,
            agencySiret: agencyWithCounsellor.agencySiret,
            agencyValidationSteps: "counsellor-and-validator",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ],
      );
    });
  });
});
