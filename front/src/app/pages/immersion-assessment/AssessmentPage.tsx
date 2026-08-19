import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import { useEffect, useState } from "react";
import { Loader, MainWrapper, PageHeader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AssessmentStatus,
  type ConventionJwtPayload,
  decodeMagicLinkJwtWithoutSignatureCheck,
  domElementIds,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  hasAllowedRoleOnAssessment,
  type Role,
} from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { AssessmentForm } from "src/app/components/forms/assessment/AssessmentForm";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useConvention } from "src/app/hooks/convention.hooks";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useSiretFetcher } from "src/app/hooks/siret.hooks";
import { ShowConventionErrorOrRenewExpiredJwt } from "src/app/pages/convention/ShowConventionErrorOrRenewExpiredJwt";
import { commonIllustrations } from "src/assets/img/illustrations";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import type { Route } from "type-route";

type AssessmentRoute = Route<typeof frontRoutes.assessment>;

interface AssessmentPageProps {
  route: AssessmentRoute;
}

export const AssessmentPage = ({ route }: AssessmentPageProps) => {
  const dispatch = useDispatch();
  const [submittedAssessmentStatus, setSubmittedAssessmentStatus] =
    useState<AssessmentStatus | null>(null);

  useEffect(
    () => () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );

  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const userRolesForFetchedConvention = useAppSelector(
    connectedUserSelectors.userRolesForFetchedConvention,
  );
  const isEstablishmentRegistered = useAppSelector(
    siretSelectors.isSiretAlreadySaved,
  );

  const fetchConventionError =
    conventionFormFeedback?.level === "error" &&
    conventionFormFeedback.on === "fetch";
  const { applicationId } =
    decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(
      route.params.jwt,
    );
  const conventionId = applicationId ?? route.params.conventionId;

  const { role: roleFromJwt } =
    decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(
      route.params.jwt,
    );
  const roles: Role[] = roleFromJwt
    ? [roleFromJwt]
    : userRolesForFetchedConvention;
  const { convention, isLoading: isConventionLoading } = useConvention({
    jwt: route.params.jwt,
    conventionId,
  });

  const { isFetchingSiret, updateSiret, currentSiret } = useSiretFetcher({
    shouldThrowErrorOnAlreadySaved: true,
    addressAutocompleteLocator: null,
  });

  if (convention && convention?.siret !== currentSiret) {
    updateSiret(convention.siret);
  }

  const assessmentFormFeedback = useFeedbackTopic("assessment");

  const isLoading = isConventionLoading;

  const isConventionValidated = convention?.status === "ACCEPTED_BY_VALIDATOR";

  const isAssessmentSuccessfullySubmitted =
    assessmentFormFeedback?.level === "success" &&
    assessmentFormFeedback?.on === "create";

  if (fetchConventionError)
    return (
      <ShowConventionErrorOrRenewExpiredJwt
        errorMessage={conventionFormFeedback?.message}
        jwt={route.params.jwt}
      />
    );

  if (isAssessmentSuccessfullySubmitted && !isFetchingSiret)
    return (
      <FullPageFeedback
        title="Merci d'avoir rempli le bilan !"
        illustration={commonIllustrations.success}
        content={
          <>
            {submittedAssessmentStatus !== "DID_NOT_SHOW" && (
              <>
                <p id={domElementIds.assessment.successMessage}>
                  Nous vous remercions d'avoir utilisé Immersion Facilitée pour
                  accompagner {convention?.signatories.beneficiary.firstName}{" "}
                  {convention?.signatories.beneficiary.lastName} dans son
                  immersion. Votre implication contribue à améliorer notre site
                  et à enrichir le dossier du candidat.
                </p>
                <p>
                  {convention?.signatories.beneficiary.firstName}{" "}
                  {convention?.signatories.beneficiary.lastName} recevra un mail
                  pour consulter le bilan, le signer et, s’il le souhaite,
                  ajouter un commentaire. Une fois signé, la version finale au
                  format PDF sera automatiquement envoyée à toutes les parties
                </p>
              </>
            )}
            {submittedAssessmentStatus === "DID_NOT_SHOW" && (
              <>
                <p>
                  Nous vous remercions d'avoir pris le temps de nous informer de
                  l'absence de {convention?.signatories.beneficiary.firstName}{" "}
                  {convention?.signatories.beneficiary.lastName}. Votre retour
                  est essentiel pour assurer un suivi de qualité.
                </p>
                <p>
                  Le prescripteur en charge de son accompagnement a été
                  automatiquement prévenu par e-mail afin de faire le point avec
                  lui.
                </p>
                <p>
                  L'immersion n'ayant pas eu lieu, le processus est désormais
                  clos (aucune signature requise, aucun PDF généré). Nous vous
                  remercions pour votre disponibilité et espérons que votre
                  prochaine immersion sera une réussite.
                </p>
              </>
            )}
            {roles.includes("establishment-tutor") ? (
              <Highlight>
                {isEstablishmentRegistered ? (
                  <p>
                    <strong>Que faire ensuite ?</strong> Maintenez à jour votre
                    fiche entreprise afin de continuer à recevoir des
                    immersions.
                  </p>
                ) : (
                  <p>
                    <strong>Que faire ensuite ?</strong> Créer votre compte
                    Immersion Facilitée afin de référencer votre entreprise pour
                    accueillir d'autres immersions.
                  </p>
                )}
              </Highlight>
            ) : null}
          </>
        }
        buttons={[
          {
            ...(roles.includes("establishment-tutor")
              ? {
                  children: isEstablishmentRegistered
                    ? "Accéder à ma fiche entreprise"
                    : "Créer mon espace",
                  onClick: () => {
                    isEstablishmentRegistered
                      ? frontRoutes.establishmentDashboard().push()
                      : frontRoutes.formEstablishment().push();
                  },
                }
              : {
                  children: "Accéder à mon espace prescripteur",
                  onClick: () => {
                    frontRoutes.agencyDashboard().push();
                  },
                }),
          },
        ]}
      />
    );

  return (
    <HeaderFooterLayout>
      {isLoading && <Loader />}
      {convention &&
      !hasAllowedRoleOnAssessment(roles, "CreateAssessment", convention) ? (
        <Alert
          severity="error"
          title="Erreur"
          description="Vous n'êtes pas autorisé à accéder à cette page"
        />
      ) : (
        convention && (
          <MainWrapper
            layout="default"
            pageHeader={
              <PageHeader
                breadcrumbs={<Breadcrumbs />}
                className={fr.cx("fr-mb-0")}
                title={`Bilan ${convention.internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"} de ${getFormattedFirstnameAndLastname(
                  {
                    firstname: convention.signatories.beneficiary.firstName,
                    lastname: convention.signatories.beneficiary.lastName,
                  },
                )}`}
              />
            }
          >
            {convention && !isConventionValidated && (
              <Alert
                severity="error"
                title="Votre convention n'est pas prête à recevoir un bilan"
                description="Seule une convention entièrement validée peut recevoir un bilan"
              />
            )}
            {convention.assessment && (
              <Alert
                severity="error"
                title="Erreur"
                description="Le bilan a déjà été rempli et ne peut être modifié."
              />
            )}
            {convention && isConventionValidated && !convention.assessment && (
              <AssessmentForm
                convention={convention}
                jwt={route.params.jwt}
                currentUserRoles={roles}
                onAssessmentSubmitted={(assessment) =>
                  setSubmittedAssessmentStatus(assessment.status)
                }
              />
            )}
          </MainWrapper>
        )
      )}
    </HeaderFooterLayout>
  );
};
