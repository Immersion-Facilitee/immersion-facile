import { ZodError } from "zod";
import { ConventionDtoBuilder } from "../convention/ConventionDtoBuilder";
import {
  type ConventionReadDto,
  makeEmptyLastReminders,
} from "../convention/convention.dto";
import { errors } from "../errors/errors";
import { reasonableSchedule } from "../schedule/ScheduleUtils";
import { expectToEqual } from "../test.helpers";
import { type DateRange, withDateRangeSchema } from "../utils/date";
import type { AssessmentDto, AssessmentFormDto } from "./assessment.dto";
import { assessmentDtoSchema, assessmentFormSchema } from "./assessment.schema";

const createdAt = "2024-01-01T00:00:00.000Z";

describe("Assessment schema date range", () => {
  it("accepts valid date range", () => {
    const dateRange: DateRange = {
      from: new Date("2024-07-01"),
      to: new Date("2024-07-20"),
    };

    const parsedDateRange = withDateRangeSchema.parse(dateRange);

    expect(parsedDateRange.from).toEqual(dateRange.from);
    expect(parsedDateRange.to).toEqual(dateRange.to);
  });

  it("rejects when date order is incorrect", () => {
    const dateRange: DateRange = {
      from: new Date("2024-07-20"),
      to: new Date("2024-07-01"),
    };

    expectDateRangeToFailWithError(dateRange, [
      "La date de fin doit être après la date de début.",
    ]);
  });

  it("rejects invalid date range", () => {
    const dateRange: DateRange = {
      from: new Date("invalid"),
      to: new Date("invalid"),
    };

    expectDateRangeToFailWithError(dateRange, [
      "Invalid input: expected date, received Date",
      "Invalid input: expected date, received Date",
    ]);
  });
});

