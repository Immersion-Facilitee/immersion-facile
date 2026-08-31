import type { WithAcquisition } from "../acquisition.dto";
import type { AgencyId } from "../agency/agency.dto";
import type { Builder } from "../Builder";
import type {
  BusinessName,
  BusinessNameCustomized,
} from "../establishment/establishment.dto";
import type { FtConnectIdentity } from "../federatedIdentities/federatedIdentity.dto";
import type { RemoteWorkMode } from "../remoteWorkMode/remoteWorkMode.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type {
  DateIntervalDto,
  ScheduleDto,
  Weekday,
} from "../schedule/Schedule.dto";
import { reasonableSchedule } from "../schedule/ScheduleUtils";
import type { NumberEmployeesRange, SiretDto } from "../siret/siret";
import type { DateString } from "../utils/date";
import {
  type Beneficiary,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  type ConventionDto,
  type ConventionId,
  type ConventionStatus,
  type ConventionValidatorInputNames,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  type ImmersionObjective,
  type InternshipKind,
  isBeneficiary,
  isBeneficiaryStudent,
  type Renewed,
  type WithOptionalFirstnameAndLastname,
} from "./convention.dto";
import type { ConventionDraftId } from "./conventionDraftId";

export const DEMANDE_IMMERSION_ID = "a99eaca1-ee70-4c90-b3f4-668d492f7392";

export const SEED_IN_REVIEW_CONVENTION_WITH_DOUBLE_VALIDATION_ID: ConventionId =
  "11111111-1111-4000-8000-000000000001";
export const SEED_IN_REVIEW_CONVENTION_ID: ConventionId =
  "11111111-1111-4000-8000-000000000002";
export const SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID: ConventionId =
  "11111111-1111-4000-8000-000000000003";
export const SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_2_ID: ConventionId =
  "11111111-1111-4000-8000-000000000004";
export const SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_3_ID: ConventionId =
  "11111111-1111-4000-8000-000000000005";
export const SEED_READY_TO_SIGN_CONVENTION_1_ID: ConventionId =
  "11111111-1111-4000-8000-000000000006";
export const SEED_READY_TO_SIGN_CONVENTION_2_ID: ConventionId =
  "11111111-1111-4000-8000-000000000007";
export const SEED_PARTIALLY_SIGNED_CONVENTION_ID: ConventionId =
  "11111111-1111-4000-8000-000000000008";
export const SEED_ADMIN_BENEFICIARY_CONVENTION_ID: ConventionId =
  "11111111-1111-4000-8000-000000000009";

export const VALID_EMAILS = [
  "beneficiary@email.fr",
  "establishment@example.com",
  "validator@mail.com",
];
export const DATE_SUBMISSION = new Date("2024-10-04").toISOString();
export const DATE_UPDATED = new Date("2024-10-04").toISOString();
export const DATE_START = new Date("2024-10-08").toISOString();
export const DATE_END = new Date("2024-10-17").toISOString();
export const DATE_SIGNATURE = new Date("2024-10-04").toISOString();

export const VALID_PHONES = [
  { codeCountry: "fr", phoneNumber: "+33123456780" },
  { codeCountry: "fr", phoneNumber: "+33601010101" },
  { codeCountry: "de", phoneNumber: "+49001231234" },
  { codeCountry: "ch", phoneNumber: "+41800001853" },
];

const beneficiary: Beneficiary<"immersion"> = {
  role: "beneficiary",
  email: VALID_EMAILS[0],
  phone: VALID_PHONES[0].phoneNumber,
  firstName: "Esteban",
  lastName: "Ocon",
  signedAt: DATE_SIGNATURE,
  emergencyContact: "Clariss Ocon",
  emergencyContactPhone: "+33663567896",
  emergencyContactEmail: "clariss.ocon@emergencycontact.com",
  financiaryHelp: "Un stage rémunéré au SMIC?",
  birthdate: "2002-10-05",
};

const establishmentTutor: EstablishmentTutor = {
  role: "establishment-tutor",
  email: VALID_EMAILS[1],
  phone: VALID_PHONES[1].phoneNumber,
  firstName: "Alain",
  lastName: "Prost",
  job: "Big Boss",
};

