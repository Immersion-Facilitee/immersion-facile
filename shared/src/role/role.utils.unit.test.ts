import { ConventionDtoBuilder } from "../convention/ConventionDtoBuilder";
import { expectToEqual } from "../test.helpers";
import { isRequesterStillSignatory } from "./role.utils";

describe("isStillSignatoryOnUpdatedConvention", () => {
  const initialConvention = new ConventionDtoBuilder()
    .withBeneficiaryEmail("beneficiary@mail.com")
    .withEstablishmentRepresentativeEmail("representative@mail.com")
    .build();

  it("returns true when the signatory email is unchanged", () => {
    expectToEqual(
      isRequesterStillSignatory({
        signatoryRole: "establishment-representative",
        initialConvention,
        updatedConvention: initialConvention,
      }),
      true,
    );
  });

  it("returns false when the signatory email of the requester role changed", () => {
    const updatedConvention = new ConventionDtoBuilder(initialConvention)
      .withEstablishmentRepresentativeEmail("new-representative@mail.com")
      .build();

    expectToEqual(
      isRequesterStillSignatory({
        signatoryRole: "establishment-representative",
        initialConvention,
        updatedConvention,
      }),
      false,
    );
  });

  it("returns true when the email of another signatory changed", () => {
    const updatedConvention = new ConventionDtoBuilder(initialConvention)
      .withBeneficiaryEmail("new-beneficiary@mail.com")
      .build();

    expectToEqual(
      isRequesterStillSignatory({
        signatoryRole: "establishment-representative",
        initialConvention,
        updatedConvention,
      }),
      true,
    );
  });
});
