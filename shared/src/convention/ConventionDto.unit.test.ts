import { addDays, format, subDays, subYears } from "date-fns";
import { keys } from "ramda";
import { ZodError } from "zod";
import {
  DATE_CONSIDERED_OLD,
  type DailyScheduleDto,
  type DateIntervalDto,
  type DateString,
  localization,
  MAX_PRESENCE_DAYS_RELEASE_DATE,
  maxPresenceDaysByInternshipKind,
  SIGNATORIES_PHONE_NUMBER_DISTINCT_RELEASE_DATE,
  toDateUTCString,
  type Weekday,
  type ZodSchemaWithInputMatchingOutput,
} from "..";
import {
  calculateNumberOfWorkedDays,
  calculateTotalImmersionHoursFromComplexSchedule,
  reasonableSchedule,
} from "../schedule/ScheduleUtils";
import {
  expectArraysToEqualIgnoringOrder,
  expectToEqual,
  splitCasesBetweenPassingAndFailing,
} from "../test.helpers";
import { ConventionDtoBuilder, DATE_START } from "./ConventionDtoBuilder";
import {
  type Beneficiary,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  CCI_15YO_REQUIREMENT_RELEASE_DATE,
  CCI_16YO_REQUIREMENT_RELEASE_DATE,
  CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE,
  type ConventionInternshipKindSpecific,
  type ConventionReadDto,
  conventionStatuses,
  type EditConventionWithFinalStatusFormValues,
  type EstablishmentRepresentative,
  type InternshipKind,
  makeEmptyLastReminders,
  maximumCalendarDayByInternshipKind,
} from "./convention.dto";
import {
  conventionInternshipKindSpecificSchema,
  conventionReadSchema,
  conventionSchema,
  editConventionWithFinalStatusFormSchema,
  editConventionWithFinalStatusRequestSchema,
  updateConventionStatusRequestSchema,
} from "./convention.schema";
import {
  getConventionTooLongMessageAndPath,
  getOverMaxWorkedDaysMessageAndPath,
} from "./conventionRefinements";

const beneficiaryRepresentative: BeneficiaryRepresentative = {
  role: "beneficiary-representative",
  firstName: "Benef",
  lastName: "Representative",
  phone: "0600110011",
  email: "benef.representative@mail.fr",
};