const establishmentRepresentative: EstablishmentRepresentative = {
  email: "establishment@example.com",
  firstName: "Billy",
  lastName: "Idol",
  phone: "+33602010203",
  role: "establishment-representative",
  signedAt: DATE_SIGNATURE,
};

const validConvention: ConventionDto = {
  id: DEMANDE_IMMERSION_ID,
  status: "READY_TO_SIGN",
  agencyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  immersionAddress: "169 boulevard de la villette, 75010 Paris",
  remoteWorkMode: "ON_SITE",
  dateSubmission: DATE_SUBMISSION,
  dateStart: DATE_START,
  dateEnd: DATE_END,
  updatedAt: DATE_UPDATED,
  businessName: "Beta.gouv.fr",
  siret: "12345678901234",
  schedule: reasonableSchedule({
    start: new Date(DATE_START),
    end: new Date(DATE_END),
  }),
  individualProtection: true,
  individualProtectionDescription: "casque et lunnettes",
  sanitaryPrevention: true,
  sanitaryPreventionDescription: "fourniture de gel",
  immersionObjective: "Confirmer un projet professionnel",
  immersionAppellation: {
    romeCode: "A1101",
    romeLabel: "Conduite d'engins agricoles et forestiers",
    appellationCode: "17751",
    appellationLabel: "Pilote de machines d'abattage",
  },
  businessAdvantages: "Prise en charge du panier repas",
  immersionActivities: "Piloter un automobile",
  immersionSkills: "Utilisation des pneus optimale, gestion de carburant",
  internshipKind: "immersion",
  signatories: { beneficiary, establishmentRepresentative },
  establishmentTutor,
};

export class ConventionDtoBuilder implements Builder<ConventionDto> {
  constructor(private dto: ConventionDto = validConvention) {}

  public build() {
    return this.dto;
  }

