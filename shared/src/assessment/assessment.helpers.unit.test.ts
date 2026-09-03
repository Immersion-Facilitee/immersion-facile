import { ConventionDtoBuilder } from "../convention/ConventionDtoBuilder";
import { expectToEqual } from "../test.helpers";
import type { AssessmentFormDto } from "./assessment.dto";
import {
  assessmentFormValuesToAssessmentDto,
  computeTotalHours,
  getAssessmentEffectiveEndDate,
  hasPartialCompletionDetails,
} from "./assessment.helpers";

describe("assessment helpers", () => {
  const convention = new ConventionDtoBuilder()
    .withDateStart("2024-01-10")
    .withDateEnd("2024-01-20")
    .build();

  const createdAt = "2024-01-21T00:00:00.000Z";

  const basePartiallyCompletedFormValues: AssessmentFormDto = {
    conventionId: convention.id,
    status: "PARTIALLY_COMPLETED",
    partialCompletionDetails: {
      lastDayOfPresence: null,
      numberOfMissedHours: null,
      numberOfMissedMinutes: null,
    },
    endedWithAJob: false,
    typeOfContract: null,
    contractStartDate: null,
    establishmentFeedback: "feedback",
    establishmentAdvices: "advices",
  };

  const baseCompletedFormValues: AssessmentFormDto = {
    conventionId: convention.id,
    status: "COMPLETED",
    endedWithAJob: false,
    typeOfContract: null,
    contractStartDate: null,
    establishmentFeedback: "feedback",
    establishmentAdvices: "advices",
  };

  describe("hasPartialCompletionDetails", () => {
    it("returns false when hours, minutes and date are empty", () => {
      expect(
        hasPartialCompletionDetails({
          lastDayOfPresence: null,
          numberOfMissedHours: null,
          numberOfMissedMinutes: null,
        }),
      ).toBe(false);
    });

    it("returns false when hours and minutes are 0 and date is empty", () => {
      expect(
        hasPartialCompletionDetails({
          lastDayOfPresence: null,
          numberOfMissedHours: 0,
          numberOfMissedMinutes: 0,
        }),
      ).toBe(false);
    });

    it("returns true when date is filled", () => {
      expect(
        hasPartialCompletionDetails({
          lastDayOfPresence: "2024-01-18",
          numberOfMissedHours: null,
          numberOfMissedMinutes: null,
        }),
      ).toBe(true);
    });

    it("returns true when hours > 0", () => {
      expect(
        hasPartialCompletionDetails({
          lastDayOfPresence: null,
          numberOfMissedHours: 2,
          numberOfMissedMinutes: null,
        }),
      ).toBe(true);
    });

    it("returns true when minutes > 0", () => {
      expect(
        hasPartialCompletionDetails({
          lastDayOfPresence: null,
          numberOfMissedHours: null,
          numberOfMissedMinutes: 30,
        }),
      ).toBe(true);
    });
  });

  describe("getAssessmentEffectiveEndDate", () => {
    it("returns convention.dateEnd when form date is null", () => {
      expectToEqual(
        getAssessmentEffectiveEndDate({
          lastDayOfPresence: null,
          conventionDateEnd: convention.dateEnd,
        }),
        convention.dateEnd,
      );
    });

    it("returns form date when filled", () => {
      expectToEqual(
        getAssessmentEffectiveEndDate({
          lastDayOfPresence: "2024-01-18",
          conventionDateEnd: convention.dateEnd,
        }),
        "2024-01-18",
      );
    });
  });

  describe("assessmentFormValuesToAssessmentDto", () => {
    it("maps hours-only form to PARTIALLY_COMPLETED with convention.dateEnd", () => {
      const assessment = assessmentFormValuesToAssessmentDto(
        {
          ...basePartiallyCompletedFormValues,
          partialCompletionDetails: {
            ...basePartiallyCompletedFormValues.partialCompletionDetails,
            numberOfMissedHours: 2,
          },
        },
        convention,
        createdAt,
      );

      expectToEqual(assessment, {
        conventionId: convention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: convention.dateEnd,
        numberOfMissedHours: 2,
        endedWithAJob: false,
        establishmentFeedback: "feedback",
        establishmentAdvices: "advices",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt,
      });
    });

    it("maps date-only form (0h 0min) to PARTIALLY_COMPLETED with numberOfMissedHours 0", () => {
      const assessment = assessmentFormValuesToAssessmentDto(
        {
          ...basePartiallyCompletedFormValues,
          partialCompletionDetails: {
            lastDayOfPresence: "2024-01-18",
            numberOfMissedHours: 0,
            numberOfMissedMinutes: 0,
          },
        },
        convention,
        createdAt,
      );

      expectToEqual(assessment, {
        conventionId: convention.id,
        status: "PARTIALLY_COMPLETED",
        lastDayOfPresence: "2024-01-18",
        numberOfMissedHours: 0,
        endedWithAJob: false,
        establishmentFeedback: "feedback",
        establishmentAdvices: "advices",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt,
      });
    });

    it("maps 1h30 to numberOfMissedHours 1.5", () => {
      const assessment = assessmentFormValuesToAssessmentDto(
        {
          ...basePartiallyCompletedFormValues,
          partialCompletionDetails: {
            lastDayOfPresence: "2024-01-18",
            numberOfMissedHours: 1,
            numberOfMissedMinutes: 30,
          },
        },
        convention,
        createdAt,
      );

      expect(assessment.status).toBe("PARTIALLY_COMPLETED");
      if (assessment.status === "PARTIALLY_COMPLETED")
        expectToEqual(assessment.numberOfMissedHours, 1.5);
    });

    it("maps COMPLETED status", () => {
      const assessment = assessmentFormValuesToAssessmentDto(
        baseCompletedFormValues,
        convention,
        createdAt,
      );

      expectToEqual(assessment, {
        conventionId: convention.id,
        status: "COMPLETED",
        endedWithAJob: false,
        establishmentFeedback: "feedback",
        establishmentAdvices: "advices",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt,
      });
    });

    it("maps endedWithAJob when contract fields are filled", () => {
      const assessment = assessmentFormValuesToAssessmentDto(
        {
          ...baseCompletedFormValues,
          endedWithAJob: true,
          typeOfContract: "CDI",
          contractStartDate: "2024-01-15",
        },
        convention,
        createdAt,
      );

      expectToEqual(assessment, {
        conventionId: convention.id,
        status: "COMPLETED",
        endedWithAJob: true,
        typeOfContract: "CDI",
        contractStartDate: "2024-01-15",
        establishmentFeedback: "feedback",
        establishmentAdvices: "advices",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt,
      });
    });
  });

  describe("computeTotalHours via mapper", () => {
    it("gives the same total for hours-only form as with lastDayOfPresence = convention.dateEnd", () => {
      const formValues: AssessmentFormDto = {
        ...basePartiallyCompletedFormValues,
        partialCompletionDetails: {
          ...basePartiallyCompletedFormValues.partialCompletionDetails,
          numberOfMissedHours: 2,
        },
      };
      const mapped = assessmentFormValuesToAssessmentDto(
        formValues,
        convention,
        createdAt,
      );

      expect(mapped.status).toBe("PARTIALLY_COMPLETED");
      if (mapped.status !== "PARTIALLY_COMPLETED") return;

      expectToEqual(
        computeTotalHours({
          convention,
          status: formValues.status,
          lastDayOfPresence: mapped.lastDayOfPresence,
          numberOfMissedHours: mapped.numberOfMissedHours,
        }),
        computeTotalHours({
          convention,
          status: "PARTIALLY_COMPLETED",
          lastDayOfPresence: convention.dateEnd,
          numberOfMissedHours: 2,
        }),
      );
    });
  });
});
