import {
  type AgencyStatus,
  activeAgencyStatuses,
  closedOrRejectedAgencyStatuses,
} from "..";
import { AgencyDtoBuilder } from "./AgencyDtoBuilder";
import { agencySchema } from "./agency.schema";

describe("agencySchema", () => {
  describe("statusJustification", () => {
    it.each([...activeAgencyStatuses, "needsReview"] satisfies AgencyStatus[])(
      "is null if the agency is %s",
      (status) => {
        const agency = new AgencyDtoBuilder()
          .withValidatorEmails(["validator@mail.com"])
          .withStatus(status)
          .withStatusJustification(null)
          .build();

        const result = agencySchema.safeParse(agency);

        expect(result.success).toBe(true);
      },
    );

    it.each([closedOrRejectedAgencyStatuses])(
      "should not be empty if the agency is %s",
      (status) => {
        const agency = new AgencyDtoBuilder()
          .withValidatorEmails(["validator@mail.com"])
          .withStatus(status)
          .withStatusJustification(null)
          .build();

        const result = agencySchema.safeParse(agency);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe(
          "Une agence inactive doit avoir une justification",
        );

        const retryResult = agencySchema.safeParse({
          ...agency,
          statusJustification: "test",
        });
        expect(retryResult.success).toBe(true);
      },
    );
  });

  describe("validatorEmails", () => {
    it.each([...activeAgencyStatuses, "needsReview"] satisfies AgencyStatus[])(
      "should have at least one validator email if the agency is %s",
      (status) => {
        const agency = new AgencyDtoBuilder()
          .withValidatorEmails(["validator@mail.com"])
          .withStatus(status)
          .build();

        const result = agencySchema.safeParse(agency);
        expect(result.success).toBe(true);
      },
    );

    it.each([...activeAgencyStatuses, "needsReview"] satisfies AgencyStatus[])(
      "should throw an error if the agency is %s and has no validator email",
      (status) => {
        const agency = new AgencyDtoBuilder()
          .withValidatorEmails([])
          .withStatus(status)
          .build();

        const result = agencySchema.safeParse(agency);
        expect(result.success).toBe(false);
      },
    );

    it.each(closedOrRejectedAgencyStatuses)(
      "can have no validator email if the agency is %s",
      (status) => {
        const agency = new AgencyDtoBuilder()
          .withValidatorEmails([])
          .withStatus(status)
          .withStatusJustification("test")
          .build();

        const result = agencySchema.safeParse(agency);
        expect(result.success).toBe(true);
      },
    );
  });
});