describe("Assessment DTO schema", () => {
  it("accepts a minimal valid assessment", () => {
    const assessment: AssessmentDto = {
      status: "COMPLETED",
      endedWithAJob: false,
      conventionId: "my-convention-id",
      establishmentAdvices: "establishment advice",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("accepts an assessment of a partially completed immersion", () => {
    const assessment: AssessmentDto = {
      status: "PARTIALLY_COMPLETED",
      conventionId: "my-convention-id",
      endedWithAJob: true,
      typeOfContract: "CDI",
      contractStartDate: "2024-01-01",
      lastDayOfPresence: "2024-01-01",
      numberOfMissedHours: 10,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("accepts PARTIALLY_COMPLETED with lastDayOfPresence and missed hours", () => {
    const assessment: AssessmentDto = {
      status: "PARTIALLY_COMPLETED",
      conventionId: "my-convention-id",
      endedWithAJob: false,
      lastDayOfPresence: "2024-01-20",
      numberOfMissedHours: 2,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("rejects PARTIALLY_COMPLETED without lastDayOfPresence", () => {
    const assessment = {
      status: "PARTIALLY_COMPLETED",
      conventionId: "my-convention-id",
      endedWithAJob: false,
      numberOfMissedHours: 2,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt,
    };
    expect(() => assessmentDtoSchema.parse(assessment)).toThrow();
  });

  it("accepts an assessment of a did not show immersion", () => {
    const assessment: AssessmentDto = {
      status: "DID_NOT_SHOW",
      conventionId: "my-convention-id",
      endedWithAJob: false,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("accepts an assessment with beneficiary signature", () => {
    const assessment: AssessmentDto = {
      status: "COMPLETED",
      conventionId: "my-convention-id",
      endedWithAJob: false,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: true,
      beneficiaryFeedback: "my beneficiary feedback",
      signedAt: "2024-01-01",
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("accepts an assessment with beneficiary signature and no feedback", () => {
    const assessment: AssessmentDto = {
      status: "COMPLETED",
      conventionId: "my-convention-id",
      endedWithAJob: false,
      establishmentAdvices: "establishment advices",
      establishmentFeedback: "establishment feedback",
      beneficiaryAgreement: true,
      beneficiaryFeedback: null,
      signedAt: "2024-01-01",
      createdAt,
    };
    const parsedAssessment = assessmentDtoSchema.parse(assessment);
    expectToEqual(assessment, parsedAssessment);
  });

  it("rejects an invalid assessment", () => {
    const assessment = {
      status: "PARTIALLY_COMPLETED",
      endedWithAJob: true,
      typeOfContract: "Alternance",
      contractStartDate: "",
      lastDayOfPresence: "",
      numberOfMissedHours: 0,
      conventionId: "1",
      establishmentAdvices: "my minimum establishment advices",
      establishmentFeedback: "my minimum establishment feedback",
    };
    expect(() => assessmentDtoSchema.parse(assessment)).toThrow();
  });
});

describe("Assessment form schema", () => {
  const convention: ConventionReadDto = {
    ...new ConventionDtoBuilder()
      .withDateStart("2024-01-10")
      .withDateEnd("2024-01-20")
      .withSchedule(reasonableSchedule)
      .build(),
    agencyName: "My agency",
    agencyDepartment: "75",
    agencyKind: "france-travail",
    agencyContactEmail: "agency@mail.fr",
    agencySiret: "77567187800032",
    agencyValidationSteps: "validator-only",
    assessment: null,
    lastReminders: makeEmptyLastReminders(),
    isEstablishmentBanned: false,
  };

  const validFormValues: AssessmentFormDto = {
    status: "PARTIALLY_COMPLETED",
    conventionId: "my-convention-id",
    endedWithAJob: true,
    typeOfContract: "CDI",
    contractStartDate: "2024-01-15",
    partialCompletionDetails: {
      lastDayOfPresence: "2024-01-18",
      numberOfMissedHours: 0,
      numberOfMissedMinutes: 0,
    },
    establishmentAdvices: "establishment advices",
    establishmentFeedback: "establishment feedback",
  };

  it("accepts hours-only PARTIALLY_COMPLETED (empty date)", () => {
    const formValues: AssessmentFormDto = {
      ...validFormValues,
      partialCompletionDetails: {
        lastDayOfPresence: null,
        numberOfMissedHours: 2,
        numberOfMissedMinutes: null,
      },
      endedWithAJob: false,
      typeOfContract: null,
      contractStartDate: null,
    };

    expectToEqual(
      assessmentFormSchema(convention).parse(formValues),
      formValues,
    );
  });

  it("accepts date-only PARTIALLY_COMPLETED (0h 0min)", () => {
    const formValues: AssessmentFormDto = {
      ...validFormValues,
      partialCompletionDetails: {
        lastDayOfPresence: "2024-01-18",
        numberOfMissedHours: 0,
        numberOfMissedMinutes: 0,
      },
      endedWithAJob: false,
      typeOfContract: null,
      contractStartDate: null,
    };

    expectToEqual(
      assessmentFormSchema(convention).parse(formValues),
      formValues,
    );
  });

  it("rejects PARTIALLY_COMPLETED with empty date and 0h 0min on partialCompletionDetails path", () => {
    const invalidFormValues: AssessmentFormDto = {
      ...validFormValues,
      partialCompletionDetails: {
        lastDayOfPresence: null,
        numberOfMissedHours: 0,
        numberOfMissedMinutes: 0,
      },
      endedWithAJob: false,
      typeOfContract: null,
      contractStartDate: null,
    };

    expectFormSchemaToFailWith({
      convention,
      formValues: invalidFormValues,
      path: ["partialCompletionDetails"],
      message: errors.assessment.partialCompletionDetailsRequired().message,
    });
  });

  it("rejects numberOfMissedHours above planned immersion hours", () => {
    const invalidFormValues: AssessmentFormDto = {
      ...validFormValues,
      partialCompletionDetails: {
        ...validFormValues.partialCompletionDetails,
        numberOfMissedHours: 999,
        numberOfMissedMinutes: null,
      },
      endedWithAJob: false,
      typeOfContract: null,
      contractStartDate: null,
    };

    expectFormSchemaToFailWith({
      convention,
      formValues: invalidFormValues,
      path: ["partialCompletionDetails", "numberOfMissedHours"],
      message: errors.assessment.numberOfMissedHoursExceedsScheduled().message,
    });
  });

  it("accepts a valid form assessment", () => {
    const parsedAssessment =
      assessmentFormSchema(convention).parse(validFormValues);
    expectToEqual(parsedAssessment, validFormValues);
  });

  it("rejects contractStartDate before convention start date", () => {
    const invalidFormValues: AssessmentFormDto = {
      ...validFormValues,
      contractStartDate: "2024-01-09",
    };

    expectFormSchemaToFailWith({
      convention,
      formValues: invalidFormValues,
      path: ["contractStartDate"],
      messageContains:
        "La date début du contrat ne peut pas être antérieure à la date de début d'immersion",
    });
  });
});

const expectDateRangeToFailWithError = (
  dateRange: DateRange,
  issueMessages: string[],
) => {
  expect(() => withDateRangeSchema.parse(dateRange)).toThrow();
  try {
    withDateRangeSchema.parse(dateRange);
  } catch (error) {
    expect(error instanceof ZodError).toBeTruthy();
    if (error instanceof ZodError) {
      expectToEqual(
        error.issues.map((i) => i.message),
        issueMessages,
      );
    }
  }
};

const expectFormSchemaToFailWith = ({
  convention,
  formValues,
  path,
  message,
  messageContains,
}: {
  convention: ConventionReadDto;
  formValues: AssessmentFormDto;
  path: (string | number)[];
  message?: string;
  messageContains?: string;
}) => {
  expect(() => assessmentFormSchema(convention).parse(formValues)).toThrow();

  try {
    assessmentFormSchema(convention).parse(formValues);
  } catch (error) {
    expect(error instanceof ZodError).toBeTruthy();
    if (error instanceof ZodError) {
      const issue = error.issues.find(
        (currentIssue) =>
          currentIssue.path.join(".") === path.join(".") &&
          (message
            ? currentIssue.message === message
            : messageContains
              ? currentIssue.message.includes(messageContains)
              : true),
      );
      expect(issue).toBeDefined();
      if (issue) expectToEqual(issue.path, path);
    }
  }
};
