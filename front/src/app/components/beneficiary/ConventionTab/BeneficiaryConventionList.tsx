import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Table from "@codegouvfr/react-dsfr/Table";
import { Fragment, useEffect } from "react";
import { Loader, SectionHighlight } from "react-design-system";
import { useDispatch, useSelector } from "react-redux";
import {
  type BeneficiaryConventionListDto,
  type ConventionId,
  type DateString,
  domElementIds,
  frontRoutes,
  immersionFacileHelpdeskRootUrl,
  isConventionArchived,
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
import { WithFeedbackReplacer } from "../../feedback/WithFeedbackReplacer";

export const BeneficiaryConventionList = (): React.ReactNode => {
  const feedbackTopic: FeedbackTopic =
    "connected-user-beneficiary-convention-list";
  const dispatch = useDispatch();
  const jwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const beneficiaryConventionList = useSelector(
    conventionListSelectors.beneficiaryConventionList,
  );
  const isLoading = useSelector(conventionListSelectors.isLoading);
  const feedback = useFeedbackTopic(feedbackTopic);
  const { enableBeneficiaryManageConvention } = useFeatureFlags();

  useEffect(() => {
    if (jwt && !isLoading && beneficiaryConventionList === null)
      dispatch(
        conventionListSlice.actions.fetchBeneficiaryConventionListRequested({
          jwt,
          feedbackTopic,
        }),
      );
  }, [jwt, isLoading, dispatch, beneficiaryConventionList]);

  useEffect(
    () => () => {
      dispatch(
        conventionListSlice.actions.clearBeneficiaryConventionListRequested(),
      );
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );

  return (
    <>
      {isLoading && <Loader />}
      <h1>Conventions</h1>
      <WithFeedbackReplacer topic={feedbackTopic} level="error" />
      {beneficiaryConventionList !== null &&
        beneficiaryConventionList.length > 0 && (
          <Table
            headers={["Entreprise", "Statut", "Bilan", "Dates", "Actions"]}
            data={conventionListToTableData(
              beneficiaryConventionList,
              enableBeneficiaryManageConvention.isActive,
            )}
          />
        )}
      {beneficiaryConventionList?.length === 0 &&
        currentUser &&
        feedback?.level === "success" && (
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

const conventionListToTableData = (
  conventionList: BeneficiaryConventionListDto,
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
    <ConventionActionButton
      key={convention.conventionId}
      conventionId={convention.conventionId}
      conventionDateEnd={convention.dateEnd}
      isBeneficiaryManageConventionEnabled={
        isBeneficiaryManageConventionEnabled
      }
    />,
  ]);

const ConventionActionButton = ({
  conventionId,
  conventionDateEnd,
  isBeneficiaryManageConventionEnabled,
}: {
  conventionId: ConventionId;
  conventionDateEnd: DateString;
  isBeneficiaryManageConventionEnabled: boolean;
}): React.ReactNode => {
  if (!isBeneficiaryManageConventionEnabled)
    return (
      <Button
        disabled
        size="small"
        priority="secondary"
        id={`${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${conventionId}`}
      >
        Voir la convention
      </Button>
    );

  return isConventionArchived({
    dateEnd: conventionDateEnd,
    now: new Date(),
  }) ? (
    <Button
      id={`${domElementIds.beneficiaryDashboardConventions.unarchiveConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.archivedConventionRequest({ conventionId }).link,
        target: "_blank",
      }}
    >
      Désarchiver
    </Button>
  ) : (
    <Button
      id={`${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.manageConventionConnectedUser({
          conventionId,
        }).link,
        target: "_blank",
      }}
    >
      Voir la convention
    </Button>
  );
};