  public withSourceConventionDraftId(
    sourceConventionDraftId?: ConventionDraftId,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      sourceConventionDraftId,
    });
  }

  public notSigned(): ConventionDtoBuilder {
    if (
      this.dto.internshipKind === "immersion" &&
      isBeneficiary(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          beneficiary: {
            ...this.dto.signatories.beneficiary,
            signedAt: undefined,
          },
          beneficiaryCurrentEmployer: this.#beneficiaryCurrentEmployer && {
            ...this.#beneficiaryCurrentEmployer,
            signedAt: undefined,
          },
          establishmentRepresentative: {
            ...this.#establishmentRepresentative,
            signedAt: undefined,
          },
          beneficiaryRepresentative: this.#beneficiaryRepresentative && {
            ...this.#beneficiaryRepresentative,
            signedAt: undefined,
          },
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          beneficiary: {
            ...this.dto.signatories.beneficiary,
            signedAt: undefined,
          },
          beneficiaryCurrentEmployer: this.#beneficiaryCurrentEmployer && {
            ...this.#beneficiaryCurrentEmployer,
            signedAt: undefined,
          },
          establishmentRepresentative: {
            ...this.#establishmentRepresentative,
            signedAt: undefined,
          },
          beneficiaryRepresentative: this.#beneficiaryRepresentative && {
            ...this.#beneficiaryRepresentative,
            signedAt: undefined,
          },
        },
      });
    }
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public signedByBeneficiary(signedAt: string | undefined) {
    return this.withBeneficiary({
      ...this.#beneficiary,
      signedAt,
    });
  }

  public signedByBeneficiaryRepresentative(signedAt: string | undefined) {
    const beneficiaryRepresentative =
      this.dto.signatories.beneficiaryRepresentative;
    if (beneficiaryRepresentative)
      return this.withBeneficiaryRepresentative({
        ...beneficiaryRepresentative,
        signedAt,
      });
    throw new Error(
      "Can't sign convention as beneficiary representative beacause there is no beneficiary representative on convention.",
    );
  }

  public signedByEstablishmentRepresentative(signedAt: string | undefined) {
    return this.withEstablishmentRepresentative({
      ...this.#establishmentRepresentative,
      signedAt,
    });
  }

  public validated(): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      status: "ACCEPTED_BY_VALIDATOR",
    });
  }

  public withAgencyId(agencyId: AgencyId): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, agencyId });
  }

  public withActivities(activities: string): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      immersionActivities: activities,
    });
  }

  public withBeneficiary(
    beneficiary: Beneficiary<InternshipKind>,
  ): ConventionDtoBuilder {
    if (this.dto.internshipKind === "immersion" && isBeneficiary(beneficiary)) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiary,
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(beneficiary)
    )
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiary,
        },
      });
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public withBeneficiaryBirthdate(birthdate: string): ConventionDtoBuilder {
    return this.withBeneficiary({
      ...this.#beneficiary,
      birthdate,
    });
  }

  public withBeneficiaryCurrentEmployer(
    beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer | undefined,
  ): ConventionDtoBuilder {
    if (
      this.dto.internshipKind === "immersion" &&
      isBeneficiary(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryCurrentEmployer,
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(this.dto.signatories.beneficiary)
    )
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryCurrentEmployer,
        },
      });
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public withAcquisition(withAcquisition: WithAcquisition) {
    return new ConventionDtoBuilder({ ...this.dto, ...withAcquisition });
  }

  public withBeneficiaryEmail(email: string): ConventionDtoBuilder {
    return this.withBeneficiary({ ...this.#beneficiary, email });
  }

  public withBeneficiaryEmergencyContactEmail(
    emergencyContactEmail: string | undefined,
  ) {
    return this.withBeneficiary({
      ...this.#beneficiary,
      emergencyContactEmail,
    });
  }

  public withBeneficiaryFirstName(firstName: string): ConventionDtoBuilder {
    return this.withBeneficiary({
      ...this.#beneficiary,
      firstName,
    });
  }

  public withBeneficiaryLastName(lastName: string): ConventionDtoBuilder {
    return this.withBeneficiary({
      ...this.#beneficiary,
      lastName,
    });
  }

  public withBeneficiaryPhone(phone: string): ConventionDtoBuilder {
    return this.withBeneficiary({ ...this.#beneficiary, phone });
  }

  public withBeneficiaryRepresentative(
    beneficiaryRepresentative: BeneficiaryRepresentative | undefined,
  ): ConventionDtoBuilder {
    if (
      this.dto.internshipKind === "immersion" &&
      isBeneficiary(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryRepresentative,
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(this.dto.signatories.beneficiary)
    )
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryRepresentative,
        },
      });
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public withBeneficiaryRepresentativeSignedAt(
    date: Date | undefined,
  ): ConventionDtoBuilder {
    if (!this.dto.signatories.beneficiaryRepresentative) {
      throw new Error("beneficiaryRepresentative does not exist");
    }
    if (
      this.dto.internshipKind === "immersion" &&
      isBeneficiary(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryRepresentative: {
            ...this.dto.signatories.beneficiaryRepresentative,
            signedAt: date ? date.toISOString() : undefined,
          },
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          beneficiaryRepresentative: {
            ...this.dto.signatories.beneficiaryRepresentative,
            signedAt: date ? date.toISOString() : undefined,
          },
        },
      });
    }
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public withBeneficiaryRepresentativeEmail(email: string) {
    const beneficiaryRepresentative =
      this.dto.signatories.beneficiaryRepresentative;
    if (beneficiaryRepresentative)
      return this.withBeneficiaryRepresentative({
        ...beneficiaryRepresentative,
        email,
      });
    throw new Error("beneficiaryRepresentative is undefined.");
  }

  public withBeneficiarySignedAt(signedAt?: Date) {
    return this.withBeneficiary({
      ...this.dto.signatories.beneficiary,
      signedAt: signedAt?.toISOString(),
    });
  }

  public withBusinessName(businessName: BusinessName): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, businessName });
  }

  public withBusinessNameCustomized(
    businessNameCustomized: BusinessNameCustomized,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, businessNameCustomized });
  }

  public withDateApproval(
    dateApproval: string | undefined,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateApproval });
  }

  public withDateEnd(dateEnd: string): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateEnd });
  }

  public withDateStart(dateStart: string): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateStart });
  }

  public withDateSubmission(dateSubmission: string): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateSubmission });
  }

  public withDateValidation(
    dateValidation: DateString | undefined,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateValidation });
  }

  public withEstablishmentRepresentative(
    establishmentRepresentative: EstablishmentRepresentative,
  ) {
    if (
      this.dto.internshipKind === "immersion" &&
      isBeneficiary(this.dto.signatories.beneficiary)
    ) {
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          establishmentRepresentative,
        },
      });
    }
    if (
      this.dto.internshipKind === "mini-stage-cci" &&
      isBeneficiaryStudent(this.dto.signatories.beneficiary)
    )
      return new ConventionDtoBuilder({
        ...this.dto,
        signatories: {
          ...this.dto.signatories,
          establishmentRepresentative,
        },
      });
    throw new Error(
      `Beneficiary is not compatible with convention internship kind '${this.dto.internshipKind}'.`,
    );
  }

  public withEstablishmentRepresentativeEmail(email: string) {
    return this.withEstablishmentRepresentative({
      ...this.#establishmentRepresentative,
      email,
    });
  }

  public withEstablishmentRepresentativeFirstName(firstName: string) {
    return this.withEstablishmentRepresentative({
      ...this.dto.signatories.establishmentRepresentative,
      firstName,
    });
  }

  public withEstablishmentRepresentativeLastName(lastName: string) {
    return this.withEstablishmentRepresentative({
      ...this.dto.signatories.establishmentRepresentative,
      lastName,
    });
  }

  public withEstablishmentRepresentativePhone(phone: string) {
    return this.withEstablishmentRepresentative({
      ...this.dto.signatories.establishmentRepresentative,
      phone,
    });
  }

  public withEstablishmentRepresentativeSignedAt(signedAt?: Date) {
    return this.withEstablishmentRepresentative({
      ...this.#establishmentRepresentative,
      signedAt: signedAt?.toISOString(),
    });
  }

  public withEstablishmentTutor(
    establishmentTutor: EstablishmentTutor,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      establishmentTutor,
    });
  }

  public withEstablishmentTutorEmail(email: string): ConventionDtoBuilder {
    return this.withEstablishmentTutor({ ...this.#establishmentTutor, email });
  }

  public withEstablishmentTutorFirstName(
    firstName: string,
  ): ConventionDtoBuilder {
    return this.withEstablishmentTutor({
      ...this.#establishmentTutor,
      firstName,
    });
  }

  public withEstablishmentTutorLastName(
    lastName: string,
  ): ConventionDtoBuilder {
    return this.withEstablishmentTutor({
      ...this.#establishmentTutor,
      lastName,
    });
  }

  public withEstablishmentTutorPhone(phone: string): ConventionDtoBuilder {
    return this.withEstablishmentTutor({ ...this.#establishmentTutor, phone });
  }

  public withEstablishmentTutorJob(job: string) {
    return this.withEstablishmentTutor({ ...this.#establishmentTutor, job });
  }

  public withFederatedIdentity(
    federatedIdentity: FtConnectIdentity | undefined,
  ): ConventionDtoBuilder {
    return this.withBeneficiary({
      ...this.#beneficiary,
      ...(federatedIdentity ? { federatedIdentity } : {}),
    });
  }

  public withId(id: ConventionId): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, id });
  }

  public withImmersionAddress(immersionAddress: string): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      immersionAddress,
    });
  }

  public withRemoteWorkMode(remoteWorkMode: RemoteWorkMode) {
    return new ConventionDtoBuilder({
      ...this.dto,
      remoteWorkMode,
    });
  }

  public withImmersionAppellation(
    immersionAppellation: AppellationAndRomeDto,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      immersionAppellation,
    });
  }

  public withImmersionObjective(
    immersionObjective: ImmersionObjective,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      immersionObjective,
    });
  }

  public withIndividualProtection(
    individualProtection: boolean,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      individualProtection,
    });
  }

  public withIndividualProtectionDescription(
    individualProtectionDescription: string,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      individualProtectionDescription,
    });
  }

  public withInternshipKind(
    internshipKind: InternshipKind,
  ): ConventionDtoBuilder {
    return internshipKind === "immersion"
      ? new ConventionDtoBuilder({
          ...this.dto,
          internshipKind,
          signatories: {
            ...this.dto.signatories,
            beneficiary,
          },
        })
      : new ConventionDtoBuilder({
          ...this.dto,
          internshipKind,
          signatories: {
            ...this.dto.signatories,
            beneficiary: {
              ...beneficiary,
              levelOfEducation: "3ème",
              schoolName: "École du quartier ouest",
              schoolPostcode: "87000",
              address: {
                city: "Paris",
                departmentCode: "75",
                postcode: "75001",
                streetNumberAndAddress: "1 rue de la paix",
              },
            },
          },
        });
  }

  public withoutDateValidation(): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, dateValidation: undefined });
  }

  public withoutFederatedIdentity(): ConventionDtoBuilder {
    return this.withBeneficiary({
      ...this.#beneficiary,
      federatedIdentity: undefined,
    });
  }

  public withoutWorkCondition(): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      workConditions: undefined,
    });
  }

  public withRenewed(renewed: Renewed) {
    return new ConventionDtoBuilder({
      ...this.dto,
      renewed,
    });
  }

  public withSanitaryPrevention(
    sanitaryPrevention: boolean,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      sanitaryPrevention,
    });
  }

  public withSanitaryPreventionDescription(
    sanitaryPreventionDescription: string,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      sanitaryPreventionDescription,
    });
  }

  public withSchedule(
    scheduleMaker: (
      interval: DateIntervalDto,
      excludedDays: Weekday[],
    ) => ScheduleDto,
    excludedDays: Weekday[] = [],
  ) {
    return new ConventionDtoBuilder({
      ...this.dto,
      schedule: scheduleMaker(
        {
          start: new Date(this.dto.dateStart),
          end: new Date(this.dto.dateEnd),
        },
        excludedDays,
      ),
    });
  }

  public withSiret(siret: SiretDto): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, siret });
  }

  public withStatus(status: ConventionStatus): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, status });
  }

  public withStatusJustification(statusJustification: string | undefined) {
    return new ConventionDtoBuilder({
      ...this.dto,
      statusJustification,
    });
  }

  public withUpdatedAt(updatedAt: DateString): ConventionDtoBuilder {
    return new ConventionDtoBuilder({ ...this.dto, updatedAt });
  }

  public withValidator(
    agencyValidator: WithOptionalFirstnameAndLastname,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      validators: {
        ...this.dto.validators,
        agencyValidator,
      },
    });
  }

  public withCounsellor(
    agencyCounsellor: WithOptionalFirstnameAndLastname,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      validators: {
        ...this.dto.validators,
        agencyCounsellor,
      },
    });
  }

  public withAgencyReferent(
    agencyReferent: WithOptionalFirstnameAndLastname,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      agencyReferent,
    });
  }

  public withEstablishmentNumberOfEmployeesRange(
    establishmentNumberEmployeesRange: NumberEmployeesRange | undefined,
  ): ConventionDtoBuilder {
    return new ConventionDtoBuilder({
      ...this.dto,
      establishmentNumberEmployeesRange,
    });
  }

  get #validators(): ConventionValidatorInputNames | undefined {
    return this.dto.validators;
  }

  get #establishmentRepresentative(): EstablishmentRepresentative {
    return this.dto.signatories.establishmentRepresentative;
  }

  get #establishmentTutor(): EstablishmentTutor {
    return this.dto.establishmentTutor;
  }

  get #beneficiary(): Beneficiary<InternshipKind> {
    return this.dto.signatories.beneficiary;
  }

  get #beneficiaryCurrentEmployer(): BeneficiaryCurrentEmployer | undefined {
    return this.dto.signatories.beneficiaryCurrentEmployer;
  }

  get #beneficiaryRepresentative(): BeneficiaryRepresentative | undefined {
    return this.dto.signatories.beneficiaryRepresentative;
  }
}
