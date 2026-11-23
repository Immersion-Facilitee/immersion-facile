import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListDefaultPerPage,
  adminEstablishmentListMaxPerPage,
  type ConnectedUser,
  type DataWithPagination,
  defaultPageInPagination,
  type GetEstablishmentsForAdminParams,
  getEstablishmentsForAdminParamsSchema,
  removeSpaces,
  siretRegex,
} from "shared";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentAggregateQueries } from "../ports/EstablishmentAggregateQueries";

export type GetEstablishmentsForAdmin = ReturnType<
  typeof makeGetEstablishmentsForAdmin
>;

export const makeGetEstablishmentsForAdmin = useCaseBuilder(
  "GetEstablishmentsForAdmin",
)
  .withInput<GetEstablishmentsForAdminParams>(
    getEstablishmentsForAdminParamsSchema,
  )
  .withOutput<DataWithPagination<AdminEstablishmentListItemDto>>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ establishmentAggregateQueries: EstablishmentAggregateQueries }>()
  .notTransactional()
  .build(
    async ({
      inputParams: { page, perPage, search },
      currentUser,
      deps: { establishmentAggregateQueries },
    }) => {
      throwIfNotAdmin(currentUser);

      return establishmentAggregateQueries.getEstablishmentsForAdmin({
        search: search && toNormalizedSearch(search),
        pagination: {
          page: page ?? defaultPageInPagination,
          perPage: Math.min(
            perPage ?? adminEstablishmentListDefaultPerPage,
            adminEstablishmentListMaxPerPage,
          ),
        },
      });
    },
  );

const toNormalizedSearch = (search: string): string =>
  siretRegex.test(search) ? removeSpaces(search) : search;
