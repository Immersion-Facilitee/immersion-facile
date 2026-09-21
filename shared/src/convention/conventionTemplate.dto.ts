import { v4 as uuidV4 } from "uuid";
import type { AgencyKind } from "../agency/agency.dto";
import type { NumberEmployeesRange } from "../siret/siret";
import type { Flavor } from "../typeFlavors";
import type { UserId } from "../user/user.dto";
import type { OmitFromExistingKeys } from "../utils";
import {
  type CreateConventionTemplatePresentationInitialValues,
  undefinedIfEmptyString,
} from "./conventionPresentation.dto";
import type { ConventionDraftDto } from "./saveConventionDraft.dto";

export type ConventionTemplateId = Flavor<string, "ConventionTemplateId">;

export type ConventionTemplate = OmitFromExistingKeys<
  ConventionDraftDto,
  "id"
> & {
  id: ConventionTemplateId;
  name: string;
  userId: UserId;
};

export const toConventionTemplate = ({
  convention,
  userId,
  establishmentNumberEmployeesRange,
  selectedAgencyKind,
  fromConventionTemplateId,
}: {
  convention: CreateConventionTemplatePresentationInitialValues;
  userId: UserId;
  establishmentNumberEmployeesRange: NumberEmployeesRange | undefined;
  selectedAgencyKind: AgencyKind | undefined;
  fromConventionTemplateId: ConventionTemplateId | undefined;
}): ConventionTemplate => ({
  ...convention,
  id: fromConventionTemplateId ?? uuidV4(),
  userId,
  agencyDepartment: convention.agencyDepartment ?? "",
  workConditions: undefinedIfEmptyString(convention.workConditions),
  agencyReferent: {
    firstname: undefinedIfEmptyString(convention.agencyReferent?.firstname),
    lastname: undefinedIfEmptyString(convention.agencyReferent?.lastname),
  },
  establishmentNumberEmployeesRange:
    establishmentNumberEmployeesRange === ""
      ? undefined
      : establishmentNumberEmployeesRange,
  agencyKind: selectedAgencyKind,
  agencyContactEmail: "",
  assessment: null,
});