describe("conventionDtoSchema", () => {
  it("accepts valid Convention", () => {
    const convention = new ConventionDtoBuilder().build();
    expectDtoToBeValid(conventionSchema, convention);
  });

  describe("email validations", () => {
    it("ignores accents and case on emails", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryEmail("Jérôme_Truc@associés.fr")
        .build();
      const parsedConvention = conventionSchema.parse(convention);
      expect(parsedConvention.signatories.beneficiary.email).toBe(
        "jerome_truc@associes.fr",
      );
    });

    it("allow empty emergency contact email", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryEmergencyContactEmail("")
        .build();
      const parsedConvention = conventionSchema.parse(convention);
      expect(
        parsedConvention.signatories.beneficiary.emergencyContactEmail,
      ).toBe("");
    });

    it("ignores accents on emergency contact email", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryEmergencyContactEmail("Jérôme_Truc@associés.fr")
        .build();
      const parsedConvention = conventionSchema.parse(convention);
      expect(
        parsedConvention.signatories.beneficiary.emergencyContactEmail,
      ).toBe("jerome_truc@associes.fr");
    });

    it("rejects equal beneficiary and establishment tutor emails", () => {
      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder()
          .withBeneficiaryEmail("demandeur@mail.fr")
          .withEstablishmentTutorEmail("demandeur@mail.fr")
          .build(),
        [
          "establishmentTutor.email: Le mail du tuteur doit être différent des mails du bénéficiaire, de son représentant légal et de son employeur actuel.",
        ],
      );
    });

    it("rejects equal beneficiary and establishment representative emails", () => {
      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder()
          .withBeneficiaryEmail("demandeur@mail.fr")
          .withEstablishmentRepresentativeEmail("demandeur@mail.fr")
          .build(),
        [
          "signatories.beneficiary.email: Les emails des signataires doivent être différents.",
          "signatories.establishmentRepresentative.email: Les emails des signataires doivent être différents.",
        ],
      );
    });

    it("rejects equal beneficiary and beneficiary representative emails", () => {
      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder()
          .withBeneficiaryEmail("demandeur@mail.fr")
          .withBeneficiaryRepresentative({
            ...beneficiaryRepresentative,
            email: "demandeur@mail.fr",
          })
          .build(),
        [
          "signatories.beneficiary.email: Les emails des signataires doivent être différents.",
          "signatories.beneficiaryRepresentative.email: Les emails des signataires doivent être différents.",
        ],
      );
    });

    it("rejects equal beneficiary representative and establishment tutor emails", () => {
      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder()
          .withEstablishmentTutorEmail(beneficiaryRepresentative.email)
          .withBeneficiaryRepresentative(beneficiaryRepresentative)
          .build(),
        [
          "establishmentTutor.email: Le mail du tuteur doit être différent des mails du bénéficiaire, de son représentant légal et de son employeur actuel.",
        ],
      );
    });

    it("rejects equal beneficiary current employer and other signatories", () => {
      const currentEmployer: BeneficiaryCurrentEmployer = {
        role: "beneficiary-current-employer",
        email: "email@email.com",
        phone: "+33600110011",
        firstName: "John",
        lastName: "Doe",
        businessSiret: "11112222333344",
        businessName: "machin",
        businessAddress: "truc",
        job: "Chef",
      };

      const convention = new ConventionDtoBuilder()
        .withBeneficiaryCurrentEmployer(currentEmployer)
        .build();

      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder(convention)
          .withBeneficiaryEmail(currentEmployer.email)
          .build(),
        [
          "signatories.beneficiary.email: Les emails des signataires doivent être différents.",
          "signatories.beneficiaryCurrentEmployer.email: Les emails des signataires doivent être différents.",
        ],
      );

      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder(convention)
          .withBeneficiaryRepresentative({
            ...currentEmployer,
            role: "beneficiary-representative",
          })
          .build(),
        [
          "signatories.beneficiaryRepresentative.email: Les emails des signataires doivent être différents.",
          "signatories.beneficiaryCurrentEmployer.email: Les emails des signataires doivent être différents.",
        ],
      );

      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        new ConventionDtoBuilder(convention)
          .withEstablishmentRepresentativeEmail(currentEmployer.email)
          .build(),
        [
          "signatories.establishmentRepresentative.email: Les emails des signataires doivent être différents.",
          "signatories.beneficiaryCurrentEmployer.email: Les emails des signataires doivent être différents.",
        ],
      );
    });

    it("confirm convention read schema inherit convention controls", () => {
      const validConventionRead: ConventionReadDto = {
        ...new ConventionDtoBuilder().build(),
        agencyName: "agence de test",
        agencySiret: "00000000000000",
        agencyContactEmail: "contact@mail.com",
        agencyDepartment: "75",
        agencyKind: "france-travail",
        agencyValidationSteps: "validator-only",
        assessment: {
          status: "COMPLETED",
          endedWithAJob: false,
          signedAt: null,
          createdAt: new Date().toISOString(),
        },
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      };
      expect(() =>
        conventionReadSchema.parse(validConventionRead),
      ).not.toThrow();
      expect(conventionReadSchema.parse(validConventionRead)).toBeTruthy();
      const invalidConventionRead: ConventionReadDto = {
        ...new ConventionDtoBuilder()
          .withEstablishmentTutorEmail(beneficiaryRepresentative.email)
          .withBeneficiaryRepresentative(beneficiaryRepresentative)
          .build(),
        agencyName: "agence de test",
        agencySiret: "00000000000000",
        agencyContactEmail: "contact@mail.com",
        agencyDepartment: "90",
        agencyKind: "france-travail",
        agencyValidationSteps: "validator-only",
        assessment: {
          status: "COMPLETED",
          endedWithAJob: false,
          signedAt: null,
          createdAt: new Date().toISOString(),
        },
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: true,
        establishmentBannishmentJustification:
          "Achète du Coca-Cola au lieu du Breizh-Cola",
      };
      expectDtoInvalidWithIssueMessages(
        conventionReadSchema,
        invalidConventionRead,
        [
          "establishmentTutor.email: Le mail du tuteur doit être différent des mails du bénéficiaire, de son représentant légal et de son employeur actuel.",
        ],
      );
    });
  });

  it("rejects when string with spaces are provided", () => {
    const convention = new ConventionDtoBuilder().withId("  ").build();

    expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
      "id: Le format de l'identifiant est invalide",
    ]);
  });

  describe("phone validation", () => {
    it("rejects when phone is not a valid number", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryPhone("wrong")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        `signatories.beneficiary.phone: Le numéro de téléphone '${convention.signatories.beneficiary.phone}' n'est pas valide en France.`,
      ]);

      const convention2 = new ConventionDtoBuilder()
        .withBeneficiaryPhone("0203stillWrong")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention2, [
        `signatories.beneficiary.phone: Le numéro de téléphone '${convention2.signatories.beneficiary.phone}' n'est pas valide en France.`,
      ]);
    });

    it("rejects when establishmentTutorPhone is not a valid number", () => {
      const convention = new ConventionDtoBuilder()
        .withEstablishmentTutorPhone("wrong")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        `establishmentTutor.phone: Le numéro de téléphone '${convention.establishmentTutor.phone}' n'est pas valide en France.`,
      ]);
    });

    describe("when signatories have same phone numbers", () => {
      it("does nothing if submission date if before constraint release date", () => {
        const convention = new ConventionDtoBuilder()
          .withDateSubmission(
            subDays(
              SIGNATORIES_PHONE_NUMBER_DISTINCT_RELEASE_DATE,
              2,
            ).toISOString(),
          )
          .withBeneficiaryPhone("+33632342426")
          .withBeneficiaryRepresentative({
            ...beneficiaryRepresentative,
            phone: "+33632342426",
          })
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });

      it("rejects equal beneficiary and beneficiary representative phone numbers", () => {
        expectDtoInvalidWithIssueMessages(
          conventionSchema,
          new ConventionDtoBuilder()
            .withDateSubmission("2025-05-25")
            .withBeneficiaryPhone("+33632342426")
            .withBeneficiaryRepresentative({
              ...beneficiaryRepresentative,
              phone: "+33632342426",
            })
            .build(),
          [
            "signatories.beneficiary.phone: Les numéros de téléphone des signataires doivent être différents.",
            "signatories.beneficiaryRepresentative.phone: Les numéros de téléphone des signataires doivent être différents.",
          ],
        );
      });

      it("rejects equal beneficiary and establishment representative phone numbers", () => {
        expectDtoInvalidWithIssueMessages(
          conventionSchema,
          new ConventionDtoBuilder()
            .withDateSubmission("2025-05-25")
            .withBeneficiaryPhone("+33632342426")
            .withEstablishmentRepresentativePhone("+33632342426")
            .build(),
          [
            "signatories.beneficiary.phone: Les numéros de téléphone des signataires doivent être différents.",
            "signatories.establishmentRepresentative.phone: Les numéros de téléphone des signataires doivent être différents.",
          ],
        );
      });
    });
  });

  it("rejects when establishmentTutorJob is an empty string", () => {
    const convention = new ConventionDtoBuilder()
      .withEstablishmentTutor({
        email: "tuteur@entreprise.com",
        firstName: "Jean",
        lastName: "Tuteur",
        phone: "0102030405",
        job: "",
        role: "establishment-tutor",
      })
      .build();

    expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
      "establishmentTutor.job: Ce champ est obligatoire",
    ]);
  });

  describe("contraints on number of day of presence", () => {
    const dateStart = new Date("2025-03-31");

    const maxCalendarDays =
      maximumCalendarDayByInternshipKind["mini-stage-cci"];
    const maxPresenceDays = maxPresenceDaysByInternshipKind["mini-stage-cci"];

    const makeConvention = (dateSubmission: DateString) =>
      new ConventionDtoBuilder()
        .withInternshipKind("mini-stage-cci")
        .withDateSubmission(dateSubmission)
        .withDateStart(dateStart.toISOString())
        .withDateEnd(addDays(dateStart, maxCalendarDays).toISOString())
        .withSchedule(reasonableSchedule, ["samedi", "dimanche"])
        .build();

    describe(`when submission date is before ${format(MAX_PRESENCE_DAYS_RELEASE_DATE, "dd/MM/yyyy")} (date where we shipped in prod)`, () => {
      it(`accepts conventions with more than ${maxPresenceDays} days of presence for internshipKind: 'mini-stage-cci'`, () => {
        const convention = makeConvention(
          subDays(new Date(MAX_PRESENCE_DAYS_RELEASE_DATE), 1).toISOString(),
        );

        expectDtoToBeValid(conventionSchema, convention);
      });
    });

    describe(`when submission date is after ${format(MAX_PRESENCE_DAYS_RELEASE_DATE, "dd/MM/yyyy")} (date where we shipped in prod)`, () => {
      it(`reject conventions with more than ${maxPresenceDays} days of presence for intershipKind: 'mini-stage-cci'`, () => {
        const convention = makeConvention(
          addDays(new Date(MAX_PRESENCE_DAYS_RELEASE_DATE), 1).toISOString(),
        );

        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          `dateEnd: ${getOverMaxWorkedDaysMessageAndPath(convention).message}`,
        ]);
      });
    });
  });

  describe("constraints on convention start and end dates", () => {
    it("rejects misformatted submission dates", () => {
      const convention = new ConventionDtoBuilder()
        .withDateSubmission("not-a-date")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "dateSubmission: Le format de la date saisie est invalide",
      ]);
    });

    it("rejects misformatted start dates", () => {
      const convention = new ConventionDtoBuilder()
        .withDateStart("not-a-date")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "dateStart: Le format de la date de début est invalide",
        "dateEnd: La date de fin doit être après la date de début.",
        "dateEnd: La durée maximale calendaire d'une immersion est de 30 jours.",
        "signatories.beneficiaryRepresentative: Les bénéficiaires mineurs doivent renseigner un représentant légal. Le bénéficiaire aurait NaN ans au démarrage de la convention.",
        "schedule: Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Veuillez remplir les horaires.",
      ]);
    });

    it("rejects misformatted end dates", () => {
      const convention = new ConventionDtoBuilder()
        .withDateEnd("not-a-date")
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "dateEnd: Le format de la date de fin est invalide",
        "dateEnd: La date de fin doit être après la date de début.",
        "dateEnd: La durée maximale calendaire d'une immersion est de 30 jours.",
        "schedule: Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Veuillez remplir les horaires.",
      ]);
    });

    it("rejects start dates that are after the end date", () => {
      const convention = new ConventionDtoBuilder()
        .withDateStart("2024-10-10")
        .withDateEnd("2024-10-03")
        .withSchedule(reasonableSchedule)
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "dateEnd: La date de fin doit être après la date de début.",
        "schedule: Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Veuillez remplir les horaires.",
      ]);
    });

    it("accept start dates that are tuesday if submitting on previous friday", () => {
      const convention = new ConventionDtoBuilder()
        .withDateSubmission("2023-10-15") // which is a friday
        .withDateStart("2023-10-19") // which is the following tuesday
        .withDateEnd("2023-10-27")
        .withSchedule(reasonableSchedule)
        .build();

      expectDtoToBeValid(conventionSchema, convention);
    });

    describe("Handle convention validation with time periods on season time update", () => {
      it("summer time", () => {
        const complexSchedule: DailyScheduleDto[] = [
          { date: "2023-03-20T00:00:00.000Z", timePeriods: [] },
          { date: "2023-04-06T00:00:00.000Z", timePeriods: [] },
          {
            date: "2023-04-07T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-04-08T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          { date: "2023-04-09T00:00:00.000Z", timePeriods: [] },
          {
            date: "2023-04-10T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-04-11T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-04-12T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
        ];

        expectToEqual(calculateNumberOfWorkedDays(complexSchedule), 5);
        expectToEqual(
          calculateTotalImmersionHoursFromComplexSchedule(complexSchedule),
          35,
        );
        const convention = new ConventionDtoBuilder()
          .withDateStart("2023-03-20")
          .withDateEnd("2023-04-12")
          .withSchedule(
            (_interval: DateIntervalDto, _excludedDays?: Weekday[]) => ({
              totalHours:
                calculateTotalImmersionHoursFromComplexSchedule(
                  complexSchedule,
                ),
              isSimple: false,
              complexSchedule,
              workedDays: calculateNumberOfWorkedDays(complexSchedule),
            }),
          )
          .build();
        expectToEqual(conventionSchema.parse(convention), convention);
      });

      it("winter time", () => {
        const complexSchedule: DailyScheduleDto[] = [
          { date: "2023-10-20T00:00:00.000Z", timePeriods: [] },
          { date: "2023-11-06T00:00:00.000Z", timePeriods: [] },
          {
            date: "2023-11-07T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-11-08T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          { date: "2023-11-09T00:00:00.000Z", timePeriods: [] },
          {
            date: "2023-11-10T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-11-11T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
          {
            date: "2023-11-12T00:00:00.000Z",
            timePeriods: [
              { start: "09:00", end: "12:00" },
              { start: "13:00", end: "17:00" },
            ],
          },
        ];

        expectToEqual(calculateNumberOfWorkedDays(complexSchedule), 5);
        expectToEqual(
          calculateTotalImmersionHoursFromComplexSchedule(complexSchedule),
          35,
        );
        const convention = new ConventionDtoBuilder()
          .withDateStart("2023-10-20")
          .withDateEnd("2023-11-12")
          .withSchedule(
            (_interval: DateIntervalDto, _excludedDays?: Weekday[]) => ({
              totalHours:
                calculateTotalImmersionHoursFromComplexSchedule(
                  complexSchedule,
                ),
              isSimple: false,
              complexSchedule,
              workedDays: calculateNumberOfWorkedDays(complexSchedule),
            }),
          )
          .build();
        expectToEqual(conventionSchema.parse(convention), convention);
      });
    });

    describe("Correctly handles max authorized number of days", () => {
      const calendarDayAndInternShips = keys(
        maximumCalendarDayByInternshipKind,
      ).map((internshipKind) => ({
        internshipKind,
        maxCalendarDays: maximumCalendarDayByInternshipKind[internshipKind],
      }));

      it.each(
        calendarDayAndInternShips,
      )("for $internshipKind rejects when it is more than $maxCalendarDays", ({
        internshipKind,
        maxCalendarDays,
      }) => {
        const convention = new ConventionDtoBuilder()
          .withInternshipKind(internshipKind)
          .withDateStart(DATE_START)
          .withDateEnd(
            addDays(new Date(DATE_START), maxCalendarDays + 1).toISOString(),
          )
          .withSchedule(reasonableSchedule, [
            "lundi",
            "mercredi",
            "vendredi",
            "samedi",
            "dimanche",
          ])
          .build();

        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          `dateEnd: ${
            getConventionTooLongMessageAndPath({
              internshipKind,
            }).message
          }`,
        ]);
      });

      it.each(
        calendarDayAndInternShips,
      )("for $intershipKind accepts end date that are <= $maxCalendarDays calendar days after the start date", ({
        internshipKind,
        maxCalendarDays,
      }) => {
        const dateStart = DATE_START;
        const dateEnd = addDays(
          new Date(DATE_START),
          maxCalendarDays,
        ).toISOString();
        const convention = new ConventionDtoBuilder()
          .withInternshipKind(internshipKind)
          .withDateStart(dateStart)
          .withDateEnd(dateEnd)
          .withSchedule(reasonableSchedule, [
            "jeudi",
            "vendredi",
            "samedi",
            "dimanche",
          ])
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });
    });

    describe("when max hours per week is exceeded", () => {
      type Month = "2024-07" | "2024-09";

      const createConvention = (month: Month) => {
        const complexSchedule = [
          {
            date: `${month}-02T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:00" },
            ],
          },
          {
            date: `${month}-03T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "18:00" },
            ],
          },
          {
            date: `${month}-04T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:30" },
            ],
          },
          {
            date: `${month}-05T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:30" },
            ],
          },
          {
            date: `${month}-06T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:30" },
            ],
          },
          {
            date: `${month}-06T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:30" },
            ],
          },
          {
            date: `${month}-11T00:00:00.000Z`,
            timePeriods: [
              { start: "08:00", end: "12:30" },
              { start: "13:00", end: "19:30" },
            ],
          },
        ];

        return new ConventionDtoBuilder()
          .withInternshipKind("immersion")
          .withDateStart(new Date(`${month}-05`).toISOString())
          .withDateEnd(addDays(new Date(`${month}-05`), 7).toISOString())
          .withSchedule(
            (_interval: DateIntervalDto, _excludedDays?: Weekday[]) => ({
              totalHours:
                calculateTotalImmersionHoursFromComplexSchedule(
                  complexSchedule,
                ),
              isSimple: false,
              complexSchedule,
              workedDays: calculateNumberOfWorkedDays(complexSchedule),
            }),
          )
          .build();
      };

      it(`check max per week when endDate is after ${DATE_CONSIDERED_OLD}`, () => {
        const convention = createConvention("2024-09");
        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          "schedule: Convention a99eaca1-ee70-4c90-b3f4-668d492f7392 - Veuillez saisir moins de 48h pour la semaine 1.",
        ]);
      });

      it(`does NOT check max per week when endDate is before ${DATE_CONSIDERED_OLD}`, () => {
        const convention = createConvention("2024-07");
        expectDtoToBeValid(conventionSchema, convention);
      });
    });

    describe("CCI specific age constraints", () => {
      const DATES = {
        CCI_15YO_RELEASE_BEFORE: subDays(
          CCI_15YO_REQUIREMENT_RELEASE_DATE,
          1,
        ).toISOString(),
        CCI_15YO_RELEASE_AFTER: addDays(
          CCI_15YO_REQUIREMENT_RELEASE_DATE,
          1,
        ).toISOString(),
        CCI_16YO_RELEASE_BEFORE: subDays(
          CCI_16YO_REQUIREMENT_RELEASE_DATE,
          1,
        ).toISOString(),
        CCI_16YO_RELEASE_AT: toDateUTCString(CCI_16YO_REQUIREMENT_RELEASE_DATE),
        CCI_16YO_RELEASE_AFTER: addDays(
          CCI_16YO_REQUIREMENT_RELEASE_DATE,
          1,
        ).toISOString(),
      };

      describe("Add issue when week hours is greater than cci max hours", () => {
        const conventionStartDate = new Date("2025-11-03");
        const makeConventionDto = ({
          conventionStartDate,
          submissionDate,
          workedDaysCount,
          beneficiaryBirthdate,
        }: {
          conventionStartDate: Date;
          submissionDate: DateString;
          workedDaysCount: number;
          beneficiaryBirthdate: DateString;
        }) => {
          return new ConventionDtoBuilder()
            .withInternshipKind("mini-stage-cci")
            .withDateStart(conventionStartDate.toISOString())
            .withDateEnd(
              addDays(conventionStartDate, workedDaysCount - 1).toISOString(),
            )
            .withDateSubmission(submissionDate)
            .withBeneficiaryBirthdate(beneficiaryBirthdate)
            .withBeneficiaryRepresentative(beneficiaryRepresentative)
            .withSchedule(reasonableSchedule)
            .build();
        };

        describe("when beneficiary is under 15yo", () => {
          const beneficiaryBirthdayDate_14yo = subYears(
            new Date(conventionStartDate),
            14,
          ).toISOString();

          it.each([
            {
              title: `before ${CCI_15YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_15YO_RELEASE_BEFORE,
            },
            {
              title: `after ${CCI_15YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
            },
            {
              title: `after ${CCI_16YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_16YO_RELEASE_AFTER,
            },
          ])("when $title, can create convention with weekly hours < 30h", ({
            submissionDate,
          }) => {
            const conventionWithLightSchedule = makeConventionDto({
              conventionStartDate,
              submissionDate,
              workedDaysCount: 4,
              beneficiaryBirthdate: beneficiaryBirthdayDate_14yo,
            });

            expectDtoToBeValid(conventionSchema, conventionWithLightSchedule);
          });

          it.each([
            {
              title: `before ${CCI_15YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_15YO_RELEASE_BEFORE,
            },
            {
              title: `after ${CCI_15YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
            },
            {
              title: `after ${CCI_16YO_REQUIREMENT_RELEASE_DATE}`,
              submissionDate: DATES.CCI_16YO_RELEASE_AFTER,
            },
          ])("when $title, fails when weekly hours > 30h", ({
            submissionDate,
          }) => {
            expectDtoInvalidWithIssueMessages(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate,
                workedDaysCount: 5,
                beneficiaryBirthdate: beneficiaryBirthdayDate_14yo,
              }),
              [
                `schedule.totalHours: La durée maximale hebdomadaire d'un mini-stage pour une personne de 14 ans est de 30h`,
              ],
            );
          });
        });

        describe("when beneficiary is between 15yo and 16yo", () => {
          const beneficiaryBirthdayDate_15yr = subYears(
            conventionStartDate,
            15,
          ).toISOString();

          it(`before ${CCI_15YO_REQUIREMENT_RELEASE_DATE}, convention can have > 30h`, () => {
            expectDtoToBeValid(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_15YO_RELEASE_BEFORE,
                workedDaysCount: 6,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
            );
          });

          it(`after ${CCI_15YO_REQUIREMENT_RELEASE_DATE}, weekly hours can be > 30h but <= 35h`, () => {
            expectDtoToBeValid(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
                workedDaysCount: 5,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
            );
          });

          it(`after ${CCI_15YO_REQUIREMENT_RELEASE_DATE} and before ${CCI_16YO_REQUIREMENT_RELEASE_DATE}, fails when weekly hours > 35h`, () => {
            expectDtoInvalidWithIssueMessages(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
                workedDaysCount: 6,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
              [
                "schedule.totalHours: La durée maximale hebdomadaire d'un mini-stage pour une personne de 15 ans est de 35h",
              ],
            );
          });

          it(`on ${CCI_16YO_REQUIREMENT_RELEASE_DATE}, weekly hours can be > 30h but <= 35h`, () => {
            expectDtoToBeValid(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_16YO_RELEASE_AT,
                workedDaysCount: 5,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
            );
          });

          it(`on ${CCI_16YO_REQUIREMENT_RELEASE_DATE}, weekly hours can be > 30h but <= 35h`, () => {
            expectDtoToBeValid(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_16YO_RELEASE_AFTER,
                workedDaysCount: 5,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
            );
          });

          it(`after ${CCI_16YO_REQUIREMENT_RELEASE_DATE}, fails when weekly hours > 35h`, () => {
            expectDtoInvalidWithIssueMessages(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_16YO_RELEASE_AFTER,
                workedDaysCount: 6,
                beneficiaryBirthdate: beneficiaryBirthdayDate_15yr,
              }),
              [
                "dateEnd: Le nombre maximum de jours de présence est 5 jours. Actuellement, il y a 6 jours de présence.",
                "schedule.totalHours: La durée maximale hebdomadaire d'un mini-stage pour une personne de 15 ans est de 35h",
              ],
            );
          });
        });

        describe("when beneficiary is > 16yo", () => {
          const beneficiaryBirthdayDate18yo = subYears(
            conventionStartDate,
            18,
          ).toISOString();

          it.each([
            {
              title: `before ${CCI_15YO_REQUIREMENT_RELEASE_DATE}, can create convention > ${35} hours`,
              submissionDate: DATES.CCI_15YO_RELEASE_BEFORE,
              workedDaysCount: 6,
              weeklyHours: 42,
            },
            {
              title: `after ${CCI_15YO_REQUIREMENT_RELEASE_DATE}, can create convention <= ${35} hours`,
              submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
              workedDaysCount: 5,
              weeklyHours: 35,
            },
            {
              title: `after ${CCI_16YO_REQUIREMENT_RELEASE_DATE}, can create convention <= ${35} hours`,
              submissionDate: DATES.CCI_16YO_RELEASE_AFTER,
              workedDaysCount: 5,
              weeklyHours: 35,
            },
          ])("$title", ({ submissionDate, workedDaysCount }) => {
            expectDtoToBeValid(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: submissionDate,
                workedDaysCount: workedDaysCount,
                beneficiaryBirthdate: beneficiaryBirthdayDate18yo,
              }),
            );
          });

          it(`after ${CCI_15YO_REQUIREMENT_RELEASE_DATE}, cannot create convention > ${35} hours`, () => {
            expectDtoInvalidWithIssueMessages(
              conventionSchema,
              makeConventionDto({
                conventionStartDate,
                submissionDate: DATES.CCI_15YO_RELEASE_AFTER,
                workedDaysCount: 6,
                beneficiaryBirthdate: beneficiaryBirthdayDate18yo,
              }),
              [
                "schedule.totalHours: La durée maximale hebdomadaire d'un mini-stage pour une personne de 18 ans est de 35h",
              ],
            );
          });
        });
      });

      describe("Add issue when daily hours is greater than cci max daily hours", () => {
        const dateStart = new Date("2022-10-10").toISOString();
        const dateEnd = addDays(new Date(dateStart), 4).toISOString();

        type DailyHourOption = 8 | 9;

        const createOldConventionWithTimePeriods = (
          dailyHours: DailyHourOption,
        ) => {
          const endHourSelector: Record<DailyHourOption, DateString> = {
            "8": "15:00",
            "9": "16:00",
          };

          const dailyComplexSchedule: DailyScheduleDto[] = [
            {
              date: "2022-10-10T00:00:00.000Z",
              timePeriods: [
                { start: "07:00", end: endHourSelector[dailyHours] },
              ],
            },
            {
              date: "2022-10-11T00:00:00.000Z",
              timePeriods: [{ start: "09:00", end: "15:00" }],
            },
          ];

          return new ConventionDtoBuilder()
            .withInternshipKind("mini-stage-cci")
            .withDateStart(dateStart)
            .withDateEnd(dateEnd)
            .withSchedule(
              (_interval: DateIntervalDto, _excludedDays?: Weekday[]) => ({
                totalHours:
                  calculateTotalImmersionHoursFromComplexSchedule(
                    dailyComplexSchedule,
                  ),
                isSimple: false,
                complexSchedule: dailyComplexSchedule,
                workedDays: calculateNumberOfWorkedDays(dailyComplexSchedule),
              }),
            )
            .build();
        };

        it(`valid when submitted before ${CCI_16YO_REQUIREMENT_RELEASE_DATE} and exceed daily limit of ${7}h`, () => {
          expectDtoToBeValid(
            conventionSchema,
            new ConventionDtoBuilder(createOldConventionWithTimePeriods(8))
              .withDateSubmission(DATES.CCI_16YO_RELEASE_BEFORE)
              .build(),
          );
        });

        it(`valid when submitted on ${CCI_16YO_REQUIREMENT_RELEASE_DATE} and exceed daily limit of ${7}h`, () => {
          expectDtoToBeValid(
            conventionSchema,
            new ConventionDtoBuilder(createOldConventionWithTimePeriods(8))
              .withDateSubmission(DATES.CCI_16YO_RELEASE_AT)
              .build(),
          );
        });

        it(`valid when submitted after ${CCI_16YO_REQUIREMENT_RELEASE_DATE} and below daily limit of 8h`, () => {
          expectDtoToBeValid(
            conventionSchema,
            new ConventionDtoBuilder(createOldConventionWithTimePeriods(8))
              .withDateSubmission(DATES.CCI_16YO_RELEASE_AT)
              .build(),
          );
        });

        it(`throw when submitted after ${CCI_16YO_REQUIREMENT_RELEASE_DATE} and exceed daily limit of ${7}h`, () => {
          const recentConvention = new ConventionDtoBuilder(
            createOldConventionWithTimePeriods(9),
          )
            .withDateSubmission(DATES.CCI_16YO_RELEASE_AFTER)
            .build();

          expectDtoInvalidWithIssueMessages(
            conventionSchema,
            recentConvention,
            [
              "schedule.totalHours: La durée maximale journalière d'un mini-stage pour une personne de 20 ans est de 8h",
            ],
          );
        });
      });
    });

    describe("status that are available without signatures", () => {
      const [allowWithoutSignature, failingWithoutSignature] =
        splitCasesBetweenPassingAndFailing(conventionStatuses, [
          "READY_TO_SIGN",
          "PARTIALLY_SIGNED",
          "REJECTED",
          "CANCELLED",
          "DEPRECATED",
        ]);

      it.each(
        allowWithoutSignature.map((status) => ({ status })),
      )("WITHOUT signatures, a Convention CAN be $status", ({ status }) => {
        const convention = new ConventionDtoBuilder()
          .withStatus(status)
          .notSigned()
          .build();
        expectDtoToBeValid(conventionSchema, convention);
      });

      it.each(
        failingWithoutSignature.map((status) => ({ status })),
      )("WITHOUT signatures, a Convention CANNOT be $status", ({ status }) => {
        const convention = new ConventionDtoBuilder()
          .withStatus(status)
          .notSigned()
          .build();
        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          "status: La confirmation de votre accord est obligatoire.",
        ]);
      });
    });
  });

  describe("differentiate beneficiaries according to internshipkind", () => {
    const establishmentRepresentative: EstablishmentRepresentative = {
      email: "b@b.com",
      firstName: "dfssd",
      lastName: "fghfg",
      phone: "0756435789",
      role: "establishment-representative",
    };
    const beneficiaryStudent: Beneficiary<"mini-stage-cci"> = {
      birthdate: new Date().toISOString(),
      levelOfEducation: "1ère",
      email: "a@a.com",
      firstName: "student",
      lastName: "student",
      phone: "0656435789",
      role: "beneficiary",
      isRqth: false,
      schoolName: "École du quartier ouest",
      schoolPostcode: "87000",
    };
    const beneficiary: Beneficiary<"immersion"> = {
      birthdate: new Date().toISOString(),
      email: "a@a.com",
      firstName: "sdfgf",
      lastName: "sdfs",
      phone: "0656435789",
      role: "beneficiary",
      isRqth: false,
    };

    it("right path internship immersion", () => {
      const conventionInternshipKindSpecificImmersion: ConventionInternshipKindSpecific<"immersion"> =
        {
          internshipKind: "immersion",
          signatories: {
            beneficiary,
            establishmentRepresentative,
          },
        };
      expect(() =>
        conventionInternshipKindSpecificSchema.parse(
          conventionInternshipKindSpecificImmersion,
        ),
      ).not.toThrow();
      expect(
        conventionInternshipKindSpecificSchema.parse(
          conventionInternshipKindSpecificImmersion,
        ),
      ).toBeTruthy();
    });

    it("right path internship mini-stage-cci", () => {
      const conventionInternshipKindSpecificCci: ConventionInternshipKindSpecific<"mini-stage-cci"> =
        {
          internshipKind: "mini-stage-cci",
          signatories: {
            beneficiary: beneficiaryStudent,
            establishmentRepresentative,
          },
        };
      expect(() =>
        conventionInternshipKindSpecificSchema.parse(
          conventionInternshipKindSpecificCci,
        ),
      ).not.toThrow();
      expect(
        conventionInternshipKindSpecificSchema.parse(
          conventionInternshipKindSpecificCci,
        ),
      ).toBeTruthy();
    });

    it("bad path internship mini-stage-cci", () => {
      const badConventionInternshipKindSpecific: ConventionInternshipKindSpecific<InternshipKind> =
        {
          internshipKind: "mini-stage-cci",
          signatories: {
            beneficiary,
            establishmentRepresentative,
          },
        };
      const expectedErrorMessages = [
        "signatories.beneficiary.levelOfEducation: Votre niveau d'étude est obligatoire.",
        "signatories.beneficiary.schoolName: Ce champ est obligatoire",
        "signatories.beneficiary.schoolPostcode: Ce champ est obligatoire",
      ];

      expectDtoInvalidWithIssueMessages(
        conventionInternshipKindSpecificSchema,
        badConventionInternshipKindSpecific,
        expectedErrorMessages,
      );
    });
  });

  describe("constraints on beneficiary birthdate", () => {
    it('rejects when beneficiary age is under 16yr with internship kind "immersion"', () => {
      const immersionStartDate = new Date("2022-01-01");
      const beneficiary: Beneficiary<"immersion"> = {
        birthdate: addDays(subYears(immersionStartDate, 16), 1).toISOString(),
        email: "a@a.com",
        firstName: "sdfgf",
        lastName: "sdfs",
        phone: "0656435789",
        role: "beneficiary",
        isRqth: false,
      };

      const convention = new ConventionDtoBuilder()
        .withInternshipKind("immersion")
        .withDateStart(immersionStartDate.toISOString())
        .withDateEnd(new Date("2022-01-02").toISOString())
        .withSchedule(reasonableSchedule)
        .withBeneficiary(beneficiary)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "signatories.beneficiary.birthdate: L'âge du bénéficiaire doit être au minimum de 16ans",
      ]);
    });

    it('rejects when beneficiary age is under 10yr with internship kind "mini-stage-cci"', () => {
      const immersionStartDate = new Date("2022-01-01");
      const beneficiary: Beneficiary<"mini-stage-cci"> = {
        levelOfEducation: "Terminale",
        birthdate: addDays(subYears(immersionStartDate, 10), 1).toISOString(),
        email: "a@a.com",
        firstName: "sdfgf",
        lastName: "sdfs",
        phone: "0656435789",
        role: "beneficiary",
        schoolName: "École du quartier ouest",
        address: {
          city: "Paris",
          postcode: "75001",
          streetNumberAndAddress: "1 rue de Rivoli",
          departmentCode: "75",
        },
        schoolPostcode: "87000",
      };

      const convention = new ConventionDtoBuilder()
        .withInternshipKind("mini-stage-cci")
        .withDateSubmission("2022-01-01")
        .withDateStart(immersionStartDate.toISOString())
        .withDateEnd(new Date("2022-01-02").toISOString())
        .withSchedule(reasonableSchedule, ["dimanche"])
        .withBeneficiary(beneficiary)
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();

      expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
        "signatories.beneficiary.birthdate: L'âge du bénéficiaire doit être au minimum de 10ans",
      ]);
    });

    describe("when beneficiary age is greater than 120yr", () => {
      const immersionStartDate = new Date("2022-01-01");
      const beneficiary: Beneficiary<"immersion"> = {
        birthdate: addDays(subYears(immersionStartDate, 121), 1).toISOString(),
        email: "a@a.com",
        firstName: "sdfgf",
        lastName: "sdfs",
        phone: "0656435789",
        role: "beneficiary",
        isRqth: false,
      };

      it("accepts when convention is created before 2024-04-30", () => {
        const convention = new ConventionDtoBuilder()
          .withBeneficiary(beneficiary)
          .withDateSubmission("2024-04-29")
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });

      it("rejects when convention is created after 2024-04-30", () => {
        const convention = new ConventionDtoBuilder()
          .withBeneficiary(beneficiary)
          .withDateSubmission("2024-04-30 14:00:00")
          .build();

        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          "signatories.beneficiary.birthdate: Merci de vérifier votre date de naissance: avez-vous 123 ans ?",
        ]);
      });
    });

    describe("accepts when beneficiary is major", () => {
      it("from immersion start date", () => {
        const convention = new ConventionDtoBuilder()
          .withBeneficiaryBirthdate("2007-03-26")
          .withDateStart("2025-03-26")
          .withDateEnd("2025-03-28")
          .withSchedule(reasonableSchedule)
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });

      it("before immersion start date", () => {
        const convention = new ConventionDtoBuilder()
          .withBeneficiaryBirthdate("2000-10-05")
          .withDateStart("2025-10-05")
          .withDateEnd("2025-10-10")
          .withSchedule(reasonableSchedule)
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });
    });

    describe("convention with no beneficiary representative for a beneficiary under 18", () => {
      it("rejects when beneficiary is minor (when immersion starts) and no beneficiary representative was provided", () => {
        const immersionStartDate = new Date("2023-11-01");
        const beneficiary: Beneficiary<"immersion"> = {
          birthdate: subYears(immersionStartDate, 16).toISOString(),
          email: "a@a.com",
          firstName: "sdfgf",
          lastName: "sdfs",
          phone: "0656435789",
          role: "beneficiary",
        };

        const convention = new ConventionDtoBuilder()
          .withDateSubmission("2023-10-30")
          .withDateStart(immersionStartDate.toISOString())
          .withDateEnd(addDays(immersionStartDate, 4).toISOString())
          .withSchedule(reasonableSchedule, ["dimanche"])
          .withBeneficiary(beneficiary)
          .withBeneficiaryRepresentative(undefined)
          .build();

        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          "signatories.beneficiaryRepresentative: Les bénéficiaires mineurs doivent renseigner un représentant légal. Le bénéficiaire aurait 16 ans au démarrage de la convention.",
        ]);
      });

      it("works if convention was submitted before the rule applies", () => {
        const immersionStartDate = new Date("2023-11-01");
        const beneficiary: Beneficiary<"immersion"> = {
          birthdate: subYears(immersionStartDate, 16).toISOString(),
          email: "a@a.com",
          firstName: "sdfgf",
          lastName: "sdfs",
          phone: "0656435789",
          role: "beneficiary",
        };

        const convention = new ConventionDtoBuilder()
          .withDateSubmission("2023-10-27")
          .withDateStart(immersionStartDate.toISOString())
          .withDateEnd(addDays(immersionStartDate, 4).toISOString())
          .withSchedule(reasonableSchedule, ["dimanche"])
          .withBeneficiary(beneficiary)
          .withBeneficiaryRepresentative(undefined)
          .build();

        expectDtoToBeValid(conventionSchema, convention);
      });
    });
  });

  describe("when sunday is in schedule", () => {
    const saturdayOfWeek1 = new Date("2024-09-07").toISOString();
    const sundayOfWeek1 = new Date("2024-09-08").toISOString();
    const mondayOfWeek2 = new Date("2024-09-09").toISOString();
    const conventionBuilder = new ConventionDtoBuilder()
      .withDateStart(saturdayOfWeek1)
      .withDateEnd(mondayOfWeek2);

    describe("when there is no timePeriods on sunday", () => {
      it("accepts when internship kind is mini-stage-cci", () => {
        const scheduleWithoutSunday: DailyScheduleDto[] = [
          {
            date: saturdayOfWeek1,
            timePeriods: [{ start: "09:00", end: "12:00" }],
          },
          {
            date: sundayOfWeek1,
            timePeriods: [],
          },
          {
            date: mondayOfWeek2,
            timePeriods: [{ start: "09:00", end: "12:00" }],
          },
        ];

        expectDtoToBeValid(
          conventionSchema,
          conventionBuilder
            .withInternshipKind("mini-stage-cci")
            .withSchedule(() => ({
              totalHours: calculateTotalImmersionHoursFromComplexSchedule(
                scheduleWithoutSunday,
              ),
              workedDays: calculateNumberOfWorkedDays(scheduleWithoutSunday),
              isSimple: false,
              complexSchedule: scheduleWithoutSunday,
            }))
            .build(),
        );
      });
    });

    describe("when there is timePeriods on sunday", () => {
      it("rejects when internship kind is mini-stage-cci", () => {
        const convention = conventionBuilder
          .withInternshipKind("mini-stage-cci")
          .withSchedule(reasonableSchedule)
          .build();

        expectDtoInvalidWithIssueMessages(conventionSchema, convention, [
          `schedule.workedDays: [${convention.id}] Le mini-stage ne peut pas se dérouler un dimanche`,
        ]);
      });

      it("accepts valid convention when kind is immersion", () => {
        expectDtoToBeValid(
          conventionSchema,
          conventionBuilder
            .withInternshipKind("immersion")
            .withSchedule(reasonableSchedule)
            .build(),
        );
      });
    });
  });

  describe("CCI immersion address must be in France", () => {
    const belgianAddress =
      "14 Boulevard de Berlaimont 1000 Bruxelles, Belgique";
    const makeMiniStageConvention = (
      immersionAddress: string,
      dateSubmission = addDays(
        CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE,
        1,
      ).toISOString(),
    ) =>
      new ConventionDtoBuilder()
        .withInternshipKind("mini-stage-cci")
        .withDateStart(DATE_START)
        .withDateEnd(addDays(new Date(DATE_START), 4).toISOString())
        .withDateSubmission(dateSubmission)
        .withSchedule(reasonableSchedule, ["dimanche"])
        .withImmersionAddress(immersionAddress)
        .build();

    it("accepts a French address", () => {
      expectDtoToBeValid(
        conventionSchema,
        makeMiniStageConvention(
          "169 boulevard de la villette, 75010 Paris, France",
        ),
      );
    });

    it("accepts a DROM-COM address without country name", () => {
      expectDtoToBeValid(
        conventionSchema,
        makeMiniStageConvention("97438 SAINTE-MARIE"),
      );
    });

    it("rejects a Belgian address when submitted after the release date", () => {
      expectDtoInvalidWithIssueMessages(
        conventionSchema,
        makeMiniStageConvention(belgianAddress),
        [
          `immersionAddress: ${localization.miniStageImmersionAddressMustBeInFrance}`,
        ],
      );
    });

    it(`accepts a Belgian address when submitted before ${CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE}`, () => {
      expectDtoToBeValid(
        conventionSchema,
        makeMiniStageConvention(
          belgianAddress,
          subDays(CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE, 1).toISOString(),
        ),
      );
    });

    it("accepts a Belgian address when internship kind is immersion", () => {
      expectDtoToBeValid(
        conventionSchema,
        new ConventionDtoBuilder()
          .withInternshipKind("immersion")
          .withImmersionAddress(belgianAddress)
          .build(),
      );
    });
  });
});

