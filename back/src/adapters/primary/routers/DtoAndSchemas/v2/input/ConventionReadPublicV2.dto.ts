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
): ConventionReadPublicV2Dto => ({
  ...conventionReadDto,
  agencyKind: toPartnerAgencyKind(conventionReadDto.agencyKind),
  ...(conventionReadDto.agencyRefersTo
    ? {
        agencyRefersTo: {
          ...conventionReadDto.agencyRefersTo,
          kind: toPartnerAgencyKind(conventionReadDto.agencyRefersTo.kind),
        },
      }
    : {}),
});
