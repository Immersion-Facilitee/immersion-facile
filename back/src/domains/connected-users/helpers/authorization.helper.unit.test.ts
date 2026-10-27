import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createConventionMagicLinkPayload } from "../../../utils/jwt";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import { throwIfNotAuthorizedForRole } from "./authorization.helper";

describe("Convention role authorization", () => {
  const agency = toAgencyWithRights(new AgencyDtoBuilder().build());
  const convention = new ConventionDtoBuilder().withAgencyId(agency.id).build();
  const conventionPayload = createConventionMagicLinkPayload({
    id: convention.id,
    role: "validator",
    email: "validator@example.com",
    now: new Date(),
  });
  const errorToThrow = errors.convention.transferNotAuthorizedForRole();

  it.each([
    null,
    {},
    { version: 1, emailAuthCode: true },
    { userId: "" },
    { ...conventionPayload, applicationId: undefined },
    { ...conventionPayload, role: undefined },
    { ...conventionPayload, emailHash: undefined },
    { ...conventionPayload, emailAuthCode: true },
    { ...conventionPayload, userId: "another-user" },
  ])("rejects unsupported or incomplete identities: %j", async (jwtPayload) => {
    const uow = createInMemoryUow();
    uow.agencyRepository.agencies = [agency];

    await expectPromiseToFailWithError(
      throwIfNotAuthorizedForRole({
        uow,
        jwtPayload,
        authorizedRoles: ["validator"],
        errorToThrow,
        convention,
        agencyWithUserRights: agency,
        isPeAdvisorAllowed: false,
        isValidatorOfAgencyRefersToAllowed: false,
      }),
      errorToThrow,
    );
  });
});
