import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Table from "@codegouvfr/react-dsfr/Table";
import { Fragment, useEffect } from "react";
import { Loader, SectionHighlight } from "react-design-system";
import { useDispatch, useSelector } from "react-redux";
import {
  type BeneficiaryConventionListDto,
  domElementIds,
  frontRoutes,
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
  const { enableBeneficiaryConventionPilotage } = useFeatureFlags();

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
            fixed
            headers={["Entreprise", "Statut", "Bilan", "Dates", "Actions"]}
            data={conventionListToTableData(
              beneficiaryConventionList,
              enableBeneficiaryConventionPilotage.isActive,
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
  isPilotageEnabled: boolean,
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
    isPilotageEnabled ? (
      <Button
        key={convention.conventionId}
        id={domElementIds.beneficiaryDashboardConventions.goToConventionButton}
        linkProps={{
          target: "_blank",
          rel: "noreferrer",
          href: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.conventionId,
          }).link.href,
        }}
      >
        Voir la convention
      </Button>
    ) : (
      <Button
        disabled
        key={convention.conventionId}
        id={domElementIds.beneficiaryDashboardConventions.goToConventionButton}
      >
        Voir la convention
      </Button>
    ),
  ]);