describe("editConventionWithFinalStatusFormSchema", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";

  const validFormValues: EditConventionWithFinalStatusFormValues = {
    conventionId,
    establishmentTutor: {
      firstname: "Marie",
      lastname: "Tutor",
      job: "Responsable RH",
      email: "tutor@mail.com",
      phone: "+33601020304",
    },
    beneficiary: {
      updatedBeneficiaryBirthDate: "2008-06-01",
      firstname: "Jean",
      lastname: "Dupont",
    },
  };

  it("accepts valid form values", () => {
    expectDtoToBeValid(
      editConventionWithFinalStatusFormSchema,
      validFormValues,
    );
  });

  it("rejects empty establishment tutor lastname", () => {
    expect(() =>
      editConventionWithFinalStatusFormSchema.parse({
        ...validFormValues,
        establishmentTutor: {
          ...validFormValues.establishmentTutor,
          lastname: "",
        },
      }),
    ).toThrow();
  });

  it("rejects empty beneficiary firstname", () => {
    expect(() =>
      editConventionWithFinalStatusFormSchema.parse({
        ...validFormValues,
        beneficiary: {
          ...validFormValues.beneficiary,
          firstname: "",
        },
      }),
    ).toThrow();
  });
});

describe("editConventionWithFinalStatusRequestSchema", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";

  const establishmentTutor = {
    firstname: "Marie",
    lastname: "Tutor",
    job: "Responsable RH",
    email: "tutor@mail.com",
    phone: "+33601020304",
  };

  it("accepts request with establishment tutor only", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
      establishmentTutor,
    });
  });

  it("accepts request with partial establishment tutor update", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
      establishmentTutor: {
        email: "new-tutor@mail.com",
      },
    });
  });

  it("accepts request with beneficiary only", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
      beneficiary: {
        updatedBeneficiaryBirthDate: "2008-06-01",
      },
    });
  });

  it("accepts request with establishment tutor and beneficiary updates", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
      establishmentTutor,
      beneficiary: {
        updatedBeneficiaryBirthDate: "2008-06-01",
        firstname: "Jean",
        lastname: "Dupont",
      },
    });
  });

  it("accepts request with only conventionId at schema level", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
    });
  });

  it("accepts request with empty establishment tutor object at schema level", () => {
    expectDtoToBeValid(editConventionWithFinalStatusRequestSchema, {
      conventionId,
      establishmentTutor: {},
    });
  });

  it("rejects empty string for establishment tutor lastname", () => {
    expect(() =>
      editConventionWithFinalStatusRequestSchema.parse({
        conventionId,
        establishmentTutor: {
          lastname: "",
        },
      }),
    ).toThrow();
  });

  it("rejects empty string for beneficiary lastname", () => {
    expect(() =>
      editConventionWithFinalStatusRequestSchema.parse({
        conventionId,
        beneficiary: {
          lastname: "",
        },
      }),
    ).toThrow();
  });

  it("rejects empty string for beneficiary birthdate", () => {
    expect(() =>
      editConventionWithFinalStatusRequestSchema.parse({
        conventionId,
        beneficiary: {
          updatedBeneficiaryBirthDate: "",
        },
      }),
    ).toThrow();
  });
});

