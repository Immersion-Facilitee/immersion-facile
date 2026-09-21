import Alert from "@codegouvfr/react-dsfr/Alert";
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { ModalProps } from "@codegouvfr/react-dsfr/Modal";
import {
  type AgencyRight,
  domElementIds,
  type Email,
  type UserId,
} from "shared";
import { Feedback } from "../feedback/Feedback";

export const SelfRemoveUserAgencyRightFeedback = () => (
  <Feedback
    topics={["agency-user-right-self"]}
    render={({ title, level, message }) => (
      <Alert
        title={title}
        description={
          level === "error" ? (
            <>
              Impossible de procéder à votre détachement pour le moment.
              Veuillez réessayer ultérieurement ou contacter le support.
              <br />
              {message}
            </>
          ) : (
            `Vous avez bien été détaché de l'organisme. Vous n'avez désormais plus accès à ses conventions, bilans et statistiques.`
          )
        }
        severity={level}
        small
      />
    )}
  />
);

export type UserRightToRemove = {
  agencyRight: AgencyRight;
  userEmail: Email;
  userId: UserId;
  isSelfRemoval: boolean;
};

export const makeRemoveUserAgencyRightsButtonProps = ({
  userRightToRemove,
  removeUserButtonId,
  size,
  onDeleteClicked,
}: {
  removeUserButtonId: string;
  userRightToRemove: UserRightToRemove;
  onDeleteClicked: (userRightToRemove: UserRightToRemove) => void;
  size?: ButtonProps.Common["size"];
}): ButtonProps => ({
  children: userRightToRemove.isSelfRemoval ? "Me détacher" : "Supprimer",
  priority: "secondary",
  disabled:
    userRightToRemove.agencyRight.agency.refersToAgencyId !== null &&
    userRightToRemove.agencyRight.roles.includes("validator"),
  id: removeUserButtonId,
  onClick: () => onDeleteClicked(userRightToRemove),
  size,
});

export const makeRemoveUserAgencyRightsModalProps = ({
  userRightToRemove,
  onCancel,
  onSubmitted,
}: {
  userRightToRemove: UserRightToRemove;
  onSubmitted: (userRightToRemove: UserRightToRemove) => void;
  onCancel: () => void;
}): ModalProps => ({
  title:
    userRightToRemove.isSelfRemoval === true
      ? `Se détacher de ${userRightToRemove.agencyRight.agency.name}`
      : "Confirmer la suppression",
  children: (
    <>
      {makeDescriptionFromUserRightToRemove(userRightToRemove)}

      <ButtonsGroup
        inlineLayoutWhen="always"
        buttons={[
          {
            priority: "secondary",
            children: "Annuler",
            onClick: onCancel,
          },
          {
            id: domElementIds.admin.agencyTab
              .editAgencyRemoveUserConfirmationButton,
            priority: "primary",
            children: userRightToRemove.isSelfRemoval
              ? "Me détacher"
              : "Supprimer le rattachement",
            onClick: () => onSubmitted(userRightToRemove),
          },
        ]}
      />
    </>
  ),
});

const makeDescriptionFromUserRightToRemove = (
  userRightToRemove: UserRightToRemove,
): React.JSX.Element => {
  if (!userRightToRemove.isSelfRemoval)
    return (
      <>
        <p>
          Vous êtes sur le point de supprimer le rattachement de{" "}
          {userRightToRemove.userEmail} à l'agence "
          {userRightToRemove.agencyRight.agency.name}".
        </p>
        <p>Souhaitez-vous continuer ?</p>
      </>
    );

  return userRightToRemove.agencyRight.roles.includes("agency-admin") ? (
    <>
      <p>
        Vous êtes sur le point de vous détacher de cet organisme. En tant
        qu'administrateur, vous perdrez tous vos droits de gestion ainsi que
        l'accès aux données qui y sont liés.
      </p>
      <p>Êtes-vous sûr de vouloir continuer ?</p>
    </>
  ) : (
    <p>
      Êtes-vous sûr de vouloir quitter cet organisme ? Vous perdrez
      immédiatement l'accès à l'ensemble des conventions, bilans, statistiques
      et fonctionnalités qui y sont liés.
    </p>
  );
};
