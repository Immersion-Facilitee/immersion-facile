import { fr } from "@codegouvfr/react-dsfr";
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { Fragment, type ReactNode, useEffect } from "react";
import { RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AbsoluteUrl,
  domElementIds,
  type EstablishmentUserConventionListDto,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isConventionArchived,
  isConventionEndingInOneDayOrMore,
  isConventionValidated,
  toDisplayedDate,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import { conventionListSlice } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { match, P } from "ts-pattern";
import { ConventionAssessmentStatusBadge } from "../../convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "../../convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "../../convention/ConventionStatusBadge";
import { UnarchivedOrManageConventionButton } from "../../convention/UnarchivedOrManageConventionButton";

const establishmentConventionListFeedbackTopic: FeedbackTopic =
  "connected-user-establishment-convention-list";

type EstablishmentConventionListProps = {
  conventionsDashboardUrl: AbsoluteUrl | null;
};

type EstablishmentConventionGridItem = {
  badge: ReactNode;
  id: string;
  title: string;
  subTitle: string;
  content: ReactNode;
  cta: ButtonProps;
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
          headers={getEstablishmentConventionTableHeaders({
            hasConventions,
            search: filters.search,
          })}
          isLoading={isLoading}
          label={"Listing des conventions"}
          hasViewSwitch={true}
          gridData={toEstablishmentConventionGridData(conventions)}
          tableData={toEstablishmentConventionTableData(conventions)}
          searchBar={{
            label: "Rechercher",
            placeholder:
              "Rechercher une convention (ID de convention, nom, prénom, email, SIRET, ... )",
            onSubmit: (query: string) => {
              dispatch(
                conventionListSlice.actions.fetchEstablishmentConventionListRequested(
                  {
                    jwt: connectedUserJwt,
                    filters: {
                      ...filters,
                      search: query || undefined,
                      page: 1,
                    },
                    feedbackTopic: establishmentConventionListFeedbackTopic,
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

const getEstablishmentConventionTableHeaders = ({
  hasConventions,
  search,
}: {
  hasConventions: boolean;
  search: string | undefined;
}): string[] =>
  match({ hasConventions, search })
    .with({ hasConventions: true }, () => [
      "Personne en immersion",
      "Statut",
      "Bilan",
      "Dates",
      "Actions",
    ])
    .with({ search: P.string.minLength(1) }, ({ search }) => [
      `Aucune convention trouvée pour la recherche « ${search} », vous pouvez modifier votre recherche pour l'élargir.`,
    ])
    .otherwise(() => ["Nous n'avons pas trouvé de convention."]);

const toEstablishmentConventionGridData = (
  conventions: EstablishmentUserConventionListDto[],
): EstablishmentConventionGridItem[] =>
  conventions.map((convention) => {
    const shouldShowAssessmentBadge =
      isConventionValidated(convention.status) &&
      !isConventionEndingInOneDayOrMore(convention.dateEnd);
    return {
      id: convention.id,
      title: getFormattedFirstnameAndLastname({
        firstname: convention.beneficiary.firstName,
        lastname: convention.beneficiary.lastName,
      }),
      subTitle: `${convention.immersionAppellation.appellationLabel} - ${convention.businessName}`,
      badge: (
        <ul className={fr.cx("fr-badges-group", "fr-badges-group--sm")}>
          <li>
            <ConventionStatusBadge
              conventionStatus={convention.status}
              userKind="establishment"
            />
          </li>
          {shouldShowAssessmentBadge && (
            <li>
              <ConventionAssessmentStatusBadge
                conventionParams={convention}
                userKind="establishment"
              />
            </li>
          )}
        </ul>
      ),
      content: (
        <dl className={fr.cx("fr-raw-list", "fr-mt-1w")}>
          <dt className={fr.cx("fr-text--xs", "fr-mb-0")}>Dates</dt>
          <dd className={fr.cx("fr-text--sm", "fr-text--bold")}>
            {`Du ${toDisplayedDate({
              date: new Date(convention.dateStart),
              withHours: false,
            })} au ${toDisplayedDate({
              date: new Date(convention.dateEnd),
              withHours: false,
            })}`}
          </dd>
        </dl>
      ),
      cta: toEstablishmentConventionGridCta({
        convention,
        isDisabled: false,
      }),
    };
  });

const toEstablishmentConventionGridCta = ({
  convention,
  isDisabled,
}: {
  convention: EstablishmentUserConventionListDto;
  isDisabled: boolean;
}): ButtonProps => {
  const id = `${domElementIds.establishmentDashboardConventions.goToConventionButton}--${convention.id}`;

  if (isDisabled)
    return {
      id,
      disabled: true,
      children: "Voir la convention",
    };

  if (
    isConventionArchived({
      dateEnd: convention.dateEnd,
      now: new Date(),
    })
  )
    return {
      id: `${domElementIds.beneficiaryDashboardConventions.unarchiveConventionButton}--${convention.id}`,
      children: "Désarchiver",
      linkProps: {
        ...frontRoutes.archivedConventionRequest({
          conventionId: convention.id,
        }).link,
        target: "_blank",
      },
    };

  return {
    id,
    children: "Voir la convention",
    linkProps: {
      ...frontRoutes.manageConventionConnectedUser({
        conventionId: convention.id,
      }).link,
      target: "_blank",
    },
  };
};

const toEstablishmentConventionTableData = (
  conventions: EstablishmentUserConventionListDto[],
): ReactNode[][] =>
  conventions.map((convention) => [
    <Fragment key={`${convention.id}-beneficiary`}>
      <p>
        <strong>
          {getFormattedFirstnameAndLastname({
            firstname: convention.beneficiary.firstName,
            lastname: convention.beneficiary.lastName,
          })}
        </strong>
      </p>
      <p>
        {`${convention.immersionAppellation.appellationLabel} (${convention.businessName})`}
      </p>
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
