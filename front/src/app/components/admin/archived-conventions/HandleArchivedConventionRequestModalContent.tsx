import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import { CopyButton } from "react-design-system";
import {
  type ArchivedConventionRequestToReviewDto,
  domElementIds,
  frontRoutes,
  getFormattedFirstnameAndLastname,
} from "shared";
import { archiveReasonContentMapping } from "src/app/contents/convention-archive/conventionArchive.helpers";

export const HandleArchivedConventionRequestModalContent = ({
  request,
}: {
  request: ArchivedConventionRequestToReviewDto;
}) => {
  const requesterName = getFormattedFirstnameAndLastname({
    firstname: request.requester.firstname,
    lastname: request.requester.lastname,
  });

  return (
    <>
      <p className={fr.cx("fr-text--bold", "fr-mb-1w")}>Résumé de la demande</p>
      <ul className={fr.cx("fr-mb-3w")}>
        <li>
          Demandeur : {requesterName} ({request.requester.email})
        </li>
        <li>Raison : {archiveReasonContentMapping[request.reason]}</li>
        {request.reason === "other" && <li>{request.otherReason}</li>}
      </ul>
      <p className={fr.cx("fr-text--bold", "fr-mb-1w")}>Convention demandée</p>
      {request.conventionSearchMethod === "withConventionId" ? (
        <ConventionIdDetails request={request} />
      ) : (
        <ConventionDetailsWithoutId request={request} />
      )}
      <Alert
        severity="info"
        small
        className={fr.cx("fr-mt-3w")}
        description="Le renvoi des documents n'est pas encore automatisé. Veuillez envoyer manuellement la convention et le bilan en PDF par e-mail au demandeur avant de marquer cette tâche comme traitée."
      />
    </>
  );
};

const ConventionIdDetails = ({
  request,
}: {
  request: Extract<
    ArchivedConventionRequestToReviewDto,
    { conventionSearchMethod: "withConventionId" }
  >;
}) => (
  <>
    <p className={fr.cx("fr-mb-2w")}>
      ID {request.conventionId}{" "}
      <CopyButton
        label="Copier"
        textToCopy={request.conventionId}
        withIcon
        iconOnly
      />
    </p>
    <Button
      priority="secondary"
      iconId="fr-icon-external-link-line"
      iconPosition="right"
      linkProps={{
        ...frontRoutes.adminConventionDetail({
          conventionId: request.conventionId,
        }).link,
        target: "_blank",
      }}
    >
      Accéder à la convention
    </Button>
  </>
);

const ConventionDetailsWithoutId = ({
  request,
}: {
  request: Extract<
    ArchivedConventionRequestToReviewDto,
    { conventionSearchMethod: "withConventionDetails" }
  >;
}) => (
  <ul>
    <li>
      Candidat :{" "}
      {getFormattedFirstnameAndLastname({
        firstname: request.beneficiaryFirstName,
        lastname: request.beneficiaryLastName,
      })}
    </li>
    <li>SIRET : {request.siret}</li>
    <li>Date estimée de l'immersion : {request.immersionDate}</li>
  </ul>
);
