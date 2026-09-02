import {
  ConventionDtoBuilder,
  type ConventionReadDto,
  type ConventionStatus,
  makeEmptyLastReminders,
  type Role,
} from "shared";
import { isAllowedConventionTransition } from "src/app/utils/IsAllowedConventionTransition";

const convention: ConventionReadDto = {
  ...new ConventionDtoBuilder().withStatus("IN_REVIEW").build(),
  agencyKind: "cap-emploi",
  agencySiret: "11112222333300",
  agencyContactEmail: "contact@mail.com",
  agencyValidationSteps: "counsellor-and-validator",
  agencyName: "Agence de cap emploi",
  agencyDepartment: "75",
  assessment: null,
  lastReminders: makeEmptyLastReminders(),
  isEstablishmentBanned: false,
};

type TestCase = {
  convention: ConventionReadDto;
  targetStatus: ConventionStatus;
  roles: Role[];
  expected: boolean;
};

const cases: TestCase[] = [
  {
    convention,
    targetStatus: "ACCEPTED_BY_COUNSELLOR",
    roles: ["counsellor"],
    expected: true,
  },
  {
    convention,
    targetStatus: "ACCEPTED_BY_VALIDATOR",
    roles: ["beneficiary"],
    expected: false,
  },
  {
    convention,
    targetStatus: "ACCEPTED_BY_VALIDATOR",
    roles: ["counsellor"],
    expected: false,
  },
  {
    convention,
    targetStatus: "ACCEPTED_BY_VALIDATOR",
    roles: ["validator"],
    expected: false,
  },
];

describe("isAllowedTransition", () => {
  it.each(cases)(
    `Transition allowed should be $expected. With roles $roles, and target status: $targetStatus, from status ${convention.status}`,
    ({ convention, targetStatus, roles, expected }) => {
      expect(
        isAllowedConventionTransition(convention, targetStatus, roles),
      ).toBe(expected);
    },
  );
});
