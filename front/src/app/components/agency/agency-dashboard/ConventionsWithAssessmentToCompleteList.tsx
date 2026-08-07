import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import Pagination from "@codegouvfr/react-dsfr/Pagination";
import { useCallback } from "react";
import { HeadingSection, Task } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConventionWithUnfinalizedAssessment,
  domElementIds,
  frontRoutes,
  NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
  toDisplayedDate,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  getAssessmentCompletionStatus,
  getAssessmentLabelsAndSeverityByStatus,
} from "src/app/utils/assessment.utils";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserConventionsToManageSelectors } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.selectors";
import { connectedUserConventionsToManageSlice } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";

export const ConventionsWithAssessmentToCompleteList = () => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const conventions = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessment,
  );
  const pagination = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentPagination,
  );

  const fetchConventions = useCallback(
    ({ page }: { page: number }) => {
      if (connectedUserJwt) {
        dispatch(
          connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
            {
              filters: {
                page,
                perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              },
              jwt: connectedUserJwt,
              feedbackTopic: "conventions-with-unfinalized-assessment",
            },
          ),
        );
      }
    },
    [connectedUserJwt, dispatch],
  );

  const onPaginationClick = useCallback(
    (pageNumber: number) => {
      fetchConventions({ page: pageNumber });
    },
    [fetchConventions],
  );

  return (
    <HeadingSection
      title="Relances bilans"
      titleAs="h2"
      className={fr.cx("fr-mt-2w", "fr-mb-4w")}
    >
      {conventions?.length === 0 && (
        <p>Aucun bilan à compléter ou à signer pour le moment.</p>
      )}
      {conventions.map((convention) => (
        <AssessmentToCompleteTaskItem
          key={convention.id}
          convention={convention}
        />
      ))}
      {pagination &&
        pagination?.totalRecords > NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE && (
          <Pagination
            className={fr.cx("fr-mt-3w")}
            count={pagination.totalPages}
            defaultPage={pagination.currentPage}
            getPageLinkProps={(pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              href: "#",
              key: `page-${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                onPaginationClick(pageNumber);
              },
            })}
          />
        )}
    </HeadingSection>
  );
};

const AssessmentToCompleteTaskItem = ({
  convention,
}: {
  convention: ConventionWithUnfinalizedAssessment;
}) => {
  const assessmentCompletionStatus = getAssessmentCompletionStatus(
    convention.assessment,
  );
  const title = (
    <>
      <span className={fr.cx("fr-pr-2v")}>
        {convention.beneficiary.firstname} {
          convention.beneficiary.lastname
        }{" "}
      </span>
      <Badge
        className={fr.cx("fr-badge--error", "fr-mx-2v")}
        severity="warning"
        small
      >
        {
          getAssessmentLabelsAndSeverityByStatus({ isPlural: false })[
            assessmentCompletionStatus
          ].shortLabel.agencyLabel
        }
      </Badge>
    </>
  );
  const footer = convention.assessment
    ? `Date de complétion du bilan : ${toDisplayedDate({ date: new Date(convention.assessment.createdAt) })}`
    : `Date de fin d'immersion : ${toDisplayedDate({ date: new Date(convention.dateEnd) })}`;

  return (
    <Task
      title={title}
      titleAs="h3"
      description={
        getAssessmentLabelsAndSeverityByStatus({ isPlural: false })[
          assessmentCompletionStatus
        ].description
      }
      footer={footer}
      buttonsRows={[
        {
          id: domElementIds.manageConventionConnectedUser
            .pilotConventionWithUnfinalizedAssessmentButton,
          content: (
            <Button
              priority="secondary"
              size="medium"
              linkProps={{
                target: "_blank",
                rel: "noreferrer",
                href: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                }).link.href,
              }}
            >
              Piloter
            </Button>
          ),
        },
      ]}
    />
  );
};
