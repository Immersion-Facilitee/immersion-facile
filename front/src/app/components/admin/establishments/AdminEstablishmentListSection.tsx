import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { useEffect } from "react";
import { RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListDefaultPerPage,
  adminEstablishmentListSearchMinLength,
  domElementIds,
  frontRoutes,
  type GetEstablishmentsForAdminParams,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { adminEstablishmentListSelectors } from "src/core-logic/domain/adminEstablishmentList/adminEstablishmentList.selectors";
import {
  adminEstablishmentListSlice,
  initialAdminEstablishmentListFilters,
} from "src/core-logic/domain/adminEstablishmentList/adminEstablishmentList.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

const feedbackTopic: FeedbackTopic = "admin-establishment-list";

const toResultCountLabel = (totalRecords: number): string =>
  totalRecords <= 1
    ? `${totalRecords} établissement`
    : `${totalRecords} établissements`;

const toOtherLocationsLabel = (otherLocationsCount: number): string =>
  otherLocationsCount === 1
    ? "+ 1 autre adresse"
    : `+ ${otherLocationsCount} autres adresses`;

export const AdminEstablishmentListSection = (): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(adminEstablishmentListSelectors.isLoading);
  const {
    data: establishments,
    pagination,
    filters,
  } = useAppSelector(adminEstablishmentListSelectors.adminEstablishmentList);

  useEffect(() => {
    if (connectedUserJwt)
      dispatch(
        adminEstablishmentListSlice.actions.fetchAdminEstablishmentListRequested(
          {
            jwt: connectedUserJwt,
            filters: initialAdminEstablishmentListFilters,
            feedbackTopic,
          },
        ),
      );

    return () => {
      dispatch(
        adminEstablishmentListSlice.actions.clearAdminEstablishmentListRequested(),
      );
    };
  }, [dispatch, connectedUserJwt]);

  if (!connectedUserJwt) return null;

  const fetchEstablishments = (
    filtersToFetch: GetEstablishmentsForAdminParams,
  ): void => {
    dispatch(
      adminEstablishmentListSlice.actions.fetchAdminEstablishmentListRequested({
        jwt: connectedUserJwt,
        filters: filtersToFetch,
        feedbackTopic,
      }),
    );
  };

  const searchEstablishments = (query: string): void => {
    const search = query.trim();
    if (search === (filters.search ?? "")) return;
    if (search && search.length < adminEstablishmentListSearchMinLength) return;
    fetchEstablishments({
      search: search || undefined,
      page: 1,
      perPage: adminEstablishmentListDefaultPerPage,
    });
  };

  return (
    <BackofficeDashboardTabContent
      title="Consulter les établissements"
      description="Établissements référencés, du plus récemment au plus anciennement mis à jour."
    >
      <WithFeedbackReplacer topic={feedbackTopic}>
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(pagination.totalRecords)}
        </p>
        <RichTable
          label="Liste des établissements"
          hasViewSwitch={false}
          isLoading={isLoading}
          searchBar={{
            label: "Rechercher",
            placeholder:
              "Rechercher un établissement (SIRET, nom, nom ou email du contact)",
            hintText: `Le SIRET et l'email doivent être complets, les noms peuvent être partiels (${adminEstablishmentListSearchMinLength} caractères minimum).`,
            onSubmit: searchEstablishments,
          }}
          emptyStateMessage="Aucun établissement trouvé avec cette recherche."
          headers={[
            { content: "Établissement" },
            { content: "SIRET" },
            { content: "Localisation" },
            { content: "Mises en relation" },
            { content: "Conventions validées" },
            { content: "Actions" },
          ]}
          tableData={establishments.map(makeAdminEstablishmentListLine)}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                fetchEstablishments({ ...filters, page: pageNumber });
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

const makeAdminEstablishmentListLine = (
  establishment: AdminEstablishmentListItemDto,
): React.ReactNode[] => [
  <span key={`${establishment.siret}-name`}>
    <strong>{establishment.name}</strong>
    {establishment.customizedName && (
      <span className={fr.cx("fr-hint-text")}>
        {establishment.customizedName}
      </span>
    )}
  </span>,
  establishment.siret,
  <span key={`${establishment.siret}-location`}>
    {establishment.city} ({establishment.postcode})
    {establishment.otherLocationsCount > 0 && (
      <span className={fr.cx("fr-hint-text")}>
        {toOtherLocationsLabel(establishment.otherLocationsCount)}
      </span>
    )}
  </span>,
  establishment.discussionsCount,
  establishment.validatedConventionsCount,
  <Button
    key={`${establishment.siret}-actions`}
    id={`${domElementIds.adminEstablishments.establishmentListEditEstablishmentButton}--${establishment.siret}`}
    size="small"
    priority="secondary"
    linkProps={{
      ...frontRoutes.adminEstablishments({ siret: establishment.siret }).link,
      title: `Piloter l'établissement ${establishment.name}`,
    }}
  >
    Piloter
  </Button>,
];
