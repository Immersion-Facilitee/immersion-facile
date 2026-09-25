import { fr } from "@codegouvfr/react-dsfr";
import { Fragment, useEffect } from "react";
import { RichTable, SectionHighlight } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type BeneficiaryConvention,
  defaultPerPageInWebPagination,
  domElementIds,
  immersionFacileHelpdeskRootUrl,
} from "shared";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import { conventionListSlice } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { ConventionAssessmentStatusBadge } from "../../convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "../../convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "../../convention/ConventionStatusBadge";
import { UnarchivedOrManageConventionButton } from "../../convention/UnarchivedOrManageConventionButton";
import { WithFeedbackReplacer } from "../../feedback/WithFeedbackReplacer";

export const BeneficiaryConventionList = (): React.ReactNode => {
  const feedbackTopic: FeedbackTopic =
    "connected-user-beneficiary-convention-list";
  const dispatch = useDispatch();
  const jwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.beneficiaryConventionList);
  const isLoading = useAppSelector(conventionListSelectors.isLoading);
  const feedback = useFeedbackTopic(feedbackTopic);
  const { enableBeneficiaryManageConvention } = useFeatureFlags();
  const hasActiveSearch = !!filters.search;
  const hasConventions = conventions.length > 0;
  const showHelpdeskEmptyState =
    !hasConventions &&
    !hasActiveSearch &&
    !!currentUser &&
    feedback?.level === "success";
  const showTable = !!jwt && (hasConventions || hasActiveSearch);

  useEffect(() => {
    if (jwt)
      dispatch(
        conventionListSlice.actions.fetchBeneficiaryConventionListRequested({
          jwt,
          filters: {
            page: 1,
            perPage: defaultPerPageInWebPagination,
          },
          feedbackTopic,
        }),
      );

    return () => {
      dispatch(
        conventionListSlice.actions.clearBeneficiaryConventionListRequested(),
      );
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    };
  }, [jwt, dispatch]);

  return (
    <>
      <h1>Conventions</h1>
      <WithFeedbackReplacer topic={feedbackTopic} level="error" />
      {showTable && (
        <RichTable
          headers={getTableHeaders(hasConventions)}
          isLoading={isLoading}
          data={conventionListToTableData(
            conventions,
            enableBeneficiaryManageConvention.isActive,
          )}
          searchBar={{
            label: "Rechercher",
            placeholder:
              "Rechercher une convention (ID, entreprise, email, etc.)",
            onSubmit: (query: string) => {
              dispatch(
                conventionListSlice.actions.fetchBeneficiaryConventionListRequested(
                  {
                    jwt,
                    filters: {
                      ...filters,
                      search: query || undefined,
                      page: 1,
                      perPage: defaultPerPageInWebPagination,
                    },
                    feedbackTopic,
                  },
                ),
              );
            },
          }}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                dispatch(
                  conventionListSlice.actions.fetchBeneficiaryConventionListRequested(
                    {
                      jwt,
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
      )}
      {showHelpdeskEmptyState && currentUser && (
        <SectionHighlight priority="discrete">
          <p>
            Aucune convention associée à votre mail{" "}
            <strong>{currentUser.email}</strong> n’a été trouvée.
          </p>
          <p>
            Si vous avez déjà une convention en cours, vérifiez que vous vous
            êtes connecté avec le même mail que celui renseigné sur vos
            conventions.
          </p>
          <p>
            Pour plus d’informations,{" "}
            <a
              id={
                domElementIds.beneficiaryDashboardConventions
                  .beneficiaryConventionListHelpdeskNoConventionHint
              }
              href={`${immersionFacileHelpdeskRootUrl}/article/consulter-mes-conventions-dimmersion-12be20q/`}
              className={fr.cx("fr-link")}
              target="_blank"
              rel="noreferrer"
            >
              consultez notre centre d’aide
            </a>
            .
          </p>
        </SectionHighlight>
      )}
    </>
  );
};

const getTableHeaders = (hasConventions: boolean): React.ReactNode[] =>
  hasConventions
    ? ["Entreprise", "Statut", "Bilan", "Dates", "Actions"]
    : [
        "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche",
      ];

const conventionListToTableData = (
  conventionList: BeneficiaryConvention[],
  isBeneficiaryManageConventionEnabled: boolean,
): React.ReactNode[][] =>
  conventionList.map<React.ReactNode[]>((convention) => [
    convention.businessName,
    <Fragment key={convention.conventionId}>
      <ConventionStatusBadge
        conventionStatus={convention.status}
        userKind="beneficiary"
      />
    </Fragment>,
    <Fragment key={convention.conventionId}>
      <ConventionAssessmentStatusBadge
        conventionParams={convention}
        userKind="beneficiary"
      />
    </Fragment>,
    <Fragment key={convention.conventionId}>
      <ConventionDatesDisplay
        dateStart={convention.dateStart}
        dateEnd={convention.dateEnd}
      />
    </Fragment>,
    <UnarchivedOrManageConventionButton
      label="Voir la convention"
      key={convention.conventionId}
      conventionId={convention.conventionId}
      conventionDateEnd={convention.dateEnd}
      isDisabled={!isBeneficiaryManageConventionEnabled}
      id={`${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${convention.conventionId}`}
    />,
  ]);
