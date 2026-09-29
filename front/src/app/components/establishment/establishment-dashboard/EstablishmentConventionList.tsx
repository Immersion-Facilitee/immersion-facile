import { fr } from "@codegouvfr/react-dsfr";
import { Fragment, type ReactNode, useEffect } from "react";
import { RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AbsoluteUrl,
  domElementIds,
  type EstablishmentUserConventionListDto,
  getFormattedFirstnameAndLastname,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import { conventionListSlice } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { ConventionAssessmentStatusBadge } from "../../convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "../../convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "../../convention/ConventionStatusBadge";
import { UnarchivedOrManageConventionButton } from "../../convention/UnarchivedOrManageConventionButton";

const establishmentConventionListFeedbackTopic: FeedbackTopic =
  "connected-user-establishment-convention-list";

type EstablishmentConventionListProps = {
  conventionsDashboardUrl: AbsoluteUrl | null;
};

export const EstablishmentConventionList = ({
  conventionsDashboardUrl,
}: EstablishmentConventionListProps): ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.establishmentConventionList);
  const isLoading = useAppSelector(conventionListSelectors.isLoading);
  const hasConventions = conventions.length > 0;

  useEffect(() => {
    if (!connectedUserJwt) return;

    dispatch(
      conventionListSlice.actions.fetchEstablishmentConventionListRequested({
        jwt: connectedUserJwt,
        filters: {
          page: 1,
          perPage: 10,
        },
        feedbackTopic: establishmentConventionListFeedbackTopic,
      }),
    );

    return () => {
      dispatch(
        conventionListSlice.actions.clearEstablishmentConventionListRequested(),
      );
    };
  }, [connectedUserJwt, dispatch]);

  if (!connectedUserJwt) return null;

  return (
    <div className={fr.cx("fr-mt-4w")}>
      {conventionsDashboardUrl && (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--right")}>
          <MetabaseFullScreenButton
            url={conventionsDashboardUrl}
            label="Télécharger les données (Excel/CSV)"
            tooltipText="L’export se fait depuis l’ancien tableau Metabase."
          />
        </div>
      )}
      <WithFeedbackReplacer topic={establishmentConventionListFeedbackTopic}>
        <RichTable
          headers={getEstablishmentConventionTableHeaders(
            hasConventions || isLoading,
          )}
          isLoading={isLoading}
          data={toEstablishmentConventionTableData(conventions)}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                dispatch(
                  conventionListSlice.actions.fetchEstablishmentConventionListRequested(
                    {
                      jwt: connectedUserJwt,
                      filters: { ...filters, page: pageNumber },
                      feedbackTopic: establishmentConventionListFeedbackTopic,
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
    </div>
  );
};

const getEstablishmentConventionTableHeaders = (
  hasConventions: boolean,
): string[] =>
  hasConventions
    ? ["Personne en immersion", "Statut", "Bilan", "Dates", "Actions"]
    : ["Nous n'avons pas trouvé de convention."];

const toEstablishmentConventionTableData = (
  conventions: EstablishmentUserConventionListDto[],
): ReactNode[][] =>
  conventions.map((convention) => [
    <Fragment key={`${convention.id}-beneficiary`}>
      <strong>
        {getFormattedFirstnameAndLastname({
          firstname: convention.beneficiary.firstName,
          lastname: convention.beneficiary.lastName,
        })}
      </strong>
      <br />
      {`${convention.immersionAppellation.appellationLabel} (${convention.businessName})`}
    </Fragment>,
    <Fragment key={`${convention.id}-status`}>
      <ConventionStatusBadge
        conventionStatus={convention.status}
        userKind="establishment"
      />
    </Fragment>,
    <Fragment key={`${convention.id}-assessment`}>
      <ConventionAssessmentStatusBadge
        conventionParams={convention}
        userKind="establishment"
      />
    </Fragment>,
    <Fragment key={`${convention.id}-dates`}>
      <ConventionDatesDisplay
        dateStart={convention.dateStart}
        dateEnd={convention.dateEnd}
      />
    </Fragment>,
    <UnarchivedOrManageConventionButton
      label="Voir la convention"
      key={`${convention.id}-actions`}
      conventionId={convention.id}
      conventionDateEnd={convention.dateEnd}
      isDisabled={false}
      id={`${domElementIds.establishmentDashboardConventions.goToConventionButton}--${convention.id}`}
    />,
  ]);
