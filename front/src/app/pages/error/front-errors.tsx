import Button from "@codegouvfr/react-dsfr/Button";
import type { ReactElement } from "react";
import {
  type ConventionId,
  domElementIds,
  type Email,
  expiredJwtErrorTitle,
  frontRoutes,
  type SiretDto,
} from "shared";
import { immersionFacileSupportUrl } from "src/app/components/layout/LayoutFooter";
import type {
  ContactErrorInformation,
  ErrorButton,
  FrontErrorProps,
} from "src/app/contents/error/types";

export class FrontSpecificError extends Error {
  public props: FrontErrorProps;

  constructor(props: FrontErrorProps) {
    super();
    this.props = props;
  }
}

export const frontErrors = {
  auth: {
    expiredJwt: ({ RenewJwtButton }: { RenewJwtButton: ReactElement }) =>
      new FrontSpecificError({
        title: expiredJwtErrorTitle,
        description: (
          <>
            <p>
              Pour des raisons de sécurité, les liens de connexion sont valables
              pendant une durée limitée.
            </p>
            <p>
              Vous pouvez demander un nouveau lien ci-dessous. Il vous sera
              envoyé par email dans les 2 à 3 minutes.
            </p>
            <p>
              Vous n'avez pas reçu le lien ?{" "}
              <a
                href={immersionFacileSupportUrl}
                target="_blank"
                rel="noreferrer"
              >
                Contactez-nous
              </a>
            </p>
          </>
        ),
        buttons: [RenewJwtButton],
      }),
  },
  jwtLink: {
    expired: ({ RenewJwtButton }: { RenewJwtButton: ReactElement }) =>
      new FrontSpecificError({
        title: "Votre lien a expiré",
        description: (
          <>
            <p>
              Pour des raisons de sécurité, les liens sont valables pendant une
              durée limitée.
            </p>
            <p>
              Vous pouvez demander un nouveau lien ci-dessous. Il vous sera
              envoyé par email dans les 2 à 3 minutes.
            </p>
          </>
        ),
        buttons: [RenewJwtButton],
      }),
  },
  generic: {
    temporaryError: () =>
      new FrontSpecificError({
        title: "Une erreur technique est survenue",
        description: "Veuillez réessayer plus tard.",
        buttons: [HomeButton],
      }),
    backendUnreachable: () =>
      new FrontSpecificError({
        title: "Immersion Facilitée est momentanément indisponible",
        description: (
          <>
            <p>
              Ce problème est temporaire. Veuillez réessayer d'ici quelques
              minutes.
            </p>
            <p>
              Si le problème persiste :{" "}
              <a
                href={immersionFacileSupportUrl}
                target="_blank"
                rel="noreferrer"
              >
                contactez-nous
              </a>
            </p>
          </>
        ),
        buttons: [HomeButton],
      }),
    pageNotFound: () =>
      new FrontSpecificError({
        title: "Page non trouvée",
        subtitle: "La page que vous cherchez est introuvable.",
        description: (
          <>
            <p>
              La page que vous cherchez est introuvable. Si vous avez tapé
              l'adresse web dans le navigateur, vérifiez qu'elle est correcte.
              La page n’est peut-être plus disponible.
              <br />
              Dans ce cas, pour continuer votre visite vous pouvez consulter
              notre page d’accueil, ou effectuer une recherche avec notre moteur
              de recherche en haut de page.
            </p>
            <p>
              Sinon contactez-nous pour que l’on puisse vous rediriger vers la
              bonne information.
            </p>
          </>
        ),
        buttons: [HomeButton, ContactUsButton()],
      }),
    unauthorized: () => {
      const description = "Vous n'êtes pas autorisé à accéder à cette page.";
      return new FrontSpecificError({
        title: "Non-autorisé",
        description,
        buttons: [HomeButton, ContactUsButton()],
      });
    },
    wrongRoute: ({
      supportedRoutes,
      originalRoute,
    }: {
      supportedRoutes: string[];
      originalRoute: string;
    }) => {
      const description = `La page à laquelle vous essayez d'accéder est mal configurée. Les routes supportées sont : ${supportedRoutes.join(", ")}. La route originale est : ${originalRoute}.`;
      return new FrontSpecificError({
        title: "Erreur technique",
        description,
        buttons: [HomeButton, ContactUsButton()],
      });
    },
  },
  convention: {
    cancelled: ({
      conventionId,
      justificationStatus,
      agencyName,
    }: {
      conventionId: ConventionId;
      justificationStatus?: string;
      agencyName: string;
    }) =>
      new FrontSpecificError({
        title: "Demande annulée",
        subtitle: `La demande de convention ${conventionId} n'est plus accessible.`,
        description: `${
          justificationStatus
            ? `Elle a été annulée pour le motif suivant : ${justificationStatus}<br><br>`
            : ""
        } Merci de vous rapprocher de votre conseiller. Pour rappel, l'agence indiquée sur votre convention était : ${agencyName}.`,
        buttons: [
          <Button
            key={"im-error__faq-button"}
            linkProps={{
              href: "https://immersion-facile.beta.gouv.fr/aide/",
              target: "_blank",
            }}
          >
            Accéder à la FAQ
          </Button>,
        ],
      }),
    externalConsumerNotFound: ({ consumerName }: { consumerName: string }) => {
      const description = `Nous n'avons aucun partenaire avec le nom : ${consumerName}. Veuillez vérifier l'orthographe.`;
      return new FrontSpecificError({
        title: "Partenaire inconnu",
        description,
        buttons: [HomeButton, ContactUsButton()],
      });
    },
    badSchema: ({
      conventionId,
      errorMessage,
      issues,
    }: {
      conventionId: ConventionId;
      errorMessage: string;
      issues?: string[];
    }) =>
      new FrontSpecificError({
        title: "Affichage de la convention impossible",
        description: (
          <>
            <p>
              Un incident technique empêche l'affichage de cette convention.
              Cela peut être dû par exemple à une incohérence dans ses données
              (ex : durée journalière, dates ou formats invalides).
            </p>
            <ul>
              <li>ID de la convention : {conventionId}</li>
              <li>Type d'erreur : {errorMessage}</li>
              {issues && (
                <>
                  <li>Problèmes rencontrés :</li>
                  <ul>
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </>
              )}
            </ul>
            <p>
              Pour corriger cette situation et accéder à nouveau à la
              convention, veuillez contacter le support d'Immersion Facilitée.
            </p>
          </>
        ),
        buttons: [ContactUsButton()],
      }),
    noRightsOnConvention: ({
      userEmail,
      conventionId,
    }: {
      userEmail: Email;
      conventionId: ConventionId;
    }) =>
      new FrontSpecificError({
        title: "Accès non autorisé",
        description: (
          <>
            <p>
              L’accès à cette convention n’est pas possible avec le compte
              actuel ({userEmail}). Ce compte n’a aucun droit sur la convention.
            </p>
            <ul>
              <li>ID de la convention : {conventionId}</li>
            </ul>
            <p>
              Pour accéder à cette convention, contactez l’agence afin de
              vérifier ou mettre à jour les droits.
            </p>
          </>
        ),
        buttons: [HomeButton, ContactUsButton()],
      }),
  },
  conventionDraft: {
    notFound: () =>
      new FrontSpecificError({
        title: "Ce brouillon de convention n'existe plus",
        description: (
          <>
            <p>Ce brouillon n'est plus accessible, soit car :</p>
            <ul>
              <li>
                <strong>Le brouillon a expiré :</strong> Les brouillons sont
                supprimés automatiquement après 30 jours sans modification.
              </li>
              <li>
                <strong>Une convention a déjà été créée</strong> à partir de ce
                brouillon.
              </li>
            </ul>
            <p>
              Si besoin, vous pouvez créer une nouvelle demande de convention.
            </p>
          </>
        ),
        buttons: [
          <Button
            key="InitiateConventionButton"
            priority="primary"
            linkProps={{
              ...frontRoutes.initiateConvention().link,
              id: domElementIds.temporaryError.initiateConventionButton,
            }}
          >
            Créer une demande de convention
          </Button>,
        ],
      }),
  },
  establishment: {
    notFound: ({ siret }: { siret?: SiretDto }) => {
      const description = `Nous n'avons trouvé aucun établissement ${siret ? `avec le siret ${siret}` : ""}.`;
      return new FrontSpecificError({
        title: "Établissment non trouvé",
        description,
        buttons: [HomeButton, ContactUsButton()],
      });
    },
    expiredLink: () =>
      new FrontSpecificError({
        title: "Lien périmé",
        description: `Nous n'utilisons plus de lien magique pour vous permettre de modifier votre fiche établissement. Pour effectuer cette action, connectez-vous à votre espace entreprise.`,
        buttons: [EstablishmentDashboardButton],
      }),
  },
};

const EstablishmentDashboardButton: ErrorButton = (
  <Button
    priority="primary"
    linkProps={{
      ...frontRoutes.establishmentDashboard().link,
      id: domElementIds.temporaryError.establishmentDashboardButton,
    }}
  >
    Accéder à mon espace entreprise
  </Button>
);

export const HomeButton: ErrorButton = (
  <Button
    priority="primary"
    linkProps={{
      ...frontRoutes.home().link,
      id: domElementIds.temporaryError.homeButton,
    }}
  >
    Page d'accueil
  </Button>
);

export const ContactUsButton = ({
  priority = "secondary",
}: ContactErrorInformation = {}) => (
  <Button
    priority={priority}
    linkProps={{
      href: `${immersionFacileSupportUrl}`,
      target: "_blank",
      id: domElementIds.temporaryError.contactUsButton,
    }}
  >
    Contactez-nous
  </Button>
);
