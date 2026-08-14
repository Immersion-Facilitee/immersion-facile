import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import DOMPurify from "dompurify";
import { useEffect } from "react";
import { Document, Loader, MainWrapper } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  computeTotalHours,
  convertLocaleDateToUtcTimezoneDate,
  domElementIds,
  escapeHtml,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  immersionFacileHelpdeskRootUrl,
  isAssessmentDto,
  isBeforeAssessmentSignatureReleaseDate,
  makeSiretDescriptionLink,
  toDisplayedDate,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { AssessmentSignModalContent } from "src/app/components/forms/assessment/SignAssessmentModalContent";
import { useConvention } from "src/app/hooks/convention.hooks";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useJwt } from "src/app/hooks/jwt.hooks";
import { usePdfGenerator } from "src/app/hooks/pdf.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { ShowConventionErrorOrRenewExpiredJwt } from "src/app/pages/convention/ShowConventionErrorOrRenewExpiredJwt";
import { createFormModal } from "src/app/utils/createFormModal";
import { commonIllustrations } from "src/assets/img/illustrations";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import { agenciesSlice } from "src/core-logic/domain/agencies/agencies.slice";
import { assessmentSelectors } from "src/core-logic/domain/assessment/assessment.selectors";
import { assessmentSlice } from "src/core-logic/domain/assessment/assessment.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import logoIf from "/assets/img/logo-if.svg";
import logoRf from "/assets/img/logo-rf.svg";

const createAssessmentSignModalParams = {
  isOpenedByDefault: false,
  id: domElementIds.assessmentDocument.signAssessmentModal,
  formId: domElementIds.assessmentDocument.signAssessmentForm,
  doSubmitClosesModal: false,
  concealingBackdrop: true,
  submitButton: {
    id: domElementIds.assessmentDocument.signAssessmentButton,
    children: "Signer le bilan",
    iconId: "fr-icon-pencil-line",
    iconPosition: "left",
  },
  cancelButton: {
    id: domElementIds.assessmentDocument.cancelSignAssessmentButton,
    children: "Annuler",
  },
};

const {
  Component: AssessmentSignModal,
  open: openAssessmentSignModal,
  close: closeAssessmentSignModal,
} = createFormModal(createAssessmentSignModalParams);

type AssessmentDocumentPageProps = {
  route: Route<typeof frontRoutes.assessmentDocument>;
};