describe("updateConventionStatusRequestSchema", () => {
  it("rejects IN_REVIEW", () => {
    const conventionId = new ConventionDtoBuilder().build().id;
    expect(() =>
      updateConventionStatusRequestSchema.parse({
        status: "IN_REVIEW",
        conventionId,
      }),
    ).toThrow(ZodError);
  });
});

const expectDtoToBeValid = <T>(
  schema: ZodSchemaWithInputMatchingOutput<T>,
  validDto: T,
): void => {
  expect(() => schema.parse(validDto)).not.toThrow();
  expect(schema.parse(validDto)).toBeTruthy();
};

const expectDtoInvalidWithIssueMessages = <T>(
  schema: ZodSchemaWithInputMatchingOutput<T>,
  dto: T,
  issueMessages: string[],
) => {
  expect(() => schema.parse(dto)).toThrow();
  try {
    schema.parse(dto);
  } catch (error) {
    if (error instanceof ZodError) {
      const actualIssues = error.issues.reduce((acc, issue) => {
        const path = issue.path.join(".");
        acc.push(`${path}: ${issue.message}`);
        return acc;
      }, [] as string[]);

      expectArraysToEqualIgnoringOrder(actualIssues, issueMessages);
      return;
    }
    throw new Error("Zod error expected when parsing dto");
  }
};
