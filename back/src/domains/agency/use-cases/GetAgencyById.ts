import {
  type AgencyDto,
  type AgencyId,
  agencyIdSchema,
  type ConnectedUser,
  errors,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { throwIfNotAgencyAdminOrBackofficeAdmin } from "../../connected-users/helpers/authorization.helper";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetAgencyById = ReturnType<typeof makeGetAgencyById>;
export const makeGetAgencyById = useCaseBuilder("GetAgencyById")
  .withInput<AgencyId>(agencyIdSchema)
  .withOutput<AgencyDto>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ uow, currentUser, inputParams }) => {
    const agency = await uow.agencyRepository.getById(inputParams);

    if (!agency) throw errors.agency.notFound({ agencyId: inputParams });

    throwIfNotAgencyAdminOrBackofficeAdmin({
      agencyIds: [agency.id],
      currentUser,
    });

    return agencyWithRightToAgencyDto(uow, agency);
  });