export const AssessmentDocumentPage = ({
  route,
}: AssessmentDocumentPageProps) => {
  const dispatch = useDispatch();
  const { jwt, jwtPayload } = useJwt(route);

  const conventionId = jwtPayload.applicationId ?? route.params.conventionId;
  const assessment = useAppSelector(assessmentSelectors.currentAssessment);
  const isAssessmentLoading = useAppSelector(assessmentSelectors.isLoading);

  const userRolesForFetchedConvention = useAppSelector(
    connectedUserSelectors.userRolesForFetchedConvention,
  );
  const agencyInfo = useAppSelector(agenciesSelectors.details);
  const isAgencyInfoLoading = useAppSelector(agenciesSelectors.isLoading);

  const { convention, isLoading: isConventionLoading } = useConvention({
    jwt,
    conventionId,
  });
  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const signAssessmentFeedback = useFeedbackTopic("sign-assessment");
  const fetchConventionError =
    conventionFormFeedback?.level === "error" &&
    conventionFormFeedback.on === "fetch";
  const isBeneficiary = jwtPayload.role
    ? jwtPayload.role === "beneficiary"
    : userRolesForFetchedConvention.includes("beneficiary");

  const isSignAssessmentSuccess =
    signAssessmentFeedback?.level === "success" &&
    signAssessmentFeedback?.on === "create";
  const { isPdfLoading, generateAndDownloadPdf } = usePdfGenerator();

  useEffect(() => {
    dispatch(
      assessmentSlice.actions.getAssessmentRequested({
        conventionId,
        jwt,
        feedbackTopic: "assessment",
      }),
    );
  }, [dispatch, conventionId, jwt]);

  useEffect(
    () => () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );
  useEffect(() => {
    if (convention?.agencyId && !agencyInfo) {
      dispatch(
        agenciesSlice.actions.fetchAgencyInfoRequested(convention.agencyId),
      );
    }
  }, [convention?.agencyId, dispatch, agencyInfo]);

  const logos = [
    <img key="logo-rf" src={logoRf} alt="Logo RF" />,
    <img
      key={"logo-if"}
      src={agencyInfo?.logoUrl ? agencyInfo.logoUrl : logoIf}
      alt=""
    />,
  ];

  if (
    isConventionLoading ||
    isAssessmentLoading ||
    isPdfLoading ||
    isAgencyInfoLoading
  )
    return <Loader />;

  if (fetchConventionError)
    return (
      <ShowConventionErrorOrRenewExpiredJwt
        errorMessage={conventionFormFeedback.message}
        jwt={jwt}
      />
    );

  if (!convention) return <p>Pas de convention correspondante trouvée</p>;
  if (!assessment)
    return (
      <FullPageFeedback
        title="Ce bilan n’est plus disponible"
        illustration={commonIllustrations.success}
        content={
          <>
            <p>
              Ce bilan d’immersion a été supprimé suite à une demande et ne peut
              plus être consulté ni signé.
            </p>
            <p>
              Un nouveau bilan est en cours de préparation. Dès qu’il sera prêt,
              vous recevrez un nouvel email vous permettant d’y accéder et de le
              signer.
            </p>
            <p>
              Vous avez besoin d’aide ?{" "}
              <a
                href={immersionFacileHelpdeskRootUrl}
                target="_blank"
                rel="noreferrer"
              >
                Contacter le support
              </a>
              .
            </p>
          </>
        }
        buttons={[
          {
            children: "Retourner sur la page d’accueil",
            onClick: () => frontRoutes.home().push(),
          },
        ]}
      />
    );
  if (isSignAssessmentSuccess)
    return (
      <FullPageFeedback
        title="Votre bilan d'immersion a bien été signé"
        illustration={commonIllustrations.documentsAdministratifs}
        content={
          <>
            <p>
              Merci pour votre retour, votre signature a bien été prise en
              compte.
            </p>
            <p>
              Un lien vous permettant de télécharger le bilan d’immersion au
              format PDF vous sera envoyé par email dans les prochaines minutes,
              ainsi qu’à votre tuteur et votre accompagnateur.
            </p>
            <p>
              Ce document pourra vous servir de support pour vos démarches et
              vos échanges futurs.
            </p>
          </>
        }
        buttons={[
          {
            children: "Consulter le bilan",
            priority: "primary",
            type: "button",
            onClick: () => {
              dispatch(
                feedbackSlice.actions.clearFeedbackTopics(["sign-assessment"]),
              );
              dispatch(
                assessmentSlice.actions.getAssessmentRequested({
                  conventionId,
                  jwt,
                  feedbackTopic: "assessment",
                }),
              );
            },
          },
          {
            children: "Découvrir d'autres immersions",
            priority: "secondary",
            type: "button",
            onClick: () => frontRoutes.search().push(),
          },
        ]}
      />
    );

  const isAssessmentLegacy = !isAssessmentDto(assessment);
  const isSignedByBeneficiary = !isAssessmentLegacy && !!assessment.signedAt;
  const isBeforeSignatureReleaseDate =
    !isAssessmentLegacy &&
    isBeforeAssessmentSignatureReleaseDate(assessment.createdAt);
  const isSignatureRequired = !(
    isSignedByBeneficiary ||
    assessment.status === "DID_NOT_SHOW" ||
    isBeforeSignatureReleaseDate
  );

  return (
    <MainWrapper layout="default" vSpacing={8}>
      <Feedback topics={["sign-assessment"]} />
      <Document
        logos={logos}
        printButtonLabel={"Imprimer le bilan"}
        title={`Bilan ${
          convention.internshipKind === "immersion"
            ? "de l'immersion professionnelle"
            : "du mini-stage"
        }`}
        beneficiaryName={getFormattedFirstnameAndLastname({
          firstname: convention.signatories.beneficiary.firstName,
          lastname: convention.signatories.beneficiary.lastName,
        })}
        businessName={convention.businessName}
        internshipKind={convention.internshipKind}
        showPrintButton={!isSignatureRequired}
        customActions={
          !isSignatureRequired
            ? [
                <Button
                  key={"htmlToPdfButton"}
                  priority="secondary"
                  onClick={() =>
                    generateAndDownloadPdf({
                      conventionId,
                      prefix: "bilan",
                      jwt,
                    })
                  }
                  className={fr.cx("fr-mr-1w")}
                  id={domElementIds.assessmentDocument.downloadPdfButton}
                >
                  Télécharger en PDF
                </Button>,
              ]
            : []
        }
      >
        <h2 className={fr.cx("fr-h4")}>
          Identifiant de la convention: {convention.id}
        </h2>
        <p>
          {convention.internshipKind === "immersion"
            ? "Cette immersion s'est déroulée"
            : "Ce mini-stage s'est déroulé"}{" "}
          du{" "}
          {toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateStart),
            ),
          })}{" "}
          au{" "}
          {toDisplayedDate({
            date: convertLocaleDateToUtcTimezoneDate(
              new Date(convention.dateEnd),
            ),
          })}{" "}
          au sein de <strong>{convention.businessName}</strong> (Siret n° :{" "}
          <a
            href={makeSiretDescriptionLink(convention.siret)}
            target="_blank"
            rel="noreferrer"
          >
            {convention.siret}
          </a>
          ) à l'adresse suivante <strong>{convention.immersionAddress}</strong>.
        </p>
        <ul>
          <li>
            <strong>Métier observé :</strong>{" "}
            {convention.immersionAppellation.appellationLabel}
          </li>
          <li>
            <strong>
              Objectif{" "}
              {convention.internshipKind === "immersion"
                ? "de l'immersion"
                : "du mini-stage"}{" "}
              :
            </strong>{" "}
            {convention.immersionObjective}
          </li>
        </ul>
        <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>
          Évaluation du tuteur{" "}
          {convention.internshipKind === "immersion"
            ? "de l'immersion"
            : "du mini-stage"}
        </h2>
        <p>
          <strong>Tuteur :</strong>{" "}
          {getFormattedFirstnameAndLastname({
            firstname: convention.establishmentTutor.firstName,
            lastname: convention.establishmentTutor.lastName,
          })}
        </p>
        <ul>
          {!isAssessmentLegacy && (
            <li>
              <strong>
                {convention.internshipKind === "immersion"
                  ? "Immersion réalisée"
                  : "Mini-stage réalisé"}{" "}
                :
              </strong>{" "}
              {assessment.status === "DID_NOT_SHOW" ? "Non" : "Oui"}
            </li>
          )}
          {isAssessmentLegacy && (
            <li>
              <strong>
                {convention.internshipKind === "immersion"
                  ? "Immersion complète"
                  : "Mini-stage complet"}{" "}
                :
              </strong>{" "}
              {assessment.status === "ABANDONED" ? "Non" : "Oui"}
            </li>
          )}
          {assessment.status === "COMPLETED" && (
            <>
              <li>
                <strong>Nombre total d'heures :</strong>{" "}
                {computeTotalHours({
                  convention,
                  numberOfMissedHours: 0,
                  lastDayOfPresence: undefined,
                  status: assessment.status,
                })}
              </li>
              <li>
                <strong>Date réelle de fin :</strong>{" "}
                {toDisplayedDate({
                  date: new Date(convention.dateEnd),
                  withHours: false,
                })}
              </li>
            </>
          )}
          {assessment.status === "PARTIALLY_COMPLETED" && (
            <>
              <li>
                <strong>Nombre total d'heures :</strong>{" "}
                {computeTotalHours({
                  convention,
                  numberOfMissedHours: assessment.numberOfMissedHours,
                  lastDayOfPresence: assessment.lastDayOfPresence,
                  status: assessment.status,
                })}
              </li>
              <li>
                <strong>Date réelle de fin :</strong>{" "}
                {toDisplayedDate({
                  date: new Date(assessment.lastDayOfPresence),
                  withHours: false,
                })}
              </li>
            </>
          )}
          {!isAssessmentLegacy && (
            <>
              <li>
                <strong>Embauche :</strong>{" "}
                {assessment.endedWithAJob ? "Oui" : "Non"}
              </li>
              {assessment.endedWithAJob && (
                <>
                  <li>
                    <strong>Date d'embauche :</strong>{" "}
                    {toDisplayedDate({
                      date: convertLocaleDateToUtcTimezoneDate(
                        new Date(assessment.contractStartDate),
                      ),
                    })}
                  </li>
                  <li>
                    <strong>Type de contrat :</strong>{" "}
                    {assessment.typeOfContract}
                  </li>
                </>
              )}
            </>
          )}
        </ul>
        <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>Appréciation générale</h2>
        <p
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              escapeHtml(assessment.establishmentFeedback).replace(
                /\n/g,
                "<br />",
              ),
            ),
          }}
        />
        {!isAssessmentLegacy && (
          <>
            <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>
              Conseils pour la suite
            </h2>
            <p
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  escapeHtml(assessment.establishmentAdvices).replace(
                    /\n/g,
                    "<br />",
                  ),
                ),
              }}
            />
            {!isAssessmentLegacy &&
              !isBeforeSignatureReleaseDate &&
              assessment.status !== "DID_NOT_SHOW" && (
                <>
                  <h2 className={fr.cx("fr-h4", "fr-mt-4w")}>
                    Signature de la personne en immersion
                  </h2>
                  {isSignedByBeneficiary ? (
                    <>
                      <p>
                        Personne en immersion :{" "}
                        {getFormattedFirstnameAndLastname({
                          firstname:
                            convention.signatories.beneficiary.firstName,
                          lastname: convention.signatories.beneficiary.lastName,
                        })}
                      </p>
                      <ul>
                        <li>
                          <strong>Choix exprimés :</strong>{" "}
                          {assessment.beneficiaryAgreement
                            ? "J'ai bien lu, je suis d'accord"
                            : "J'ai bien lu, je ne suis pas d'accord"}
                        </li>
                        {assessment.signedAt && (
                          <li>
                            <strong>Date de signature :</strong>{" "}
                            {toDisplayedDate({
                              date: new Date(assessment.signedAt),
                              withHours: false,
                            })}
                          </li>
                        )}
                      </ul>

                      {assessment.beneficiaryFeedback && (
                        <>
                          <strong>Commentaire :</strong>
                          <p>{assessment.beneficiaryFeedback}</p>
                        </>
                      )}
                    </>
                  ) : (
                    <p>
                      La personne en immersion n'a pas encore signé ce bilan. Ce
                      document est une version provisoire et ne constitue pas un
                      bilan finalisé.
                    </p>
                  )}
                </>
              )}
          </>
        )}
        <hr className={fr.cx("fr-hr", "fr-mb-6w", "fr-mt-10w")} />
        <footer className={fr.cx("fr-text--xs")}>
          <p>
            Ce document a été rédigé dans le cadre{" "}
            {convention.internshipKind === "immersion"
              ? "de l'immersion professionnelle réalisée"
              : "du mini-stage réalisé"}{" "}
            par{" "}
            {getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
              firstname: convention.signatories.beneficiary.firstName,
            })}{" "}
            chez {convention.businessName}. Il peut être utilisé comme référence
            lors de futurs entretiens ou dans le dossier de candidature pour
            valoriser l'expérience acquise au sein de l'entreprise d'accueil.
          </p>
          <p>
            Nous vous encourageons à conserver ce PDF comme preuve officielle de
            votre immersion et des compétences développées, en vue de vos
            futures candidatures.
          </p>
        </footer>
      </Document>
      {isBeneficiary && isSignatureRequired && (
        <>
          <div
            className={fr.cx("fr-container", "fr-grid-row--center")}
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              boxSizing: "border-box",
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                width: "100%",
                background: "var(--background-raised-grey)",
                borderTop: "1px solid var(--border-default-grey)",
                padding: ".3rem",
              }}
            >
              <Button
                priority="primary"
                type="button"
                iconId="fr-icon-pencil-line"
                iconPosition="left"
                id={
                  domElementIds.assessmentDocument.openSignAssessmentModalButton
                }
                className={fr.cx("fr-mr-2w", "fr-my-1w")}
                onClick={() => openAssessmentSignModal()}
              >
                Signer le bilan
              </Button>
            </div>
          </div>
          {createPortal(
            <AssessmentSignModal title="Signature du bilan">
              <AssessmentSignModalContent
                conventionId={conventionId}
                jwt={jwt}
                onCloseModal={closeAssessmentSignModal}
              />
            </AssessmentSignModal>,
            document.body,
          )}
        </>
      )}
    </MainWrapper>
  );
};
