import type { BusinessName } from "../establishment/establishment.dto";
import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { Firstname, Lastname } from "../user/user.dto";
import type { DateString } from "../utils/date";
import type {
  ConventionAssessmentFields,
  ConventionId,
  ConventionStatus,
} from "./convention.dto";

export type EstablishmentUserConventionListDto = {
  id: ConventionId;
  status: ConventionStatus;
  dateStart: DateString;
  dateEnd: DateString;
  businessName: BusinessName;
  immersionAppellation: AppellationAndRomeDto;
  assessment: ConventionAssessmentFields["assessment"];
  beneficiary: {
    firstName: Firstname;
    lastName: Lastname;
  };
};

export type GetConventionsForEstablishmentUserParams = PaginationQueryParams;
