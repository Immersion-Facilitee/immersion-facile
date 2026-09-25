import { createConsentManagement } from "@codegouvfr/react-dsfr/consentManagement";

type PianoConsent = {
  pianoMode: "optin" | "optout";
};

declare global {
  interface Window {
    pianoConsent?: PianoConsent;
  }
}

export const { ConsentBannerAndConsentManagement, useConsent } =
  createConsentManagement({
    finalityDescription: () => ({
      statistics: {
        title: "Mesure d'audience",
        description:
          "Nous utilisons des cookies pour mesurer l’audience de notre site et améliorer son contenu.",
        subFinalities: {
          metabase: {
            title: "Metabase",
            description: (
              <>
                <p>
                  Metabase est un outil de visualisation de données qui nous
                  permet de suivre les données et produire des tableaux de bord.
                  Il peut déposer 1 cookie sur votre navigateur.
                </p>
                <p>
                  <a
                    href="https://www.metabase.com/hosting/subprocessors/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir le site officiel
                  </a>
                  .
                </p>
              </>
            ),
          },
        },
      },
      support: {
        title: "Support et assistance utilisateur",
        description:
          "Nous utilisons des cookies pour vous proposer la fonctionnalité de contact par chat avec le support d'Immersion Facilitée.",
        subFinalities: {
          crisp: {
            title: "Crisp",
            description: (
              <>
                <p>
                  Crisp est un outil de chat qui nous permet de vous proposer la
                  fonctionnalité de contact par chat avec le support d'Immersion
                  Facilitée. Il peut déposer 5 cookies sur votre navigateur.
                </p>
                <p>
                  <a
                    href="https://crisp.chat/fr/privacy/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir le site officiel
                  </a>
                </p>
              </>
            ),
          },
        },
      },
    }),
    personalDataPolicyLinkProps: {
      href: "/pages/politique-de-confidentialite",
    },
  });

export const getConsentModal = () => {
  const modalElement = document.querySelector("#fr-consent-modal");
  return {
    modalElement,
    modalElementDSFR: modalElement
      ? (window as any).dsfr(modalElement).modal
      : null,
  };
};

export const ConsentManager = () => (
  <section aria-label="Gestion des cookies">
    <ConsentBannerAndConsentManagement />
  </section>
);
