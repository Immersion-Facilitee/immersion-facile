import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { useEffect, useState } from "react";
import { type RichDropdownProps, RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminAgencyListItemDto,
  adminAgencyListSearchMinLength,
  defaultPerPageInWebPagination,
  domElementIds,
  frontRoutes,
  type GetAgenciesForAdminParams,
} from "shared";
import {
  makeAgencyKindDropdownFilter,
  makeAgencyStatusDropdownFilter,
} from "src/app/components/admin/agencies/adminAgencyListFilters";
import { AgencyStatusBadge } from "src/app/components/agency/AgencyStatusBadge";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { agencyKindToShortLabel } from "src/app/contents/agencyKind.content";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { adminAgencyListSelectors } from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.selectors";
import {
  adminAgencyListSlice,
  initialAdminAgencyListFilters,
} from "src/core-logic/domain/agencies/admin-agency-list/adminAgencyList.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

type AdminAgencyListFilters = Pick<
  GetAgenciesForAdminParams,
  "kinds" | "statuses"
>;

const feedbackTopic: FeedbackTopic = "admin-agency-list";

const toResultCountLabel = (totalRecords: number): string =>
  totalRecords <= 1 ? `${totalRecords} agence` : `${totalRecords} agences`;

export const AdminAgencyListSection = (): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(adminAgencyListSelectors.isLoading);
  const {
    data: agencies,
    pagination,
    filters,
  } = useAppSelector(adminAgencyListSelectors.adminAgencyList);
  const [tempFilters, setTempFilters] = useState<AdminAgencyListFilters>({
    kinds: initialAdminAgencyListFilters.kinds,
    statuses: initialAdminAgencyListFilters.statuses,
  });

  useEffect(() => {
    if (connectedUserJwt)
      dispatch(
        adminAgencyListSlice.actions.fetchAdminAgencyListRequested({
          jwt: connectedUserJwt,
          filters: initialAdminAgencyListFilters,
          feedbackTopic,
        }),
      );

    return () => {
      dispatch(adminAgencyListSlice.actions.clearAdminAgencyListRequested());
    };
  }, [dispatch, connectedUserJwt]);

  if (!connectedUserJwt) return null;

  const fetchAgencies = (filtersToFetch: GetAgenciesForAdminParams): void => {
    dispatch(
      adminAgencyListSlice.actions.fetchAdminAgencyListRequested({
        jwt: connectedUserJwt,
        filters: filtersToFetch,
        feedbackTopic,
      }),
    );
  };

  const applyFilters = (
    filtersToApply: AdminAgencyListFilters,
    search: string | undefined,
  ): void =>
    fetchAgencies({
      ...filtersToApply,
      search,
      page: 1,
      perPage: defaultPerPageInWebPagination,
    });

  const resetFilters = (resetValues: AdminAgencyListFilters): void => {
    const filtersToApply = { ...tempFilters, ...resetValues };
    setTempFilters(filtersToApply);
    applyFilters(filtersToApply, filters.search);
  };

  const searchAgencies = (query: string): void => {
    const search = query.trim();
    if (search === (filters.search ?? "")) return;
    if (search && search.length < adminAgencyListSearchMinLength) return;
    applyFilters(tempFilters, search || undefined);
  };

  const dropdownFilters: RichDropdownProps[] = [
    makeAgencyKindDropdownFilter({
      id: `${domElementIds.adminAgencies.agencyListFilterDropdown}--kind`,
      appliedValues: filters.kinds,
      selectedValues: tempFilters.kinds,
      onChange: (kinds) => setTempFilters({ ...tempFilters, kinds }),
      onReset: () => resetFilters({ kinds: undefined }),
    }),
    makeAgencyStatusDropdownFilter({
      id: `${domElementIds.adminAgencies.agencyListFilterDropdown}--status`,
      appliedValues: filters.statuses,
      selectedValues: tempFilters.statuses,
      onChange: (statuses) => setTempFilters({ ...tempFilters, statuses }),
      onReset: () => resetFilters({ statuses: undefined }),
    }),
  ];

  return (
    <BackofficeDashboardTabContent
      title="Consulter les agences"
      description="Agences correspondant aux filtres, de la plus récente à la plus ancienne date de création."
    >
      <WithFeedbackReplacer topic={feedbackTopic}>
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(pagination.totalRecords)}
        </p>
        <RichTable
          label="Liste des agences"
          hasViewSwitch={false}
          isLoading={isLoading}
          searchBar={{
            label: "Rechercher",
            placeholder: "Rechercher une agence (nom, SIRET ou ID)",
            hintText: `Le SIRET et l'ID doivent être complets, le nom peut être partiel (${adminAgencyListSearchMinLength} caractères minimum).`,
            onSubmit: searchAgencies,
          }}
          dropdownFilters={{
            items: dropdownFilters,
            onSubmit: () => applyFilters(tempFilters, filters.search),
          }}
          headers={
            agencies.length > 0
              ? [
                  { content: "Agence" },
                  { content: "Type d'agence" },
                  { content: "SIRET" },
                  { content: "Statut" },
                  { content: "Structure d'accompagnement" },
                  { content: "Actions" },
                ]
              : [
                  {
                    content:
                      "Aucune agence trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
                  },
                ]
          }
          tableData={agencies.map(makeAdminAgencyListLine)}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                fetchAgencies({ ...filters, page: pageNumber });
              },
              href: "#",
              key: `pagination-link-${pageNumber}`,
            }),
          }}
        />
      </WithFeedbackReplacer>
    </BackofficeDashboardTabContent>
  );
};

const makeAdminAgencyListLine = (
  agency: AdminAgencyListItemDto,
): React.ReactNode[] => [
  <strong key={`${agency.id}-name`}>{agency.name}</strong>,
  agencyKindToShortLabel[agency.kind],
  agency.siret,
  <AgencyStatusBadge key={`${agency.id}-status`} status={agency.status} />,
  agency.refersToAgencyName ? `Liée à ${agency.refersToAgencyName}` : "",
  <Button
    key={`${agency.id}-actions`}
    id={`${domElementIds.adminAgencies.agencyListEditAgencyButton}--${agency.id}`}
    size="small"
    priority="secondary"
    linkProps={{
      ...frontRoutes.adminAgencyDetail({ agencyId: agency.id }).link,
      target: "_blank",
    }}
  >
    Modifier
  </Button>,
];
