import type {
  AgencyRefersToInConvention,
  ConventionReadDto,
  PartnerAgencyKind,
} from "shared";
import { toPartnerAgencyKind } from "../../../../../../utils/agency";

export type ConventionReadPublicV2Dto = Omit<
  ConventionReadDto,
  "agencyKind" | "agencyRefersTo"
> & {
  agencyKind: PartnerAgencyKind;
  agencyRefersTo?: Omit<AgencyRefersToInConvention, "kind"> & {
    kind: PartnerAgencyKind;
  };
};

export const conventionReadToConventionReadPublicV2 = (
  conventionReadDto: ConventionReadDto,
): ConventionReadPublicV2Dto => {
  const { agencyKind, agencyRefersTo, ...rest } = conventionReadDto;
  return {
    ...rest,
    agencyKind: toPartnerAgencyKind(agencyKind),
    ...(agencyRefersTo
      ? {
          agencyRefersTo: {
            ...agencyRefersTo,
            kind: toPartnerAgencyKind(agencyRefersTo.kind),
          },
        }
      : {}),
  };
};
