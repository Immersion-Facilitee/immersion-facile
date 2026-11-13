import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { useEffect, useState } from "react";
import {
  type HeadingSectionProps,
  type RichDropdownProps,
  RichTable,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminConventionListDto,
  type AgencyDto,
  type AgencyId,
  adminConventionListMaxResults,
  adminConventionListPerPage,
  adminConventionListTextFilterMinLength,
  domElementIds,
  type FlatGetConventionsForAdminParams,
  flatGetConventionsForAdminParamsSchema,
  frontRoutes,
} from "shared";
import { ConventionAssessmentStatusBadge } from "src/app/components/convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "src/app/components/convention/ConventionDatesDisplay";
import {
  AgencyReferentCell,
  BeneficiaryCell,
  ConventionStatusBadges,
} from "src/app/components/convention/convention-list/ConventionListCells";
import {
  makeAssessmentCompletionStatusDropdownFilter,
  makeConventionStatusDropdownFilter,
} from "src/app/components/convention/convention-list/conventionListFilters";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useAdminDashboard } from "src/app/pages/admin/useAdminDashboard";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialAdminConventionList,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

type AdminConventionListFilters = Pick<
  FlatGetConventionsForAdminParams,
  "statuses" | "assessmentCompletionStatus" | "agencyNameContains"
>;

const feedbackTopic: FeedbackTopic = "admin-convention-list";

const agencyNameFilterLabel = "Agence";

type AdminConventionListScope = Pick<
  FlatGetConventionsForAdminParams,
  "agencyIds" | "sortBy"
>;

type AdminConventionListContent = {
  title: string;
  titleAs: HeadingSectionProps["titleAs"];
  description: string;
  tableLabel: string;
  searchHint: string;
  emptyResultMessage: string;
  maxResultsMessage: string;
  manageConventionButtonId: string;
};

const searchHintTail = `L'email et le SIRET doivent être complets, les noms peuvent être partiels (${adminConventionListTextFilterMinLength} caractères minimum).`;

const allConventionsContent: AdminConventionListContent = {
  title: "Consulter les conventions",
  titleAs: "h1",
  description:
    "Conventions correspondant aux filtres, de la plus récente à la plus ancienne date de la demande.",
  tableLabel: "Liste des conventions",
  searchHint: `Astuce : saisir un nom de conseiller dans la recherche permet d’afficher uniquement ses conventions. Pour une agence, utilisez le filtre Agence. ${searchHintTail}`,
  emptyResultMessage:
    "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
  maxResultsMessage: `${adminConventionListMaxResults} conventions ou plus : seules les ${adminConventionListMaxResults} plus récentes sont consultables, affinez les filtres pour trouver les plus anciennes.`,
  manageConventionButtonId:
    domElementIds.adminConventions.conventionListManageConventionButton,
};

const makeAgencyConventionsContent = (
  agency: AgencyDto,
): AdminConventionListContent => ({
  title: "Conventions de l'agence",
  titleAs: "h2",
  description:
    "Conventions de l'agence, de la plus récente à la plus ancienne date de début.",
  tableLabel: `Liste des conventions de ${agency.name}`,
  searchHint: `Astuce : saisir un nom de conseiller dans la recherche permet d’afficher uniquement ses conventions. ${searchHintTail}`,
  emptyResultMessage: "Aucune convention trouvée pour cette agence.",
  maxResultsMessage: `${adminConventionListMaxResults} conventions ou plus : seules les ${adminConventionListMaxResults} plus récentes par date de début sont consultables, affinez la recherche pour trouver les autres.`,
  manageConventionButtonId:
    domElementIds.adminConventions.agencyConventionListManageConventionButton,
});

const toAdminConventionListScope = (
  agencyId: AgencyId | undefined,
): AdminConventionListScope =>
  agencyId ? { agencyIds: [agencyId], sortBy: "dateStart" } : {};

const AdminConventionsMetabaseBackupLink = (): React.ReactNode => {
  const { url } = useAdminDashboard({ name: "adminConventions" });
  return url ? (
    <MetabaseFullScreenButton
      id={domElementIds.adminConventions.conventionListMetabaseBackupLink}
      url={url}
      label="Ouvrir l'ancien tableau Metabase"
    />
  ) : null;
};

const toResultCountLabel = (
  totalRecords: number,
  maxResultsMessage: string,
): string => {
  if (totalRecords >= adminConventionListMaxResults) return maxResultsMessage;
  if (totalRecords <= 1) return `${totalRecords} convention`;
  return `${totalRecords} conventions`;
};

const toFlatGetConventionsForAdminParams = (
  scope: AdminConventionListScope,
  filtersToApply: AdminConventionListFilters,
  search: string | undefined,
): FlatGetConventionsForAdminParams => ({
  ...scope,
  ...filtersToApply,
  agencyNameContains: filtersToApply.agencyNameContains?.trim() || undefined,
  search,
  page: 1,
  perPage: adminConventionListPerPage,
});

export const AdminConventionListSection = ({
  agency,
}: {
  agency?: AgencyDto;
}): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const agencyId = agency?.id;
  const isAgencyScoped = agency !== undefined;
  const scope = toAdminConventionListScope(agencyId);
  const content = agency
    ? makeAgencyConventionsContent(agency)
    : allConventionsContent;
  const isLoading = useAppSelector(conventionListSelectors.isLoading);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.adminConventionList);
  const [tempFilters, setTempFilters] = useState<AdminConventionListFilters>(
    {},
  );
  const [hasSubmittedInvalidFilters, setHasSubmittedInvalidFilters] =
    useState(false);

  useEffect(() => {
    if (connectedUserJwt)
      dispatch(
        conventionListSlice.actions.fetchAdminConventionListRequested({
          jwt: connectedUserJwt,
          filters: {
            ...initialAdminConventionList.filters,
            ...toAdminConventionListScope(agencyId),
          },
          feedbackTopic,
        }),
      );

    return () => {
      dispatch(conventionListSlice.actions.clearAdminConventionListRequested());
    };
  }, [dispatch, connectedUserJwt, agencyId]);

  if (!connectedUserJwt) return null;

  const filtersValidation = flatGetConventionsForAdminParamsSchema.safeParse(
    toFlatGetConventionsForAdminParams(scope, tempFilters, filters.search),
  );
  const filtersErrorMessage =
    hasSubmittedInvalidFilters && !filtersValidation.success
      ? filtersValidation.error.issues
          .map(({ path, message }) =>
            path[0] === "agencyNameContains"
              ? `${agencyNameFilterLabel} : ${message}`
              : message,
          )
          .join(" ")
      : undefined;

  const applyFilters = (
    filtersToApply: AdminConventionListFilters,
    search: string | undefined,
  ): void => {
    const validation = flatGetConventionsForAdminParamsSchema.safeParse(
      toFlatGetConventionsForAdminParams(scope, filtersToApply, search),
    );
    setHasSubmittedInvalidFilters(!validation.success);
    if (validation.success)
      dispatch(
        conventionListSlice.actions.fetchAdminConventionListRequested({
          jwt: connectedUserJwt,
          filters: validation.data,
          feedbackTopic,
        }),
      );
  };

  const resetFilters = (resetValues: AdminConventionListFilters): void => {
    const filtersToApply = { ...tempFilters, ...resetValues };
    setTempFilters(filtersToApply);
    applyFilters(filtersToApply, filters.search);
  };

  const searchConventions = (query: string): void => {
    const search = query.trim();
    if (search === (filters.search ?? "")) return;
    if (search && search.length < adminConventionListTextFilterMinLength)
      return;
    applyFilters(tempFilters, search || undefined);
  };

  const dropdownFilters: RichDropdownProps[] = [
    makeConventionStatusDropdownFilter({
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--status`,
      appliedValues: filters.statuses,
      selectedValues: tempFilters.statuses,
      onChange: (statuses) => setTempFilters({ ...tempFilters, statuses }),
      onReset: () => resetFilters({ statuses: undefined }),
    }),
    makeAssessmentCompletionStatusDropdownFilter({
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--assessment`,
      appliedValues: filters.assessmentCompletionStatus,
      selectedValues: tempFilters.assessmentCompletionStatus,
      onChange: (assessmentCompletionStatus) =>
        setTempFilters({ ...tempFilters, assessmentCompletionStatus }),
      onReset: () => resetFilters({ assessmentCompletionStatus: undefined }),
    }),
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--agency`,
      iconId: "fr-icon-building-line",
      defaultValue: "Toutes les agences",
      values: [
        filters.agencyNameContains
          ? `${agencyNameFilterLabel} : ${filters.agencyNameContains}`
          : "Toutes les agences",
      ],
      submenu: {
        title: "Filtrer par agence",
        content: (
          <Input
            label={agencyNameFilterLabel}
            hintText={`${adminConventionListTextFilterMinLength} caractères minimum`}
            state={filtersErrorMessage ? "error" : "default"}
            stateRelatedMessage={filtersErrorMessage}
            nativeInputProps={{
              id: `${domElementIds.adminConventions.conventionListFilterInput}--agencyNameContains`,
              name: "agencyNameContains",
              value: tempFilters.agencyNameContains ?? "",
              onChange: (event) =>
                setTempFilters({
                  ...tempFilters,
                  agencyNameContains: event.currentTarget.value,
                }),
            }}
          />
        ),
      },
      onReset: () => resetFilters({ agencyNameContains: undefined }),
    },
  ];

  return (
    <BackofficeDashboardTabContent
      title={content.title}
      titleAs={content.titleAs}
      description={content.description}
      titleAction={
        isAgencyScoped ? null : <AdminConventionsMetabaseBackupLink />
      }
    >
      <WithFeedbackReplacer topic={feedbackTopic}>
        {filtersErrorMessage && (
          <Alert
            small
            severity="error"
            className={fr.cx("fr-mb-2w")}
            description={filtersErrorMessage}
          />
        )}
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(
            pagination.totalRecords,
            content.maxResultsMessage,
          )}
        </p>
        <RichTable
          label={content.tableLabel}
          hasViewSwitch={false}
          isLoading={isLoading}
          searchBar={{
            label: "Rechercher",
            placeholder:
              "Rechercher une convention (ID, nom, prénom, conseiller, entreprise, email, SIRET)",
            hintText: content.searchHint,
            onSubmit: searchConventions,
          }}
          dropdownFilters={
            isAgencyScoped
              ? undefined
              : {
                  items: dropdownFilters,
                  onSubmit: () => applyFilters(tempFilters, filters.search),
                }
          }
          headers={
            conventions.length > 0
              ? [
                  { content: "Conseiller" },
                  ...(isAgencyScoped ? [] : [{ content: "Structure" }]),
                  { content: "Statut" },
                  { content: "Bilan" },
                  { content: "Personne en immersion" },
                  { content: "Établissement" },
                  { content: "Dates" },
                  { content: "Actions" },
                ]
              : [{ content: content.emptyResultMessage }]
          }
          tableData={conventions.map((convention) =>
            makeAdminConventionListLine({
              convention,
              isAgencyScoped,
              manageConventionButtonId: content.manageConventionButtonId,
            }),
          )}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                dispatch(
                  conventionListSlice.actions.fetchAdminConventionListRequested(
                    {
                      jwt: connectedUserJwt,
                      filters: { ...filters, page: pageNumber },
                      feedbackTopic,
                    },
                  ),
                );
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

const ConventionStructureCell = ({
  convention,
}: {
  convention: AdminConventionListDto;
}): React.ReactNode => (
  <>
    <strong>{convention.agencyName}</strong>
    {convention.agencyRefersToAgencyName && (
      <span className={fr.cx("fr-hint-text")}>
        Liée à {convention.agencyRefersToAgencyName}
      </span>
    )}
  </>
);

const makeAdminConventionListLine = ({
  convention,
  isAgencyScoped,
  manageConventionButtonId,
}: {
  convention: AdminConventionListDto;
  isAgencyScoped: boolean;
  manageConventionButtonId: string;
}): React.ReactNode[] => [
  <AgencyReferentCell
    key={`${convention.id}-counsellor`}
    agencyReferent={convention.agencyReferent}
    agencyName={convention.agencyName}
  />,
  ...(isAgencyScoped
    ? []
    : [
        <ConventionStructureCell
          key={`${convention.id}-agency`}
          convention={convention}
        />,
      ]),
  <ConventionStatusBadges
    key={`${convention.id}-status`}
    status={convention.status}
    dateEnd={convention.dateEnd}
  />,
  <ConventionAssessmentStatusBadge
    key={`${convention.id}-assessment`}
    conventionParams={convention}
    userKind="agency"
  />,
  <BeneficiaryCell
    key={`${convention.id}-beneficiary`}
    beneficiary={convention.beneficiary}
  />,
  <strong key={`${convention.id}-establishment`}>
    {convention.businessName}
  </strong>,
  <ConventionDatesDisplay
    key={`${convention.id}-dates`}
    dateStart={convention.dateStart}
    dateEnd={convention.dateEnd}
  />,
  <Button
    key={`${convention.id}-actions`}
    id={`${manageConventionButtonId}--${convention.id}`}
    size="small"
    priority="secondary"
    linkProps={{
      ...frontRoutes.adminConventionDetail({ conventionId: convention.id })
        .link,
      target: "_blank",
    }}
  >
    Piloter
  </Button>,
];
